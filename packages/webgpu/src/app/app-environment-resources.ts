import type { EnvironmentPacket } from "@aperture-engine/render";
import {
  assetHandleKey,
  type EnvironmentMapHandle,
} from "@aperture-engine/simulation";
import {
  createDiffuseIblTextureResourceReport,
  createSpecularIblTextureResourceReport,
  diffuseIblTextureResourceReportToJsonValue,
  specularIblTextureResourceReportToJsonValue,
  type DiffuseIblCubeSource,
  type DiffuseIblTextureResourceReport,
  type SpecularIblPmremSource,
  type SpecularIblTextureResourceReport,
} from "../lighting/ibl-texture-resource.js";
import type { EquirectToCubeStorageFormat } from "../lighting/equirect-to-cube-compute-pipeline.js";
import {
  createEquirectToCubeResource,
  type EquirectSource,
  type EquirectToCubeResourceReport,
} from "../lighting/equirect-to-cube-resource.js";
import {
  createIblSamplerResourceReport,
  iblSamplerResourceReportToJsonValue,
  type IblSamplerResourceReport,
} from "../lighting/ibl-sampler-resource.js";
import {
  createIblSamplerDescriptorReadinessReport,
  iblSamplerDescriptorReadinessReportToJsonValue,
  type IblSamplerDescriptorReadinessReport,
} from "../lighting/ibl-sampler-descriptor-readiness.js";
import {
  createIblTexturePreparationReport,
  iblTexturePreparationReportToJsonValue,
  type IblTexturePreparationReport,
} from "../lighting/ibl-texture-preparation.js";
import {
  createIblResourceDescriptorReport,
  iblResourceDescriptorReportToJsonValue,
  type IblResourceDescriptorReport,
} from "../lighting/ibl-resource-descriptor.js";
import type {
  SamplerGpuResource,
  TextureGpuDeviceLike,
  TextureGpuResource,
} from "../resources/textures/texture-resources.js";
import {
  createStandardMaterialIblBindGroupDescriptorReadinessReport,
  createStandardMaterialIblBindGroupResourceReport,
  standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue,
  standardMaterialIblBindGroupResourceReportToJsonValue,
  type StandardMaterialIblBindGroupDescriptorReadinessReport,
  type StandardMaterialIblBindGroupResource,
  type StandardMaterialIblBindGroupResourceReport,
} from "../materials/standard/standard-material-ibl-bind-group.js";
import type {
  ShadowSamplerResource,
  StandardMaterialShadowBindGroupResource,
} from "../materials/standard/standard-material-shadow-bind-group.js";
import type { ShadowCasterPipelineResource } from "../shadows/shadow-caster-pipeline-resource.js";
import type { ShadowCasterMatrixBindGroupResource } from "../shadows/shadow-caster-matrix-bind-group-resource.js";
import type { ShadowDepthTextureResourceCache } from "../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResource } from "../shadows/shadow-matrix-buffer-resource.js";
import type { StandardFrameIblResources } from "../materials/standard/standard-frame-resources.js";

export interface WebGpuEnvironmentResourceCache {
  readonly diffuseTextures: Map<string, TextureGpuResource>;
  readonly specularTextures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
  readonly standardIblBindGroups: Map<
    string,
    StandardMaterialIblBindGroupResource
  >;
  readonly shadowSamplers: Map<string, ShadowSamplerResource>;
  readonly standardShadowBindGroups: Map<
    string,
    StandardMaterialShadowBindGroupResource
  >;
  readonly shadowCasterPipelines: Map<string, ShadowCasterPipelineResource>;
  readonly shadowCasterMatrixBindGroups: Map<
    string,
    ShadowCasterMatrixBindGroupResource
  >;
  readonly shadowDepthTextures: ShadowDepthTextureResourceCache;
  readonly shadowMatrixBuffers: Map<string, ShadowMatrixBufferResource>;
}

interface WebGpuEnvironmentBindGroupDeviceLike extends TextureGpuDeviceLike {
  readonly createBindGroup?: (descriptor: unknown) => unknown;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
}

export interface WebGpuEnvironmentResourceCacheSummary {
  diffuseTextureEntries: number;
  specularTextureEntries: number;
  samplerEntries: number;
  standardIblBindGroupEntries: number;
  shadowSamplerEntries: number;
  standardShadowBindGroupEntries: number;
  shadowCasterPipelineEntries: number;
  shadowCasterMatrixBindGroupEntries: number;
  shadowDepthTextureEntries: number;
  shadowMatrixBufferEntries: number;
  totalEntries: number;
}

