import { requireValue } from "./contract.mjs";
import {
  numericFieldReader,
  GEOMETRY_V2_LIMITS,
} from "./geometry-codec-v2.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "./protocol-v2.mjs";

const widths = {
  i8: 1,
  u8: 1,
  i16le: 2,
  u16le: 2,
  i32le: 4,
  u32le: 4,
  f32le: 4,
  f64le: 8,
};
const sourceDtypes = {
  Int8Array: "i8",
  Uint8Array: "u8",
  Uint8ClampedArray: "u8",
  Int16Array: "i16le",
  Uint16Array: "u16le",
  Int32Array: "i32le",
  Uint32Array: "u32le",
  Float32Array: "f32le",
  Float64Array: "f64le",
  Array: "f64le",
  "matrix-list": "f64le",
};
export const jsonBytesV2 = (value) =>
  new TextEncoder().encode(JSON.stringify(value) + "\n");
export const digestV2 = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
export const stableV2 = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );

/** Validate actual declared ownership/layout before exposing any scalar reader. */
export function decodeNumericSnapshotV2(record, chunks) {
  const limit = GEOMETRY_V2_LIMITS;
  requireValue(
    record.schema === "aperture.geometry-numeric-snapshot.v2" &&
      record.chunkCount === chunks.length &&
      stableV2(record.limits) === stableV2(limit) &&
      record.endianness === "little" &&
      record.chunkBytes === limit.chunkBytes &&
      Number.isSafeInteger(record.totalBytes) &&
      record.totalBytes > 0 &&
      record.totalBytes <= limit.geometryBytes &&
      Array.isArray(record.meshes) &&
      record.meshes.length > 0 &&
      record.meshes.length <= limit.meshes &&
      chunks.length === Math.ceil(record.totalBytes / limit.chunkBytes) &&
      chunks.reduce((sum, part) => sum + part.length, 0) === record.totalBytes,
    "Invalid numeric snapshot inventory",
  );
  const ids = new Set(),
    decoded = [];
  let cursor = 0,
    rows = 0,
    runs = 0,
    verticesWork = 0,
    trianglesWork = 0;
  const readByte = (offset) =>
    chunks[Math.floor(offset / limit.chunkBytes)][offset % limit.chunkBytes];
  const field = (descriptor, role, components) => {
    if (descriptor === null) return null;
    requireValue(
      descriptor &&
        descriptor.role === role &&
        descriptor.components === components &&
        sourceDtypes[descriptor.sourceType] === descriptor.dtype &&
        widths[descriptor.dtype] &&
        Number.isSafeInteger(descriptor.elementCount) &&
        descriptor.elementCount > 0 &&
        descriptor.elementCount % components === 0,
      "Invalid numeric source role/dtype/cardinality",
    );
    requireValue(
      role === "instances"
        ? descriptor.sourceType === "matrix-list"
        : descriptor.sourceType !== "matrix-list",
      "Unexpected matrix-list field",
    );
    const expected =
      Math.ceil(cursor / widths[descriptor.dtype]) * widths[descriptor.dtype];
    requireValue(
      descriptor.byteOffset === expected &&
        descriptor.byteLength ===
          descriptor.elementCount * widths[descriptor.dtype] &&
        Number.isSafeInteger(descriptor.byteLength) &&
        expected + descriptor.byteLength <= record.totalBytes,
      "Numeric field overlap/gap/length differs",
    );
    for (let i = cursor; i < expected; i++)
      requireValue(readByte(i) === 0, "Nonzero numeric alignment padding");
    cursor = expected + descriptor.byteLength;
    if (role === "worldMatrix" || role === "instances") {
      rows += descriptor.elementCount / 16;
      requireValue(
        rows <= limit.matrixRows &&
          (role !== "worldMatrix" || descriptor.elementCount === 16),
        "Matrix row budget/cardinality differs",
      );
    }
    if (role === "instances") {
      requireValue(
        Array.isArray(descriptor.sourceTypeRuns) &&
          descriptor.sourceTypeRuns.length > 0,
        "Matrix source type metadata missing",
      );
      let count = 0,
        previous;
      for (const run of descriptor.sourceTypeRuns) {
        requireValue(
          run.sourceType !== "matrix-list" &&
            sourceDtypes[run.sourceType] &&
            run.sourceType !== previous &&
            Number.isSafeInteger(run.count) &&
            run.count > 0,
          "Invalid matrix source type run",
        );
        count += run.count;
        previous = run.sourceType;
        runs++;
      }
      requireValue(
        count === descriptor.elementCount / 16 &&
          runs <= limit.matrixSourceTypeRuns,
        "Matrix source type runs/count differ",
      );
    } else
      requireValue(
        descriptor.sourceTypeRuns === undefined,
        "Unexpected matrix source metadata",
      );
    return numericFieldReader(descriptor, chunks, limit.chunkBytes);
  };
  for (const mesh of record.meshes) {
    requireValue(
      typeof mesh.id === "string" &&
        new TextEncoder().encode(mesh.id).length > 0 &&
        new TextEncoder().encode(mesh.id).length <= 256 &&
        !ids.has(mesh.id),
      "Missing/duplicate/oversized geometry id",
    );
    ids.add(mesh.id);
    const positions = field(mesh.positions, "positions", 3);
    requireValue(positions, "Position field missing");
    const indices = field(mesh.indices, "indices", 3);
    const normals = field(mesh.normals, "normals", 3);
    const worldMatrix = field(mesh.worldMatrix, "worldMatrix", 16);
    const instances = field(mesh.instances, "instances", 16);
    requireValue(worldMatrix || instances, "World/instance matrix missing");
    requireValue(
      !normals || normals.length === positions.length,
      "Normal cardinality differs",
    );
    const vertexCount = positions.length / 3,
      effectiveIndices = indices?.length ?? vertexCount;
    requireValue(effectiveIndices % 3 === 0, "Triangle cardinality differs");
    const instanceCount = instances ? instances.length / 16 : 1;
    verticesWork += vertexCount * instanceCount;
    trianglesWork += (effectiveIndices / 3) * instanceCount;
    requireValue(
      Number.isSafeInteger(verticesWork) &&
        verticesWork <= limit.transformedVertices &&
        Number.isSafeInteger(trianglesWork) &&
        trianglesWork <= limit.instancedTriangles,
      "Exact geometry analysis work budget exceeded",
    );
    decoded.push({
      id: mesh.id,
      positions,
      indices,
      normals,
      worldMatrix,
      instances,
    });
  }
  requireValue(
    cursor === record.totalBytes,
    "Unreferenced trailing numeric bytes",
  );
  return decoded;
}

