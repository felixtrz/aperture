import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type RenderSnapshot,
  type SamplerAsset,
  type TextureAsset,
} from "@aperture-engine/render";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  type AppTextureSamplerPreparationOptions,
  type WebGpuAppTextureSamplerPreparationDiagnostic,
} from "./app-texture-sampler-resources.js";
import type { LocalLightClusterSupportedCookieResource } from "./local-light-clusters.js";
import type { StandardFrameShadowReceiverResources } from "./standard-frame-resources.js";
import {
  createSamplerGpuResource,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "./texture-resources.js";

const DEFAULT_COOKIE_SAMPLER_CACHE_KEY = "local-light-cookie:default-sampler@1";
const DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY =
  "local-light-cookie:default-sampler";

export interface LocalLightClusterCookieResources {
  readonly textureResource: TextureGpuResource;
  readonly samplerResource: SamplerGpuResource;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly supportedResources: readonly LocalLightClusterSupportedCookieResource[];
}

export type LocalLightClusterCookieResourceDiagnostic =
  | WebGpuAppTextureSamplerPreparationDiagnostic
  | {
      readonly code: "localLightClusterCookie.textureNot2d";
      readonly message: string;
      readonly resourceKey: string;
    };

export interface PrepareLocalLightClusterCookieResourcesResult {
  readonly valid: boolean;
  readonly resources: LocalLightClusterCookieResources | null;
  readonly diagnostics: readonly LocalLightClusterCookieResourceDiagnostic[];
}

export function prepareLocalLightClusterCookieResources(
  options: AppTextureSamplerPreparationOptions & {
    readonly snapshot: RenderSnapshot;
    readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
  },
): PrepareLocalLightClusterCookieResourcesResult {
  const diagnostics: LocalLightClusterCookieResourceDiagnostic[] = [];
  const textureSamplerDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] =
    [];
  const spotMatrixBaseByLightId = supportedSpotMatrixBaseByLightId(
    options.shadowReceiverResources,
  );

  if (spotMatrixBaseByLightId.size === 0) {
    return { valid: true, resources: null, diagnostics };
  }

  for (const light of options.snapshot.lights) {
    if (
      light.kind !== "spot" ||
      light.cookieTexture === undefined ||
      light.cookieTexture === null
    ) {
      continue;
    }

    const matrixBaseIndex = spotMatrixBaseByLightId.get(light.lightId);

    if (matrixBaseIndex === undefined) {
      continue;
    }

    const textureEntry = options.assets.get<"texture", TextureAsset>(
      light.cookieTexture,
    );
    const textureKey = assetHandleKey(light.cookieTexture);

    if (
      textureEntry?.status === "ready" &&
      textureEntry.asset !== null &&
      textureEntry.asset.dimension !== "2d"
    ) {
      diagnostics.push({
        code: "localLightClusterCookie.textureNot2d",
        resourceKey: textureKey,
        message: `Clustered local-light cookie '${textureKey}' must be a 2D texture.`,
      });
      return { valid: false, resources: null, diagnostics };
    }

    const texture = prepareAppTextureResource({
      assets: options.assets,
      device: options.device,
      cache: options.cache,
      handle: light.cookieTexture,
      reuse: options.reuse,
      diagnostics: textureSamplerDiagnostics,
    });
    diagnostics.push(...textureSamplerDiagnostics.splice(0));

    if (texture === null) {
      return { valid: false, resources: null, diagnostics };
    }

    const sampler =
      light.cookieSampler === undefined || light.cookieSampler === null
        ? prepareDefaultCookieSamplerResource({
            ...options,
            diagnostics,
          })
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: light.cookieSampler,
            reuse: options.reuse,
            diagnostics: textureSamplerDiagnostics,
          });
    diagnostics.push(...textureSamplerDiagnostics.splice(0));

    if (sampler === null) {
      return { valid: false, resources: null, diagnostics };
    }

    return {
      valid: diagnostics.length === 0,
      resources: {
        textureResource: texture.resource,
        samplerResource: sampler.resource,
        textureKey: texture.cacheKey,
        samplerKey: sampler.cacheKey,
        supportedResources: [
          {
            lightId: light.lightId,
            textureKey: texture.cacheKey,
            samplerKey: sampler.cacheKey,
            matrixBaseIndex,
          },
        ],
      },
      diagnostics,
    };
  }

  return { valid: diagnostics.length === 0, resources: null, diagnostics };
}

function supportedSpotMatrixBaseByLightId(
  resources: StandardFrameShadowReceiverResources | undefined,
): Map<number, number> {
  const spotResources =
    resources?.shadowKind === "multi"
      ? resources.spotShadowReceiverResources
      : resources?.shadowKind === "spot"
        ? resources
        : undefined;
  const supported = new Map<number, number>();

  if (
    spotResources === undefined ||
    spotResources.matrixBufferResource.resource === null ||
    spotResources.samplerResource.resource === null
  ) {
    return supported;
  }

  let matrixBaseIndex = 0;

  for (const resource of spotResources.depthTextureResources.resources) {
    if (
      resource.viewDimension === "2d" &&
      resource.allocation.resource !== null
    ) {
      supported.set(resource.lightId, matrixBaseIndex);
      matrixBaseIndex += 1;
    }
  }

  return supported;
}

function prepareDefaultCookieSamplerResource(
  options: Pick<
    AppTextureSamplerPreparationOptions,
    "cache" | "device" | "reuse"
  > & {
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
  },
): { readonly cacheKey: string; readonly resource: SamplerGpuResource } | null {
  const cached = options.cache.samplers.get(DEFAULT_COOKIE_SAMPLER_CACHE_KEY);

  if (cached !== undefined) {
    options.reuse.samplerResourcesReused += 1;
    return { cacheKey: DEFAULT_COOKIE_SAMPLER_CACHE_KEY, resource: cached };
  }

  const result = createSamplerGpuResource({
    device: options.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY,
    sampler: defaultCookieSampler(),
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.samplers.set(DEFAULT_COOKIE_SAMPLER_CACHE_KEY, result.resource);
  options.reuse.samplerResourcesCreated += 1;

  return {
    cacheKey: DEFAULT_COOKIE_SAMPLER_CACHE_KEY,
    resource: result.resource,
  };
}

function defaultCookieSampler(): SamplerAsset {
  return createSamplerAsset({
    label: "Clustered local-light cookie sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
}