export interface WebGpuEnvironmentResourceReuseReport {
  diffuseTextureResourcesCreated: number;
  diffuseTextureResourcesReused: number;
  specularTextureResourcesCreated: number;
  specularTextureResourcesReused: number;
  samplerResourcesCreated: number;
  samplerResourcesReused: number;
}

export interface WebGpuAppIblResourceReports {
  readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
  readonly specularTextureResource: SpecularIblTextureResourceReport;
  readonly samplerResources: IblSamplerResourceReport;
  readonly reuse: WebGpuEnvironmentResourceReuseReport;
  readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}

export interface WebGpuAppEnvironmentEquirectSource extends EquirectSource {
  readonly faceSize?: number;
  readonly format?: EquirectToCubeStorageFormat;
  readonly resourceKey?: string;
  readonly label?: string;
  readonly mipLevelCount?: number;
}

export interface PrepareWebGpuAppIblResourceReportsOptions {
  readonly app: object;
  readonly device?: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly samplers: IblSamplerDescriptorReadinessReport;
  readonly diffuseSources?: readonly DiffuseIblCubeSource[];
  readonly specularPmremSources?: readonly SpecularIblPmremSource[];
}

export interface WebGpuAppEnvironmentAssetInput {
  readonly handle: EnvironmentMapHandle;
  readonly label?: string;
  readonly version?: string | number;
  readonly diffuseResourceKey: string;
  readonly specularResourceKey: string;
  readonly equirectSource?: WebGpuAppEnvironmentEquirectSource;
  readonly diffuseSource?: DiffuseIblCubeSource;
  readonly specularPmremSource?: SpecularIblPmremSource;
  readonly standardMaterialCount?: number;
}

export interface PrepareWebGpuAppEnvironmentAssetsOptions {
  readonly app: object;
  readonly device?: TextureGpuDeviceLike;
  readonly assets: readonly WebGpuAppEnvironmentAssetInput[];
  readonly activeHandle?: EnvironmentMapHandle | null;
  readonly activeEnvironmentMapResourceKey?: string | null;
}

export interface WebGpuPreparedEnvironmentAssetReuseReport extends WebGpuEnvironmentResourceReuseReport {
  readonly standardIblBindGroupsCreated: number;
  readonly standardIblBindGroupsReused: number;
}

export interface WebGpuPreparedEnvironmentAsset {
  readonly handle: EnvironmentMapHandle;
  readonly environmentMapResourceKey: string;
  readonly label?: string;
  readonly version: string | null;
  readonly ready: boolean;
  readonly standardMaterialCount: number;
  readonly diffuseResourceKey: string;
  readonly diffuseTextureKey: string;
  readonly specularResourceKey: string;
  readonly specularTextureKey: string;
  readonly samplerKeys: readonly string[];
  readonly descriptorReport: IblResourceDescriptorReport;
  readonly texturePreparation: IblTexturePreparationReport;
  readonly samplerDescriptors: IblSamplerDescriptorReadinessReport;
  readonly equirectProjection?: EquirectToCubeResourceReport;
  readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
  readonly specularTextureResource: SpecularIblTextureResourceReport;
  readonly samplerResources: IblSamplerResourceReport;
  readonly bindGroupDescriptor: StandardMaterialIblBindGroupDescriptorReadinessReport;
  readonly bindGroupResource: StandardMaterialIblBindGroupResourceReport;
  readonly standardMaterialIblResources: StandardFrameIblResources;
  readonly reuse: WebGpuPreparedEnvironmentAssetReuseReport;
  readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}

export interface WebGpuPreparedEnvironmentAssetSetTotals {
  readonly assetCount: number;
  readonly readyAssetCount: number;
  readonly diffuseTextureResourcesCreated: number;
  readonly diffuseTextureResourcesReused: number;
  readonly specularTextureResourcesCreated: number;
  readonly specularTextureResourcesReused: number;
  readonly samplerResourcesCreated: number;
  readonly samplerResourcesReused: number;
  readonly standardIblBindGroupsCreated: number;
  readonly standardIblBindGroupsReused: number;
}