function affine(matrix, start = 0) {
  for (let i = 0; i < 16; i++)
    requireValue(
      Number.isFinite(matrix.get(start + i)),
      "Nonfinite world/instance matrix",
    );
  requireValue(
    Math.abs(matrix.get(start + 15) - 1) < 1e-6 &&
      [3, 7, 11].every((i) => Math.abs(matrix.get(start + i)) < 1e-6),
    "Nonaffine world/instance matrix",
  );
}

export function effectiveMatrixReaderV2(mesh) {
  return mesh.instances ?? mesh.worldMatrix;
}

/** Same arithmetic/threshold as v1; no all-vertex transformed-point allocation. */
export function inspectNumericMeshV2(mesh) {
  const vertices = mesh.positions.length / 3,
    count = mesh.indices?.length ?? vertices;
  for (const field of [mesh.positions, mesh.normals].filter(Boolean))
    for (let i = 0; i < field.length; i++)
      requireValue(Number.isFinite(field.get(i)), "Nonfinite position/normal");
  if (mesh.indices)
    for (let i = 0; i < mesh.indices.length; i++) {
      const value = mesh.indices.get(i);
      requireValue(
        Number.isInteger(value) && value >= 0 && value < vertices,
        "Triangle index out of range",
      );
    }
  if (mesh.worldMatrix) affine(mesh.worldMatrix);
  const matrices = effectiveMatrixReaderV2(mesh),
    instances = matrices.length / 16;
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  let degenerateTriangles = 0;
  const point = (vertex, start) => {
    const x = mesh.positions.get(vertex * 3),
      y = mesh.positions.get(vertex * 3 + 1),
      z = mesh.positions.get(vertex * 3 + 2);
    return [0, 1, 2].map(
      (axis) =>
        matrices.get(start + axis) * x +
        matrices.get(start + axis + 4) * y +
        matrices.get(start + axis + 8) * z +
        matrices.get(start + axis + 12),
    );
  };
  for (let instance = 0; instance < instances; instance++) {
    const start = instance * 16;
    affine(matrices, start);
    for (let vertex = 0; vertex < vertices; vertex++) {
      const value = point(vertex, start);
      for (let axis = 0; axis < 3; axis++) {
        requireValue(
          Number.isFinite(value[axis]),
          "Nonfinite transformed geometry",
        );
        bounds.min[axis] = Math.min(bounds.min[axis], value[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], value[axis]);
      }
    }
    for (let i = 0; i < count; i += 3) {
      const a = point(mesh.indices?.get(i) ?? i, start),
        b = point(mesh.indices?.get(i + 1) ?? i + 1, start),
        c = point(mesh.indices?.get(i + 2) ?? i + 2, start);
      const u = a.map((value, axis) => b[axis] - value),
        v = a.map((value, axis) => c[axis] - value);
      const squaredArea4 =
        (u[1] * v[2] - u[2] * v[1]) ** 2 +
        (u[2] * v[0] - u[0] * v[2]) ** 2 +
        (u[0] * v[1] - u[1] * v[0]) ** 2;
      if (squaredArea4 <= 1e-20) degenerateTriangles++;
    }
  }
  return {
    id: mesh.id,
    vertices,
    authoredTriangles: count / 3,
    instances,
    instancedTriangles: (count / 3) * instances,
    degenerateTriangles,
    normalsPresent: mesh.normals !== null,
    bounds,
  };
}

