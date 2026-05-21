import { describe, expect, it } from "vitest";

import {
  createBatchCompatibilityKey,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createRenderSortKey,
  createUnlitMaterialAsset,
  createPackedSnapshotInstanceTintsScratch,
  createPackedSnapshotTransformsScratch,
  packSnapshotInstanceTintsForVertexBuffer,
  packSnapshotTransforms,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotTransforms,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("render snapshot transform packing", () => {
  it("packs mesh draw transforms in stable draw order", () => {
    const first = packet(1, 16);
    const second = packet(2, 0);
    const result = packSnapshotTransforms(
      snapshot([first, second], matrices([1, 2])),
    );

    expect(Array.from(result.data)).toEqual([...matrix(1), ...matrix(2)]);
    expect(result.offsets).toEqual([
      { renderId: first.renderId, sourceOffset: 16, packedOffset: 16 },
      { renderId: second.renderId, sourceOffset: 0, packedOffset: 0 },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("reuses packed offsets for draws that share a source transform", () => {
    const first = packet(3, 0);
    const second = packet(4, 0);
    const result = packSnapshotTransforms(snapshot([first, second], matrix(7)));

    expect(Array.from(result.data)).toEqual(matrix(7));
    expect(result.offsets).toEqual([
      { renderId: first.renderId, sourceOffset: 0, packedOffset: 0 },
      { renderId: second.renderId, sourceOffset: 0, packedOffset: 0 },
    ]);
  });

  it("diagnoses missing transform offsets without querying ECS", () => {
    const valid = packet(5, 0);
    const invalid = packet(6, 16);
    const result = packSnapshotTransforms(
      snapshot([valid, invalid], matrix(1)),
    );

    expect(Array.from(result.data)).toEqual(matrix(1));
    expect(result.offsets).toEqual([
      { renderId: valid.renderId, sourceOffset: 0, packedOffset: 0 },
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderTransformPack.missingTransform",
    ]);
    expect(result.diagnostics[0]?.entity).toEqual(invalid.entity);
  });

  it("returns an empty pack for empty snapshots", () => {
    const result = packSnapshotTransforms(snapshot([], []));

    expect(result.data).toEqual(new Float32Array(0));
    expect(result.offsets).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("can reuse caller-owned transform pack scratch on the frame hot path", () => {
    const scratch = createPackedSnapshotTransformsScratch(32, 2);
    const first = writePackedSnapshotTransforms(
      snapshot([packet(1, 0), packet(2, 16)], matrices([1, 2])),
      scratch,
    );
    const firstOffsets = [...first.offsets];
    const firstData = first.data;
    const second = writePackedSnapshotTransforms(
      snapshot([packet(2, 16), packet(1, 0)], matrices([1, 2])),
      scratch,
    );

    expect(second).toBe(first);
    expect(second.data).toBe(firstData);
    expect(second.floatCount).toBe(32);
    expect(new Set(second.offsets)).toEqual(new Set(firstOffsets));
    expect(second.offsets.map((offset) => offset.renderId)).toEqual([2, 1]);
    expect(Array.from(second.data.subarray(0, second.floatCount))).toEqual([
      ...matrix(1),
      ...matrix(2),
    ]);
  });

  it("packs instance tints into transform-aligned vertex buffer slots", () => {
    const first = packet(1, 0);
    const second = packet(2, 16, 0);
    const transforms = packSnapshotTransforms(
      snapshot([first, second], matrices([1, 2]), [0.25, 0.5, 0.75, 1]),
    );
    const result = packSnapshotInstanceTintsForVertexBuffer(
      snapshot([first, second], matrices([1, 2]), [0.25, 0.5, 0.75, 1]),
      transforms,
    );

    expect(result.floatCount).toBe(8);
    expect(Array.from(result.data.subarray(0, result.floatCount))).toEqual([
      1, 1, 1, 1, 0.25, 0.5, 0.75, 1,
    ]);
    expect(result.offsets).toEqual([
      { renderId: second.renderId, sourceOffset: 0, packedOffset: 4 },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("only reports tint-specific diagnostics while transform diagnostics remain separate", () => {
    const tinted = packet(1, 0, 0);
    const missingUntinted = packet(2, 16);
    const currentSnapshot = snapshot(
      [tinted, missingUntinted],
      matrix(1),
      [0.25, 0.5, 0.75, 1],
    );
    const transforms = packSnapshotTransforms(currentSnapshot);
    const result = packSnapshotInstanceTintsForVertexBuffer(
      currentSnapshot,
      transforms,
    );

    expect(transforms.diagnostics).toMatchObject([
      { code: "renderTransformPack.missingTransform" },
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(Array.from(result.data.subarray(0, result.floatCount))).toEqual([
      0.25, 0.5, 0.75, 1,
    ]);
  });

  it("can reuse caller-owned instance tint pack scratch", () => {
    const scratch = createPackedSnapshotInstanceTintsScratch(8, 1);
    const firstSnapshot = snapshot(
      [packet(1, 0, 0), packet(2, 16, 4)],
      matrices([1, 2]),
      [1, 0, 0, 1, 0, 1, 0, 1],
    );
    const firstTransforms = packSnapshotTransforms(firstSnapshot);
    const first = writePackedSnapshotInstanceTintsForVertexBuffer(
      firstSnapshot,
      firstTransforms,
      scratch,
    );
    const firstData = first.data;
    const secondSnapshot = snapshot([packet(3, 0, 0)], matrix(3), [0, 0, 1, 1]);
    const secondTransforms = packSnapshotTransforms(secondSnapshot);
    const second = writePackedSnapshotInstanceTintsForVertexBuffer(
      secondSnapshot,
      secondTransforms,
      scratch,
    );

    expect(second).toBe(first);
    expect(second.data).toBe(firstData);
    expect(second.floatCount).toBe(4);
    expect(Array.from(second.data.subarray(0, second.floatCount))).toEqual([
      0, 0, 1, 1,
    ]);
  });
});

function packet(
  seed: number,
  worldTransformOffset: number,
  instanceTintOffset?: number,
): MeshDrawPacket {
  const mesh = createMeshHandle(`mesh-${seed}`);
  const material = createMaterialHandle(`material-${seed}`);

  return {
    renderId: seed,
    entity: { index: seed, generation: 0 },
    mesh,
    material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset,
    boundsIndex: seed,
    layerMask: 1,
    sortKey: createRenderSortKey({ stableId: seed }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline: createMaterialPipelineKeyInput(
        createUnlitMaterialAsset(),
      ),
      materialKey: material.id,
      meshLayoutKey: "p3n3uv2",
      topology: "triangle-list",
    }),
    ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
  };
}

function snapshot(
  meshDraws: readonly MeshDrawPacket[],
  transforms: readonly number[],
  instanceTints?: readonly number[],
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(transforms),
    ...(instanceTints === undefined
      ? {}
      : { instanceTints: new Float32Array(instanceTints) }),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function matrices(seeds: readonly number[]): number[] {
  return seeds.flatMap((seed) => matrix(seed));
}

function matrix(seed: number): number[] {
  return Array.from({ length: 16 }, (_, index) => seed * 100 + index);
}
