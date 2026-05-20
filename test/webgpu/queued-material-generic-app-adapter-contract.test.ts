import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  type MaterialQueueItem,
  type MeshDrawPacket,
} from "@aperture-engine/core";
import {
  createQueuedMaterialAdapterRegistry,
  createQueuedMaterialAppResourceItem,
  createQueuedMaterialFrameResourceScratch,
  createQueuedMaterialPrepareRouteResult,
  prepareQueuedMaterialFrameResourceSet,
  routeQueuedMaterialPrepare,
  type QueuedMaterialAppResourceItem,
  type QueuedMaterialFrameResourceSetCallbacks,
  type QueuedMaterialPrepareRouteAdapter,
} from "@aperture-engine/webgpu";

type PreviewMaterial = {
  readonly kind: "test-preview";
  readonly label: string;
  readonly tint: readonly [number, number, number, number];
};

type PreviewDiagnostic = {
  readonly code: "testPreview.unsupportedPhase";
  readonly renderPhase: string;
};

type PreviewAdapter = QueuedMaterialPrepareRouteAdapter<
  "test-preview",
  PreviewMaterial,
  PreviewDiagnostic
> & {
  readonly routeLabel: "test-only";
};

type PreviewPipeline = {
  readonly valid: true;
  readonly resource: {
    readonly pipeline: {
      readonly getBindGroupLayout: (group: number) => unknown;
    };
  };
  readonly diagnostics: readonly [];
};

type PreviewMesh = { readonly resourceKey: string };

type PreviewBindGroup = {
  readonly group: number;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
};

type PreviewResources = {
  readonly mesh: PreviewMesh;
  readonly material: { readonly resourceKey: string };
  readonly bindGroups: readonly PreviewBindGroup[];
};

type PreviewResourceResult =
  | {
      readonly valid: true;
      readonly resources: PreviewResources;
      readonly diagnostics: readonly [];
    }
  | {
      readonly valid: false;
      readonly resources: null;
      readonly diagnostics: readonly [
        { readonly code: "testPreview.frameResourcesMissing" },
      ];
    };

type PreviewPipelinePlan = {
  readonly family: string;
  readonly pipelineKey: string;
};

type PreviewPipelineLayouts = {
  readonly materialLayout: unknown;
};

type PreviewTextureSamplerDependencies = {
  readonly valid: true;
  readonly diagnostics: readonly [];
};

type PreviewFrameOptions = {
  readonly fail: boolean;
  readonly layout: unknown;
};

type PreviewAppResourceItem = QueuedMaterialAppResourceItem<
  PreviewMaterial,
  PreviewAdapter
>;

type PreviewFrameResourceCallbacks = QueuedMaterialFrameResourceSetCallbacks<
  PreviewAppResourceItem,
  PreviewPipeline,
  PreviewPipelinePlan,
  PreviewPipelineLayouts,
  PreviewTextureSamplerDependencies,
  PreviewFrameOptions,
  PreviewResources,
  PreviewResourceResult,
  PreviewMesh,
  PreviewBindGroup
>;

describe("generic app material adapter contract", () => {
  it("routes a test-only family through prepare, app item, and frame-resource contracts", async () => {
    const queueItem = previewQueueItem();
    const material: PreviewMaterial = {
      kind: "test-preview",
      label: "Preview material",
      tint: [0.25, 0.5, 0.75, 1],
    };
    const adapter: PreviewAdapter = {
      kind: "test-preview",
      routeLabel: "test-only",
      acceptsMaterial: (candidate): candidate is PreviewMaterial =>
        typeof candidate === "object" &&
        candidate !== null &&
        "kind" in candidate &&
        candidate.kind === "test-preview",
      validateQueueItem: (item) =>
        item.renderPhase === "opaque"
          ? null
          : {
              code: "testPreview.unsupportedPhase",
              renderPhase: item.renderPhase,
            },
      prepareRoute: (context) =>
        createQueuedMaterialPrepareRouteResult<PreviewDiagnostic>(context),
    };
    const registry = createQueuedMaterialAdapterRegistry<PreviewAdapter>([
      adapter,
    ]);

    const route = routeQueuedMaterialPrepare(registry, {
      queueItem,
      material,
      sourceVersion: 3,
      frame: 11,
    });
    const mismatch = routeQueuedMaterialPrepare(registry, {
      queueItem,
      material: { kind: "unlit" },
      sourceVersion: 3,
      frame: 11,
    });

    expect(route).toEqual({
      valid: true,
      status: "prepared",
      family: "test-preview",
      materialKey: "material:preview",
      meshResourceKey: "prepared-mesh:preview",
      materialResourceKey: "prepared-material:preview",
      pipelineKey: "test-preview|opaque",
      sourceVersion: 3,
      frame: 11,
      diagnostics: [],
    });
    expect(mismatch).toMatchObject({
      valid: false,
      status: "failed",
      diagnostics: [
        {
          code: "queuedMaterialPrepareRoute.materialMismatch",
          materialFamily: "test-preview",
          materialKind: "unlit",
        },
      ],
    });

    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute: route,
      adapter,
      draw: previewDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Preview mesh" }),
      meshKey: "prepared-mesh:preview",
      sourceMeshKey: "mesh:preview",
      material,
      materialKey: "prepared-material:preview",
      sourceMaterialKey: "material:preview",
    });
    const scratch = createQueuedMaterialFrameResourceScratch<
      PreviewPipelinePlan,
      PreviewMesh,
      PreviewBindGroup
    >();
    const appended: PreviewResources[] = [];

    const prepared = await prepareQueuedMaterialFrameResourceSet<
      typeof item,
      PreviewPipeline,
      PreviewPipelinePlan,
      PreviewPipelineLayouts,
      PreviewTextureSamplerDependencies,
      PreviewFrameOptions,
      PreviewResources,
      PreviewResourceResult,
      PreviewMesh,
      PreviewBindGroup
    >({
      items: [item],
      scratch,
      callbacks: previewFrameResourceCallbacks(appended, false),
    });
    const failed = await prepareQueuedMaterialFrameResourceSet<
      typeof item,
      PreviewPipeline,
      PreviewPipelinePlan,
      PreviewPipelineLayouts,
      PreviewTextureSamplerDependencies,
      PreviewFrameOptions,
      PreviewResources,
      PreviewResourceResult,
      PreviewMesh,
      PreviewBindGroup
    >({
      items: [item],
      scratch: createQueuedMaterialFrameResourceScratch<
        PreviewPipelinePlan,
        PreviewMesh,
        PreviewBindGroup
      >(),
      callbacks: previewFrameResourceCallbacks([], true),
    });

    expect(item.adapter.routeLabel).toBe("test-only");
    expect(prepared.valid).toBe(true);
    expect(prepared.pipelineResults).toEqual([
      { family: "test-preview", pipelineKey: "test-preview|opaque" },
    ]);
    expect(prepared.meshResourceKeys.get("mesh:preview")).toBe(
      "gpu-mesh:preview",
    );
    expect(prepared.materialResourceKeys.get("material:preview")).toBe(
      "gpu-material:preview",
    );
    expect(prepared.bindGroups).toMatchObject([
      {
        group: 2,
        resourceKey: "bind-group:preview|pipeline:test-preview|opaque",
      },
    ]);
    expect(appended).toHaveLength(1);
    expect(failed.valid).toBe(false);
    expect(failed.diagnostics).toEqual([
      { code: "testPreview.frameResourcesMissing" },
      {
        code: "testPreview.frameResourceRoute",
        family: "test-preview",
        materialKey: "material:preview",
      },
    ]);
    expect(JSON.stringify({ route, prepared, failed })).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|rawGpuHandle|testPreviewResourceSet/,
    );
  });
});

