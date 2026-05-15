import { describe, expect, it } from "vitest";

import {
  createBatchCompatibilityKey,
  createMaterialHandle,
  createMaterialPipelineKeyInput,
  createMeshHandle,
  createRenderSortKey,
  createRenderTargetHandle,
  createStableRenderId,
  createUnlitMaterialAsset,
  inspectRenderSnapshot,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "../../src/index.js";

describe("render snapshot inspection report", () => {
  it("summarizes populated snapshot packet counts and unique handles", () => {
    const first = packet(1, "cube", "white");
    const second = packet(2, "cube", "blue");
    const report = inspectRenderSnapshot(
      snapshot({
        meshDraws: [first, second],
        renderTarget: "main",
        transforms: new Float32Array(32),
        viewMatrices: new Float32Array(48),
      }),
    );

    expect(report.counts).toMatchObject({
      views: 1,
      meshDraws: 2,
      transformFloats: 32,
      viewMatrixFloats: 48,
      diagnostics: 0,
    });
    expect(report.handles).toEqual({
      meshKeys: ["mesh:cube"],
      materialKeys: ["material:blue", "material:white"],
      renderTargetKeys: ["render-target:main"],
    });
  });

  it("reports empty snapshots", () => {
    expect(
      inspectRenderSnapshot(snapshot({ meshDraws: [] })).diagnostics,
    ).toMatchObject([{ code: "renderSnapshot.empty" }]);
  });

  it("preserves snapshot diagnostics", () => {
    const report = inspectRenderSnapshot({
      ...snapshot({ meshDraws: [packet(3, "plane", "white")] }),
      diagnostics: [
        {
          code: "render.assetMissing",
          message: "missing",
          severity: "warning",
        },
      ],
    });

    expect(report.counts.diagnostics).toBe(1);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.assetMissing",
    ]);
  });
});

function packet(
  seed: number,
  meshId: string,
  materialId: string,
): MeshDrawPacket {
  const entity = { index: seed, generation: 0 };
  const stableId = createStableRenderId(entity);
  const materialPipeline = createMaterialPipelineKeyInput(
    createUnlitMaterialAsset(),
  );

  return {
    renderId: stableId,
    entity,
    mesh: createMeshHandle(meshId),
    material: createMaterialHandle(materialId),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: seed * 16,
    boundsIndex: seed,
    layerMask: 1,
    sortKey: createRenderSortKey({ stableId }),
    batchKey: createBatchCompatibilityKey({
      materialPipeline,
      materialKey: materialId,
      meshLayoutKey: "p3n3uv2",
      topology: "triangle-list",
    }),
  };
}

function snapshot(input: {
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly renderTarget?: string;
  readonly transforms?: Float32Array;
  readonly viewMatrices?: Float32Array;
}): RenderSnapshot {
  return {
    frame: 1,
    views:
      input.renderTarget === undefined
        ? []
        : [
            {
              viewId: 0,
              camera: { index: 1, generation: 0 },
              priority: 0,
              layerMask: 1,
              viewMatrixOffset: 0,
              projectionMatrixOffset: 16,
              viewProjectionMatrixOffset: 32,
              viewport: [0, 0, 1, 1],
              scissor: [0, 0, 1, 1],
              clearColor: [0, 0, 0, 1],
              clearDepth: 1,
              clearStencil: 0,
              renderTarget: createRenderTargetHandle(input.renderTarget),
            },
          ],
    meshDraws: input.meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: input.transforms ?? new Float32Array(0),
    viewMatrices: input.viewMatrices ?? new Float32Array(0),
    diagnostics: [],
    report: {
      views: input.renderTarget === undefined ? 0 : 1,
      meshDraws: input.meshDraws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
