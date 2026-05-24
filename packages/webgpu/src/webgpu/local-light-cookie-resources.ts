import {
  assetHandleKey,
  makePerspective,
  multiplyMat4,
  type Mat4Like,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type LightPacket,
  type RenderSnapshot,
  type SamplerAsset,
  type TextureAsset,
} from "@aperture-engine/render";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  sourceAssetCacheKey,
  type AppTextureSamplerPreparationOptions,
  type WebGpuAppTextureSamplerPreparationDiagnostic,
} from "./app-texture-sampler-resources.js";
import type { LocalLightClusterSupportedCookieResource } from "./local-light-clusters.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { writeBufferData } from "./app-frame-resource-utils.js";
import type { StandardFrameShadowReceiverResources } from "./standard-frame-resources.js";
import {
  createSamplerGpuResource,
  createTextureGpuResource,
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type TextureGpuDeviceLike,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "./texture-resources.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";

const DEFAULT_COOKIE_SAMPLER_CACHE_KEY = "local-light-cookie:default-sampler@1";
const DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY =
  "local-light-cookie:default-sampler";
const SPOT_COOKIE_MATRIX_VERSION = 1;
const EPSILON = 1e-6;

export type LocalLightClusterCookieTextureViewDimension =
  | "2d"
  | "2d-array"
  | "cube";

export interface LocalLightClusterCookieMatrixResource {
  readonly resourceKey: string;
  readonly label: string;
  readonly buffer: unknown;
  readonly matrixCount: number;
  readonly entryLightIds: readonly number[];
}

export interface LocalLightClusterCookieResources {
  readonly matrixResource: LocalLightClusterCookieMatrixResource;
  readonly textureResource: TextureGpuResource;
  readonly samplerResource: SamplerGpuResource;
  readonly textureViewDimension: LocalLightClusterCookieTextureViewDimension;
  readonly textureLayout?: "single" | "array" | "atlas";
  readonly shadowMatrixCompatible?: boolean;
  readonly atlasUpdate?: LocalLightClusterCookieAtlasUpdateReport;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly supportedResources: readonly LocalLightClusterSupportedCookieResource[];
}

export interface LocalLightClusterCookieAtlasUpdateReport {
  readonly updateMode: "cache-hit" | "cpu-upload" | "gpu-blit";
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly requestedTileCount: number;
  readonly updatedTileCount: number;
  readonly gpuBlitTileCount: number;
  readonly cpuUploadTileCount: number;
  readonly cachedTileCount: number;
  readonly sourceTextureKeys: readonly string[];
}

export type LocalLightClusterCookieResourceDiagnostic =
  | WebGpuAppTextureSamplerPreparationDiagnostic
  | {
      readonly code:
        | "localLightClusterCookie.textureNot2d"
        | "localLightClusterCookie.textureNotCube"
        | "localLightClusterCookie.textureArrayIncompatible"
        | "localLightClusterCookie.textureArrayMissingSourceData"
        | "localLightClusterCookie.textureAtlasIncompatible"
        | "localLightClusterCookie.textureAtlasMissingSourceData"
        | "localLightClusterCookie.textureAtlasUploadUnavailable"
        | "localLightClusterCookie.textureAtlasUploadFailed";
      readonly message: string;
      readonly resourceKey: string;
    }
  | {
      readonly code:
        | "localLightClusterCookie.missingLightTransform"
        | "localLightClusterCookie.invalidLightDirection"
        | "localLightClusterCookie.bufferCreationFailed";
      readonly message: string;
      readonly lightId: number;
      readonly reason?: WebGpuBufferFailureReason;
    };

export interface PrepareLocalLightClusterCookieResourcesResult {
  readonly valid: boolean;
  readonly resources: LocalLightClusterCookieResources | null;
  readonly diagnostics: readonly LocalLightClusterCookieResourceDiagnostic[];
}

interface CookieArrayCandidate {
  readonly light: LightPacket;
  readonly texture: TextureAsset & {
    readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
  };
  readonly textureKey: string;
  readonly textureCacheKey: string;
  readonly samplerSignature: string;
  readonly layerByteLength: number;
  readonly rowsPerImage: number;
  readonly layerCount: number;
  readonly layerBaseIndex: number;
}

interface CookieAtlasCandidate {
  readonly light: LightPacket;
  readonly texture: TextureAsset & {
    readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
  };
  readonly textureKey: string;
  readonly textureCacheKey: string;
  readonly samplerSignature: string;
  readonly rowsPerImage: number;
  readonly layerByteLength: number;
  readonly originX: number;
  readonly originY: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly atlasTileWidth: number;
  readonly atlasTileHeight: number;
  readonly matrixBaseIndex: number;
  readonly shadowMatrixCompatible?: boolean;
}

interface PreparedCookieAtlasTextureResource {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
  readonly atlasUpdate: LocalLightClusterCookieAtlasUpdateReport;
}

interface CookieAtlasBlitPreparedTile {
  readonly candidate: CookieAtlasCandidate;
  readonly sourceTextureResource: TextureGpuResource;
  readonly sourceSamplerResource: SamplerGpuResource;
}

interface CookieAtlasBlitDeviceLike extends TextureGpuDeviceLike {
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createPipelineLayout?: (descriptor: unknown) => unknown;
  readonly createRenderPipeline?: (descriptor: unknown) => unknown;
  readonly createBindGroup?: (descriptor: unknown) => unknown;
  readonly createCommandEncoder?: (descriptor?: unknown) => {
    readonly beginRenderPass?: (descriptor: unknown) => {
      readonly setPipeline?: (pipeline: unknown) => void;
      readonly setBindGroup?: (index: number, bindGroup: unknown) => void;
      readonly setViewport?: (
        x: number,
        y: number,
        width: number,
        height: number,
        minDepth: number,
        maxDepth: number,
      ) => void;
      readonly draw?: (
        vertexCount: number,
        instanceCount?: number,
        firstVertex?: number,
        firstInstance?: number,
      ) => void;
      readonly end?: () => void;
    };
    readonly finish?: () => unknown;
  };
  readonly queue?: TextureGpuDeviceLike["queue"] & {
    readonly submit?: (commandBuffers: readonly unknown[]) => void;
  };
}

interface CookieAtlasBlitPipeline {
  readonly bindGroupLayout: unknown;
  readonly pipeline: unknown;
}

const cookieAtlasBlitPipelineCache = new WeakMap<
  object,
  Map<string, CookieAtlasBlitPipeline>
>();
const cookieAtlasSourceKeys = new WeakMap<object, Map<string, string>>();
const COOKIE_ATLAS_BLIT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2f(0.5, 0.5);
  output.uv.y = 1.0 - output.uv.y;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(sourceTexture, sourceSampler, input.uv);
}
`;

export function prepareLocalLightClusterCookieResources(
  options: AppTextureSamplerPreparationOptions & {
    readonly snapshot: RenderSnapshot;
    readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
    readonly matrixCache?: Map<string, LocalLightClusterCookieMatrixResource>;
  },
): PrepareLocalLightClusterCookieResourcesResult {
  const diagnostics: LocalLightClusterCookieResourceDiagnostic[] = [];
  const textureSamplerDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] =
    [];
  const arrayCandidates = collectCookieArrayCandidates(options);
  const baseAtlasCandidates = collectCookieAtlasCandidates(options);
  const shadowAlignedAtlasCandidates =
    collectShadowAlignedCookieAtlasCandidates(
      baseAtlasCandidates,
      options.shadowReceiverResources,
    );
  const atlasCandidates =
    shadowAlignedAtlasCandidates.length > 1
      ? shadowAlignedAtlasCandidates
      : baseAtlasCandidates;

  if (
    atlasCandidates.length > 1 &&
    atlasCandidates.length > arrayCandidates.length
  ) {
    const matrixResource = prepareCookieAtlasMatrixResource({
      device: options.device as WebGpuBufferDeviceLike,
      candidates: atlasCandidates,
      snapshot: options.snapshot,
      ...(options.matrixCache === undefined
        ? {}
        : { cache: options.matrixCache }),
      diagnostics,
    });

    if (matrixResource === null) {
      return {
        valid: diagnostics.length === 0,
        resources: null,
        diagnostics,
      };
    }

    const texture = prepareCookieTextureAtlasResource({
      ...options,
      candidates: atlasCandidates,
      diagnostics,
    });

    if (texture === null) {
      return { valid: false, resources: null, diagnostics };
    }

    const firstCandidate = atlasCandidates[0];

    if (firstCandidate === undefined) {
      return { valid: false, resources: null, diagnostics };
    }

    const sampler =
      firstCandidate.light.cookieSampler === undefined ||
      firstCandidate.light.cookieSampler === null
        ? prepareDefaultCookieSamplerResource({
            ...options,
            diagnostics,
          })
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: firstCandidate.light.cookieSampler,
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
        matrixResource,
        textureResource: texture.resource,
        samplerResource: sampler.resource,
        textureViewDimension: "2d",
        textureLayout: "atlas",
        shadowMatrixCompatible: atlasCandidates.every(
          (candidate) => candidate.shadowMatrixCompatible === true,
        ),
        atlasUpdate: texture.atlasUpdate,
        textureKey: texture.cacheKey,
        samplerKey: sampler.cacheKey,
        supportedResources: atlasCandidates.map((candidate) => ({
          lightId: candidate.light.lightId,
          textureKey: texture.cacheKey,
          samplerKey: sampler.cacheKey,
          textureViewDimension: "2d",
          matrixBaseIndex: candidate.matrixBaseIndex,
        })),
      },
      diagnostics,
    };
  }

  if (arrayCandidates.length > 1) {
    const matrixResource = prepareCookieMatrixArrayResource({
      device: options.device as WebGpuBufferDeviceLike,
      candidates: arrayCandidates,
      snapshot: options.snapshot,
      ...(options.matrixCache === undefined
        ? {}
        : { cache: options.matrixCache }),
      diagnostics,
    });

    if (matrixResource === null) {
      return {
        valid: diagnostics.length === 0,
        resources: null,
        diagnostics,
      };
    }

    const texture = prepareCookieTextureArrayResource({
      ...options,
      candidates: arrayCandidates,
      diagnostics,
    });

    if (texture === null) {
      return { valid: false, resources: null, diagnostics };
    }

    const firstCandidate = arrayCandidates[0];

    if (firstCandidate === undefined) {
      return { valid: false, resources: null, diagnostics };
    }

    const sampler =
      firstCandidate.light.cookieSampler === undefined ||
      firstCandidate.light.cookieSampler === null
        ? prepareDefaultCookieSamplerResource({
            ...options,
            diagnostics,
          })
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: firstCandidate.light.cookieSampler,
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
        matrixResource,
        textureResource: texture.resource,
        samplerResource: sampler.resource,
        textureViewDimension: "2d-array",
        textureLayout: "array",
        shadowMatrixCompatible: false,
        textureKey: texture.cacheKey,
        samplerKey: sampler.cacheKey,
        supportedResources: arrayCandidates.map((candidate) => ({
          lightId: candidate.light.lightId,
          textureKey: texture.cacheKey,
          samplerKey: sampler.cacheKey,
          textureViewDimension: "2d-array",
          matrixBaseIndex: candidate.layerBaseIndex,
        })),
      },
      diagnostics,
    };
  }

  for (const light of options.snapshot.lights) {
    if (
      (light.kind !== "point" && light.kind !== "spot") ||
      light.cookieTexture === undefined ||
      light.cookieTexture === null
    ) {
      continue;
    }

    const textureViewDimension = cookieTextureViewDimensionForLight(light);
    const matrixResource = prepareCookieMatrixResource({
      device: options.device as WebGpuBufferDeviceLike,
      snapshot: options.snapshot,
      light,
      ...(options.matrixCache === undefined
        ? {}
        : { cache: options.matrixCache }),
      diagnostics,
    });

    if (matrixResource === null) {
      return {
        valid: diagnostics.length === 0,
        resources: null,
        diagnostics,
      };
    }

    const textureEntry = options.assets.get<"texture", TextureAsset>(
      light.cookieTexture,
    );
    const textureKey = assetHandleKey(light.cookieTexture);

    const textureDiagnostic = validateCookieTextureAsset(
      textureKey,
      textureEntry?.status === "ready" ? textureEntry.asset : null,
      textureViewDimension,
    );

    if (textureDiagnostic !== null) {
      diagnostics.push({
        code: textureDiagnostic.code,
        resourceKey: textureKey,
        message: textureDiagnostic.message,
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
      ...(textureViewDimension === "cube"
        ? {
            viewDescriptor: { dimension: "cube" },
            viewDescriptorKey: "cube",
          }
        : {}),
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
        matrixResource,
        textureResource: texture.resource,
        samplerResource: sampler.resource,
        textureViewDimension,
        textureLayout: "single",
        shadowMatrixCompatible: false,
        textureKey: texture.cacheKey,
        samplerKey: sampler.cacheKey,
        supportedResources: [
          {
            lightId: light.lightId,
            textureKey: texture.cacheKey,
            samplerKey: sampler.cacheKey,
            textureViewDimension,
            matrixBaseIndex: 0,
          },
        ],
      },
      diagnostics,
    };
  }

  return { valid: diagnostics.length === 0, resources: null, diagnostics };
}

function collectCookieArrayCandidates(
  options: Pick<AppTextureSamplerPreparationOptions, "assets"> & {
    readonly snapshot: RenderSnapshot;
  },
): readonly CookieArrayCandidate[] {
  const candidates: CookieArrayCandidate[] = [];
  let base: {
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly colorSpace: TextureAsset["colorSpace"];
    readonly semantic: TextureAsset["semantic"];
    readonly mipLevelCount: number;
    readonly bytesPerRow: number;
    readonly rowsPerImage: number;
    readonly samplerSignature: string;
  } | null = null;
  let nextLayerBaseIndex = 0;

  for (const light of options.snapshot.lights) {
    if (
      (light.kind !== "spot" && light.kind !== "point") ||
      light.cookieTexture === undefined ||
      light.cookieTexture === null
    ) {
      continue;
    }

    const textureEntry = options.assets.get<"texture", TextureAsset>(
      light.cookieTexture,
    );

    if (
      textureEntry === undefined ||
      textureEntry.status !== "ready" ||
      textureEntry.asset === null ||
      textureEntry.asset.sourceData === undefined
    ) {
      continue;
    }

    if (light.kind === "spot" && textureEntry.asset.dimension !== "2d") {
      continue;
    }

    if (
      light.kind === "point" &&
      (textureEntry.asset.dimension !== "cube" ||
        textureEntry.asset.depthOrLayers !== 6)
    ) {
      continue;
    }

    const sampler = cookieSamplerCandidate(options, light);

    if (sampler === null) {
      continue;
    }

    const texture = textureEntry.asset as TextureAsset & {
      readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
    };
    const rowsPerImage = texture.sourceData.rowsPerImage ?? texture.height;
    const layerByteLength = rowsPerImage * texture.sourceData.bytesPerRow;
    const layerCount = light.kind === "point" ? 6 : 1;

    if (texture.sourceData.bytes.byteLength < layerByteLength * layerCount) {
      continue;
    }

    const candidateBase = {
      width: texture.width,
      height: texture.height,
      format: texture.format,
      colorSpace: texture.colorSpace,
      semantic: texture.semantic,
      mipLevelCount: texture.mipLevelCount,
      bytesPerRow: texture.sourceData.bytesPerRow,
      rowsPerImage,
      samplerSignature: sampler.signature,
    };

    if (base === null) {
      base = candidateBase;
    } else if (!cookieArrayBaseMatches(base, candidateBase)) {
      continue;
    }

    candidates.push({
      light,
      texture,
      textureKey: assetHandleKey(light.cookieTexture),
      textureCacheKey: sourceAssetCacheKey(
        light.cookieTexture,
        textureEntry.version,
      ),
      samplerSignature: sampler.signature,
      layerByteLength,
      rowsPerImage,
      layerCount,
      layerBaseIndex: nextLayerBaseIndex,
    });
    nextLayerBaseIndex += layerCount;
  }

  return candidates;
}

function collectCookieAtlasCandidates(
  options: Pick<AppTextureSamplerPreparationOptions, "assets"> & {
    readonly snapshot: RenderSnapshot;
  },
): readonly CookieAtlasCandidate[] {
  const pending: Omit<
    CookieAtlasCandidate,
    | "originX"
    | "originY"
    | "atlasWidth"
    | "atlasHeight"
    | "atlasTileWidth"
    | "atlasTileHeight"
    | "matrixBaseIndex"
    | "shadowMatrixCompatible"
  >[] = [];
  let base: {
    readonly format: string;
    readonly colorSpace: TextureAsset["colorSpace"];
    readonly semantic: TextureAsset["semantic"];
    readonly mipLevelCount: number;
    readonly samplerSignature: string;
  } | null = null;

  for (const light of options.snapshot.lights) {
    if (
      light.kind !== "spot" ||
      light.cookieTexture === undefined ||
      light.cookieTexture === null
    ) {
      continue;
    }

    const textureEntry = options.assets.get<"texture", TextureAsset>(
      light.cookieTexture,
    );

    if (
      textureEntry === undefined ||
      textureEntry.status !== "ready" ||
      textureEntry.asset === null ||
      textureEntry.asset.sourceData === undefined ||
      textureEntry.asset.dimension !== "2d" ||
      textureEntry.asset.width <= 0 ||
      textureEntry.asset.height <= 0
    ) {
      continue;
    }

    const sampler = cookieSamplerCandidate(options, light);

    if (sampler === null) {
      continue;
    }

    const texture = textureEntry.asset as TextureAsset & {
      readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
    };
    const rowsPerImage = texture.sourceData.rowsPerImage ?? texture.height;
    const layerByteLength = rowsPerImage * texture.sourceData.bytesPerRow;

    if (texture.sourceData.bytes.byteLength < layerByteLength) {
      continue;
    }

    const candidateBase = {
      format: texture.format,
      colorSpace: texture.colorSpace,
      semantic: texture.semantic,
      mipLevelCount: texture.mipLevelCount,
      samplerSignature: sampler.signature,
    };

    if (base === null) {
      base = candidateBase;
    } else if (!cookieAtlasBaseMatches(base, candidateBase)) {
      continue;
    }

    pending.push({
      light,
      texture,
      textureKey: assetHandleKey(light.cookieTexture),
      textureCacheKey: sourceAssetCacheKey(
        light.cookieTexture,
        textureEntry.version,
      ),
      samplerSignature: sampler.signature,
      rowsPerImage,
      layerByteLength,
    });
  }

  if (pending.length <= 1) {
    return [];
  }

  const atlasWidth = pending.reduce(
    (width, candidate) => width + candidate.texture.width,
    0,
  );
  const atlasHeight = pending.reduce(
    (height, candidate) => Math.max(height, candidate.texture.height),
    1,
  );
  const candidates: CookieAtlasCandidate[] = [];
  let originX = 0;

  for (const candidate of pending) {
    candidates.push({
      ...candidate,
      originX,
      originY: 0,
      atlasWidth,
      atlasHeight,
      atlasTileWidth: candidate.texture.width,
      atlasTileHeight: candidate.texture.height,
      matrixBaseIndex: candidates.length,
    });
    originX += candidate.texture.width;
  }

  return candidates;
}

function collectShadowAlignedCookieAtlasCandidates(
  candidates: readonly CookieAtlasCandidate[],
  shadowReceiverResources: StandardFrameShadowReceiverResources | undefined,
): readonly CookieAtlasCandidate[] {
  if (candidates.length <= 1 || shadowReceiverResources === undefined) {
    return [];
  }

  const spotResources =
    shadowReceiverResources.shadowKind !== undefined &&
    shadowReceiverResources.shadowKind.startsWith("multi")
      ? shadowReceiverResources.spotShadowReceiverResources
      : shadowReceiverResources.shadowKind === "spot" ||
          shadowReceiverResources.shadowKind === "spot-array"
        ? shadowReceiverResources
        : undefined;

  if (
    spotResources === undefined ||
    spotResources.matrixBufferResource.resource === null ||
    spotResources.samplerResource.resource === null
  ) {
    return [];
  }

  const spotDepthResources = spotResources.depthTextureResources.resources;
  const aligned: CookieAtlasCandidate[] = [];
  let atlasWidth: number | null = null;
  let atlasHeight: number | null = null;

  for (const candidate of candidates) {
    const shadowResource = spotDepthResources.find(
      (resource) =>
        resource.lightId === candidate.light.lightId &&
        resource.viewDimension === "2d" &&
        resource.allocation.resource !== null &&
        resource.atlasRegion !== undefined,
    );
    const shadowTextureSize =
      shadowResource?.allocation.resource?.descriptor.size;

    if (
      shadowResource === undefined ||
      shadowResource.atlasRegion === undefined ||
      shadowTextureSize === undefined
    ) {
      return [];
    }

    const shadowAtlasWidth = shadowTextureSize[0];
    const shadowAtlasHeight = shadowTextureSize[1];

    if (
      atlasWidth !== null &&
      (atlasWidth !== shadowAtlasWidth || atlasHeight !== shadowAtlasHeight)
    ) {
      return [];
    }

    atlasWidth = shadowAtlasWidth;
    atlasHeight = shadowAtlasHeight;

    aligned.push({
      ...candidate,
      originX: shadowResource.atlasRegion.originX,
      originY: shadowResource.atlasRegion.originY,
      atlasWidth: shadowAtlasWidth,
      atlasHeight: shadowAtlasHeight,
      atlasTileWidth: shadowResource.atlasRegion.width,
      atlasTileHeight: shadowResource.atlasRegion.height,
      matrixBaseIndex: aligned.length,
      shadowMatrixCompatible: true,
    });
  }

  return aligned;
}

function cookieSamplerCandidate(
  options: Pick<AppTextureSamplerPreparationOptions, "assets">,
  light: LightPacket,
): { readonly signature: string } | null {
  if (light.cookieSampler === undefined || light.cookieSampler === null) {
    return { signature: DEFAULT_COOKIE_SAMPLER_CACHE_KEY };
  }

  const entry = options.assets.get<"sampler", SamplerAsset>(
    light.cookieSampler,
  );

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return null;
  }

  return { signature: samplerAssetSignature(entry.asset) };
}

function samplerAssetSignature(sampler: SamplerAsset): string {
  return [
    sampler.addressModeU,
    sampler.addressModeV,
    sampler.addressModeW,
    sampler.magFilter,
    sampler.minFilter,
    sampler.mipmapFilter,
    sampler.lodMinClamp,
    sampler.lodMaxClamp,
    sampler.maxAnisotropy,
  ].join("|");
}

function cookieArrayBaseMatches(
  base: {
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly colorSpace: TextureAsset["colorSpace"];
    readonly semantic: TextureAsset["semantic"];
    readonly mipLevelCount: number;
    readonly bytesPerRow: number;
    readonly rowsPerImage: number;
    readonly samplerSignature: string;
  },
  candidate: typeof base,
): boolean {
  return (
    candidate.width === base.width &&
    candidate.height === base.height &&
    candidate.format === base.format &&
    candidate.colorSpace === base.colorSpace &&
    candidate.semantic === base.semantic &&
    candidate.mipLevelCount === base.mipLevelCount &&
    candidate.bytesPerRow === base.bytesPerRow &&
    candidate.rowsPerImage === base.rowsPerImage &&
    candidate.samplerSignature === base.samplerSignature
  );
}

function cookieAtlasBaseMatches(
  base: {
    readonly format: string;
    readonly colorSpace: TextureAsset["colorSpace"];
    readonly semantic: TextureAsset["semantic"];
    readonly mipLevelCount: number;
    readonly samplerSignature: string;
  },
  candidate: typeof base,
): boolean {
  return (
    candidate.format === base.format &&
    candidate.colorSpace === base.colorSpace &&
    candidate.semantic === base.semantic &&
    candidate.mipLevelCount === base.mipLevelCount &&
    candidate.samplerSignature === base.samplerSignature
  );
}

function prepareCookieTextureArrayResource(
  options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieArrayCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
  },
): {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
} | null {
  const first = options.candidates[0];

  if (first === undefined) {
    return null;
  }

  const cacheKey = `local-light-cookie-array:v1:${options.candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.layerBaseIndex}+${candidate.layerCount}:${candidate.textureCacheKey}`,
    )
    .join("|")}`;
  const cached = options.cache.textures.get(cacheKey);

  if (cached !== undefined) {
    options.reuse.textureResourcesReused += 1;
    return { cacheKey, resource: cached };
  }

  const layerByteLength = first.layerByteLength;
  const totalLayerCount = options.candidates.reduce(
    (total, candidate) => total + candidate.layerCount,
    0,
  );
  const combinedData = new Uint8Array(layerByteLength * totalLayerCount);

  for (let index = 0; index < options.candidates.length; index += 1) {
    const candidate = options.candidates[index];

    if (candidate === undefined || candidate.texture.sourceData === undefined) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureArrayMissingSourceData",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie array '${cacheKey}' requires source texture bytes for every layer.`,
      });
      return null;
    }

    if (
      candidate.layerByteLength !== layerByteLength ||
      candidate.rowsPerImage !== first.rowsPerImage ||
      candidate.texture.sourceData.bytes.byteLength <
        layerByteLength * candidate.layerCount
    ) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureArrayIncompatible",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie array '${cacheKey}' has incompatible layer layout for texture '${candidate.textureKey}'.`,
      });
      return null;
    }

    combinedData.set(
      candidate.texture.sourceData.bytes.subarray(
        0,
        layerByteLength * candidate.layerCount,
      ),
      candidate.layerBaseIndex * layerByteLength,
    );
  }

  const result = createTextureGpuResource({
    device: options.device as Parameters<
      typeof createTextureGpuResource
    >[0]["device"],
    resourceKey: cacheKey,
    descriptor: {
      label: cacheKey,
      size: [first.texture.width, first.texture.height, totalLayerCount],
      format: first.texture.format,
      colorSpace: first.texture.colorSpace,
      semantic: first.texture.semantic,
      mipLevelCount: first.texture.mipLevelCount,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    },
    upload: {
      data: combinedData,
      bytesPerRow: first.texture.sourceData.bytesPerRow,
      rowsPerImage: first.rowsPerImage,
    },
    viewDescriptor: { dimension: "2d-array" },
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  options.cache.textures.set(cacheKey, result.resource);
  options.reuse.textureResourcesCreated += 1;

  return { cacheKey, resource: result.resource };
}

function prepareCookieTextureAtlasResource(
  options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieAtlasCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
  },
): PreparedCookieAtlasTextureResource | null {
  const gpuBlitTexture = prepareCookieTextureAtlasGpuBlitResource(options);

  if (gpuBlitTexture !== null) {
    return gpuBlitTexture;
  }

  return prepareCookieTextureAtlasCpuUploadResource(options);
}

