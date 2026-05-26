import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createMatcapMaterialAsset,
  createRenderSortKey,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  type BatchCompatibilityKey,
  type MaterialAsset,
  type MeshDrawPacket,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  createQueuedBuiltInFrameResourceScratch,
  createSingleQueuedBuiltInAppResourceItem,
  prepareQueuedBuiltInFrameResourceSet,
  type QueuedBuiltInAppResourceItem,
  type UnlitFrameGpuResources,
} from "@aperture-engine/webgpu";

describe("queued built-in frame-resource set preparation", () => {
  it("prepares a routed built-in frame-resource set with injected pipeline callbacks", async () => {
    const frameResources = fakeFrameResources();
    const item = queuedItem({
      frameResources: {
        valid: true,
        resources: frameResources,
        diagnostics: [],
      },
    });
    const pipeline = fakePipeline();
    const result = await prepareQueuedBuiltInFrameResourceSet({
      resourceSet: { items: [item] },
      scratch: createQueuedBuiltInFrameResourceScratch(),
      viewUniforms: frameResources.viewUniform as never,
      worldTransforms: frameResources.worldTransforms as never,
      callbacks: {
        getPipeline: () => pipeline,
        getPipelineView: (value) => value,
        createPipelinePlanResult: ({ item: routedItem, pipeline }) => ({
          key: routedItem.draw.batchKey.pipelineKey,
          pipeline: pipeline.resource?.pipeline,
        }),
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          sharedLayouts: [getBindGroupLayout(0)],
        }),
        prepareTextureSamplerDependencies: () => preparedDependencies(),
        createFrameResourceOptions: ({ item: routedItem, layouts }) => ({
          item: routedItem,
          layouts,
        }),
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      mesh: { resourceKey: "gpu-mesh:cube" },
      meshResources: [{ resourceKey: "gpu-mesh:cube" }],
      unlit: [frameResources],
      matcap: [],
      standard: [],
      byFamilySummary: [{ family: "unlit", itemCount: 1 }],
      bindGroups: [
        {
          resourceKey: "bind-group:0|pipeline:unlit|opaque|back|less|none",
        },
      ],
    });
    expect(result.firstPipeline).toBe(pipeline);
    expect(result.resources?.byFamily.byFamily.get("unlit")).toEqual([
      frameResources,
    ]);
    expect(result.pipelineResults).toEqual([
      {
        key: "unlit|opaque|back|less|none",
        pipeline: pipeline.resource?.pipeline,
      },
    ]);
    expect(result.meshResourceKeys.get("mesh:cube")).toBe("gpu-mesh:cube");
    expect(result.materialResourceKeys.get("material:white")).toBe(
      "gpu-material:white",
    );
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });

  it("reports failed frame-resource routes without app-owned GPU details", async () => {
    const item = queuedItem({
      frameResources: {
        valid: false,
        resources: null,
        diagnostics: [{ code: "fake.missingBuffer", rawGpuHandle: undefined }],
      },
    });
    const result = await prepareQueuedBuiltInFrameResourceSet({
      resourceSet: { items: [item] },
      scratch: createQueuedBuiltInFrameResourceScratch(),
      viewUniforms: {} as never,
      worldTransforms: {} as never,
      callbacks: {
        getPipeline: fakePipeline,
        getPipelineView: (value) => value,
        createPipelinePlanResult: ({ item: routedItem, pipeline }) => ({
          key: routedItem.draw.batchKey.pipelineKey,
          pipeline: pipeline.resource?.pipeline,
        }),
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          sharedLayouts: [getBindGroupLayout(0)],
        }),
        prepareTextureSamplerDependencies: () => preparedDependencies(),
        createFrameResourceOptions: ({ item: routedItem, layouts }) => ({
          item: routedItem,
          layouts,
        }),
      },
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics).toMatchObject([
      { code: "fake.missingBuffer" },
      {
        code: "webGpuApp.frameResourceRoute",
        route: {
          valid: false,
          status: "failed",
          family: "unlit",
          backendMeshKey: "mesh:cube@1",
          backendMaterialKey: "material:white@1",
          pipelineKey: "unlit|opaque|back|less|none",
        },
      },
    ]);
    expect(JSON.stringify(result.diagnostics)).not.toContain("rawGpuHandle");
  });

  it("resets reusable frame-resource scratch between preparation calls", async () => {
    const scratch = createQueuedBuiltInFrameResourceScratch();
    const firstFrameResources = fakeFrameResources("first");
    const secondFrameResources = fakeFrameResources("second");
    const first = await prepareQueuedBuiltInFrameResourceSet({
      resourceSet: {
        items: [
          queuedItem({
            frameResources: {
              valid: true,
              resources: firstFrameResources,
              diagnostics: [],
            },
          }),
        ],
      },
      scratch,
      viewUniforms: firstFrameResources.viewUniform as never,
      worldTransforms: firstFrameResources.worldTransforms as never,
      callbacks: successCallbacks(fakePipeline()),
    });
    const firstMeshResources = first.resources?.meshResources.map((mesh) => ({
      resourceKey: mesh.resourceKey,
    }));
    const firstBindGroups = first.resources?.bindGroups.map((bindGroup) => ({
      resourceKey: bindGroup.resourceKey,
    }));
    const second = await prepareQueuedBuiltInFrameResourceSet({
      resourceSet: {
        items: [
          queuedItem({
            frameResources: {
              valid: true,
              resources: secondFrameResources,
              diagnostics: [],
            },
          }),
        ],
      },
      scratch,
      viewUniforms: secondFrameResources.viewUniform as never,
      worldTransforms: secondFrameResources.worldTransforms as never,
      callbacks: successCallbacks(fakePipeline()),
    });

    expect(firstMeshResources).toEqual([{ resourceKey: "gpu-mesh:first" }]);
    expect(firstBindGroups).toEqual([
      {
        resourceKey: "bind-group:first|pipeline:unlit|opaque|back|less|none",
      },
    ]);
    expect(second.valid).toBe(true);
    expect(second.resources?.meshResources).toMatchObject([
      { resourceKey: "gpu-mesh:second" },
    ]);
    expect(second.resources?.bindGroups).toMatchObject([
      {
        resourceKey: "bind-group:second|pipeline:unlit|opaque|back|less|none",
      },
    ]);
    expect(second.pipelineResults).toHaveLength(1);
    expect(second.meshResourceKeys.get("mesh:cube")).toBe("gpu-mesh:second");
    expect(second.materialResourceKeys.get("material:white")).toBe(
      "gpu-material:second",
    );
    const serializedSecond = JSON.stringify(second);

    expect(serializedSecond).not.toContain("gpu-mesh:first");
    expect(serializedSecond).not.toContain("gpu-material:first");
    expect(serializedSecond).not.toContain("bind-group:first");
  });

  it("prepares mixed built-in frame-resource families through deterministic generic buckets", async () => {
    const pipeline = fakePipeline();
    const scratch = createQueuedBuiltInFrameResourceScratch();
    const items = [
      queuedItem({
        family: "unlit",
        meshId: "cube-a",
        materialId: "white-a",
        material: createUnlitMaterialAsset({ label: "White A" }),
        pipelineKey: "unlit|opaque|back|less|none",
        frameResources: {
          valid: true,
          resources: fakeFrameResources("unlit-a"),
          diagnostics: [],
        },
      }),
      queuedItem({
        family: "unlit",
        meshId: "cube-b",
        materialId: "white-b",
        material: createUnlitMaterialAsset({ label: "White B" }),
        pipelineKey: "unlit|opaque|back|less|none",
        frameResources: {
          valid: true,
          resources: fakeFrameResources("unlit-b"),
          diagnostics: [],
        },
      }),
      queuedItem({
        family: "matcap",
        meshId: "cube-c",
        materialId: "matcap-preview",
        material: createMatcapMaterialAsset({ label: "Matcap Preview" }),
        pipelineKey: "matcap|opaque|back|less|none",
        frameResources: {
          valid: true,
          resources: fakeFrameResources("matcap"),
          diagnostics: [],
        },
      }),
    ];
    let pipelinePlanCalls = 0;
    let frameResourceOptionsCalls = 0;

    const result = await prepareQueuedBuiltInFrameResourceSet({
      resourceSet: { items },
      scratch,
      viewUniforms: fakeFrameResources("view").viewUniform as never,
      worldTransforms: fakeFrameResources("world").worldTransforms as never,
      callbacks: {
        getPipeline: () => pipeline,
        getPipelineView: (value) => value,
        createPipelinePlanResult: ({ item: routedItem, pipeline }) => {
          pipelinePlanCalls += 1;

          return {
            family: routedItem.queueItem.materialFamily,
            key: routedItem.draw.batchKey.pipelineKey,
            pipeline: pipeline.resource?.pipeline,
          };
        },
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          sharedLayouts: [getBindGroupLayout(0)],
        }),
        prepareTextureSamplerDependencies: () => preparedDependencies(),
        createFrameResourceOptions: ({ item: routedItem, layouts }) => {
          frameResourceOptionsCalls += 1;

          return {
            item: routedItem,
            layouts,
          };
        },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(pipelinePlanCalls).toBe(2);
    expect(frameResourceOptionsCalls).toBe(3);
    expect(result.pipelineResults).toEqual([
      {
        family: "unlit",
        key: "unlit|opaque|back|less|none",
        pipeline: pipeline.resource?.pipeline,
      },
      {
        family: "matcap",
        key: "matcap|opaque|back|less|none",
        pipeline: pipeline.resource?.pipeline,
      },
    ]);
    expect(result.resources?.byFamilySummary).toEqual([
      { family: "matcap", itemCount: 1 },
      { family: "unlit", itemCount: 2 },
    ]);
    expect(result.resources?.unlit).toHaveLength(2);
    expect(result.resources?.matcap).toHaveLength(1);
    expect(result.resources?.standard).toHaveLength(0);
    expect(result.resources?.byFamily.byFamily.get("unlit")).toHaveLength(2);
    expect(result.resources?.byFamily.byFamily.get("matcap")).toHaveLength(1);
    expect(result.resources?.meshResources).toMatchObject([
      { resourceKey: "gpu-mesh:unlit-a" },
      { resourceKey: "gpu-mesh:unlit-b" },
      { resourceKey: "gpu-mesh:matcap" },
    ]);
    expect(result.resources?.bindGroups).toMatchObject([
      {
        resourceKey: "bind-group:unlit-a|pipeline:unlit|opaque|back|less|none",
      },
      {
        resourceKey: "bind-group:unlit-b|pipeline:unlit|opaque|back|less|none",
      },
      {
        resourceKey: "bind-group:matcap|pipeline:matcap|opaque|back|less|none",
      },
    ]);
    expect(result.meshResourceKeys.get("mesh:cube-a")).toBe("gpu-mesh:unlit-a");
    expect(result.meshResourceKeys.get("mesh:cube-b")).toBe("gpu-mesh:unlit-b");
    expect(result.meshResourceKeys.get("mesh:cube-c")).toBe("gpu-mesh:matcap");
    expect(result.materialResourceKeys.get("material:white-a")).toBe(
      "gpu-material:unlit-a",
    );
    expect(result.materialResourceKeys.get("material:white-b")).toBe(
      "gpu-material:unlit-b",
    );
    expect(result.materialResourceKeys.get("material:matcap-preview")).toBe(
      "gpu-material:matcap",
    );

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("rawGpuHandle");
    expect(serialized).not.toContain("White A");
    expect(serialized).not.toContain("White B");
    expect(serialized).not.toContain("Matcap Preview");
  });
});

