import { describe, expect, it } from "vitest";

import {
  buildMaterialQueueFromSnapshot,
  createMaterialHandle,
  createMaterialQueueScratch,
  createMeshHandle,
  createRenderSortKey,
  materialQueueFamilyFromPipelineKey,
  writeMaterialQueueFromSnapshot,
  type BatchCompatibilityKey,
  type MaterialQueueResourceKeyResolvers,
  type MeshDrawPacket,
  type RenderQueue,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("material family render queue", () => {
  it("builds JSON-safe queue items for mixed built-in material families", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 3,
        materialFamily: "standard",
        meshId: "sphere",
        materialId: "brushed-metal",
        depth: 12,
      }),
      drawPacket({
        renderId: 1,
        materialFamily: "unlit",
        meshId: "cube",
        materialId: "white",
        depth: 4,
      }),
      drawPacket({
        renderId: 2,
        materialFamily: "matcap",
        meshId: "torus",
        materialId: "clay",
        depth: 7,
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(snapshot, resourceResolvers());

    expect(plan.diagnostics).toEqual([]);
    expect(
      plan.items.map((item) => ({
        renderId: item.renderId,
        drawIndex: item.drawIndex,
        materialFamily: item.materialFamily,
        renderPhase: item.renderPhase,
        pipelineKey: item.pipelineKey,
        meshKey: item.meshKey,
        materialKey: item.materialKey,
        meshResourceKey: item.meshResourceKey,
        materialResourceKey: item.materialResourceKey,
        depth: item.depth,
      })),
    ).toEqual([
      {
        renderId: 2,
        drawIndex: 2,
        materialFamily: "matcap",
        renderPhase: "opaque",
        pipelineKey: "matcap|opaque|back|less|none",
        meshKey: "mesh:torus",
        materialKey: "material:clay",
        meshResourceKey: "gpu-mesh:mesh:torus",
        materialResourceKey: "gpu-material:material:clay",
        depth: 7,
      },
      {
        renderId: 3,
        drawIndex: 0,
        materialFamily: "standard",
        renderPhase: "opaque",
        pipelineKey: "standard|opaque|back|less|none",
        meshKey: "mesh:sphere",
        materialKey: "material:brushed-metal",
        meshResourceKey: "gpu-mesh:mesh:sphere",
        materialResourceKey: "gpu-material:material:brushed-metal",
        depth: 12,
      },
      {
        renderId: 1,
        drawIndex: 1,
        materialFamily: "unlit",
        renderPhase: "opaque",
        pipelineKey: "unlit|opaque|back|less|none",
        meshKey: "mesh:cube",
        materialKey: "material:white",
        meshResourceKey: "gpu-mesh:mesh:cube",
        materialResourceKey: "gpu-material:material:white",
        depth: 4,
      },
    ]);

    const parsed = JSON.parse(JSON.stringify(plan.items)) as unknown;

    expect(parsed).toEqual(plan.items);
  });

  it("groups opaque items by pipeline, material resource, and mesh resource before depth", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 1,
        materialFamily: "unlit",
        meshId: "mesh-b",
        materialId: "material-b",
        depth: 1,
      }),
      drawPacket({
        renderId: 2,
        materialFamily: "unlit",
        meshId: "mesh-a",
        materialId: "material-a",
        depth: 50,
      }),
      drawPacket({
        renderId: 3,
        materialFamily: "unlit",
        meshId: "mesh-a",
        materialId: "material-a",
        depth: 10,
      }),
      drawPacket({
        renderId: 4,
        materialFamily: "standard",
        meshId: "mesh-c",
        materialId: "material-a",
        depth: 2,
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(snapshot, resourceResolvers());

    expect(plan.items.map((item) => item.renderId)).toEqual([4, 3, 2, 1]);
    expect(plan.items.map((item) => item.pipelineKey)).toEqual([
      "standard|opaque|back|less|none",
      "unlit|opaque|back|less|none",
      "unlit|opaque|back|less|none",
      "unlit|opaque|back|less|none",
    ]);
    expect(plan.items.map((item) => item.materialResourceKey)).toEqual([
      "gpu-material:material:material-a",
      "gpu-material:material:material-a",
      "gpu-material:material:material-a",
      "gpu-material:material:material-b",
    ]);
  });

  it("preserves input order for otherwise identical opaque queue items", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 11,
        materialFamily: "unlit",
        meshId: "cube",
        materialId: "white",
        stableId: 42,
      }),
      drawPacket({
        renderId: 12,
        materialFamily: "unlit",
        meshId: "cube",
        materialId: "white",
        stableId: 42,
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(snapshot, resourceResolvers());

    expect(plan.items.map((item) => item.renderId)).toEqual([11, 12]);
  });

  it("orders opaque and alpha-test phases before back-to-front transparent items", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 1,
        materialFamily: "unlit",
        queue: "transparent",
        depth: 10,
      }),
      drawPacket({
        renderId: 2,
        materialFamily: "unlit",
        queue: "transparent",
        depth: 50,
      }),
      drawPacket({
        renderId: 3,
        materialFamily: "unlit",
        queue: "alpha-test",
        depth: 20,
      }),
      drawPacket({
        renderId: 4,
        materialFamily: "unlit",
        queue: "opaque",
        depth: 30,
      }),
      drawPacket({
        renderId: 5,
        materialFamily: "unlit",
        queue: "transparent",
        depth: 25,
        stableId: 99,
      }),
      drawPacket({
        renderId: 6,
        materialFamily: "unlit",
        queue: "transparent",
        depth: 25,
        stableId: 99,
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(snapshot, resourceResolvers());

    expect(
      plan.items.map((item) => ({
        renderId: item.renderId,
        renderPhase: item.renderPhase,
        depth: item.depth,
      })),
    ).toEqual([
      { renderId: 4, renderPhase: "opaque", depth: 30 },
      { renderId: 3, renderPhase: "alpha-test", depth: 20 },
      { renderId: 2, renderPhase: "transparent", depth: 50 },
      { renderId: 5, renderPhase: "transparent", depth: 25 },
      { renderId: 6, renderPhase: "transparent", depth: 25 },
      { renderId: 1, renderPhase: "transparent", depth: 10 },
    ]);
  });

  it("diagnoses missing prepared resource keys without queueing the draw", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 5,
        materialFamily: "matcap",
        meshId: "torus",
        materialId: "missing",
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(
      snapshot,
      resourceResolvers({ missingMaterials: ["material:missing"] }),
    );

    expect(plan.items).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "materialQueue.missingPreparedResource",
        severity: "warning",
        assetKey: "material:missing",
      },
    ]);
  });

  it("diagnoses unknown material family tokens before resolving resources", () => {
    const snapshot = renderSnapshot([
      drawPacket({
        renderId: 9,
        materialFamily: "toon",
        meshId: "sphere",
        materialId: "ink",
      }),
    ]);
    const plan = buildMaterialQueueFromSnapshot(snapshot, resourceResolvers());

    expect(plan.items).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "materialQueue.unknownMaterialFamily",
        severity: "warning",
        entity: { index: 9, generation: 1 },
      },
    ]);
  });

  it("can reuse caller-owned scratch arrays on the snapshot queue path", () => {
    const scratch = createMaterialQueueScratch(2);
    const first = writeMaterialQueueFromSnapshot(
      renderSnapshot([
        drawPacket({ renderId: 1, materialFamily: "unlit" }),
        drawPacket({ renderId: 2, materialFamily: "matcap" }),
      ]),
      resourceResolvers(),
      scratch,
    );
    const firstItems = [...first.items];
    const second = writeMaterialQueueFromSnapshot(
      renderSnapshot([
        drawPacket({ renderId: 3, materialFamily: "standard" }),
        drawPacket({ renderId: 4, materialFamily: "unlit" }),
      ]),
      resourceResolvers(),
      scratch,
    );

    expect(new Set(second.items)).toEqual(new Set(firstItems));
    expect(second.items.map((item) => item.renderId)).toEqual([3, 4]);
  });

  it("extracts known material family tokens from pipeline keys", () => {
    expect(materialQueueFamilyFromPipelineKey("unlit|opaque")).toBe("unlit");
    expect(materialQueueFamilyFromPipelineKey("matcap|opaque")).toBe("matcap");
    expect(materialQueueFamilyFromPipelineKey("standard|opaque")).toBe(
      "standard",
    );
    expect(materialQueueFamilyFromPipelineKey("debug-normal|opaque")).toBe(
      "debug-normal",
    );
    expect(materialQueueFamilyFromPipelineKey("toon|opaque")).toBeNull();
  });
});