function prepareCookieTextureAtlasGpuBlitResource(
  options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieAtlasCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
  },
): PreparedCookieAtlasTextureResource | null {
  const first = options.candidates[0];

  if (first === undefined) {
    return null;
  }

  const device = options.device as CookieAtlasBlitDeviceLike;

  if (!canBlitCookieAtlasOnGpu(device)) {
    return null;
  }

  const cacheKey = `local-light-cookie-atlas-gpu:v1:${first.atlasWidth}x${first.atlasHeight}:format:${first.texture.format}:mips:${first.texture.mipLevelCount}:color:${first.texture.colorSpace}:semantic:${first.texture.semantic}:${options.candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`,
    )
    .join("|")}`;
  const cached = options.cache.textures.get(cacheKey);
  let resource = cached;
  let created = false;

  if (resource === undefined) {
    const result = createTextureGpuResource({
      device,
      resourceKey: cacheKey,
      descriptor: {
        label: cacheKey,
        size: [first.atlasWidth, first.atlasHeight, 1],
        format: first.texture.format,
        colorSpace: first.texture.colorSpace,
        semantic: first.texture.semantic,
        mipLevelCount: first.texture.mipLevelCount,
        usage:
          WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
          WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST |
          WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
      },
    });

    if (!result.valid || result.resource === null) {
      return null;
    }

    resource = result.resource;
    created = true;
  }

  const previousSourceKeys =
    getCookieAtlasSourceKeys(resource.texture) ?? new Map<string, string>();
  const preparedTiles: CookieAtlasBlitPreparedTile[] = [];
  const sourceTextureKeys: string[] = [];
  const tileKeysToUpdate: string[] = [];
  const localDiagnostics: LocalLightClusterCookieResourceDiagnostic[] = [];
  const localTextureSamplerDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] =
    [];

  for (const candidate of options.candidates) {
    const sourceKey = candidate.textureCacheKey;
    const tileKey = cookieAtlasTileKey(candidate);

    sourceTextureKeys.push(sourceKey);

    if (!created && previousSourceKeys.get(tileKey) === sourceKey) {
      continue;
    }

    const sourceTexture = prepareAppTextureResource({
      assets: options.assets,
      device: options.device,
      cache: options.cache,
      handle: candidate.light.cookieTexture as NonNullable<
        LightPacket["cookieTexture"]
      >,
      reuse: options.reuse,
      diagnostics: localTextureSamplerDiagnostics,
    });
    localDiagnostics.push(...localTextureSamplerDiagnostics.splice(0));

    if (sourceTexture === null) {
      return null;
    }

    const sourceSampler =
      candidate.light.cookieSampler === undefined ||
      candidate.light.cookieSampler === null
        ? prepareDefaultCookieSamplerResource({
            ...options,
            diagnostics: localDiagnostics,
          })
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.device,
            cache: options.cache,
            handle: candidate.light.cookieSampler,
            reuse: options.reuse,
            diagnostics: localTextureSamplerDiagnostics,
          });
    localDiagnostics.push(...localTextureSamplerDiagnostics.splice(0));

    if (sourceSampler === null || localDiagnostics.length > 0) {
      return null;
    }

    preparedTiles.push({
      candidate,
      sourceTextureResource: sourceTexture.resource,
      sourceSamplerResource: sourceSampler.resource,
    });
    tileKeysToUpdate.push(tileKey);
  }

  if (preparedTiles.length > 0) {
    const blitSucceeded = renderCookieAtlasBlitTiles({
      device,
      resource,
      format: first.texture.format,
      tiles: preparedTiles,
      clear: created,
    });

    if (!blitSucceeded) {
      return null;
    }

    const nextSourceKeys = new Map(previousSourceKeys);

    for (let index = 0; index < tileKeysToUpdate.length; index += 1) {
      const tileKey = tileKeysToUpdate[index];
      const prepared = preparedTiles[index];

      if (tileKey !== undefined && prepared !== undefined) {
        nextSourceKeys.set(tileKey, prepared.candidate.textureCacheKey);
      }
    }

    setCookieAtlasSourceKeys(resource.texture, nextSourceKeys);
  } else if (created) {
    setCookieAtlasSourceKeys(resource.texture, previousSourceKeys);
  }

  if (created) {
    options.cache.textures.set(cacheKey, resource);
    options.reuse.textureResourcesCreated += 1;
  } else {
    options.reuse.textureResourcesReused += 1;
  }

  return {
    cacheKey,
    resource,
    atlasUpdate: {
      updateMode: preparedTiles.length > 0 ? "gpu-blit" : "cache-hit",
      atlasWidth: first.atlasWidth,
      atlasHeight: first.atlasHeight,
      requestedTileCount: options.candidates.length,
      updatedTileCount: preparedTiles.length,
      gpuBlitTileCount: preparedTiles.length,
      cpuUploadTileCount: 0,
      cachedTileCount: options.candidates.length - preparedTiles.length,
      sourceTextureKeys,
    },
  };
}

function prepareCookieTextureAtlasCpuUploadResource(
  options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieAtlasCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
  },
): PreparedCookieAtlasTextureResource | null {
  const first = options.candidates[0];

  if (first === undefined) {
    return null;
  }

  const cacheKey = `local-light-cookie-atlas:v1:${first.atlasWidth}x${first.atlasHeight}:${options.candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}:${candidate.textureCacheKey}`,
    )
    .join("|")}`;
  const cached = options.cache.textures.get(cacheKey);

  if (cached !== undefined) {
    options.reuse.textureResourcesReused += 1;
    return {
      cacheKey,
      resource: cached,
      atlasUpdate: {
        updateMode: "cache-hit",
        atlasWidth: first.atlasWidth,
        atlasHeight: first.atlasHeight,
        requestedTileCount: options.candidates.length,
        updatedTileCount: 0,
        gpuBlitTileCount: 0,
        cpuUploadTileCount: 0,
        cachedTileCount: options.candidates.length,
        sourceTextureKeys: options.candidates.map(
          (candidate) => candidate.textureCacheKey,
        ),
      },
    };
  }

  const result = createTextureGpuResource({
    device: options.device as Parameters<
      typeof createTextureGpuResource
    >[0]["device"],
    resourceKey: cacheKey,
    descriptor: {
      label: cacheKey,
      size: [first.atlasWidth, first.atlasHeight, 1],
      format: first.texture.format,
      colorSpace: first.texture.colorSpace,
      semantic: first.texture.semantic,
      mipLevelCount: first.texture.mipLevelCount,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    },
  });

  options.diagnostics.push(...result.diagnostics);

  if (!result.valid || result.resource === null) {
    return null;
  }

  const textureDevice = options.device as Parameters<
    typeof createTextureGpuResource
  >[0]["device"];
  const queue = textureDevice.queue;

  if (queue === undefined || queue.writeTexture === undefined) {
    options.diagnostics.push({
      code: "localLightClusterCookie.textureAtlasUploadUnavailable",
      resourceKey: cacheKey,
      message: `Clustered local-light cookie atlas '${cacheKey}' cannot upload source texture tiles because WebGPU queue.writeTexture is unavailable.`,
    });
    return null;
  }

  for (const candidate of options.candidates) {
    if (candidate.texture.sourceData === undefined) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureAtlasMissingSourceData",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie atlas '${cacheKey}' requires source texture bytes for '${candidate.textureKey}'.`,
      });
      return null;
    }

    if (
      candidate.texture.sourceData.bytes.byteLength < candidate.layerByteLength
    ) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureAtlasIncompatible",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie atlas '${cacheKey}' has incompatible source data for texture '${candidate.textureKey}'.`,
      });
      return null;
    }

    const upload = atlasTileUploadData(candidate);

    if (upload === null) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureAtlasIncompatible",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie atlas '${cacheKey}' has incompatible source data for texture '${candidate.textureKey}'.`,
      });
      return null;
    }

    try {
      queue.writeTexture(
        {
          texture: result.resource.texture,
          origin: { x: candidate.originX, y: candidate.originY, z: 0 },
        },
        upload.bytes,
        {
          bytesPerRow: upload.bytesPerRow,
          rowsPerImage: upload.rowsPerImage,
        },
        [candidate.atlasTileWidth, candidate.atlasTileHeight, 1],
      );
    } catch (error) {
      options.diagnostics.push({
        code: "localLightClusterCookie.textureAtlasUploadFailed",
        resourceKey: cacheKey,
        message: `Clustered local-light cookie atlas '${cacheKey}' upload failed for texture '${candidate.textureKey}': ${
          error instanceof Error ? error.message : "Texture upload failed."
        }`,
      });
      return null;
    }
  }

  options.cache.textures.set(cacheKey, result.resource);
  options.reuse.textureResourcesCreated += 1;

  return {
    cacheKey,
    resource: result.resource,
    atlasUpdate: {
      updateMode: "cpu-upload",
      atlasWidth: first.atlasWidth,
      atlasHeight: first.atlasHeight,
      requestedTileCount: options.candidates.length,
      updatedTileCount: options.candidates.length,
      gpuBlitTileCount: 0,
      cpuUploadTileCount: options.candidates.length,
      cachedTileCount: 0,
      sourceTextureKeys: options.candidates.map(
        (candidate) => candidate.textureCacheKey,
      ),
    },
  };
}