export interface WebGpuPreparedEnvironmentAssetSet {
  readonly assets: readonly WebGpuPreparedEnvironmentAsset[];
  readonly activeEnvironmentMapResourceKey: string | null;
  readonly active: WebGpuPreparedEnvironmentAsset | null;
  readonly totals: WebGpuPreparedEnvironmentAssetSetTotals;
  readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}

const APP_ENVIRONMENT_RESOURCE_CACHES = new WeakMap<
  object,
  WebGpuEnvironmentResourceCache
>();

export function createWebGpuEnvironmentResourceCache(): WebGpuEnvironmentResourceCache {
  return {
    diffuseTextures: new Map(),
    specularTextures: new Map(),
    samplers: new Map(),
    standardIblBindGroups: new Map(),
    shadowSamplers: new Map(),
    standardShadowBindGroups: new Map(),
    shadowCasterPipelines: new Map(),
    shadowCasterMatrixBindGroups: new Map(),
    shadowDepthTextures: new Map(),
    shadowMatrixBuffers: new Map(),
  };
}

export function registerWebGpuAppEnvironmentResourceCache(
  app: object,
  cache: WebGpuEnvironmentResourceCache,
): void {
  APP_ENVIRONMENT_RESOURCE_CACHES.set(app, cache);
}

export function getOrCreateWebGpuAppEnvironmentResourceCache(
  app: object,
): WebGpuEnvironmentResourceCache {
  const cached = APP_ENVIRONMENT_RESOURCE_CACHES.get(app);

  if (cached !== undefined) {
    return cached;
  }

  const cache = createWebGpuEnvironmentResourceCache();
  APP_ENVIRONMENT_RESOURCE_CACHES.set(app, cache);
  return cache;
}

export function createWebGpuEnvironmentResourceCacheSummary(): WebGpuEnvironmentResourceCacheSummary {
  return {
    diffuseTextureEntries: 0,
    specularTextureEntries: 0,
    samplerEntries: 0,
    standardIblBindGroupEntries: 0,
    shadowSamplerEntries: 0,
    standardShadowBindGroupEntries: 0,
    shadowCasterPipelineEntries: 0,
    shadowCasterMatrixBindGroupEntries: 0,
    shadowDepthTextureEntries: 0,
    shadowMatrixBufferEntries: 0,
    totalEntries: 0,
  };
}

export function writeWebGpuEnvironmentResourceCacheSummary(
  summary: WebGpuEnvironmentResourceCacheSummary,
  cache: WebGpuEnvironmentResourceCache,
): WebGpuEnvironmentResourceCacheSummary {
  summary.diffuseTextureEntries = cache.diffuseTextures.size;
  summary.specularTextureEntries = cache.specularTextures.size;
  summary.samplerEntries = cache.samplers.size;
  summary.standardIblBindGroupEntries = cache.standardIblBindGroups.size;
  summary.shadowSamplerEntries = cache.shadowSamplers.size;
  summary.standardShadowBindGroupEntries = cache.standardShadowBindGroups.size;
  summary.shadowCasterPipelineEntries = cache.shadowCasterPipelines.size;
  summary.shadowCasterMatrixBindGroupEntries =
    cache.shadowCasterMatrixBindGroups.size;
  summary.shadowDepthTextureEntries = cache.shadowDepthTextures.size;
  summary.shadowMatrixBufferEntries = cache.shadowMatrixBuffers.size;
  summary.totalEntries =
    summary.diffuseTextureEntries +
    summary.specularTextureEntries +
    summary.samplerEntries +
    summary.standardIblBindGroupEntries +
    summary.shadowSamplerEntries +
    summary.standardShadowBindGroupEntries +
    summary.shadowCasterPipelineEntries +
    summary.shadowCasterMatrixBindGroupEntries +
    summary.shadowDepthTextureEntries +
    summary.shadowMatrixBufferEntries;
  return summary;
}