async function logicalFieldHash(get, count, dtype, digest) {
  const width = widths[dtype],
    chunks = [],
    length = count * width;
  for (let start = 0; start < count; ) {
    const values = Math.min(
      count - start,
      GEOMETRY_V2_LIMITS.chunkBytes / width,
    );
    const bytes = new Uint8Array(values * width),
      view = new DataView(bytes.buffer);
    for (let i = 0; i < values; i++) {
      const value = get(start + i);
      if (dtype === "f64le")
        view.setFloat64(i * width, value === 0 ? 0 : value, true);
      else view.setUint32(i * width, value, true);
    }
    chunks.push({ bytes: bytes.length, sha256: await digest(bytes) });
    start += values;
  }
  return { dtype, elementCount: count, bytes: length, chunks };
}

export async function canonicalGeometryHashV2(mesh, digest = digestV2) {
  const vertices = mesh.positions.length / 3;
  const positions = await logicalFieldHash(
    (i) => mesh.positions.get(i),
    mesh.positions.length,
    "f64le",
    digest,
  );
  const indices = await logicalFieldHash(
    (i) => mesh.indices?.get(i) ?? i,
    mesh.indices?.length ?? vertices,
    "u32le",
    digest,
  );
  const normals = mesh.normals
    ? await logicalFieldHash(
        (i) => mesh.normals.get(i),
        mesh.normals.length,
        "f64le",
        digest,
      )
    : null;
  return digest(
    jsonBytesV2({
      schema: ARTIFACT_PROTOCOL_V2.normalizedGeometryHash,
      positions,
      indices,
      normals,
    }),
  );
}

/** Exact full matrix bytes form a multiset key; avoids one async hash per row. */
export function addSemanticMatricesV2(multiset, geometryHash, matrixReader) {
  const bytes = new Uint8Array(128),
    view = new DataView(bytes.buffer);
  for (let start = 0; start < matrixReader.length; start += 16) {
    for (let i = 0; i < 16; i++) {
      const value = matrixReader.get(start + i);
      view.setFloat64(i * 8, value === 0 ? 0 : value, true);
    }
    let hex = "";
    for (const value of bytes) hex += value.toString(16).padStart(2, "0");
    const key = geometryHash + hex;
    multiset.set(key, (multiset.get(key) ?? 0) + 1);
  }
}