function canBlitCookieAtlasOnGpu(device: CookieAtlasBlitDeviceLike): boolean {
  return (
    typeof device.createShaderModule === "function" &&
    typeof device.createBindGroupLayout === "function" &&
    typeof device.createPipelineLayout === "function" &&
    typeof device.createRenderPipeline === "function" &&
    typeof device.createBindGroup === "function" &&
    typeof device.createCommandEncoder === "function" &&
    typeof device.queue?.submit === "function"
  );
}

function getCookieAtlasSourceKeys(
  texture: unknown,
): Map<string, string> | undefined {
  return isObjectLike(texture) ? cookieAtlasSourceKeys.get(texture) : undefined;
}

function setCookieAtlasSourceKeys(
  texture: unknown,
  keys: Map<string, string>,
): void {
  if (isObjectLike(texture)) {
    cookieAtlasSourceKeys.set(texture, keys);
  }
}

function cookieAtlasTileKey(candidate: CookieAtlasCandidate): string {
  return `${candidate.light.kind}:${candidate.light.lightId}@${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`;
}

function renderCookieAtlasBlitTiles(options: {
  readonly device: CookieAtlasBlitDeviceLike;
  readonly resource: TextureGpuResource;
  readonly format: string;
  readonly tiles: readonly CookieAtlasBlitPreparedTile[];
  readonly clear: boolean;
}): boolean {
  if (options.tiles.length === 0) {
    return true;
  }

  const pipeline = getOrCreateCookieAtlasBlitPipeline(
    options.device,
    options.format,
  );
  const encoder = options.device.createCommandEncoder?.({
    label: "local-light-cookie-atlas-blit-encoder",
  });

  if (
    pipeline === null ||
    encoder === undefined ||
    typeof encoder.beginRenderPass !== "function" ||
    typeof encoder.finish !== "function"
  ) {
    return false;
  }

  const pass = encoder.beginRenderPass({
    label: "local-light-cookie-atlas-blit-pass",
    colorAttachments: [
      {
        view: options.resource.view,
        loadOp: options.clear ? "clear" : "load",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      },
    ],
  });

  if (
    pass === undefined ||
    typeof pass.setPipeline !== "function" ||
    typeof pass.setBindGroup !== "function" ||
    typeof pass.setViewport !== "function" ||
    typeof pass.draw !== "function" ||
    typeof pass.end !== "function"
  ) {
    return false;
  }

  pass.setPipeline(pipeline.pipeline);

  for (const tile of options.tiles) {
    const bindGroup = options.device.createBindGroup?.({
      label: `local-light-cookie-atlas-blit:${tile.candidate.light.lightId}`,
      layout: pipeline.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: tile.sourceTextureResource.view,
        },
        {
          binding: 1,
          resource: tile.sourceSamplerResource.sampler,
        },
      ],
    });

    if (bindGroup === undefined) {
      return false;
    }

    pass.setBindGroup(0, bindGroup);
    pass.setViewport(
      tile.candidate.originX,
      tile.candidate.originY,
      tile.candidate.atlasTileWidth,
      tile.candidate.atlasTileHeight,
      0,
      1,
    );
    pass.draw(3, 1, 0, 0);
  }

  pass.end();

  const commandBuffer = encoder.finish();

  options.device.queue?.submit?.([commandBuffer]);

  return true;
}