export function createWebGpuEnvironmentResourceReuseReport(): WebGpuEnvironmentResourceReuseReport {
  return {
    diffuseTextureResourcesCreated: 0,
    diffuseTextureResourcesReused: 0,
    specularTextureResourcesCreated: 0,
    specularTextureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}

export function prepareWebGpuAppIblResourceReports(
  options: PrepareWebGpuAppIblResourceReportsOptions,
): WebGpuAppIblResourceReports {
  const device = options.device ?? deviceFromApp(options.app);
  const cache = getOrCreateWebGpuAppEnvironmentResourceCache(options.app);
  const reuse = createWebGpuEnvironmentResourceReuseReport();

  const diffuseTextureResource = createDiffuseIblTextureResourceReport({
    device,
    textures: options.textures,
    cache: cache.diffuseTextures,
    ...(options.diffuseSources === undefined
      ? {}
      : { diffuseSources: options.diffuseSources }),
  });
  reuse.diffuseTextureResourcesCreated =
    diffuseTextureResource.createdTextureCount;
  reuse.diffuseTextureResourcesReused =
    diffuseTextureResource.reusedTextureCount;

  const specularTextureResource = createSpecularIblTextureResourceReport({
    device,
    textures: options.textures,
    cache: cache.specularTextures,
    ...(options.specularPmremSources === undefined
      ? {}
      : { pmremSources: options.specularPmremSources }),
  });
  reuse.specularTextureResourcesCreated =
    specularTextureResource.createdTextureCount;
  reuse.specularTextureResourcesReused =
    specularTextureResource.reusedTextureCount;

  const samplerResources = createIblSamplerResourceReport({
    device,
    samplers: options.samplers,
    cache: cache.samplers,
  });
  reuse.samplerResourcesCreated = samplerResources.createdSamplerCount;
  reuse.samplerResourcesReused = samplerResources.reusedSamplerCount;

  return {
    diffuseTextureResource,
    specularTextureResource,
    samplerResources,
    reuse,
    cacheSummary: writeWebGpuEnvironmentResourceCacheSummary(
      createWebGpuEnvironmentResourceCacheSummary(),
      cache,
    ),
  };
}

export function prepareWebGpuAppEnvironmentAssets(
  options: PrepareWebGpuAppEnvironmentAssetsOptions,
): WebGpuPreparedEnvironmentAssetSet {
  const device = options.device ?? deviceFromApp(options.app);
  const cache = getOrCreateWebGpuAppEnvironmentResourceCache(options.app);
  const preparedAssets = options.assets.map((asset, index) =>
    prepareWebGpuAppEnvironmentAsset({
      app: options.app,
      device,
      cache,
      asset,
      environmentId: index + 1,
    }),
  );
  const requestedActiveKey =
    options.activeEnvironmentMapResourceKey ??
    (options.activeHandle === undefined || options.activeHandle === null
      ? null
      : assetHandleKey(options.activeHandle));
  const activeEnvironmentMapResourceKey =
    requestedActiveKey ?? preparedAssets[0]?.environmentMapResourceKey ?? null;
  const active =
    activeEnvironmentMapResourceKey === null
      ? null
      : (preparedAssets.find(
          (asset) =>
            asset.environmentMapResourceKey === activeEnvironmentMapResourceKey,
        ) ?? null);

  return {
    assets: preparedAssets,
    activeEnvironmentMapResourceKey,
    active,
    totals: summarizePreparedEnvironmentAssets(preparedAssets),
    cacheSummary: writeWebGpuEnvironmentResourceCacheSummary(
      createWebGpuEnvironmentResourceCacheSummary(),
      cache,
    ),
  };
}

export function webGpuPreparedEnvironmentAssetSetToJsonValue(
  set: WebGpuPreparedEnvironmentAssetSet,
) {
  return {
    activeEnvironmentMapResourceKey: set.activeEnvironmentMapResourceKey,
    activeReady: set.active?.ready ?? false,
    totals: { ...set.totals },
    cacheSummary: { ...set.cacheSummary },
    assets: set.assets.map((asset) =>
      webGpuPreparedEnvironmentAssetToJsonValue(asset),
    ),
  };
}

function prepareWebGpuAppEnvironmentAsset(input: {
  readonly app: object;
  readonly device: TextureGpuDeviceLike;
  readonly cache: WebGpuEnvironmentResourceCache;
  readonly asset: WebGpuAppEnvironmentAssetInput;
  readonly environmentId: number;
}): WebGpuPreparedEnvironmentAsset {
  const environmentMapResourceKey = assetHandleKey(input.asset.handle);
  const version =
    input.asset.version === undefined ? null : String(input.asset.version);
  const diffuseResourceKey = versionedEnvironmentResourceKey(
    input.asset.diffuseResourceKey,
    version,
  );
  const specularResourceKey = versionedEnvironmentResourceKey(
    input.asset.specularResourceKey,
    version,
  );
  const descriptorReport = createIblResourceDescriptorReport({
    snapshot: [environmentPacket(input.environmentId, input.asset.handle)],
    descriptors: [
      {
        environmentMapResourceKey,
        diffuseResourceKey,
        specularResourceKey,
      },
    ],
  });
  const texturePreparation = createIblTexturePreparationReport({
    descriptors: descriptorReport,
    preparation: "ready",
  });
  const samplerDescriptors = createIblSamplerDescriptorReadinessReport({
    textures: texturePreparation,
    allocation: "ready",
  });
  const equirectProjection = equirectProjectionForAsset({
    asset: input.asset,
    device: input.device,
    environmentMapResourceKey,
    version,
  });
  const diffuseSources = diffuseSourcesForAsset({
    asset: input.asset,
    environmentMapResourceKey,
    diffuseResourceKey,
    ...(equirectProjection === undefined ? {} : { equirectProjection }),
  });
  const specularPmremSources = specularSourcesForAsset({
    asset: input.asset,
    environmentMapResourceKey,
    specularResourceKey,
    ...(equirectProjection === undefined ? {} : { equirectProjection }),
  });
  const resources = prepareWebGpuAppIblResourceReports({
    app: input.app,
    device: input.device,
    textures: texturePreparation,
    samplers: samplerDescriptors,
    ...(diffuseSources === undefined ? {} : { diffuseSources }),
    ...(specularPmremSources === undefined ? {} : { specularPmremSources }),
  });
  const standardMaterialCount = input.asset.standardMaterialCount ?? 1;
  const bindGroupDescriptor =
    createStandardMaterialIblBindGroupDescriptorReadinessReport({
      standardMaterialCount,
      textures: texturePreparation,
      diffuseTextureResource: resources.diffuseTextureResource,
      specularTextureResource: resources.specularTextureResource,
      samplers: resources.samplerResources,
    });
  const bindGroupResource = createStandardMaterialIblBindGroupResourceReport({
    device: input.device as WebGpuEnvironmentBindGroupDeviceLike,
    standardMaterialCount,
    descriptor: bindGroupDescriptor,
    diffuseTextureResource: resources.diffuseTextureResource,
    specularTextureResource: resources.specularTextureResource,
    samplers: resources.samplerResources,
    cache: input.cache.standardIblBindGroups,
  });
  const standardMaterialIblResources: StandardFrameIblResources = {
    bindGroupResource,
    diffuseTextureResource: resources.diffuseTextureResource,
    specularTextureResource: resources.specularTextureResource,
    samplerResource: resources.samplerResources,
  };
  const samplerKeys = resources.samplerResources.resources.flatMap(
    (resource) =>
      resource.resource === null ? [] : [resource.resource.resourceKey],
  );
  const base = {
    handle: input.asset.handle,
    environmentMapResourceKey,
    version,
    ready:
      (equirectProjection?.ready ?? true) &&
      resources.diffuseTextureResource.ready &&
      resources.specularTextureResource.ready &&
      resources.samplerResources.ready &&
      bindGroupResource.ready,
    standardMaterialCount,
    diffuseResourceKey,
    diffuseTextureKey: `${diffuseResourceKey}:texture`,
    specularResourceKey,
    specularTextureKey: `${specularResourceKey}:texture`,
    samplerKeys,
    descriptorReport,
    texturePreparation,
    samplerDescriptors,
    ...(equirectProjection === undefined ? {} : { equirectProjection }),
    diffuseTextureResource: resources.diffuseTextureResource,
    specularTextureResource: resources.specularTextureResource,
    samplerResources: resources.samplerResources,
    bindGroupDescriptor,
    bindGroupResource,
    standardMaterialIblResources,
    reuse: {
      ...resources.reuse,
      standardIblBindGroupsCreated: bindGroupResource.createdBindGroupCount,
      standardIblBindGroupsReused: bindGroupResource.reusedBindGroupCount,
    },
    cacheSummary: writeWebGpuEnvironmentResourceCacheSummary(
      createWebGpuEnvironmentResourceCacheSummary(),
      input.cache,
    ),
  };

  return input.asset.label === undefined
    ? base
    : { ...base, label: input.asset.label };
}

function webGpuPreparedEnvironmentAssetToJsonValue(
  asset: WebGpuPreparedEnvironmentAsset,
) {
  return {
    environmentMapResourceKey: asset.environmentMapResourceKey,
    ...(asset.label === undefined ? {} : { label: asset.label }),
    version: asset.version,
    ready: asset.ready,
    standardMaterialCount: asset.standardMaterialCount,
    resourceKeys: {
      diffuseResourceKey: asset.diffuseResourceKey,
      diffuseTextureKey: asset.diffuseTextureKey,
      specularResourceKey: asset.specularResourceKey,
      specularTextureKey: asset.specularTextureKey,
      samplerKeys: [...asset.samplerKeys],
      bindGroupResourceKey:
        asset.bindGroupResource.resource?.resourceKey ?? null,
    },
    reuse: { ...asset.reuse },
    cacheSummary: { ...asset.cacheSummary },
    reports: {
      descriptors: iblResourceDescriptorReportToJsonValue(
        asset.descriptorReport,
      ),
      texturePreparation: iblTexturePreparationReportToJsonValue(
        asset.texturePreparation,
      ),
      samplerDescriptors: iblSamplerDescriptorReadinessReportToJsonValue(
        asset.samplerDescriptors,
      ),
      ...(asset.equirectProjection === undefined
        ? {}
        : {
            equirectProjection: equirectToCubeResourceReportToJsonValue(
              asset.equirectProjection,
            ),
          }),
      diffuseTexture: diffuseIblTextureResourceReportToJsonValue(
        asset.diffuseTextureResource,
      ),
      specularTexture: specularIblTextureResourceReportToJsonValue(
        asset.specularTextureResource,
      ),
      samplerResources: iblSamplerResourceReportToJsonValue(
        asset.samplerResources,
      ),
      bindGroupDescriptor:
        standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(
          asset.bindGroupDescriptor,
        ),
      bindGroupResource: standardMaterialIblBindGroupResourceReportToJsonValue(
        asset.bindGroupResource,
      ),
    },
  };
}

function equirectProjectionForAsset(input: {
  readonly asset: WebGpuAppEnvironmentAssetInput;
  readonly device: TextureGpuDeviceLike;
  readonly environmentMapResourceKey: string;
  readonly version: string | null;
}): EquirectToCubeResourceReport | undefined {
  const source = input.asset.equirectSource;

  if (source === undefined) {
    return undefined;
  }

  return createEquirectToCubeResource({
    device: input.device,
    equirect: source,
    ...(source.faceSize === undefined ? {} : { faceSize: source.faceSize }),
    ...(source.format === undefined ? {} : { format: source.format }),
    resourceKey: versionedEnvironmentResourceKey(
      source.resourceKey ?? `${input.environmentMapResourceKey}:equirect-cube`,
      input.version,
    ),
    label: source.label ?? input.asset.label ?? input.environmentMapResourceKey,
  });
}

function equirectToCubeResourceReportToJsonValue(
  report: EquirectToCubeResourceReport,
) {
  return {
    ready: report.ready,
    faceSize: report.faceSize,
    faceCount: report.faceCount,
    format: report.format,
    projection: report.projection,
    resourceKey: report.resource?.resourceKey ?? null,
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

function summarizePreparedEnvironmentAssets(
  assets: readonly WebGpuPreparedEnvironmentAsset[],
): WebGpuPreparedEnvironmentAssetSetTotals {
  return assets.reduce<WebGpuPreparedEnvironmentAssetSetTotals>(
    (totals, asset) => ({
      assetCount: totals.assetCount + 1,
      readyAssetCount: totals.readyAssetCount + (asset.ready ? 1 : 0),
      diffuseTextureResourcesCreated:
        totals.diffuseTextureResourcesCreated +
        asset.reuse.diffuseTextureResourcesCreated,
      diffuseTextureResourcesReused:
        totals.diffuseTextureResourcesReused +
        asset.reuse.diffuseTextureResourcesReused,
      specularTextureResourcesCreated:
        totals.specularTextureResourcesCreated +
        asset.reuse.specularTextureResourcesCreated,
      specularTextureResourcesReused:
        totals.specularTextureResourcesReused +
        asset.reuse.specularTextureResourcesReused,
      samplerResourcesCreated:
        totals.samplerResourcesCreated + asset.reuse.samplerResourcesCreated,
      samplerResourcesReused:
        totals.samplerResourcesReused + asset.reuse.samplerResourcesReused,
      standardIblBindGroupsCreated:
        totals.standardIblBindGroupsCreated +
        asset.reuse.standardIblBindGroupsCreated,
      standardIblBindGroupsReused:
        totals.standardIblBindGroupsReused +
        asset.reuse.standardIblBindGroupsReused,
    }),
    {
      assetCount: 0,
      readyAssetCount: 0,
      diffuseTextureResourcesCreated: 0,
      diffuseTextureResourcesReused: 0,
      specularTextureResourcesCreated: 0,
      specularTextureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 0,
      standardIblBindGroupsCreated: 0,
      standardIblBindGroupsReused: 0,
    },
  );
}

function environmentPacket(
  environmentId: number,
  handle: EnvironmentMapHandle,
): EnvironmentPacket {
  return {
    environmentId,
    handle,
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function diffuseSourcesForAsset(input: {
  readonly asset: WebGpuAppEnvironmentAssetInput;
  readonly environmentMapResourceKey: string;
  readonly diffuseResourceKey: string;
  readonly equirectProjection?: EquirectToCubeResourceReport;
}): readonly DiffuseIblCubeSource[] | undefined {
  const source = input.asset.diffuseSource;

  if (source !== undefined) {
    return [
      {
        ...source,
        resourceKey: `${input.diffuseResourceKey}:texture`,
        sourceResourceKey: input.diffuseResourceKey,
        environmentMapResourceKey: input.environmentMapResourceKey,
        label:
          source.label ?? input.asset.label ?? input.environmentMapResourceKey,
      },
    ];
  }

  if (
    input.equirectProjection?.ready !== true ||
    input.equirectProjection.resource === null
  ) {
    return undefined;
  }

  return [
    {
      resourceKey: `${input.diffuseResourceKey}:texture`,
      sourceResourceKey: input.diffuseResourceKey,
      environmentMapResourceKey: input.environmentMapResourceKey,
      label:
        input.asset.equirectSource?.label ??
        input.asset.label ??
        input.environmentMapResourceKey,
      faceSize: input.equirectProjection.faceSize,
      format: input.equirectProjection.format,
      sourceTexture: input.equirectProjection.resource,
    },
  ];
}

function specularSourcesForAsset(input: {
  readonly asset: WebGpuAppEnvironmentAssetInput;
  readonly environmentMapResourceKey: string;
  readonly specularResourceKey: string;
  readonly equirectProjection?: EquirectToCubeResourceReport;
}): readonly SpecularIblPmremSource[] | undefined {
  const source = input.asset.specularPmremSource;

  if (source !== undefined) {
    return [
      {
        ...source,
        resourceKey: `${input.specularResourceKey}:texture`,
        sourceResourceKey: input.specularResourceKey,
        environmentMapResourceKey: input.environmentMapResourceKey,
        label:
          source.label ?? input.asset.label ?? input.environmentMapResourceKey,
      },
    ];
  }

  if (
    input.equirectProjection?.ready !== true ||
    input.equirectProjection.resource === null
  ) {
    return undefined;
  }

  return [
    {
      resourceKey: `${input.specularResourceKey}:texture`,
      sourceResourceKey: input.specularResourceKey,
      environmentMapResourceKey: input.environmentMapResourceKey,
      label:
        input.asset.equirectSource?.label ??
        input.asset.label ??
        input.environmentMapResourceKey,
      faceSize: input.equirectProjection.faceSize,
      format: input.equirectProjection.format,
      sourceTexture: input.equirectProjection.resource,
      ...(input.asset.equirectSource?.mipLevelCount === undefined
        ? {}
        : { mipLevelCount: input.asset.equirectSource.mipLevelCount }),
    },
  ];
}

function versionedEnvironmentResourceKey(
  resourceKey: string,
  version: string | null,
): string {
  return version === null ? resourceKey : `${resourceKey}@${version}`;
}

function deviceFromApp(app: object): TextureGpuDeviceLike {
  const maybeApp = app as {
    readonly initialization?: { readonly device?: TextureGpuDeviceLike };
  };
  return maybeApp.initialization?.device ?? {};
}
