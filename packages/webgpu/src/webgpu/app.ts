import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
  type SamplerHandle,
  type TextureHandle,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  RenderWorld,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  createMaterialDependencyReadinessReport,
  extractRenderSnapshot,
  Material,
  materialDependencyReadinessReportToJsonValue,
  registerRenderAuthoringComponents,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type MatcapMaterialAsset,
  type MaterialAsset,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotTransformsScratch,
  type PackedSnapshotViewUniforms,
  type PackedSnapshotViewUniformsScratch,
  type RenderSnapshot,
  type SamplerAsset,
  type StandardMaterialAsset,
  type TextureAsset,
  type TextureUsage,
  type UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  assembleFrameBoundary,
  type FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  createMatcapFrameGpuResources,
  type CreateMatcapFrameGpuResourcesResult,
  type MatcapFrameGpuResources,
} from "./matcap-frame-resources.js";
import { type MatcapMaterialBindGroupLayoutResource } from "./matcap-bind-group.js";
import { createMatcapMaterialBindGroupLayoutPlan } from "./matcap-bind-group-layout.js";
import {
  createMatcapRenderPipelineResource,
  type CreateMatcapRenderPipelineResourceResult,
} from "./matcap-pipeline.js";
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
  createMultiMaterialUnlitFrameGpuResources,
  createUnlitFrameGpuResources,
  type CreateMultiMaterialUnlitFrameGpuResourcesResult,
  type CreateUnlitFrameGpuResourcesResult,
  type UnlitFrameGpuResources,
} from "./unlit-frame-resources.js";
import {
  createUnlitBindGroupLayoutMetadata,
  type UnlitBindGroupLayoutResource,
} from "./unlit-bind-group.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "./unlit-pipeline.js";
import {
  WEBGPU_TEXTURE_USAGE_FLAGS,
  createSamplerGpuResource,
  createTextureGpuResource,
  type SamplerGpuResource,
  type TextureDescriptorInput,
  type TextureGpuResource,
  type TextureGpuResourceDiagnostic,
  type TextureUploadInput,
} from "./texture-resources.js";
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
  textureResourcesCreated: number;
  textureResourcesReused: number;
  samplerResourcesCreated: number;
  samplerResourcesReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  lightBuffersCreated: number;
  lightBuffersReused: number;
  dynamicBufferWrites: number;
}

export interface WebGpuAppSingleResourceSetDiagnostic {
  readonly code: "webGpuApp.additionalDrawResourceUnsupported";
  readonly message: string;
  readonly resourceSetIndex: number;
  readonly drawIndex: number;
  readonly renderId: number;
  readonly firstMeshKey: string;
  readonly firstMaterialKey: string;
  readonly drawMeshKey: string;
  readonly drawMaterialKey: string;
}

