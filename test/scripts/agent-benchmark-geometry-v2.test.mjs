import { describe, expect, it } from "vitest";
import {
  snapshotGeometryNumericArrays,
  numericFieldReader,
  GEOMETRY_V2_LIMITS,
} from "../../tools/agent-benchmark/geometry-codec-v2.mjs";
import { inspectMesh } from "../../tools/agent-benchmark/contract.mjs";
import {
  decodeNumericSnapshotV2,
  inspectNumericMeshV2,
  canonicalGeometryHashV2,
  effectiveMatrixReaderV2,
  addSemanticMatricesV2,
  semanticDigestV2,
  verifyPositionWitnessV2,
} from "../../tools/agent-benchmark/geometry-data-v2.mjs";
import {
  createPositionParityMatcherV2,
  matchPositionStreamV2,
} from "../../tools/agent-benchmark/position-parity-v2.mjs";
import { trialEvidenceFiles } from "../../tools/agent-benchmark/score-round.mjs";
import { rewriteRetainedSegmentsV2 } from "../../tools/agent-benchmark/upload-segments-v2.mjs";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const triangle = () => ({
  id: "triangle",
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  worldMatrix: identity.slice(),
});
function decode(meshes) {
  const { chunks, ...numeric } = snapshotGeometryNumericArrays(meshes);
  return decodeNumericSnapshotV2(numeric, chunks);
}
async function semantic(meshes) {
  const map = new Map();
  for (const mesh of decode(meshes))
    addSemanticMatricesV2(
      map,
      await canonicalGeometryHashV2(mesh),
      effectiveMatrixReaderV2(mesh),
    );
  return semanticDigestV2(map);
}
const nativeBuffer = (positions) => ({
  id: 1,
  usage: 32,
  requestedBytes: positions.byteLength,
  segments: [
    {
      offset: 0,
      bytes: new Uint8Array(
        positions.buffer,
        positions.byteOffset,
        positions.byteLength,
      ),
    },
  ],
});