function queuedItem(options: {
  readonly family?: "unlit" | "matcap" | "standard";
  readonly meshId?: string;
  readonly materialId?: string;
  readonly material?: MaterialAsset;
  readonly pipelineKey?: string;
  readonly frameResources: {
    readonly valid: boolean;
    readonly resources: UnlitFrameGpuResources | null;
    readonly diagnostics: readonly unknown[];
  };
}): QueuedBuiltInAppResourceItem {
  const adapters = createQueuedBuiltInAppResourceAdapterRegistry({
    families: createQueuedBuiltInAppResourceFamilyAdapterTable({
      prepareUnlitTextureSamplerResources: () => ({
        valid: true,
        textures: [],
        samplers: [],
        textureKeys: [],
        samplerKeys: [],
        diagnostics: [],
      }),
      prepareMatcapTextureSamplerResources: () => preparedDependencies(),
      prepareStandardTextureSamplerResources: () => preparedDependencies(),
      prepareDebugNormalTextureSamplerResources: () => preparedDependencies(),
      createUnlitFrameResources: () => options.frameResources as never,
      createMatcapFrameResources: () => options.frameResources as never,
      createStandardFrameResources: () => options.frameResources as never,
      createDebugNormalFrameResources: () => options.frameResources as never,
    }),
  });
  const item = createSingleQueuedBuiltInAppResourceItem({
    adapters,
    draw: drawPacket({
      meshId: options.meshId,
      pipelineKey: options.pipelineKey,
      materialId: options.materialId,
    }),
    drawIndex: 0,
    mesh: createBoxMeshAsset({ label: "Cube" }),
    meshKey: `mesh:${options.meshId ?? "cube"}@1`,
    material:
      options.material ??
      createMaterialAssetForFamily(options.family ?? "unlit", "White"),
    materialKey: `material:${options.materialId ?? "white"}@1`,
    materialVersion: 1,
    frame: 4,
  });

  if (item === null) {
    throw new Error("Expected unlit queued item.");
  }

  return item;
}

