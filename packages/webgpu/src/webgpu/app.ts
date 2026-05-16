import {
  AssetRegistry,
  assetHandleKey,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  RenderWorld,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MaterialAsset,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotTransformsScratch,
  type PackedSnapshotViewUniforms,
  type PackedSnapshotViewUniformsScratch,
  type RenderSnapshot,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import {
  assembleFrameBoundary,
  type FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
} from "./light-packing.js";
import { createStandardMaterialBindGroupLayoutPlan } from "./standard-bind-group-layout.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import {
  createStandardFrameGpuResources,
  type CreateStandardFrameGpuResourcesResult,
} from "./standard-frame-resources.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "./standard-pipeline.js";
import {
  createUnlitFrameGpuResources,
  type CreateUnlitFrameGpuResourcesResult,
} from "./unlit-frame-resources.js";
import {
  createUnlitBindGroupLayoutMetadata,
  type UnlitBindGroupLayoutResource,
} from "./unlit-bind-group.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "./unlit-pipeline.js";
import { createViewUniformBufferDescriptor } from "./view-uniform-buffer.js";
import { createWorldTransformBufferDescriptor } from "./world-transform-buffer.js";
import {
  createRenderFramePlanScratch,
  writeRenderFramePlanFromSnapshot,
  type RenderFramePlanScratch,
} from "./render-frame-plan.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "./index.js";

export interface WebGpuAppStepResult {
  readonly transform: TransformResolutionReport;
}

export interface WebGpuAppSpawnContext {
  readonly app: WebGpuApp;
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

export type WebGpuAppEntityInitializer = (
  entity: Entity,
  context: WebGpuAppSpawnContext,
) => void;

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly clearColor?: readonly number[];
  readonly label?: string;
}

export interface WebGpuAppRenderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly drawPackages: number;
  readonly drawCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: number;
}

export interface WebGpuAppResourceReuseReport {
  pipelineHits: number;
  pipelineMisses: number;
  meshBuffersCreated: number;
  meshBuffersReused: number;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  lightBuffersCreated: number;
  lightBuffersReused: number;
  dynamicBufferWrites: number;
}

export interface WebGpuAppRenderReport {
  readonly ok: boolean;
  readonly frame: number;
  readonly snapshot: RenderSnapshot;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly unknown[];
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly pipeline: WebGpuAppPipelineResourceResult | null;
  readonly resources: WebGpuAppFrameResourcesResult | null;
  readonly boundary: FrameBoundaryAssemblyReport | null;
}

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult;

export type WebGpuAppFrameResourcesResult =
  | CreateUnlitFrameGpuResourcesResult
  | CreateStandardFrameGpuResourcesResult;

type WebGpuAppMaterialKind = "unlit" | "standard";

interface WebGpuAppResourceCache {
  readonly pipelines: Map<string, WebGpuAppPipelineResourceResult>;
  readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
  readonly frameScratch: WebGpuAppFrameScratch;
  unlitFrame: CachedUnlitFrameResources | null;
  standardFrame: CachedStandardFrameResources | null;
}

interface WebGpuAppFrameScratch {
  readonly viewUniforms: PackedSnapshotViewUniformsScratch;
  readonly worldTransforms: PackedSnapshotTransformsScratch;
  readonly framePlan: RenderFramePlanScratch;
}

interface WebGpuAppPipelineLayouts {
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineResourceKey: string;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
}

interface CachedUnlitFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  result: CreateUnlitFrameGpuResourcesResult;
}

interface CachedStandardFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  readonly lightFloatByteLength: number;
  readonly lightMetadataByteLength: number;
  result: CreateStandardFrameGpuResourcesResult;
}

