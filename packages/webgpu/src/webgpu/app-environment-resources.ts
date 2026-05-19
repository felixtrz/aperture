import {
  createDiffuseIblTextureResourceReport,
  createSpecularIblTextureResourceReport,
  type DiffuseIblTextureResourceReport,
  type SpecularIblTextureResourceReport,
} from "./ibl-texture-resource.js";
import {
  createIblSamplerResourceReport,
  type IblSamplerResourceReport,
} from "./ibl-sampler-resource.js";
import type { IblSamplerDescriptorReadinessReport } from "./ibl-sampler-descriptor-readiness.js";
import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import type {
  SamplerGpuResource,
  TextureGpuDeviceLike,
  TextureGpuResource,
} from "./texture-resources.js";
import type { StandardMaterialIblBindGroupResource } from "./standard-material-ibl-bind-group.js";
import type {
  ShadowSamplerResource,
  StandardMaterialShadowBindGroupResource,
} from "./standard-material-shadow-bind-group.js";

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
}

export interface WebGpuEnvironmentResourceCacheSummary {
  diffuseTextureEntries: number;
  specularTextureEntries: number;
  samplerEntries: number;
  standardIblBindGroupEntries: number;
  shadowSamplerEntries: number;
  standardShadowBindGroupEntries: number;
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

export interface PrepareWebGpuAppIblResourceReportsOptions {
  readonly app: object;
  readonly device?: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly samplers: IblSamplerDescriptorReadinessReport;
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
  summary.totalEntries =
    summary.diffuseTextureEntries +
    summary.specularTextureEntries +
    summary.samplerEntries +
    summary.standardIblBindGroupEntries +
    summary.shadowSamplerEntries +
    summary.standardShadowBindGroupEntries;
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
  });
  reuse.diffuseTextureResourcesCreated =
    diffuseTextureResource.createdTextureCount;
  reuse.diffuseTextureResourcesReused =
    diffuseTextureResource.reusedTextureCount;

  const specularTextureResource = createSpecularIblTextureResourceReport({
    device,
    textures: options.textures,
    cache: cache.specularTextures,
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

function deviceFromApp(app: object): TextureGpuDeviceLike {
  const maybeApp = app as {
    readonly initialization?: { readonly device?: TextureGpuDeviceLike };
  };
  return maybeApp.initialization?.device ?? {};
}