export async function semanticDigestV2(multiset, digest = digestV2) {
  const ordered = [...multiset].sort(([a], [b]) => a.localeCompare(b)),
    chunks = [];
  const tupleBytes = 32 + 128 + 8,
    entriesPerChunk = Math.floor(GEOMETRY_V2_LIMITS.chunkBytes / tupleBytes);
  for (let start = 0; start < ordered.length; start += entriesPerChunk) {
    const batch = ordered.slice(start, start + entriesPerChunk),
      bytes = new Uint8Array(batch.length * tupleBytes),
      view = new DataView(bytes.buffer);
    for (let i = 0; i < batch.length; i++) {
      const [hex, count] = batch[i];
      for (let byte = 0; byte < 160; byte++)
        bytes[i * tupleBytes + byte] = Number.parseInt(
          hex.slice(byte * 2, byte * 2 + 2),
          16,
        );
      view.setBigUint64(i * tupleBytes + 160, BigInt(count), true);
    }
    chunks.push({ bytes: bytes.length, sha256: await digest(bytes) });
  }
  return digest(
    jsonBytesV2({
      schema: ARTIFACT_PROTOCOL_V2.semanticGeometryHash,
      distinctTuples: ordered.length,
      totalInstances: ordered.reduce((sum, [, count]) => sum + count, 0),
      chunks,
    }),
  );
}

/** Independent witness verification, not a sampled/bounds-only proxy. */
export function verifyPositionWitnessV2(positions, witness, buffers) {
  requireValue(
    witness?.matched === true &&
      Number.isSafeInteger(witness.bufferId) &&
      Number.isSafeInteger(witness.byteOffset) &&
      witness.byteOffset >= 0 &&
      [12, 24, 32, 40, 48, 64].includes(witness.strideBytes) &&
      witness.vertexCount === positions.length / 3,
    "Invalid exact position witness",
  );
  const buffer = buffers.find((item) => item.id === witness.bufferId);
  requireValue(
    buffer &&
      buffer.usage & 32 &&
      !buffer.captureTruncated &&
      !buffer.captureIncomplete,
    "Position witness buffer was incomplete/unsubmitted",
  );
  const end =
    witness.byteOffset + (witness.vertexCount - 1) * witness.strideBytes + 12;
  const segment = buffer.segments.find(
    (item) =>
      item.offset <= witness.byteOffset &&
      item.offset + item.bytes.length >= end,
  );
  requireValue(
    segment && end <= buffer.requestedBytes,
    "Position witness escapes native segment",
  );
  const view = new DataView(
    segment.bytes.buffer,
    segment.bytes.byteOffset,
    segment.bytes.byteLength,
  );
  for (let i = 0; i < positions.length; i++) {
    const offset =
      witness.byteOffset -
      segment.offset +
      Math.floor(i / 3) * witness.strideBytes +
      (i % 3) * 4;
    requireValue(
      view.getFloat32(offset, true) === Math.fround(positions.get(i)),
      "Exact native position witness mismatch",
    );
  }
  return true;
}

export function geometrySummaryV2(facts, unique) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const mesh of facts)
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], mesh.bounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], mesh.bounds.max[axis]);
    }
  return {
    meshEntries: facts.length,
    renderInstances: facts.reduce((sum, item) => sum + item.instances, 0),
    uniqueGeometryCount: unique.size,
    uniqueAuthoredVertices: [...unique.values()].reduce(
      (sum, item) => sum + item.vertices,
      0,
    ),
    uniqueAuthoredTriangles: [...unique.values()].reduce(
      (sum, item) => sum + item.authoredTriangles,
      0,
    ),
    instancedAuthoredTriangles: facts.reduce(
      (sum, item) => sum + item.instancedTriangles,
      0,
    ),
    degenerateInstancedTriangles: facts.reduce(
      (sum, item) => sum + item.degenerateTriangles,
      0,
    ),
    exactNativePositionStreamMatches: facts.filter(
      (item) => item.nativePositionParity?.matched,
    ).length,
    missingNormalMeshEntries: facts.filter((item) => !item.normalsPresent)
      .length,
    bounds,
    confidence: facts.every((item) => item.nativePositionParity?.matched)
      ? "actual-native-submitted-vertex-upload-correlated"
      : "runtime-snapshot-with-partial-native-upload-correlation",
    limitations: [
      "Exact Float32 position witnesses correlate full source streams with surviving successful native vertex-buffer writes in an ever-submitted buffer; they do not prove index, shader or world-transform parity or last-frame visibility. Independent source audit remains required.",
      "V2 raw numeric values and full instance multiplicity are retained losslessly; canonical hash encoding is explicitly versioned.",
    ],
  };
}