export interface WebGpuAppMaterialDependencyDiagnostic {
  readonly code: "webGpuApp.materialDependenciesNotReady";
  readonly message: string;
  readonly materialDependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface WebGpuAppDrawResourceSet {
  readonly index: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly drawIndices: readonly number[];
  readonly renderIds: readonly number[];
}

export interface WebGpuAppDrawResourceSetPlan {
  readonly sets: readonly WebGpuAppDrawResourceSet[];
  readonly drawCount: number;
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

export type WebGpuAppJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly WebGpuAppJsonValue[]
  | { readonly [key: string]: WebGpuAppJsonValue };

export interface WebGpuAppRenderReportJsonValue {
  readonly ok: boolean;
  readonly frame: number;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly WebGpuAppJsonValue[];
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateMatcapRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult;

export type WebGpuAppFrameResourcesResult =
  | CreateUnlitFrameGpuResourcesResult
  | CreateMultiMaterialUnlitFrameGpuResourcesResult
  | CreateMatcapFrameGpuResourcesResult
  | CreateStandardFrameGpuResourcesResult
  | CreateMixedUnlitMatcapFrameResourcesResult;

type WebGpuAppMaterialKind = "unlit" | "matcap" | "standard";

interface WebGpuAppResourceCache {
  readonly pipelines: Map<string, WebGpuAppPipelineResourceResult>;
  readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
  readonly textures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
  readonly frameScratch: WebGpuAppFrameScratch;
  unlitFrame: CachedUnlitFrameResources | null;
  matcapFrame: CachedMatcapFrameResources | null;
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
  readonly materialLayout:
    | MatcapMaterialBindGroupLayoutResource
    | StandardMaterialBindGroupLayoutResource
    | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
}

interface CachedUnlitFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  result: CreateUnlitFrameGpuResourcesResult;
}

interface CachedMatcapFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  result: CreateMatcapFrameGpuResourcesResult;
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

interface MultiUnlitAppResourceSet {
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly materialKeys: readonly string[];
}

interface MixedUnlitMatcapAppResourceSet {
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly unlit: {
    readonly draw: RenderSnapshot["meshDraws"][number];
    readonly material: UnlitMaterialAsset;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
  };
  readonly matcap: {
    readonly draw: RenderSnapshot["meshDraws"][number];
    readonly material: MatcapMaterialAsset;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
  };
}

interface MixedUnlitMatcapFrameResources {
  readonly mesh: UnlitFrameGpuResources["mesh"];
  readonly viewUniform: UnlitFrameGpuResources["viewUniform"];
  readonly worldTransforms: UnlitFrameGpuResources["worldTransforms"];
  readonly unlit: UnlitFrameGpuResources;
  readonly matcap: MatcapFrameGpuResources;
  readonly bindGroups: readonly UnlitFrameGpuResources["bindGroups"][number][];
}

interface CreateMixedUnlitMatcapFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: MixedUnlitMatcapFrameResources | null;
  readonly diagnostics: readonly unknown[];
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

export interface WebGpuAppPreparedTextureSamplerDiagnostic {
  readonly code:
    | "webGpuApp.textureSourceNotReady"
    | "webGpuApp.samplerSourceNotReady";
  readonly message: string;
  readonly resourceKey: string;
  readonly status: string;
}

type WebGpuAppTextureSamplerPreparationDiagnostic =
  | WebGpuAppPreparedTextureSamplerDiagnostic
  | TextureGpuResourceDiagnostic;

interface PreparedAppTextureSamplerResources {
  readonly valid: boolean;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly diagnostics: readonly WebGpuAppTextureSamplerPreparationDiagnostic[];
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
    textures: new Map(),
    samplers: new Map(),
    frameScratch: createWebGpuAppFrameScratch(),
    unlitFrame: null,
    matcapFrame: null,
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
      : options.kind === "matcap"
        ? await createMatcapRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createMatcapRenderPipelineResource
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
      : options.kind === "matcap"
        ? createMatcapAppPipelineLayouts(
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

function createMatcapAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "matcap",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/matcap/group-${group}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/matcap/group-${group}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: "webgpu-app/matcap/group-2",
      layout: getBindGroupLayout(2),
      descriptor: createMatcapMaterialBindGroupLayoutPlan(
        "webgpu-app/matcap/group-2",
      ).layout,
    },
    lightLayout: null,
  };
}

function createOrReuseUnlitAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: MaterialAsset | null;
  readonly materialKey: string;
  readonly textures: PreparedAppTextureSamplerResources;
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
    sameStringList(cached.textureKeys, options.textures.textureKeys) &&
    sameStringList(cached.samplerKeys, options.textures.samplerKeys) &&
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
    textures: options.textures.textures,
    samplers: options.textures.samplers,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.cache.unlitFrame = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      textureKeys: [...options.textures.textureKeys],
      samplerKeys: [...options.textures.samplerKeys],
      viewByteLength:
        viewDescriptor.plan?.source.byteLength ??
        options.viewUniforms.data.byteLength,
      worldTransformByteLength:
        transformDescriptor.plan?.source.byteLength ??
        options.worldTransforms.data.byteLength,
      result,
    };
  }

  return result;
}

function createMultiUnlitAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly mesh: MeshAsset | null;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateMultiMaterialUnlitFrameGpuResourcesResult {
  const result = createMultiMaterialUnlitFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createMultiMaterialUnlitFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    materials: options.materials,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    layouts: options.layouts.sharedLayouts,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += result.resources.materials.length;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
  }

  return result;
}

function createOrReuseMatcapAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: MatcapMaterialAsset | null;
  readonly materialKey: string;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateMatcapFrameGpuResourcesResult {
  const viewDescriptor = createViewUniformBufferDescriptor(
    options.viewUniforms,
  );
  const transformDescriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );
  const cached = options.cache.matcapFrame;

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    sameStringList(cached.textureKeys, options.textures.textureKeys) &&
    sameStringList(cached.samplerKeys, options.textures.samplerKeys) &&
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
    const result: CreateMatcapFrameGpuResourcesResult = {
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

  const result = createMatcapFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createMatcapFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    material: options.material,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    sharedLayouts: options.layouts.sharedLayouts,
    materialLayout: options.layouts
      .materialLayout as MatcapMaterialBindGroupLayoutResource | null,
    textures: options.textures.textures,
    samplers: options.textures.samplers,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.cache.matcapFrame = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      textureKeys: [...options.textures.textureKeys],
      samplerKeys: [...options.textures.samplerKeys],
      viewByteLength:
        viewDescriptor.plan?.source.byteLength ??
        options.viewUniforms.data.byteLength,
      worldTransformByteLength:
        transformDescriptor.plan?.source.byteLength ??
        options.worldTransforms.data.byteLength,
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
    materialLayout: options.layouts
      .materialLayout as StandardMaterialBindGroupLayoutResource | null,
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
      viewByteLength:
        viewDescriptor.plan?.source.byteLength ??
        options.viewUniforms.data.byteLength,
      worldTransformByteLength:
        transformDescriptor.plan?.source.byteLength ??
        options.worldTransforms.data.byteLength,
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

function prepareUnlitAppTextureSamplerResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly material: UnlitMaterialAsset;
  readonly reuse: WebGpuAppResourceReuseReport;
}): PreparedAppTextureSamplerResources {
  const binding = options.material.baseColorTexture;

  if (binding === null) {
    return emptyPreparedAppTextureSamplerResources();
  }

  const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
  const textures: TextureGpuResource[] = [];
  const samplers: SamplerGpuResource[] = [];
  const textureKeys: string[] = [];
  const samplerKeys: string[] = [];

  if (binding.texture !== null) {
    const texture = prepareAppTextureResource({
      app: options.app,
      cache: options.cache,
      handle: binding.texture,
      reuse: options.reuse,
      diagnostics,
    });

    if (texture !== null) {
      textures.push(texture.resource);
      textureKeys.push(texture.cacheKey);
    }
  }

  if (binding.sampler !== null) {
    const sampler = prepareAppSamplerResource({
      app: options.app,
      cache: options.cache,
      handle: binding.sampler,
      reuse: options.reuse,
      diagnostics,
    });

    if (sampler !== null) {
      samplers.push(sampler.resource);
      samplerKeys.push(sampler.cacheKey);
    }
  }

  return {
    valid:
      diagnostics.length === 0 &&
      binding.texture !== null &&
      binding.sampler !== null &&
      textures.length === 1 &&
      samplers.length === 1,
    textures,
    samplers,
    textureKeys,
    samplerKeys,
    diagnostics,
  };
}

function prepareMatcapAppTextureSamplerResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly material: MatcapMaterialAsset;
  readonly reuse: WebGpuAppResourceReuseReport;
}): PreparedAppTextureSamplerResources {
  const binding = options.material.matcapTexture;
  const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
  const textures: TextureGpuResource[] = [];
  const samplers: SamplerGpuResource[] = [];
  const textureKeys: string[] = [];
  const samplerKeys: string[] = [];

  if (binding === null || binding.texture === null) {
    diagnostics.push({
      code: "webGpuApp.textureSourceNotReady",
      resourceKey: "matcapTexture.texture",
      status: "missing",
      message:
        "Matcap app rendering requires a ready matcap texture source asset.",
    });
  } else {
    const texture = prepareAppTextureResource({
      app: options.app,
      cache: options.cache,
      handle: binding.texture,
      reuse: options.reuse,
      diagnostics,
    });

    if (texture !== null) {
      textures.push(texture.resource);
      textureKeys.push(texture.cacheKey);
    }
  }

  if (binding === null || binding.sampler === null) {
    diagnostics.push({
      code: "webGpuApp.samplerSourceNotReady",
      resourceKey: "matcapTexture.sampler",
      status: "missing",
      message:
        "Matcap app rendering requires a ready matcap sampler source asset.",
    });
  } else {
    const sampler = prepareAppSamplerResource({
      app: options.app,
      cache: options.cache,
      handle: binding.sampler,
      reuse: options.reuse,
      diagnostics,
    });

    if (sampler !== null) {
      samplers.push(sampler.resource);
      samplerKeys.push(sampler.cacheKey);
    }
  }

  return {
    valid:
      diagnostics.length === 0 &&
      textures.length === 1 &&
      samplers.length === 1,
    textures,
    samplers,
    textureKeys,
    samplerKeys,
    diagnostics,
  };
}

function emptyPreparedAppTextureSamplerResources(): PreparedAppTextureSamplerResources {
  return {
    valid: true,
    textures: [],
    samplers: [],
    textureKeys: [],
    samplerKeys: [],
    diagnostics: [],
  };
}