function createMaterialAssetForFamily(
  family: "unlit" | "matcap" | "standard",
  label: string,
): MaterialAsset {
  switch (family) {
    case "unlit":
      return createUnlitMaterialAsset({ label });
    case "matcap":
      return createMatcapMaterialAsset({ label });
    case "standard":
      return createStandardMaterialAsset({ label });
  }
}

function preparedDependencies() {
  return {
    valid: true,
    textures: [],
    samplers: [],
    textureKeys: [],
    samplerKeys: [],
    diagnostics: [],
  };
}

function fakePipeline() {
  const rawGpuHandle = { label: "internal" };

  return {
    valid: true,
    resource: {
      cacheKey: "pipeline:unlit",
      pipeline: {
        getBindGroupLayout: (group: number) => ({ group, rawGpuHandle }),
      },
    },
    diagnostics: [],
  };
}

function successCallbacks(pipeline: ReturnType<typeof fakePipeline>) {
  return {
    getPipeline: () => pipeline,
    getPipelineView: (value: typeof pipeline) => value,
    createPipelinePlanResult: ({
      item,
      pipeline,
    }: {
      readonly item: QueuedBuiltInAppResourceItem;
      readonly pipeline: ReturnType<typeof fakePipeline>;
    }) => ({
      key: item.draw.batchKey.pipelineKey,
      pipeline: pipeline.resource?.pipeline,
    }),
    getPipelineLayouts: ({
      getBindGroupLayout,
    }: {
      readonly getBindGroupLayout: (group: number) => unknown;
    }) => ({
      sharedLayouts: [getBindGroupLayout(0)],
    }),
    prepareTextureSamplerDependencies: () => preparedDependencies(),
    createFrameResourceOptions: ({
      item,
      layouts,
    }: {
      readonly item: QueuedBuiltInAppResourceItem;
      readonly layouts: unknown;
    }) => ({
      item,
      layouts,
    }),
  };
}