function getOrCreateCookieAtlasBlitPipeline(
  device: CookieAtlasBlitDeviceLike,
  format: string,
): CookieAtlasBlitPipeline | null {
  if (!isObjectLike(device)) {
    return null;
  }

  let pipelines = cookieAtlasBlitPipelineCache.get(device);

  if (pipelines === undefined) {
    pipelines = new Map();
    cookieAtlasBlitPipelineCache.set(device, pipelines);
  }

  const cached = pipelines.get(format);

  if (cached !== undefined) {
    return cached;
  }

  const shaderModule = device.createShaderModule?.({
    label: "local-light-cookie-atlas-blit-shader",
    code: COOKIE_ATLAS_BLIT_WGSL,
  });
  const bindGroupLayout = device.createBindGroupLayout?.({
    label: "local-light-cookie-atlas-blit-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: 2,
        texture: { sampleType: "float", viewDimension: "2d" },
      },
      {
        binding: 1,
        visibility: 2,
        sampler: { type: "filtering" },
      },
    ],
  });

  if (shaderModule === undefined || bindGroupLayout === undefined) {
    return null;
  }

  const layout = device.createPipelineLayout?.({
    label: "local-light-cookie-atlas-blit-pipeline-layout",
    bindGroupLayouts: [bindGroupLayout],
  });

  if (layout === undefined) {
    return null;
  }

  const pipeline = device.createRenderPipeline?.({
    label: `local-light-cookie-atlas-blit-pipeline:${format}`,
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  if (pipeline === undefined) {
    return null;
  }

  const created = { bindGroupLayout, pipeline };

  pipelines.set(format, created);

  return created;
}

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

function atlasTileUploadData(candidate: CookieAtlasCandidate): {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage: number;
} | null {
  const source = candidate.texture.sourceData;

  if (source === undefined) {
    return null;
  }

  if (
    candidate.atlasTileWidth === candidate.texture.width &&
    candidate.atlasTileHeight === candidate.texture.height
  ) {
    return {
      bytes: source.bytes.subarray(0, candidate.layerByteLength),
      bytesPerRow: source.bytesPerRow,
      rowsPerImage: candidate.rowsPerImage,
    };
  }

  const bytesPerPixel = source.bytesPerRow / candidate.texture.width;

  if (
    !Number.isInteger(bytesPerPixel) ||
    bytesPerPixel <= 0 ||
    candidate.atlasTileWidth <= 0 ||
    candidate.atlasTileHeight <= 0
  ) {
    return null;
  }

  const bytesPerRow = candidate.atlasTileWidth * bytesPerPixel;
  const bytes = new Uint8Array(bytesPerRow * candidate.atlasTileHeight);

  for (let y = 0; y < candidate.atlasTileHeight; y += 1) {
    const sourceY = Math.min(
      candidate.texture.height - 1,
      Math.floor(
        ((y + 0.5) * candidate.texture.height) / candidate.atlasTileHeight,
      ),
    );

    for (let x = 0; x < candidate.atlasTileWidth; x += 1) {
      const sourceX = Math.min(
        candidate.texture.width - 1,
        Math.floor(
          ((x + 0.5) * candidate.texture.width) / candidate.atlasTileWidth,
        ),
      );
      const sourceOffset =
        sourceY * source.bytesPerRow + sourceX * bytesPerPixel;
      const targetOffset = y * bytesPerRow + x * bytesPerPixel;

      if (sourceOffset + bytesPerPixel > source.bytes.byteLength) {
        return null;
      }

      bytes.set(
        source.bytes.subarray(sourceOffset, sourceOffset + bytesPerPixel),
        targetOffset,
      );
    }
  }

  return {
    bytes,
    bytesPerRow,
    rowsPerImage: candidate.atlasTileHeight,
  };
}

function cookieTextureViewDimensionForLight(
  light: LightPacket,
): LocalLightClusterCookieTextureViewDimension {
  return light.kind === "point" ? "cube" : "2d";
}

function validateCookieTextureAsset(
  textureKey: string,
  texture: TextureAsset | null | undefined,
  dimension: LocalLightClusterCookieTextureViewDimension,
): {
  readonly code:
    | "localLightClusterCookie.textureNot2d"
    | "localLightClusterCookie.textureNotCube";
  readonly message: string;
} | null {
  if (texture === null || texture === undefined) {
    return null;
  }

  if (dimension === "2d" && texture.dimension !== "2d") {
    return {
      code: "localLightClusterCookie.textureNot2d",
      message: `Clustered spot-light cookie '${textureKey}' must be a 2D texture.`,
    };
  }

  if (
    dimension === "cube" &&
    (texture.dimension !== "cube" || texture.depthOrLayers !== 6)
  ) {
    return {
      code: "localLightClusterCookie.textureNotCube",
      message: `Clustered point-light cookie '${textureKey}' must be a cube texture with six layers.`,
    };
  }

  return null;
}

function prepareCookieMatrixResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly light: LightPacket;
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrix =
    options.light.kind === "spot"
      ? computeSpotCookieMatrix(options.snapshot, options.light)
      : { data: new Float32Array(identityMat4()) };

  if ("diagnostic" in matrix) {
    options.diagnostics.push(matrix.diagnostic);
    return null;
  }

  const resourceKey = cookieMatrixResourceKey(options.light);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === 1 &&
    writeBufferData(options.device, cached.buffer, matrix.data)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrix.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrix.data,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: options.light.lightId,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount: 1,
    entryLightIds: [options.light.lightId],
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

function prepareCookieMatrixArrayResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly candidates: readonly CookieArrayCandidate[];
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrixCount = Math.max(
    options.candidates.reduce(
      (total, candidate) => total + candidate.layerCount,
      0,
    ),
    1,
  );
  const matrices = new Float32Array(matrixCount * 16);
  const entryLightIds: number[] = [];

  for (const candidate of options.candidates) {
    const light = candidate.light;

    const matrix =
      light.kind === "spot"
        ? computeSpotCookieMatrix(options.snapshot, light)
        : { data: new Float32Array(identityMat4()) };

    if ("diagnostic" in matrix) {
      options.diagnostics.push(matrix.diagnostic);
      return null;
    }

    for (let layer = 0; layer < candidate.layerCount; layer += 1) {
      matrices.set(matrix.data, (candidate.layerBaseIndex + layer) * 16);
    }

    entryLightIds.push(light.lightId);
  }

  const resourceKey = cookieMatrixArrayResourceKey(options.candidates);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === matrixCount &&
    writeBufferData(options.device, cached.buffer, matrices)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrices.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrices,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: entryLightIds[0] ?? -1,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount,
    entryLightIds,
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

function prepareCookieAtlasMatrixResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly candidates: readonly CookieAtlasCandidate[];
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrixCount = Math.max(options.candidates.length, 1);
  const matrices = new Float32Array(matrixCount * 16);
  const entryLightIds: number[] = [];

  for (const candidate of options.candidates) {
    const matrix = computeSpotCookieMatrix(options.snapshot, candidate.light);

    if ("diagnostic" in matrix) {
      options.diagnostics.push(matrix.diagnostic);
      return null;
    }

    matrices.set(
      atlasAdjustedCookieMatrix(matrix.data, {
        x: candidate.originX / candidate.atlasWidth,
        y: candidate.originY / candidate.atlasHeight,
        width: candidate.atlasTileWidth / candidate.atlasWidth,
        height: candidate.atlasTileHeight / candidate.atlasHeight,
      }),
      candidate.matrixBaseIndex * 16,
    );
    entryLightIds.push(candidate.light.lightId);
  }

  const resourceKey = cookieAtlasMatrixResourceKey(options.candidates);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === matrixCount &&
    writeBufferData(options.device, cached.buffer, matrices)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrices.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrices,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: entryLightIds[0] ?? -1,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount,
    entryLightIds,
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

function computeSpotCookieMatrix(
  snapshot: RenderSnapshot,
  light: LightPacket,
):
  | { readonly data: Float32Array }
  | {
      readonly diagnostic: LocalLightClusterCookieResourceDiagnostic;
    } {
  if (!hasMatrix(snapshot.transforms, light.worldTransformOffset)) {
    return {
      diagnostic: {
        code: "localLightClusterCookie.missingLightTransform",
        lightId: light.lightId,
        message: `Clustered spot cookie light '${light.lightId}' references missing transform offset ${light.worldTransformOffset}.`,
      },
    };
  }

  const transform = snapshot.transforms.subarray(
    light.worldTransformOffset,
    light.worldTransformOffset + 16,
  );
  const lightPosition = tuple3([
    transform[12] ?? 0,
    transform[13] ?? 0,
    transform[14] ?? 0,
  ]);
  const lightDirection = normalize([
    -(transform[8] ?? 0),
    -(transform[9] ?? 0),
    -(transform[10] ?? 0),
  ]);

  if (lightDirection === null) {
    return {
      diagnostic: {
        code: "localLightClusterCookie.invalidLightDirection",
        lightId: light.lightId,
        message: `Clustered spot cookie light '${light.lightId}' has a zero-length light direction.`,
      },
    };
  }

  const target = tuple3([
    lightPosition[0] + lightDirection[0],
    lightPosition[1] + lightDirection[1],
    lightPosition[2] + lightDirection[2],
  ]);
  const up = tuple3([transform[4] ?? 0, transform[5] ?? 1, transform[6] ?? 0]);
  const viewMatrix = makeLookAt(lightPosition, target, up);
  const projectionMatrix = makePerspective(
    Math.max(light.outerConeAngle * 2, 0.01),
    1,
    Math.max(light.range / 1000, 0.01),
    Math.max(light.range, 0.02),
  );
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);

  return { data: new Float32Array(viewProjectionMatrix) };
}