interface QueueWriteBufferDeviceLike {
  readonly queue?: {
    writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
}

export interface WebGpuApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly initialization: WebGpuInitializationSuccess;
  readonly renderWorld: RenderWorld;
  spawn(...initializers: WebGpuAppEntityInitializer[]): Entity;
  registerSystem(system: Parameters<EcsWorld["registerSystem"]>[0]): WebGpuApp;
  step(delta?: number, time?: number): WebGpuAppStepResult;
  extract(frame?: number): RenderSnapshot;
  render(options?: WebGpuAppRenderOptions): Promise<WebGpuAppRenderReport>;
  stepAndRender(
    delta?: number,
    time?: number,
    frame?: number,
  ): Promise<WebGpuAppRenderReport>;
}

export interface CreateWebGpuAppOptions extends Omit<
  InitializeWebGpuOptions,
  "canvas"
> {
  readonly canvas: WebGpuCanvasLike;
  readonly assets?: AssetRegistry;
  readonly world?: EcsWorld;
  readonly worldOptions?: Partial<WorldOptions>;
}

export interface CreateWebGpuAppSuccess {
  readonly ok: true;
  readonly app: WebGpuApp;
  readonly initialization: WebGpuInitializationSuccess;
}

export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const world = options.world ?? createWorld(options.worldOptions);
  const assets = options.assets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const resourceCache = createWebGpuAppResourceCache();

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);

  const app: WebGpuApp = {
    world,
    assets,
    initialization,
    renderWorld,
    spawn(...initializers) {
      const entity = world.createEntity();
      const context: WebGpuAppSpawnContext = { app, world, assets };

      for (const initializer of initializers) {
        initializer(entity, context);
      }

      return entity;
    },
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    step(delta = 0, time = 0) {
      world.update(delta, time);
      return { transform: resolveWorldTransforms(world) };
    },
    extract(frame = 0) {
      return extractRenderSnapshot(world, assets, { frame });
    },
    async render(renderOptions = {}) {
      return renderWebGpuAppFrame(app, resourceCache, renderOptions);
    },
    async stepAndRender(delta = 0, time = 0, frame = 0) {
      this.step(delta, time);
      return this.render({ frame });
    },
  };

  return { ok: true, app, initialization };
}

function createWebGpuAppResourceCache(): WebGpuAppResourceCache {
  return {
    pipelines: new Map(),
    layouts: new Map(),
    frameScratch: createWebGpuAppFrameScratch(),
    unlitFrame: null,
    standardFrame: null,
  };
}

function createWebGpuAppFrameScratch(): WebGpuAppFrameScratch {
  return {
    viewUniforms: createPackedSnapshotViewUniformsScratch(),
    worldTransforms: createPackedSnapshotTransformsScratch(),
    framePlan: createRenderFramePlanScratch(),
  };
}

async function getOrCreateWebGpuAppPipeline(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineKey: string;
  readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
}): Promise<WebGpuAppPipelineResourceResult> {
  const key = [
    options.kind,
    options.app.initialization.format,
    options.pipelineKey,
  ].join("|");
  const cached = options.cache.pipelines.get(key);

  if (cached !== undefined) {
    options.reuse.pipelineHits += 1;
    return cached;
  }

  options.reuse.pipelineMisses += 1;

  const pipeline =
    options.kind === "standard"
      ? await createStandardRenderPipelineResource({
          device: options.app.initialization.device as Parameters<
            typeof createStandardRenderPipelineResource
          >[0]["device"],
          colorFormat: options.app.initialization.format,
          batchKey: options.batchKey,
        })
      : await createUnlitRenderPipelineResource({
          device: options.app.initialization.device as Parameters<
            typeof createUnlitRenderPipelineResource
          >[0]["device"],
          colorFormat: options.app.initialization.format,
          batchKey: options.batchKey,
        });

  if (pipeline.valid && pipeline.resource !== null) {
    options.cache.pipelines.set(key, pipeline);
  }

  return pipeline;
}