function fakeFrameResources(suffix = "cube"): UnlitFrameGpuResources {
  const materialSuffix = suffix === "cube" ? "white" : suffix;
  const bindGroupSuffix = suffix === "cube" ? "0" : suffix;

  return {
    mesh: { resourceKey: `gpu-mesh:${suffix}` },
    viewUniform: {
      resourceKey:
        suffix === "cube" ? "view-uniforms" : `view-uniforms:${suffix}`,
    },
    worldTransforms: {
      resourceKey:
        suffix === "cube" ? "world-transforms" : `world-transforms:${suffix}`,
    },
    material: { resourceKey: `gpu-material:${materialSuffix}` },
    bindGroups: [
      {
        group: 0,
        resourceKey: `bind-group:${bindGroupSuffix}`,
        layoutKey: "layout:0",
        bindGroup: {},
        entryResourceKeys: ["view-uniforms"],
      },
    ],
  } as unknown as UnlitFrameGpuResources;
}

function drawPacket(
  options: {
    readonly meshId?: string | undefined;
    readonly pipelineKey?: string | undefined;
    readonly materialId?: string | undefined;
  } = {},
): MeshDrawPacket {
  const pipelineKey = options.pipelineKey ?? "unlit|opaque|back|less|none";
  const materialKey = `material:${options.materialId ?? "white"}`;
  const meshKey = `mesh:${options.meshId ?? "cube"}`;

  return {
    renderId: 1,
    entity: { index: 1, generation: 1 },
    mesh: createMeshHandle(options.meshId ?? "cube"),
    material: createMaterialHandle(options.materialId ?? "white"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: createRenderSortKey({
      queue: "opaque",
      pipelineKey,
      materialKey,
      meshKey,
      depth: 0,
      stableId: 1,
    }),
    batchKey: batchKey(pipelineKey, materialKey),
  };
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