describe("lossless bounded numeric geometry v2", () => {
  it("joins scored geometry to the explicit v2 manifest and preserves legacy file selection", () => {
    expect(trialEvidenceFiles({}).geometry).toBe("geometry.json");
    expect(
      trialEvidenceFiles({
        artifactProtocol: "aperture.agent-house-artifacts.v2",
      }).geometry,
    ).toBe("geometry-manifest-v2.json");
    expect(() => trialEvidenceFiles({ artifactProtocol: "unknown" })).toThrow(
      /Unknown/,
    );
  });
  it("retains Float64 Number precision, typed subarrays, signed zero, normals, indices, both matrix sources and row container types", () => {
    const exact = 1 + 2 ** -40,
      backing = new Float32Array([99, 0, 0, 0, 1, 0, 0, 0, 1, 0, 99]);
    const mesh = {
      id: "typed",
      positions: backing.subarray(1, 10),
      indices: new Uint16Array([0, 1, 2]),
      normals: new Int8Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      worldMatrix: new Float64Array(identity),
      instances: [identity.slice(), new Float32Array(identity)],
    };
    const other = {
      id: "numbers",
      positions: [-0, exact, 0, 1, 0, 0, 0, 1, 0],
      worldMatrix: identity.slice(),
    };
    const snapshot = snapshotGeometryNumericArrays([mesh, other], {
      ...GEOMETRY_V2_LIMITS,
      chunkBytes: 32,
    });
    expect(snapshot.chunks.every((chunk) => chunk.length <= 32)).toBe(true);
    const fields = snapshot.meshes;
    expect(fields[0].positions.dtype).toBe("f32le");
    expect(fields[0].indices.dtype).toBe("u16le");
    expect(fields[0].normals.dtype).toBe("i8");
    expect(fields[0].instances.sourceTypeRuns).toEqual([
      { sourceType: "Array", count: 1 },
      { sourceType: "Float32Array", count: 1 },
    ]);
    expect(
      Array.from(numericFieldReader(fields[0].positions, snapshot.chunks, 32)),
    ).toEqual(Array.from(mesh.positions));
    const numbers = numericFieldReader(
      fields[1].positions,
      snapshot.chunks,
      32,
    );
    expect(Object.is(numbers.get(0), -0)).toBe(true);
    expect(numbers.get(1)).toBe(exact);
    expect(
      numericFieldReader(fields[0].worldMatrix, snapshot.chunks, 32).length,
    ).toBe(16);
    expect(
      numericFieldReader(fields[0].instances, snapshot.chunks, 32).length,
    ).toBe(32);
  });
  it("bounds arrays/work/metadata before transfer and rejects sparse, live shared or nonfinite arrays", () => {
    expect(() =>
      snapshotGeometryNumericArrays([triangle()], {
        ...GEOMETRY_V2_LIMITS,
        geometryBytes: 8,
      }),
    ).toThrow(/byte budget/);
    expect(() =>
      snapshotGeometryNumericArrays(
        [{ ...triangle(), instances: [identity, identity] }],
        { ...GEOMETRY_V2_LIMITS, transformedVertices: 5 },
      ),
    ).toThrow(/work budget/);
    expect(() =>
      snapshotGeometryNumericArrays(
        [{ ...triangle(), instances: [identity, new Float32Array(identity)] }],
        { ...GEOMETRY_V2_LIMITS, matrixSourceTypeRuns: 1 },
      ),
    ).toThrow(/metadata budget/);
    expect(() =>
      snapshotGeometryNumericArrays([{ ...triangle(), positions: Array(9) }]),
    ).toThrow(/Nonfinite/);
    expect(() =>
      snapshotGeometryNumericArrays([
        { ...triangle(), positions: [Infinity, 0, 0, 1, 0, 0, 0, 1, 0] },
      ]),
    ).toThrow(/Nonfinite/);
    expect(() =>
      snapshotGeometryNumericArrays([
        {
          ...triangle(),
          positions: new Float32Array(new SharedArrayBuffer(36)),
        },
      ]),
    ).toThrow(/owned coherent/);
  });
  it("matches original exact facts while validating indices, affine transforms and numeric layout", () => {
    const translated = identity.slice();
    translated[12] = 2;
    const mesh = {
      ...triangle(),
      indices: new Uint32Array([0, 1, 2]),
      instances: [identity, translated],
    };
    const facts = inspectNumericMeshV2(decode([mesh])[0]),
      old = inspectMesh(mesh);
    for (const key of Object.keys(facts)) expect(facts[key]).toEqual(old[key]);
    expect(() =>
      inspectNumericMeshV2(
        decode([{ ...mesh, indices: new Uint32Array([0, 1, 3]) }])[0],
      ),
    ).toThrow(/index out of range/);
    const nonaffine = identity.slice();
    nonaffine[3] = 1;
    expect(() =>
      inspectNumericMeshV2(
        decode([{ ...triangle(), worldMatrix: nonaffine }])[0],
      ),
    ).toThrow(/Nonaffine/);
    const { chunks, ...numeric } = snapshotGeometryNumericArrays([triangle()]);
    numeric.meshes[0].worldMatrix.byteOffset++;
    expect(() => decodeNumericSnapshotV2(numeric, chunks)).toThrow(
      /overlap\/gap/,
    );
  });
  it("normalizes container differences and implicit indices while binding normals, indices, precise transforms and multiplicity", async () => {
    const first = triangle(),
      other = {
        ...triangle(),
        id: "other",
        positions: Array.from(first.positions),
        normals: Array.from(first.normals),
        indices: [0, 1, 2],
      };
    expect(await canonicalGeometryHashV2(decode([first])[0])).toBe(
      await canonicalGeometryHashV2(decode([other])[0]),
    );
    expect(await semantic([first])).toBe(await semantic([other]));
    expect(await semantic([{ ...other, indices: [0, 2, 1] }])).not.toBe(
      await semantic([first]),
    );
    const normals = Array.from(first.normals);
    normals[0] = 2 ** -40;
    expect(await semantic([{ ...other, normals }])).not.toBe(
      await semantic([first]),
    );
    const shifted = identity.slice();
    shifted[12] = 2 ** -40;
    expect(await semantic([{ ...other, worldMatrix: shifted }])).not.toBe(
      await semantic([first]),
    );
    expect(
      await semantic([{ ...first, instances: [identity, identity] }]),
    ).toBe(await semantic([first, { ...first, id: "copy" }]));
    expect(
      await semantic([{ ...first, instances: [identity, identity] }]),
    ).not.toBe(await semantic([first]));
  });
  it("reuses a positive native witness for duplicate canonical geometry, preserves multiplicity and searches altered positions", async () => {
    const first = triangle(),
      decoded = decode([first])[0],
      hash = await canonicalGeometryHashV2(decoded);
    const matcher = createPositionParityMatcherV2([
        nativeBuffer(first.positions),
      ]),
      witnesses = [];
    for (let i = 0; i < 1000; i++)
      witnesses.push(matcher.match(hash, decoded.positions));
    expect(matcher.snapshot().searches).toBe(1);
    expect(matcher.snapshot().cacheHits).toBe(999);
    expect(
      witnesses.every(
        (item) => JSON.stringify(item) === JSON.stringify(witnesses[0]),
      ),
    ).toBe(true);
    verifyPositionWitnessV2(decoded.positions, witnesses[0], [
      nativeBuffer(first.positions),
    ]);
    const changed = triangle();
    changed.positions[0] = 5;
    const next = decode([changed])[0];
    expect(
      matcher.match(await canonicalGeometryHashV2(next), next.positions)
        .matched,
    ).toBe(false);
    expect(matcher.snapshot().searches).toBe(2);
    const facts = inspectNumericMeshV2(
      decode([
        { ...first, instances: Array.from({ length: 1000 }, () => identity) },
      ])[0],
    );
    expect(facts.instances).toBe(1000);
    expect(facts.instancedTriangles).toBe(1000);
  });
  it("enforces search work caps and checks every claimed native position rather than only bounds", () => {
    const mesh = triangle(),
      positions = decode([mesh])[0].positions,
      buffer = nativeBuffer(mesh.positions);
    expect(
      matchPositionStreamV2(
        positions,
        [buffer],
        { comparisons: 0 },
        { ...GEOMETRY_V2_LIMITS, parityComparisonsTotal: 2 },
      ).reason,
    ).toBe("comparison-budget-exhausted");
    const witness = matchPositionStreamV2(positions, [buffer], {
      comparisons: 0,
    });
    buffer.segments[0].bytes[16] ^= 1;
    expect(() => verifyPositionWitnessV2(positions, witness, [buffer])).toThrow(
      /position/,
    );
  });
});