function getWebGpuAppPipelineLayouts(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipeline: WebGpuAppPipelineResourceResult;
  readonly getBindGroupLayout: (group: number) => unknown;
}): WebGpuAppPipelineLayouts {
  const pipelineResourceKey = options.pipeline.resource?.cacheKey ?? "missing";
  const key = `${options.kind}|${pipelineResourceKey}`;
  const cached = options.cache.layouts.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const layouts =
    options.kind === "standard"
      ? createStandardAppPipelineLayouts(
          pipelineResourceKey,
          options.getBindGroupLayout,
        )
      : createUnlitAppPipelineLayouts(
          pipelineResourceKey,
          options.getBindGroupLayout,
        );

  options.cache.layouts.set(key, layouts);
  return layouts;
}

function createUnlitAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "unlit",
    pipelineResourceKey,
    sharedLayouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `webgpu-app/unlit/group-${group}`,
      layout: getBindGroupLayout(group),
    })),
    materialLayout: null,
    lightLayout: null,
  };
}

function createStandardAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "standard",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/standard/group-${group}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/standard/group-${group}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: "webgpu-app/standard/group-2",
      layout: getBindGroupLayout(2),
      descriptor: createStandardMaterialBindGroupLayoutPlan(
        "webgpu-app/standard/group-2",
      ).layout,
    },
    lightLayout: {
      group: 3,
      layoutKey: "webgpu-app/standard/group-3",
      layout: getBindGroupLayout(3),
      descriptor: createLightBindGroupLayoutDescriptor({
        group: 3,
        label: "webgpu-app/standard/group-3",
      }),
    },
  };
}

function createOrReuseUnlitAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: MaterialAsset | null;
  readonly materialKey: string;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateUnlitFrameGpuResourcesResult {
  const viewDescriptor = createViewUniformBufferDescriptor(
    options.viewUniforms,
  );
  const transformDescriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );
  const cached = options.cache.unlitFrame;

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    cached.result.resources !== null &&
    viewDescriptor.plan !== null &&
    transformDescriptor.plan !== null &&
    cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
    cached.worldTransformByteLength ===
      transformDescriptor.plan.source.byteLength &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.viewUniform.buffer,
      viewDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.worldTransforms.buffer,
      transformDescriptor.plan.source,
    )
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.dynamicBufferWrites += 2;

    const resources = cached.result.resources;
    const result: CreateUnlitFrameGpuResourcesResult = {
      valid: true,
      resources: {
        ...resources,
        viewUniform: {
          ...resources.viewUniform,
          views: viewDescriptor.plan.views,
        },
        worldTransforms: {
          ...resources.worldTransforms,
          offsets: transformDescriptor.plan.offsets,
        },
      },
      diagnostics: [],
    };

    cached.result = result;
    return result;
  }

  const result = createUnlitFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createUnlitFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    material: options.material,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    layouts: options.layouts.sharedLayouts,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.cache.unlitFrame = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      viewByteLength: options.viewUniforms.data.byteLength,
      worldTransformByteLength: options.worldTransforms.data.byteLength,
      result,
    };
  }

  return result;
}

function createOrReuseStandardAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: StandardMaterialAsset | null;
  readonly materialKey: string;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateStandardFrameGpuResourcesResult {
  const viewDescriptor = createViewUniformBufferDescriptor(
    options.viewUniforms,
  );
  const transformDescriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );
  const lightBuffer = createLightBufferDescriptor(options.snapshot);
  const lightDescriptor = createLightBufferDescriptorPlan(lightBuffer);
  const cached = options.cache.standardFrame;

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    cached.result.resources !== null &&
    cached.result.resources.lightGpuBuffers.resource !== null &&
    viewDescriptor.plan !== null &&
    transformDescriptor.plan !== null &&
    lightDescriptor.plan !== null &&
    cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
    cached.worldTransformByteLength ===
      transformDescriptor.plan.source.byteLength &&
    cached.lightFloatByteLength ===
      lightDescriptor.plan.source.floats.byteLength &&
    cached.lightMetadataByteLength ===
      lightDescriptor.plan.source.metadata.byteLength &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.viewUniform.buffer,
      viewDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.worldTransforms.buffer,
      transformDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.lightGpuBuffers.resource.floatBuffer,
      lightDescriptor.plan.source.floats,
    ) &&
    writeBufferData(
      options.app.initialization.device,
      cached.result.resources.lightGpuBuffers.resource.metadataBuffer,
      lightDescriptor.plan.source.metadata,
    )
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.lightBuffersReused += 1;
    options.reuse.dynamicBufferWrites += 4;

    const resources = cached.result.resources;
    const result: CreateStandardFrameGpuResourcesResult = {
      valid: true,
      resources: {
        ...resources,
        viewUniform: {
          ...resources.viewUniform,
          views: viewDescriptor.plan.views,
        },
        worldTransforms: {
          ...resources.worldTransforms,
          offsets: transformDescriptor.plan.offsets,
        },
        lightGpuBuffers: {
          valid: true,
          lightBuffer,
          descriptorPlan: lightDescriptor.plan,
          resource: resources.lightGpuBuffers.resource,
          diagnostics: [],
        },
      },
      diagnostics: [],
    };

    cached.result = result;
    return result;
  }

  const result = createStandardFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createStandardFrameGpuResources
    >[0]["device"],
    snapshot: options.snapshot,
    mesh: options.mesh,
    material: options.material,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    sharedLayouts: options.layouts.sharedLayouts,
    materialLayout: options.layouts.materialLayout,
    lightLayout: options.layouts.lightLayout,
  });

  if (
    result.valid &&
    result.resources !== null &&
    result.resources.lightGpuBuffers.descriptorPlan !== null
  ) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.reuse.lightBuffersCreated += 1;
    options.cache.standardFrame = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      viewByteLength: options.viewUniforms.data.byteLength,
      worldTransformByteLength: options.worldTransforms.data.byteLength,
      lightFloatByteLength:
        result.resources.lightGpuBuffers.descriptorPlan.source.floats
          .byteLength,
      lightMetadataByteLength:
        result.resources.lightGpuBuffers.descriptorPlan.source.metadata
          .byteLength,
      result,
    };
  }

  return result;
}

function sourceAssetCacheKey(
  handle: Parameters<typeof assetHandleKey>[0],
  version: number,
): string {
  return `${assetHandleKey(handle)}@${version}`;
}

function writeBufferData(
  device: unknown,
  buffer: unknown,
  data: ArrayBufferView,
): boolean {
  const queue = (device as QueueWriteBufferDeviceLike).queue;

  if (queue?.writeBuffer === undefined) {
    return false;
  }

  queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return true;
}

