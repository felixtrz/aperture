import { describe, expect, it } from "vitest";

import {
  createBatchCompatibilityKey,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createRenderSortKey,
  createUnlitMaterialAsset,
  packSnapshotTransforms,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "../../src/index.js";

describe("render snapshot transform packing", () => {
  it("packs mesh draw transforms in stable draw order", () => {
    const first = packet(1, 16);
    const second = packet(2, 0);
    const result = packSnapshotTransforms(
      snapshot([first, second], matrices([1, 2])),
    );

    expect(Array.from(result.data)).toEqual([...matrix(2), ...matrix(1)]);
    expect(result.offsets).toEqual([
      { renderId: first.renderId, sourceOffset: 16, packedOffset: 0 },
      { renderId: second.renderId, sourceOffset: 0, packedOffset: 16 },
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
});

function packet(seed: number, worldTransformOffset: number): MeshDrawPacket {
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
  };
}

function snapshot(
  meshDraws: readonly MeshDrawPacket[],
  transforms: readonly number[],
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