function resourceResolvers(
  options: {
    readonly missingMeshes?: readonly string[];
    readonly missingMaterials?: readonly string[];
  } = {},
): MaterialQueueResourceKeyResolvers {
  const missingMeshes = new Set(options.missingMeshes ?? []);
  const missingMaterials = new Set(options.missingMaterials ?? []);

  return {
    meshResourceKey: (input) =>
      missingMeshes.has(input.meshKey) ? null : `gpu-mesh:${input.meshKey}`,
    materialResourceKey: (input) =>
      missingMaterials.has(input.materialKey)
        ? null
        : `gpu-material:${input.materialKey}`,
  };
}

function renderSnapshot(meshDraws: readonly MeshDrawPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
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

function drawPacket(options: {
  readonly renderId: number;
  readonly materialFamily: string;
  readonly meshId?: string;
  readonly materialId?: string;
  readonly queue?: RenderQueue;
  readonly depth?: number;
  readonly stableId?: number;
}): MeshDrawPacket {
  const renderId = options.renderId;
  const meshId = options.meshId ?? "cube";
  const materialId = options.materialId ?? "white";
  const alphaMode = alphaModeForQueue(options.queue ?? "opaque");
  const pipelineKey = `${options.materialFamily}|${alphaMode}|back|less|${blendPresetForAlphaMode(
    alphaMode,
  )}`;
  const meshKey = `mesh:${meshId}`;
  const materialKey = `material:${materialId}`;

  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: createMeshHandle(meshId),
    material: createMaterialHandle(materialId),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: renderId * 16,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: options.queue ?? "opaque",
      pipelineKey,
      materialKey,
      meshKey,
      depth: options.depth ?? 0,
      stableId: options.stableId ?? renderId,
    }),
    batchKey: batchKey(pipelineKey, materialKey),
  };
}

function alphaModeForQueue(queue: RenderQueue): string {
  switch (queue) {
    case "opaque":
      return "opaque";
    case "alpha-test":
      return "mask";
    case "transparent":
      return "blend";
  }
}

function blendPresetForAlphaMode(alphaMode: string): string {
  return alphaMode === "blend" ? "alpha" : "none";
}

function batchKey(
  pipelineKey: string,
  materialKey: string,
): BatchCompatibilityKey {
  return {
    pipelineKey,
    materialKey,
    meshLayoutKey: "POSITION,NORMAL,UV_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
}