function prepareAppTextureResource(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly handle: TextureHandle;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
}): {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
} | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.app.assets.get<"texture", TextureAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "webGpuApp.textureSourceNotReady",
      resourceKey,
      status: entry?.status ?? "missing",
      message: `Texture source asset '${resourceKey}' is not ready for app rendering.`,
    });
    return null;
  }

  const cacheKey = sourceAssetCacheKey(options.handle, entry.version);
  const cached = options.cache.textures.get(cacheKey);

  if (cached !== undefined) {
    options.reuse.textureResourcesReused += 1;
    return { cacheKey, resource: cached };
  }

  const upload = textureUploadFromAsset(entry.asset);
  const result = createTextureGpuResource({
    device: options.app.initialization.device as Parameters<
      typeof createTextureGpuResource
    >[0]["device"],
    resourceKey,
    descriptor: textureDescriptorFromAsset(entry.asset),
    ...(upload === null ? {} : { upload }),
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.textures.set(cacheKey, result.resource);
  options.reuse.textureResourcesCreated += 1;
  return { cacheKey, resource: result.resource };
}

function prepareAppSamplerResource(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly handle: SamplerHandle;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
}): {
  readonly cacheKey: string;
  readonly resource: SamplerGpuResource;
} | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.app.assets.get<"sampler", SamplerAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "webGpuApp.samplerSourceNotReady",
      resourceKey,
      status: entry?.status ?? "missing",
      message: `Sampler source asset '${resourceKey}' is not ready for app rendering.`,
    });
    return null;
  }

  const cacheKey = sourceAssetCacheKey(options.handle, entry.version);
  const cached = options.cache.samplers.get(cacheKey);

  if (cached !== undefined) {
    options.reuse.samplerResourcesReused += 1;
    return { cacheKey, resource: cached };
  }

  const result = createSamplerGpuResource({
    device: options.app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey,
    sampler: entry.asset,
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.samplers.set(cacheKey, result.resource);
  options.reuse.samplerResourcesCreated += 1;
  return { cacheKey, resource: result.resource };
}

function textureDescriptorFromAsset(
  texture: TextureAsset,
): TextureDescriptorInput {
  return {
    label: texture.label,
    size: [texture.width, texture.height, texture.depthOrLayers],
    format: texture.format,
    mipLevelCount: texture.mipLevelCount,
    usage: textureUsageFlags(texture.usage),
  };
}

function textureUploadFromAsset(
  texture: TextureAsset,
): TextureUploadInput | null {
  if (texture.sourceData === undefined) {
    return null;
  }

  return {
    data: texture.sourceData.bytes,
    bytesPerRow: texture.sourceData.bytesPerRow,
    ...(texture.sourceData.rowsPerImage === undefined
      ? {}
      : { rowsPerImage: texture.sourceData.rowsPerImage }),
  };
}

function textureUsageFlags(usages: readonly TextureUsage[]): number {
  let flags = 0;

  for (const usage of usages) {
    switch (usage) {
      case "sampled":
        flags |= WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING;
        break;
      case "copy-dst":
        flags |= WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST;
        break;
      case "render-attachment":
        flags |= WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT;
        break;
    }
  }

  return flags === 0 ? WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING : flags;
}

function sameStringList(
  first: readonly string[],
  second: readonly string[],
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }

  return true;
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

function collectMultiUnlitAppResourceSet(options: {
  readonly app: WebGpuApp;
  readonly snapshot: RenderSnapshot;
  readonly plan: WebGpuAppDrawResourceSetPlan;
  readonly firstDraw: RenderSnapshot["meshDraws"][number];
}): MultiUnlitAppResourceSet | null {
  if (options.plan.sets.length <= 1) {
    return null;
  }

  const meshKey = options.plan.sets[0]?.meshKey;
  const pipelineKey = options.firstDraw.batchKey.pipelineKey;
  const materials: UnlitMaterialAsset[] = [];
  const materialKeys: string[] = [];

  if (meshKey === undefined) {
    return null;
  }

  for (const set of options.plan.sets) {
    if (set.meshKey !== meshKey) {
      return null;
    }

    const firstDrawIndex = set.drawIndices[0];
    const draw =
      firstDrawIndex === undefined
        ? undefined
        : options.snapshot.meshDraws[firstDrawIndex];

    if (draw === undefined || draw.batchKey.pipelineKey !== pipelineKey) {
      return null;
    }

    const entry = options.app.assets.get<"material", MaterialAsset>(
      draw.material,
    );

    if (
      entry === undefined ||
      entry.status !== "ready" ||
      entry.asset === null ||
      entry.asset.kind !== "unlit" ||
      entry.asset.baseColorTexture !== null
    ) {
      return null;
    }

    materials.push(entry.asset);
    materialKeys.push(assetHandleKey(draw.material));
  }

  const meshEntry = options.app.assets.get<"mesh", MeshAsset>(
    options.firstDraw.mesh,
  );

  if (
    meshEntry === undefined ||
    meshEntry.status !== "ready" ||
    meshEntry.asset === null
  ) {
    return null;
  }

  return {
    mesh: meshEntry.asset,
    meshKey: sourceAssetCacheKey(options.firstDraw.mesh, meshEntry.version),
    materials,
    materialKeys,
  };
}

function collectMixedUnlitMatcapAppResourceSet(options: {
  readonly app: WebGpuApp;
  readonly snapshot: RenderSnapshot;
  readonly plan: WebGpuAppDrawResourceSetPlan;
  readonly firstDraw: RenderSnapshot["meshDraws"][number];
}): MixedUnlitMatcapAppResourceSet | null {
  if (options.plan.sets.length !== 2) {
    return null;
  }

  const meshKey = options.plan.sets[0]?.meshKey;

  if (meshKey === undefined) {
    return null;
  }

  let unlit: MixedUnlitMatcapAppResourceSet["unlit"] | null = null;
  let matcap: MixedUnlitMatcapAppResourceSet["matcap"] | null = null;

  for (const set of options.plan.sets) {
    if (set.meshKey !== meshKey) {
      return null;
    }

    const firstDrawIndex = set.drawIndices[0];
    const draw =
      firstDrawIndex === undefined
        ? undefined
        : options.snapshot.meshDraws[firstDrawIndex];

    if (draw === undefined) {
      return null;
    }

    const entry = options.app.assets.get<"material", MaterialAsset>(
      draw.material,
    );

    if (
      entry === undefined ||
      entry.status !== "ready" ||
      entry.asset === null
    ) {
      return null;
    }

    if (entry.asset.kind === "unlit" && entry.asset.baseColorTexture === null) {
      if (unlit !== null) {
        return null;
      }

      unlit = {
        draw,
        material: entry.asset,
        materialKey: sourceAssetCacheKey(draw.material, entry.version),
        sourceMaterialKey: assetHandleKey(draw.material),
      };
      continue;
    }

    if (entry.asset.kind === "matcap") {
      if (matcap !== null) {
        return null;
      }

      matcap = {
        draw,
        material: entry.asset,
        materialKey: sourceAssetCacheKey(draw.material, entry.version),
        sourceMaterialKey: assetHandleKey(draw.material),
      };
      continue;
    }

    return null;
  }

  const meshEntry = options.app.assets.get<"mesh", MeshAsset>(
    options.firstDraw.mesh,
  );

  if (
    meshEntry === undefined ||
    meshEntry.status !== "ready" ||
    meshEntry.asset === null ||
    unlit === null ||
    matcap === null
  ) {
    return null;
  }

  return {
    mesh: meshEntry.asset,
    meshKey: sourceAssetCacheKey(options.firstDraw.mesh, meshEntry.version),
    unlit,
    matcap,
  };
}

async function renderMixedUnlitMatcapWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly firstDraw: RenderSnapshot["meshDraws"][number];
  readonly resourceSet: MixedUnlitMatcapAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
}): Promise<WebGpuAppRenderReport> {
  const unlitPipeline = await getOrCreateWebGpuAppPipeline({
    app: options.app,
    cache: options.cache,
    reuse: options.reuse,
    kind: "unlit",
    pipelineKey: options.resourceSet.unlit.draw.batchKey.pipelineKey,
    batchKey: options.resourceSet.unlit.draw.batchKey,
  });
  const matcapPipeline = await getOrCreateWebGpuAppPipeline({
    app: options.app,
    cache: options.cache,
    reuse: options.reuse,
    kind: "matcap",
    pipelineKey: options.resourceSet.matcap.draw.batchKey.pipelineKey,
    batchKey: options.resourceSet.matcap.draw.batchKey,
  });

  if (
    !unlitPipeline.valid ||
    unlitPipeline.resource === null ||
    !matcapPipeline.valid ||
    matcapPipeline.resource === null
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: unlitPipeline.valid ? matcapPipeline : unlitPipeline,
      resourceReuse: options.reuse,
      diagnostics: [
        ...unlitPipeline.diagnostics,
        ...matcapPipeline.diagnostics,
      ],
    });
  }

  const unlitPipelineHandle = unlitPipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };
  const matcapPipelineHandle = matcapPipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (
    unlitPipelineHandle.getBindGroupLayout === undefined ||
    matcapPipelineHandle.getBindGroupLayout === undefined
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline:
        unlitPipelineHandle.getBindGroupLayout === undefined
          ? unlitPipeline
          : matcapPipeline,
      resourceReuse: options.reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingPipelineLayouts",
          message:
            "The WebGPU app pipeline does not expose bind group layouts.",
        },
      ],
    });
  }

  const unlitLayouts = getWebGpuAppPipelineLayouts({
    cache: options.cache,
    kind: "unlit",
    pipeline: unlitPipeline,
    getBindGroupLayout:
      unlitPipelineHandle.getBindGroupLayout.bind(unlitPipelineHandle),
  });
  const matcapLayouts = getWebGpuAppPipelineLayouts({
    cache: options.cache,
    kind: "matcap",
    pipeline: matcapPipeline,
    getBindGroupLayout:
      matcapPipelineHandle.getBindGroupLayout.bind(matcapPipelineHandle),
  });
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    options.cache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    options.cache.frameScratch.worldTransforms,
  );
  const unlitTextures = prepareUnlitAppTextureSamplerResources({
    app: options.app,
    cache: options.cache,
    material: options.resourceSet.unlit.material,
    reuse: options.reuse,
  });
  const matcapTextures = prepareMatcapAppTextureSamplerResources({
    app: options.app,
    cache: options.cache,
    material: options.resourceSet.matcap.material,
    reuse: options.reuse,
  });

  if (!unlitTextures.valid || !matcapTextures.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: unlitPipeline,
      resourceReuse: options.reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...unlitTextures.diagnostics,
        ...matcapTextures.diagnostics,
      ],
    });
  }

  const unlitResources = createOrReuseUnlitAppFrameResources({
    app: options.app,
    cache: options.cache,
    mesh: options.resourceSet.mesh,
    meshKey: options.resourceSet.meshKey,
    material: options.resourceSet.unlit.material,
    materialKey: options.resourceSet.unlit.materialKey,
    textures: unlitTextures,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    layouts: unlitLayouts,
    reuse: options.reuse,
  });
  const matcapResources = createOrReuseMatcapAppFrameResources({
    app: options.app,
    cache: options.cache,
    mesh: options.resourceSet.mesh,
    meshKey: options.resourceSet.meshKey,
    material: options.resourceSet.matcap.material,
    materialKey: options.resourceSet.matcap.materialKey,
    textures: matcapTextures,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    layouts: matcapLayouts,
    reuse: options.reuse,
  });

  if (
    !unlitResources.valid ||
    unlitResources.resources === null ||
    !matcapResources.valid ||
    matcapResources.resources === null
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: unlitPipeline,
      resources:
        unlitResources.valid && unlitResources.resources !== null
          ? matcapResources
          : unlitResources,
      resourceReuse: options.reuse,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...unlitResources.diagnostics,
        ...matcapResources.diagnostics,
      ],
    });
  }

  const resources: CreateMixedUnlitMatcapFrameResourcesResult = {
    valid: true,
    resources: {
      mesh: unlitResources.resources.mesh,
      viewUniform: unlitResources.resources.viewUniform,
      worldTransforms: unlitResources.resources.worldTransforms,
      unlit: unlitResources.resources,
      matcap: matcapResources.resources,
      bindGroups: [
        ...unlitResources.resources.bindGroups,
        matcapResources.resources.materialBindGroup,
      ],
    },
    diagnostics: [],
  };
  const mixedResources = resources.resources;

  if (mixedResources === null) {
    throw new Error("Mixed unlit/Matcap app resources were not assembled.");
  }

  const meshResourceKeys = new Map<string, string>([
    [
      assetHandleKey(options.resourceSet.unlit.draw.mesh),
      unlitResources.resources.mesh.resourceKey,
    ],
    [
      assetHandleKey(options.resourceSet.matcap.draw.mesh),
      unlitResources.resources.mesh.resourceKey,
    ],
  ]);
  const materialResourceKeys = new Map<string, string>([
    [
      options.resourceSet.unlit.sourceMaterialKey,
      unlitResources.resources.material.resourceKey,
    ],
    [
      options.resourceSet.matcap.sourceMaterialKey,
      matcapResources.resources.material.resourceKey,
    ],
  ]);
  const pipelineResults = [
    createWebGpuAppPipelinePlanResult(
      options.resourceSet.unlit.draw,
      unlitPipeline,
    ),
    createWebGpuAppPipelinePlanResult(
      options.resourceSet.matcap.draw,
      matcapPipeline,
    ),
  ];
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot: options.snapshot,
    renderWorld: options.app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: [unlitResources.resources.mesh],
    pipelines: pipelineResults,
    bindGroups: mixedResources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  const boundary = assembleFrameBoundary({
    context: options.app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: options.app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (options.app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    clearColor: options.clearColor ?? [0, 0, 0, 1],
  });

  await waitForSubmittedWork(options.app.initialization.device);

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
    snapshot: options.snapshot,
    pipeline: unlitPipeline,
    resources,
    boundary,
    resourceReuse: options.reuse,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: framePlan.commandPlan.commands.length,
    drawCalls: framePlan.commandPlan.drawCount,
    diagnostics: [
      ...options.snapshot.diagnostics,
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

function createWebGpuAppPipelinePlanResult(
  draw: RenderSnapshot["meshDraws"][number],
  pipeline: WebGpuAppPipelineResourceResult,
): {
  readonly ok: true;
  readonly status: "miss";
  readonly key: string;
  readonly pipeline: unknown;
  readonly diagnostics: readonly [];
} {
  if (pipeline.resource === null) {
    throw new Error(
      "Cannot create a WebGPU app pipeline plan result without a pipeline resource.",
    );
  }

  return {
    ok: true as const,
    status: "miss" as const,
    key: draw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
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
  const resourceSetPlan = createWebGpuAppDrawResourceSetPlan(snapshot);

  if (firstDraw === undefined || firstView === undefined) {
    const materialDependencyDiagnostics = diagnoseSnapshotMaterialDependencies(
      app,
      snapshot,
    );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...materialDependencyDiagnostics,
        {
          code: "webGpuApp.emptySnapshot",
          message:
            "WebGPU app render requires at least one view and one mesh draw.",
        },
      ],
    });
  }

  const snapshotMaterialDependencyDiagnostics =
    diagnoseSnapshotMaterialDependencies(app, snapshot);

  if (snapshotMaterialDependencyDiagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...snapshotMaterialDependencyDiagnostics,
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

  const materialDependencyReadiness = createMaterialDependencyReadinessReport({
    registry: app.assets,
    material: firstDraw.material,
  });

  if (!materialDependencyReadiness.ready) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        createWebGpuAppMaterialDependencyDiagnostic(
          materialDependencyReadiness,
        ),
      ],
    });
  }

  if (
    material.kind !== "unlit" &&
    material.kind !== "matcap" &&
    material.kind !== "standard"
  ) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, and standard materials, not '${material.kind}'.`,
        },
      ],
    });
  }

  const multiUnlit = collectMultiUnlitAppResourceSet({
    app,
    snapshot,
    plan: resourceSetPlan,
    firstDraw,
  });
  const mixedUnlitMatcap =
    multiUnlit === null
      ? collectMixedUnlitMatcapAppResourceSet({
          app,
          snapshot,
          plan: resourceSetPlan,
          firstDraw,
        })
      : null;
  const unsupportedDrawResourceDiagnostics =
    multiUnlit === null && mixedUnlitMatcap === null
      ? diagnoseUnsupportedAdditionalDrawResources(snapshot, firstDraw)
      : [];

  if (unsupportedDrawResourceDiagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...unsupportedDrawResourceDiagnostics,
      ],
    });
  }

  if (mixedUnlitMatcap !== null) {
    return renderMixedUnlitMatcapWebGpuAppFrame({
      app,
      cache: resourceCache,
      snapshot,
      firstDraw,
      resourceSet: mixedUnlitMatcap,
      reuse,
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  }

  const materialKind = multiUnlit === null ? material.kind : "unlit";
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
  const preparedTextures =
    materialKind === "unlit"
      ? prepareUnlitAppTextureSamplerResources({
          app,
          cache: resourceCache,
          material: material as UnlitMaterialAsset,
          reuse,
        })
      : materialKind === "matcap"
        ? prepareMatcapAppTextureSamplerResources({
            app,
            cache: resourceCache,
            material: material as MatcapMaterialAsset,
            reuse,
          })
        : emptyPreparedAppTextureSamplerResources();

  if (!preparedTextures.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...preparedTextures.diagnostics,
      ],
    });
  }

  const meshKey = sourceAssetCacheKey(firstDraw.mesh, meshEntry?.version ?? -1);
  const materialKey = sourceAssetCacheKey(
    firstDraw.material,
    materialEntry?.version ?? -1,
  );
  const resources =
    multiUnlit !== null
      ? createMultiUnlitAppFrameResources({
          app,
          mesh: multiUnlit.mesh,
          materials: multiUnlit.materials,
          viewUniforms: packedViews,
          worldTransforms: packedTransforms,
          layouts,
          reuse,
        })
      : materialKind === "standard"
        ? createOrReuseStandardAppFrameResources({
            app,
            cache: resourceCache,
            snapshot,
            mesh,
            meshKey,
            material: material as StandardMaterialAsset,
            materialKey,
            viewUniforms: packedViews,
            worldTransforms: packedTransforms,
            layouts,
            reuse,
          })
        : materialKind === "matcap"
          ? createOrReuseMatcapAppFrameResources({
              app,
              cache: resourceCache,
              mesh,
              meshKey,
              material: material as MatcapMaterialAsset,
              materialKey,
              textures: preparedTextures,
              viewUniforms: packedViews,
              worldTransforms: packedTransforms,
              layouts,
              reuse,
            })
          : createOrReuseUnlitAppFrameResources({
              app,
              cache: resourceCache,
              mesh,
              meshKey,
              material,
              materialKey,
              textures: preparedTextures,
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
  const meshResourceKeys = new Map<string, string>();
  const materialResourceKeys = new Map<string, string>();

  meshResourceKeys.set(
    assetHandleKey(firstDraw.mesh),
    frameResources.mesh.resourceKey,
  );

  if ("materials" in frameResources && multiUnlit !== null) {
    for (let index = 0; index < multiUnlit.materialKeys.length; index += 1) {
      const materialResource = frameResources.materials[index];
      const materialHandleKey = multiUnlit.materialKeys[index];

      if (materialResource !== undefined && materialHandleKey !== undefined) {
        materialResourceKeys.set(
          materialHandleKey,
          materialResource.resourceKey,
        );
      }
    }
  } else if ("material" in frameResources) {
    materialResourceKeys.set(
      assetHandleKey(firstDraw.material),
      frameResources.material.resourceKey,
    );
  }

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
      meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
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

function diagnoseUnsupportedAdditionalDrawResources(
  snapshot: RenderSnapshot,
  firstDraw: RenderSnapshot["meshDraws"][number],
): WebGpuAppSingleResourceSetDiagnostic[] {
  const plan = createWebGpuAppDrawResourceSetPlan(snapshot);
  const firstSet = plan.sets[0];
  const diagnostics: WebGpuAppSingleResourceSetDiagnostic[] = [];

  if (firstSet === undefined) {
    return diagnostics;
  }

  for (let setIndex = 1; setIndex < plan.sets.length; setIndex += 1) {
    const set = plan.sets[setIndex];

    if (set === undefined) {
      continue;
    }

    for (const drawIndex of set.drawIndices) {
      const draw = snapshot.meshDraws[drawIndex];

      if (draw === undefined) {
        continue;
      }

      diagnostics.push({
        code: "webGpuApp.additionalDrawResourceUnsupported",
        resourceSetIndex: set.index,
        drawIndex,
        renderId: draw.renderId,
        firstMeshKey: firstSet.meshKey,
        firstMaterialKey: firstSet.materialKey,
        drawMeshKey: set.meshKey,
        drawMaterialKey: set.materialKey,
        message:
          `WebGPU app render currently supports one source mesh/material resource set per frame. ` +
          `Draw ${drawIndex} requires mesh '${set.meshKey}' and material '${set.materialKey}', ` +
          `while the first draw uses mesh '${firstSet.meshKey}' and material '${firstSet.materialKey}'. ` +
          "A broader render-world resource cache is future work.",
      });
    }
  }

  void firstDraw;
  return diagnostics;
}

export function createWebGpuAppDrawResourceSetPlan(
  snapshot: RenderSnapshot,
): WebGpuAppDrawResourceSetPlan {
  const mutableSets: {
    readonly index: number;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly drawIndices: number[];
    readonly renderIds: number[];
  }[] = [];
  const setByKey = new Map<string, (typeof mutableSets)[number]>();

  for (
    let drawIndex = 0;
    drawIndex < snapshot.meshDraws.length;
    drawIndex += 1
  ) {
    const draw = snapshot.meshDraws[drawIndex];

    if (draw === undefined) {
      continue;
    }

    const meshKey = assetHandleKey(draw.mesh);
    const materialKey = assetHandleKey(draw.material);
    const setKey = `${meshKey}|${materialKey}`;
    let set = setByKey.get(setKey);

    if (set === undefined) {
      set = {
        index: mutableSets.length,
        meshKey,
        materialKey,
        drawIndices: [],
        renderIds: [],
      };
      mutableSets.push(set);
      setByKey.set(setKey, set);
    }

    set.drawIndices.push(drawIndex);
    set.renderIds.push(draw.renderId);
  }

  return {
    drawCount: snapshot.meshDraws.length,
    sets: mutableSets.map((set) => ({
      index: set.index,
      meshKey: set.meshKey,
      materialKey: set.materialKey,
      drawIndices: [...set.drawIndices],
      renderIds: [...set.renderIds],
    })),
  };
}

function diagnoseSnapshotMaterialDependencies(
  app: WebGpuApp,
  snapshot: RenderSnapshot,
): WebGpuAppMaterialDependencyDiagnostic[] {
  const blockedEntities = new Set(
    snapshot.diagnostics
      .filter((diagnostic) => isMaterialDependencyRenderDiagnostic(diagnostic))
      .map((diagnostic) => renderEntityRefKey(diagnostic.entity))
      .filter((key) => key !== null),
  );

  if (blockedEntities.size === 0) {
    return [];
  }

  const query = app.world.queryManager.registerQuery({ required: [Material] });
  const diagnostics: WebGpuAppMaterialDependencyDiagnostic[] = [];
  const seenMaterialKeys = new Set<string>();

  for (const entity of query.entities) {
    const entityKey = `${entity.index}:${entity.generation}`;

    if (!blockedEntities.has(entityKey)) {
      continue;
    }

    const material = parseAppMaterialHandle(
      entity.getValue(Material, "materialId") ?? "",
    );

    if (material === null) {
      continue;
    }

    const report = createMaterialDependencyReadinessReport({
      registry: app.assets,
      material,
    });

    if (report.ready || seenMaterialKeys.has(report.materialKey)) {
      continue;
    }

    seenMaterialKeys.add(report.materialKey);
    diagnostics.push(createWebGpuAppMaterialDependencyDiagnostic(report));
  }

  return diagnostics;
}

function createWebGpuAppMaterialDependencyDiagnostic(
  materialDependencyReadiness: Parameters<
    typeof materialDependencyReadinessReportToJsonValue
  >[0],
): WebGpuAppMaterialDependencyDiagnostic {
  const json = materialDependencyReadinessReportToJsonValue(
    materialDependencyReadiness,
  );

  return {
    code: "webGpuApp.materialDependenciesNotReady",
    materialDependencyReadiness: json,
    message: `Material '${json.materialKey}' has source asset dependencies that are not ready for app rendering.`,
  };
}

function isMaterialDependencyRenderDiagnostic(
  diagnostic: unknown,
): diagnostic is {
  readonly code: string;
  readonly entity?: { readonly index: number; readonly generation: number };
} {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return false;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return (
    typeof code === "string" &&
    (code === "render.material.missingTextureHandle" ||
      code === "render.material.missingSamplerHandle" ||
      code.startsWith("render.texture.") ||
      code.startsWith("render.sampler."))
  );
}

function renderEntityRefKey(
  entity: { readonly index: number; readonly generation: number } | undefined,
): string | null {
  return entity === undefined ? null : `${entity.index}:${entity.generation}`;
}

function parseAppMaterialHandle(value: string) {
  const prefix = "material:";

  return value.startsWith(prefix) && value.length > prefix.length
    ? createMaterialHandle(value.slice(prefix.length))
    : null;
}

export function webGpuAppRenderReportToJsonValue(
  report: WebGpuAppRenderReport,
): WebGpuAppRenderReportJsonValue {
  const materialDependencyReadiness =
    collectAppReportMaterialDependencyReadiness(report);

  return {
    ok: report.ok,
    frame: report.frame,
    counts: { ...report.counts },
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    resourceReuse: { ...report.resourceReuse },
    ...(materialDependencyReadiness.length === 0
      ? {}
      : { materialDependencyReadiness }),
  };
}

export function webGpuAppRenderReportToJson(
  report: WebGpuAppRenderReport,
): string {
  return JSON.stringify(webGpuAppRenderReportToJsonValue(report));
}

function collectAppReportMaterialDependencyReadiness(
  report: WebGpuAppRenderReport,
): MaterialAssetDependencyReadinessReportJsonValue[] {
  const readiness: MaterialAssetDependencyReadinessReportJsonValue[] = [];

  for (const diagnostic of report.diagnostics) {
    if (!isWebGpuAppMaterialDependencyDiagnostic(diagnostic)) {
      continue;
    }

    readiness.push(diagnostic.materialDependencyReadiness);
  }

  return readiness;
}

function isWebGpuAppMaterialDependencyDiagnostic(
  diagnostic: unknown,
): diagnostic is WebGpuAppMaterialDependencyDiagnostic {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return false;
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly materialDependencyReadiness?: unknown;
  };

  return (
    candidate.code === "webGpuApp.materialDependenciesNotReady" &&
    typeof candidate.materialDependencyReadiness === "object" &&
    candidate.materialDependencyReadiness !== null
  );
}

function toWebGpuAppJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): WebGpuAppJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toWebGpuAppJsonValue(entry, seen));
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const result: Record<string, WebGpuAppJsonValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === undefined ||
      typeof entry === "function" ||
      typeof entry === "symbol" ||
      typeof entry === "bigint"
    ) {
      continue;
    }

    result[key] = toWebGpuAppJsonValue(entry, seen);
  }

  return result;
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
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
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
