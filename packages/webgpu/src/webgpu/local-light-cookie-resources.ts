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
  type SamplerGpuResource,
  type TextureGpuResource,
} from "./texture-resources.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";

const DEFAULT_COOKIE_SAMPLER_CACHE_KEY = "local-light-cookie:default-sampler@1";
const DEFAULT_COOKIE_SAMPLER_RESOURCE_KEY =
  "local-light-cookie:default-sampler";
const SPOT_COOKIE_MATRIX_VERSION = 1;
const EPSILON = 1e-6;

export type LocalLightClusterCookieTextureViewDimension = "2d" | "cube";

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
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly supportedResources: readonly LocalLightClusterSupportedCookieResource[];
}

export type LocalLightClusterCookieResourceDiagnostic =
  | WebGpuAppTextureSamplerPreparationDiagnostic
  | {
      readonly code:
        | "localLightClusterCookie.textureNot2d"
        | "localLightClusterCookie.textureNotCube";
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