function previewFrameResourceCallbacks(
  appended: PreviewResources[],
  fail: boolean,
): PreviewFrameResourceCallbacks {
  return {
    getPipelineKey: (item) => item.queueItem.pipelineKey,
    getSourceMeshKey: (item) => item.sourceMeshKey,
    getSourceMaterialKey: (item) => item.sourceMaterialKey,
    getPipeline: () => ({
      valid: true as const,
      resource: {
        pipeline: { getBindGroupLayout: (group: number) => ({ group }) },
      },
      diagnostics: [] as const,
    }),
    getPipelineView: (pipeline) => pipeline,
    createPipelinePlanResult: ({ item }) => ({
      family: item.adapter.kind,
      pipelineKey: item.queueItem.pipelineKey,
    }),
    getPipelineLayouts: ({ getBindGroupLayout }) => ({
      materialLayout: getBindGroupLayout(2),
    }),
    prepareTextureSamplerDependencies: () => ({
      valid: true as const,
      diagnostics: [] as const,
    }),
    createFrameResourceOptions: ({ layouts }) => ({
      fail,
      layout: layouts.materialLayout,
    }),
    createFrameResources: ({ options }) =>
      options.fail
        ? {
            valid: false as const,
            resources: null,
            diagnostics: [
              { code: "testPreview.frameResourcesMissing" },
            ] as const,
          }
        : {
            valid: true as const,
            resources: {
              mesh: { resourceKey: "gpu-mesh:preview" },
              material: { resourceKey: "gpu-material:preview" },
              bindGroups: [
                {
                  group: 2,
                  resourceKey: "bind-group:preview",
                  layoutKey: "layout:preview",
                  bindGroup: {},
                  entryResourceKeys: ["gpu-material:preview"],
                },
              ],
            },
            diagnostics: [] as const,
          },
    appendFrameResources: ({ resources }) => {
      appended.push(resources);
    },
    createRouteDiagnostic: ({ item }) => ({
      code: "testPreview.frameResourceRoute",
      family: item.adapter.kind,
      materialKey: item.queueItem.materialKey,
    }),
    getMeshResource: (resources) => resources.mesh,
    getMeshResourceKey: (resources) => resources.mesh.resourceKey,
    getMaterialResourceKey: (resources) => resources.material.resourceKey,
    getBindGroups: (resources) => resources.bindGroups,
  };
}

function previewQueueItem(): MaterialQueueItem {
  return {
    renderId: 41,
    drawIndex: 0,
    entity: { index: 41, generation: 1 },
    renderPhase: "opaque",
    materialFamily: "test-preview",
    pipelineKey: "test-preview|opaque",
    meshKey: "mesh:preview",
    materialKey: "material:preview",
    meshResourceKey: "prepared-mesh:preview",
    materialResourceKey: "prepared-material:preview",
    meshLayoutKey: "mesh-layout:preview",
    topology: "triangle-list",
    depth: 0,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "test-preview|opaque",
      materialResourceKey: "prepared-material:preview",
      meshResourceKey: "prepared-mesh:preview",
      depth: 0,
      stableId: 41,
      drawIndex: 0,
    },
  };
}

function previewDrawPacket(): MeshDrawPacket {
  return {
    renderId: 41,
    entity: { index: 41, generation: 1 },
    mesh: { kind: "mesh", id: "preview" },
    material: { kind: "material", id: "preview" },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      depth: 0,
      stableId: 41,
    },
    batchKey: {
      pipelineKey: "test-preview|opaque",
      materialKey: "material:preview",
      meshKey: "mesh:preview",
      meshLayoutKey: "mesh-layout:preview",
      topology: "triangle-list",
      renderStateKey: "opaque",
    },
  } as unknown as MeshDrawPacket;
}