describe("final retained upload byte accounting", () => {
  it("subtracts overwritten bytes before the limit and retains exact prefixes/suffixes", () => {
    const original = [{ offset: 0, bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) }];
    const replaced = rewriteRetainedSegmentsV2(
      original,
      0,
      new Uint8Array([6, 5, 4, 3, 2, 1]),
      6,
      8,
    );
    expect(replaced.ok).toBe(true);
    expect(replaced.retainedBytes).toBe(6);
    const partial = rewriteRetainedSegmentsV2(
      original,
      2,
      new Uint8Array([9, 9]),
      6,
      8,
    );
    expect(
      partial.segments.map((part) => [part.offset, Array.from(part.bytes)]),
    ).toEqual([
      [0, [1, 2]],
      [2, [9, 9]],
      [4, [5, 6]],
    ]);
    expect(original[0].bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });
  it("accounts other buffers and removes stale overlapping bytes on true exhaustion", () => {
    const original = [{ offset: 0, bytes: new Uint8Array([1, 2, 3, 4]) }];
    const exhausted = rewriteRetainedSegmentsV2(
      original,
      2,
      new Uint8Array([7, 7, 7, 7]),
      8,
      8,
    );
    expect(exhausted.ok).toBe(false);
    expect(exhausted.retainedBytes).toBe(6);
    expect(exhausted.segments.map((part) => Array.from(part.bytes))).toEqual([
      [1, 2],
    ]);
    expect(exhausted.missing).toEqual({
      offset: 2,
      bytes: 4,
      discardedCaptureBytes: 2,
      reason: "native-capture-byte-budget-exceeded",
    });
  });
});
