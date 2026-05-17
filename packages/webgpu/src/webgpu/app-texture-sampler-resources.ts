import {
  assetHandleKey,
  type SamplerHandle,
  type TextureHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MatcapMaterialAsset,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  TextureUsage,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
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

export interface WebGpuAppPreparedTextureSamplerDiagnostic {
  readonly code:
    | "webGpuApp.textureSourceNotReady"
    | "webGpuApp.samplerSourceNotReady";
  readonly message: string;
  readonly resourceKey: string;
  readonly status: string;
}

export type WebGpuAppTextureSamplerPreparationDiagnostic =
  | WebGpuAppPreparedTextureSamplerDiagnostic
  | TextureGpuResourceDiagnostic;

export interface PreparedAppTextureSamplerResources {
  readonly valid: boolean;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly diagnostics: readonly WebGpuAppTextureSamplerPreparationDiagnostic[];
}

export interface AppTextureSamplerResourceCache {
  readonly textures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
}

export interface AppTextureSamplerResourceReuseReport {
  textureResourcesCreated: number;
  textureResourcesReused: number;
  samplerResourcesCreated: number;
  samplerResourcesReused: number;
}

export interface AppTextureSamplerPreparationOptions {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: AppTextureSamplerResourceCache;
  readonly reuse: AppTextureSamplerResourceReuseReport;
}

export function prepareUnlitAppTextureSamplerResources(
  options: AppTextureSamplerPreparationOptions & {
    readonly material: UnlitMaterialAsset;
  },
): PreparedAppTextureSamplerResources {
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
      assets: options.assets,
      device: options.device,
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
      assets: options.assets,
      device: options.device,
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

export function prepareMatcapAppTextureSamplerResources(
  options: AppTextureSamplerPreparationOptions & {
    readonly material: MatcapMaterialAsset;
  },
): PreparedAppTextureSamplerResources {
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
      assets: options.assets,
      device: options.device,
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
      assets: options.assets,
      device: options.device,
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

export function prepareStandardAppTextureSamplerResources(
  options: AppTextureSamplerPreparationOptions & {
    readonly material: StandardMaterialAsset;
  },
): PreparedAppTextureSamplerResources {
  const bindings = [
    options.material.baseColorTexture,
    options.material.metallicRoughnessTexture,
    options.material.normalTexture,
    options.material.occlusionTexture,
    options.material.emissiveTexture,
  ].filter(
    (binding): binding is NonNullable<typeof binding> => binding !== null,
  );

  if (bindings.length === 0) {
    return emptyPreparedAppTextureSamplerResources();
  }

  const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
  const textures: TextureGpuResource[] = [];
  const samplers: SamplerGpuResource[] = [];
  const textureKeys: string[] = [];
  const samplerKeys: string[] = [];

  for (const binding of bindings) {
    if (binding.texture !== null) {
      const texture = prepareAppTextureResource({
        assets: options.assets,
        device: options.device,
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
        assets: options.assets,
        device: options.device,
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
  }

  return {
    valid:
      diagnostics.length === 0 &&
      bindings.every(
        (binding) => binding.texture !== null && binding.sampler !== null,
      ) &&
      textures.length === bindings.length &&
      samplers.length === bindings.length,
    textures,
    samplers,
    textureKeys,
    samplerKeys,
    diagnostics,
  };
}

export function emptyPreparedAppTextureSamplerResources(): PreparedAppTextureSamplerResources {
  return {
    valid: true,
    textures: [],
    samplers: [],
    textureKeys: [],
    samplerKeys: [],
    diagnostics: [],
  };
}

export function sourceAssetCacheKey(
  handle: Parameters<typeof assetHandleKey>[0],
  version: number,
): string {
  return `${assetHandleKey(handle)}@${version}`;
}

function prepareAppTextureResource(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: AppTextureSamplerResourceCache;
  readonly handle: TextureHandle;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
}): {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
} | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.assets.get<"texture", TextureAsset>(options.handle);

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
    device: options.device as Parameters<
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
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: AppTextureSamplerResourceCache;
  readonly handle: SamplerHandle;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
}): {
  readonly cacheKey: string;
  readonly resource: SamplerGpuResource;
} | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.assets.get<"sampler", SamplerAsset>(options.handle);

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
    device: options.device as Parameters<
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
