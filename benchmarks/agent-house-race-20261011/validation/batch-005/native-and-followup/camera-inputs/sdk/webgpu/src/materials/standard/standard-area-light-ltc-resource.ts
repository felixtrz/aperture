import { createSamplerAsset } from "@aperture-engine/render";

import {
  STANDARD_AREA_LIGHT_LTC_BYTES_PER_TEXEL,
  STANDARD_AREA_LIGHT_LTC_SIZE,
  STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
  createStandardAreaLightLtcFresnelData,
  createStandardAreaLightLtcMatrixData,
} from "./standard-area-light-ltc-data.js";
import {
  WEBGPU_TEXTURE_USAGE_FLAGS,
  createSamplerGpuResource,
  createTextureGpuResource,
  type SamplerGpuResource,
  type TextureGpuDeviceLike,
  type TextureGpuResource,
  type TextureGpuResourceDiagnostic,
} from "../../resources/textures/texture-resources.js";

export const STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING = 11;
export const STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING = 12;
export const STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING = 13;

export const STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY =
  "standard-area-light-ltc:matrix";
export const STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY =
  "standard-area-light-ltc:fresnel";
export const STANDARD_AREA_LIGHT_LTC_SAMPLER_RESOURCE_KEY =
  "standard-area-light-ltc:sampler";

export interface StandardAreaLightLtcResources {
  readonly matrixTexture: TextureGpuResource;
  readonly fresnelTexture: TextureGpuResource;
  readonly sampler: SamplerGpuResource;
}

export interface CreateStandardAreaLightLtcResourcesOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textureCache?: Map<string, TextureGpuResource>;
  readonly samplerCache?: Map<string, SamplerGpuResource>;
}

export interface CreateStandardAreaLightLtcResourcesResult {
  readonly valid: boolean;
  readonly resources: StandardAreaLightLtcResources | null;
  readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly createdSamplerCount: number;
  readonly reusedSamplerCount: number;
}

export function createStandardAreaLightLtcResources(
  options: CreateStandardAreaLightLtcResourcesOptions,
): CreateStandardAreaLightLtcResourcesResult {
  const matrix = createOrReuseLtcTexture(
    options,
    STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY,
    createStandardAreaLightLtcMatrixData(),
  );
  const fresnel = createOrReuseLtcTexture(
    options,
    STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY,
    createStandardAreaLightLtcFresnelData(),
  );
  const sampler = createOrReuseLtcSampler(options);
  const diagnostics = [
    ...matrix.diagnostics,
    ...fresnel.diagnostics,
    ...sampler.diagnostics,
  ];
  const resources =
    matrix.resource === null ||
    fresnel.resource === null ||
    sampler.resource === null
      ? null
      : {
          matrixTexture: matrix.resource,
          fresnelTexture: fresnel.resource,
          sampler: sampler.resource,
        };

  return {
    valid: resources !== null && diagnostics.length === 0,
    resources,
    diagnostics,
    createdTextureCount:
      (matrix.reused ? 0 : matrix.resource === null ? 0 : 1) +
      (fresnel.reused ? 0 : fresnel.resource === null ? 0 : 1),
    reusedTextureCount: (matrix.reused ? 1 : 0) + (fresnel.reused ? 1 : 0),
    createdSamplerCount: sampler.reused ? 0 : sampler.resource === null ? 0 : 1,
    reusedSamplerCount: sampler.reused ? 1 : 0,
  };
}

function createOrReuseLtcTexture(
  options: CreateStandardAreaLightLtcResourcesOptions,
  resourceKey: string,
  data: Uint8Array,
): {
  readonly resource: TextureGpuResource | null;
  readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
  readonly reused: boolean;
} {
  const cached = options.textureCache?.get(resourceKey);

  if (cached !== undefined) {
    return { resource: cached, diagnostics: [], reused: true };
  }

  const result = createTextureGpuResource({
    device: options.device,
    resourceKey,
    descriptor: {
      label: resourceKey,
      size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
      format: STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
      colorSpace: "linear",
      semantic: "data",
    },
    upload: {
      data,
      bytesPerRow:
        STANDARD_AREA_LIGHT_LTC_SIZE * STANDARD_AREA_LIGHT_LTC_BYTES_PER_TEXEL,
      rowsPerImage: STANDARD_AREA_LIGHT_LTC_SIZE,
    },
  });

  if (result.valid && result.resource !== null) {
    options.textureCache?.set(resourceKey, result.resource);
  }

  return {
    resource: result.resource,
    diagnostics: result.diagnostics,
    reused: false,
  };
}

function createOrReuseLtcSampler(
  options: CreateStandardAreaLightLtcResourcesOptions,
): {
  readonly resource: SamplerGpuResource | null;
  readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
  readonly reused: boolean;
} {
  const cached = options.samplerCache?.get(
    STANDARD_AREA_LIGHT_LTC_SAMPLER_RESOURCE_KEY,
  );

  if (cached !== undefined) {
    return { resource: cached, diagnostics: [], reused: true };
  }

  const result = createSamplerGpuResource({
    device: options.device,
    resourceKey: STANDARD_AREA_LIGHT_LTC_SAMPLER_RESOURCE_KEY,
    sampler: createSamplerAsset({
      label: "Standard area light LTC sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  if (result.valid && result.resource !== null) {
    options.samplerCache?.set(
      STANDARD_AREA_LIGHT_LTC_SAMPLER_RESOURCE_KEY,
      result.resource,
    );
  }

  return {
    resource: result.resource,
    diagnostics: result.diagnostics,
    reused: false,
  };
}