function cookieMatrixResourceKey(light: LightPacket): string {
  return `local-light-cookie-matrix:v${SPOT_COOKIE_MATRIX_VERSION}:${light.kind}:${light.lightId}`;
}

function cookieMatrixArrayResourceKey(
  candidates: readonly CookieArrayCandidate[],
): string {
  return `local-light-cookie-matrix-array:v${SPOT_COOKIE_MATRIX_VERSION}:${candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.layerBaseIndex}+${candidate.layerCount}`,
    )
    .join(",")}`;
}

function cookieAtlasMatrixResourceKey(
  candidates: readonly CookieAtlasCandidate[],
): string {
  return `local-light-cookie-matrix-atlas:v${SPOT_COOKIE_MATRIX_VERSION}:${candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.matrixBaseIndex}:${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`,
    )
    .join(",")}`;
}

function atlasAdjustedCookieMatrix(
  matrix: Float32Array,
  rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): Float32Array {
  const result = new Float32Array(matrix);
  const xScale = rect.width;
  const xOffset = 2 * rect.x + rect.width - 1;
  const yScale = rect.height;
  const yOffset = 1 - 2 * rect.y - rect.height;

  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    const row0 = matrix[offset] ?? 0;
    const row1 = matrix[offset + 1] ?? 0;
    const row3 = matrix[offset + 3] ?? 0;

    result[offset] = xScale * row0 + xOffset * row3;
    result[offset + 1] = yScale * row1 + yOffset * row3;
  }

  return result;
}

function makeLookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number],
): Mat4Like {
  const zAxis = normalize([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);

  if (zAxis === null) {
    return identityMat4();
  }

  const xAxis =
    normalize(cross(tuple3(up), zAxis)) ??
    normalize(cross(fallbackUpForAxis(zAxis), zAxis)) ??
    tuple3([1, 0, 0]);
  const yAxis = cross(zAxis, xAxis);

  return [
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -dot(xAxis, eye),
    -dot(yAxis, eye),
    -dot(zAxis, eye),
    1,
  ];
}

function fallbackUpForAxis(
  axis: readonly [number, number, number],
): readonly [number, number, number] {
  return Math.abs(axis[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
}

function identityMat4(): Mat4Like {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function hasMatrix(transforms: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

function normalize(
  value: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= EPSILON) {
    return null;
  }

  return tuple3([value[0] / length, value[1] / length, value[2] / length]);
}

function tuple3(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  return [value[0], value[1], value[2]];
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