async function renderWebGpuAppFrame(
  app: WebGpuApp,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const reuse = createWebGpuAppResourceReuseReport();
  const snapshot = options.snapshot ?? app.extract(options.frame ?? 0);
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        {
          code: "webGpuApp.emptySnapshot",
          message:
            "WebGPU app render requires at least one view and one mesh draw.",
        },
      ],
    });
  }

  const meshEntry = app.assets.get<"mesh", MeshAsset>(firstDraw.mesh);
  const materialEntry = app.assets.get<"material", MaterialAsset>(
    firstDraw.material,
  );
  const mesh = meshEntry?.asset ?? null;
  const material = materialEntry?.asset ?? null;

  if (mesh === null || material === null) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingSourceAsset",
          message: "WebGPU app render requires ready mesh and material assets.",
        },
      ],
    });
  }

  if (material.kind !== "unlit" && material.kind !== "standard") {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit and standard materials, not '${material.kind}'.`,
        },
      ],
    });
  }

  const materialKind = material.kind;
  const pipeline = await getOrCreateWebGpuAppPipeline({
    app,
    cache: resourceCache,
    reuse,
    kind: materialKind,
    pipelineKey: firstDraw.batchKey.pipelineKey,
    batchKey: firstDraw.batchKey,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: pipeline.diagnostics,
    });
  }

  const pipelineHandle = pipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingPipelineLayouts",
          message:
            "The WebGPU app pipeline does not expose bind group layouts.",
        },
      ],
    });
  }

  const getBindGroupLayout =
    pipelineHandle.getBindGroupLayout.bind(pipelineHandle);
  const layouts = getWebGpuAppPipelineLayouts({
    cache: resourceCache,
    kind: materialKind,
    pipeline,
    getBindGroupLayout,
  });
  const packedViews = writePackedSnapshotViewUniforms(
    snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  const resources =
    materialKind === "standard"
      ? createOrReuseStandardAppFrameResources({
          app,
          cache: resourceCache,
          snapshot,
          mesh,
          meshKey: sourceAssetCacheKey(
            firstDraw.mesh,
            meshEntry?.version ?? -1,
          ),
          material: material as StandardMaterialAsset,
          materialKey: sourceAssetCacheKey(
            firstDraw.material,
            materialEntry?.version ?? -1,
          ),
          viewUniforms: packedViews,
          worldTransforms: packedTransforms,
          layouts,
          reuse,
        })
      : createOrReuseUnlitAppFrameResources({
          app,
          cache: resourceCache,
          mesh,
          meshKey: sourceAssetCacheKey(
            firstDraw.mesh,
            meshEntry?.version ?? -1,
          ),
          material,
          materialKey: sourceAssetCacheKey(
            firstDraw.material,
            materialEntry?.version ?? -1,
          ),
          viewUniforms: packedViews,
          worldTransforms: packedTransforms,
          layouts,
          reuse,
        });

  if (!resources.valid || resources.resources === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...resources.diagnostics,
      ],
    });
  }

  const frameResources = resources.resources;
  const pipelineResult = {
    ok: true as const,
    status: "miss" as const,
    key: firstDraw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot,
    renderWorld: app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      draw.mesh.id === firstDraw.mesh.id
        ? frameResources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === firstDraw.material.id
        ? frameResources.material.resourceKey
        : null,
    meshResources: [frameResources.mesh],
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: resourceCache.frameScratch.framePlan,
  });
  const boundary = assembleFrameBoundary({
    context: app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    clearColor: options.clearColor ?? [0, 0, 0, 1],
  });

  await waitForSubmittedWork(app.initialization.device);

  return renderReport({
    ok:
      framePlan.apply.diagnostics.length === 0 &&
      framePlan.bindingPlan.diagnostics.length === 0 &&
      framePlan.packages.diagnostics.length === 0 &&
      framePlan.drawCommands.diagnostics.length === 0 &&
      framePlan.drawList.valid &&
      framePlan.resources.valid &&
      framePlan.commandPlan.valid &&
      boundary.valid,
    snapshot,
    pipeline,
    resources,
    boundary,
    resourceReuse: reuse,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: framePlan.commandPlan.commands.length,
    drawCalls: framePlan.commandPlan.drawCount,
    diagnostics: [
      ...snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    ],
  });
}

function renderReport(input: {
  readonly ok: boolean;
  readonly snapshot: RenderSnapshot;
  readonly diagnostics: readonly unknown[];
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
  readonly pipeline?: WebGpuAppPipelineResourceResult | null;
  readonly resources?: WebGpuAppFrameResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
  readonly drawPackages?: number;
  readonly drawCommands?: number;
  readonly drawCalls?: number;
}): WebGpuAppRenderReport {
  return {
    ok: input.ok,
    frame: input.snapshot.frame,
    snapshot: input.snapshot,
    counts: {
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: input.diagnostics.length,
    },
    diagnostics: input.diagnostics,
    resourceReuse: input.resourceReuse ?? createWebGpuAppResourceReuseReport(),
    pipeline: input.pipeline ?? null,
    resources: input.resources ?? null,
    boundary: input.boundary ?? null,
  };
}

function createWebGpuAppResourceReuseReport(): WebGpuAppResourceReuseReport {
  return {
    pipelineHits: 0,
    pipelineMisses: 0,
    meshBuffersCreated: 0,
    meshBuffersReused: 0,
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
    dynamicBufferWrites: 0,
  };
}

async function waitForSubmittedWork(device: unknown): Promise<void> {
  const queue = (
    device as { readonly queue?: { onSubmittedWorkDone?: () => Promise<void> } }
  ).queue;

  if (typeof queue?.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }
}
