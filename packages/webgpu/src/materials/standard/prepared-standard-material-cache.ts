import {
  assetHandleKey,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import type { StandardMaterialAsset } from "@aperture-engine/render";
import {
  createStandardMaterialBindGroupDescriptorPlan,
  createStandardMaterialBindGroupResource,
  type StandardMaterialBindGroupDescriptorDiagnostic,
  type StandardMaterialBindGroupLayoutResource,
  type StandardMaterialBindGroupResource,
  type StandardMaterialBindGroupResourceDiagnostic,
} from "./standard-bind-group.js";
import {
  createStandardMaterialGpuBuffer,
  type StandardMaterialGpuBufferDiagnostic,
  type StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
import {
  createStandardMaterialPreparationPlan,
  type StandardMaterialBufferDescriptorDiagnostic,
  type StandardMaterialPackingDiagnostic,
} from "./standard-material-buffer.js";
import type { StandardFrameGpuResourceDeviceLike } from "./standard-frame-resources.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../../resources/textures/texture-resources.js";
import {
  createPreparedStandardBaseColorTextureDependencyKeys,
  createPreparedStandardClearcoatRoughnessTextureDependencyKeys,
  createPreparedStandardClearcoatTextureDependencyKeys,
  createPreparedStandardIridescenceTextureDependencyKeys,
  createPreparedStandardIridescenceThicknessTextureDependencyKeys,
  createPreparedStandardMetallicRoughnessTextureDependencyKeys,
  createPreparedStandardNormalTextureDependencyKeys,
  createPreparedStandardSheenColorTextureDependencyKeys,
  createPreparedStandardSheenRoughnessTextureDependencyKeys,
  createPreparedStandardTextureBindingDependencyKeys,
  createPreparedStandardTextureDependencyKeys,
  createPreparedStandardTransmissionTextureDependencyKeys,
  standardTextureBinding,
  type CreatePreparedStandardBaseColorTextureDependencyKeysOptions,
  type CreatePreparedStandardBaseColorTextureDependencyKeysResult,
  type CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions,
  type CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult,
  type CreatePreparedStandardClearcoatTextureDependencyKeysOptions,
  type CreatePreparedStandardClearcoatTextureDependencyKeysResult,
  type CreatePreparedStandardIridescenceTextureDependencyKeysOptions,
  type CreatePreparedStandardIridescenceTextureDependencyKeysResult,
  type CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions,
  type CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult,
  type CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions,
  type CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult,
  type CreatePreparedStandardNormalTextureDependencyKeysOptions,
  type CreatePreparedStandardNormalTextureDependencyKeysResult,
  type CreatePreparedStandardSheenColorTextureDependencyKeysOptions,
  type CreatePreparedStandardSheenColorTextureDependencyKeysResult,
  type CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions,
  type CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult,
  type CreatePreparedStandardTextureDependencyKeysOptions,
  type CreatePreparedStandardTextureDependencyKeysResult,
  type CreatePreparedStandardTransmissionTextureDependencyKeysOptions,
  type CreatePreparedStandardTransmissionTextureDependencyKeysResult,
  type PreparedStandardTextureBindingDependencyKeys,
  type PreparedStandardTextureDependencyDiagnostic,
  type PreparedStandardTextureDependencyKeys,
  type PreparedStandardTextureDependencyVersionKey,
  type StandardTextureDependencyField,
} from "./prepared-standard-material-dependencies.js";

export {
  createPreparedStandardBaseColorTextureDependencyKeys,
  createPreparedStandardClearcoatRoughnessTextureDependencyKeys,
  createPreparedStandardClearcoatTextureDependencyKeys,
  createPreparedStandardIridescenceTextureDependencyKeys,
  createPreparedStandardIridescenceThicknessTextureDependencyKeys,
  createPreparedStandardMetallicRoughnessTextureDependencyKeys,
  createPreparedStandardNormalTextureDependencyKeys,
  createPreparedStandardSheenColorTextureDependencyKeys,
  createPreparedStandardSheenRoughnessTextureDependencyKeys,
  createPreparedStandardTextureDependencyKeys,
  createPreparedStandardTransmissionTextureDependencyKeys,
};
export type {
  CreatePreparedStandardBaseColorTextureDependencyKeysOptions,
  CreatePreparedStandardBaseColorTextureDependencyKeysResult,
  CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions,
  CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult,
  CreatePreparedStandardClearcoatTextureDependencyKeysOptions,
  CreatePreparedStandardClearcoatTextureDependencyKeysResult,
  CreatePreparedStandardIridescenceTextureDependencyKeysOptions,
  CreatePreparedStandardIridescenceTextureDependencyKeysResult,
  CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions,
  CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult,
  CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions,
  CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult,
  CreatePreparedStandardNormalTextureDependencyKeysOptions,
  CreatePreparedStandardNormalTextureDependencyKeysResult,
  CreatePreparedStandardSheenColorTextureDependencyKeysOptions,
  CreatePreparedStandardSheenColorTextureDependencyKeysResult,
  CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions,
  CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult,
  CreatePreparedStandardTextureDependencyKeysOptions,
  CreatePreparedStandardTextureDependencyKeysResult,
  CreatePreparedStandardTransmissionTextureDependencyKeysOptions,
  CreatePreparedStandardTransmissionTextureDependencyKeysResult,
  PreparedStandardTextureBindingDependencyKeys,
  PreparedStandardTextureDependencyDiagnostic,
  PreparedStandardTextureDependencyKeys,
  PreparedStandardTextureDependencyVersionKey,
  StandardTextureDependencyField,
};

export type PreparedScalarStandardMaterialCacheStatus =
  | "created"
  | "reused"
  | "skipped"
  | "failed";

export interface PreparedScalarStandardMaterialResource {
  readonly cacheKey: string;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  lastUsedFrame: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: StandardMaterialGpuBufferResource;
  readonly bindGroup: StandardMaterialBindGroupResource;
}

export interface PreparedBaseColorTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedMetallicRoughnessTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedNormalTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedClearcoatTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedClearcoatRoughnessTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedTransmissionTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedSheenColorTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedSheenRoughnessTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedIridescenceTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedIridescenceThicknessTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedOcclusionEmissiveTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKeys: readonly string[];
  readonly samplerResourceKeys: readonly string[];
}

export interface PreparedScalarStandardMaterialCache {
  readonly resources: Map<string, PreparedScalarStandardMaterialResource>;
}

export type PreparedScalarStandardMaterialDiagnostic =
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedScalarStandardMaterial.notScalar"
        | "preparedScalarStandardMaterial.missingLayout"
        | "preparedScalarStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedBaseColorTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured"
        | "preparedBaseColorTexturedStandardMaterial.missingLayout"
        | "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedMetallicRoughnessTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured"
        | "preparedMetallicRoughnessTexturedStandardMaterial.missingLayout"
        | "preparedMetallicRoughnessTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedNormalTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedNormalTexturedStandardMaterial.notNormalTextured"
        | "preparedNormalTexturedStandardMaterial.missingLayout"
        | "preparedNormalTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedClearcoatTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedClearcoatTexturedStandardMaterial.notClearcoatTextured"
        | "preparedClearcoatTexturedStandardMaterial.missingLayout"
        | "preparedClearcoatTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedClearcoatRoughnessTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedClearcoatRoughnessTexturedStandardMaterial.notClearcoatRoughnessTextured"
        | "preparedClearcoatRoughnessTexturedStandardMaterial.missingLayout"
        | "preparedClearcoatRoughnessTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedTransmissionTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedTransmissionTexturedStandardMaterial.notTransmissionTextured"
        | "preparedTransmissionTexturedStandardMaterial.missingLayout"
        | "preparedTransmissionTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedSheenColorTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedSheenColorTexturedStandardMaterial.notSheenColorTextured"
        | "preparedSheenColorTexturedStandardMaterial.missingLayout"
        | "preparedSheenColorTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedSheenRoughnessTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedSheenRoughnessTexturedStandardMaterial.notSheenRoughnessTextured"
        | "preparedSheenRoughnessTexturedStandardMaterial.missingLayout"
        | "preparedSheenRoughnessTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedIridescenceTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedIridescenceTexturedStandardMaterial.notIridescenceTextured"
        | "preparedIridescenceTexturedStandardMaterial.missingLayout"
        | "preparedIridescenceTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedIridescenceThicknessTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedIridescenceThicknessTexturedStandardMaterial.notIridescenceThicknessTextured"
        | "preparedIridescenceThicknessTexturedStandardMaterial.missingLayout"
        | "preparedIridescenceThicknessTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedOcclusionEmissiveTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured"
        | "preparedOcclusionEmissiveTexturedStandardMaterial.missingLayout"
        | "preparedOcclusionEmissiveTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export interface PrepareScalarStandardMaterialResourceOptions {
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
}

export interface PrepareScalarStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedScalarStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedScalarStandardMaterialDiagnostic[];
}

export interface PrepareBaseColorTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareBaseColorTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedBaseColorTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedBaseColorTexturedStandardMaterialDiagnostic[];
}

export interface PrepareMetallicRoughnessTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareMetallicRoughnessTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedMetallicRoughnessTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedMetallicRoughnessTexturedStandardMaterialDiagnostic[];
}

export interface PrepareNormalTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareNormalTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedNormalTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedNormalTexturedStandardMaterialDiagnostic[];
}

export interface PrepareClearcoatTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareClearcoatTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedClearcoatTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedClearcoatTexturedStandardMaterialDiagnostic[];
}

export interface PrepareClearcoatRoughnessTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareClearcoatRoughnessTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedClearcoatRoughnessTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedClearcoatRoughnessTexturedStandardMaterialDiagnostic[];
}

export interface PrepareTransmissionTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareTransmissionTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedTransmissionTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedTransmissionTexturedStandardMaterialDiagnostic[];
}

export interface PrepareSheenColorTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareSheenColorTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedSheenColorTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedSheenColorTexturedStandardMaterialDiagnostic[];
}

export interface PrepareSheenRoughnessTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareSheenRoughnessTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedSheenRoughnessTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedSheenRoughnessTexturedStandardMaterialDiagnostic[];
}

export interface PrepareIridescenceTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareIridescenceTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedIridescenceTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedIridescenceTexturedStandardMaterialDiagnostic[];
}

export interface PrepareIridescenceThicknessTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareIridescenceThicknessTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedIridescenceThicknessTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedIridescenceThicknessTexturedStandardMaterialDiagnostic[];
}

export interface PrepareOcclusionEmissiveTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareOcclusionEmissiveTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedOcclusionEmissiveTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedOcclusionEmissiveTexturedStandardMaterialDiagnostic[];
}

export function createPreparedScalarStandardMaterialCache(): PreparedScalarStandardMaterialCache {
  return { resources: new Map() };
}

export function prepareScalarStandardMaterialResource(
  options: PrepareScalarStandardMaterialResourceOptions,
): PrepareScalarStandardMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (!isScalarStandardMaterial(options.material)) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: "preparedScalarStandardMaterial.notScalar",
          materialKey: sourceMaterialKey,
          message:
            "Scalar StandardMaterial prepared caching does not handle textured StandardMaterial variants.",
        },
      ],
    };
  }

  if (options.layout === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "preparedScalarStandardMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "Scalar StandardMaterial prepared caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const cacheKey = preparedScalarStandardMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
  });
  const cached = options.cache.resources.get(cacheKey);

  if (cached !== undefined) {
    cached.lastUsedFrame = options.frame ?? 0;

    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const preparation = createStandardMaterialPreparationPlan(options.material, {
    label: `prepared-material:${sourceMaterialKey}`,
  });
  const material = createStandardMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });
  const bindGroupPlan = createStandardMaterialBindGroupDescriptorPlan({
    materialResourceKey: material.resource?.resourceKey ?? null,
    dependencies:
      preparation.plan?.materialBuffer.dependencies ??
      emptyStandardMaterialDependencies(),
  });
  const bindGroup = createStandardMaterialBindGroupResource({
    device: options.device,
    plan: bindGroupPlan,
    layout: options.layout,
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
  });
  const diagnostics: PreparedScalarStandardMaterialDiagnostic[] = [
    ...preparation.diagnostics,
    ...material.diagnostics,
    ...bindGroup.diagnostics,
  ];

  if (
    diagnostics.length > 0 ||
    !preparation.valid ||
    preparation.plan === null ||
    !material.valid ||
    material.resource === null ||
    !bindGroup.valid ||
    bindGroup.resource === null
  ) {
    if (bindGroup.resource === null && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedScalarStandardMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "Scalar StandardMaterial prepared caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedScalarStandardMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    lastUsedFrame: options.frame ?? 0,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    materialResourceKey: material.resource.resourceKey,
    bindGroupResourceKey: bindGroup.resource.resourceKey,
    material: material.resource,
    bindGroup: bindGroup.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function prepareBaseColorTexturedStandardMaterialResource(
  options: PrepareBaseColorTexturedStandardMaterialResourceOptions,
): PrepareBaseColorTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "baseColorTexture",
    acceptsMaterial: isBaseColorOnlyStandardMaterial,
    notTexturedCode:
      "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured",
    missingLayoutCode:
      "preparedBaseColorTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Base-color textured StandardMaterial prepared caching requires exactly a base-color texture binding.",
    missingLayoutMessage:
      "Base-color textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Base-color textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    diagnostics:
      result.diagnostics as readonly PreparedBaseColorTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareMetallicRoughnessTexturedStandardMaterialResource(
  options: PrepareMetallicRoughnessTexturedStandardMaterialResourceOptions,
): PrepareMetallicRoughnessTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "metallicRoughnessTexture",
    acceptsMaterial: isMetallicRoughnessOnlyStandardMaterial,
    notTexturedCode:
      "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured",
    missingLayoutCode:
      "preparedMetallicRoughnessTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedMetallicRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Metallic-roughness textured StandardMaterial prepared caching requires exactly a metallic-roughness texture binding.",
    missingLayoutMessage:
      "Metallic-roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Metallic-roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    diagnostics:
      result.diagnostics as readonly PreparedMetallicRoughnessTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareNormalTexturedStandardMaterialResource(
  options: PrepareNormalTexturedStandardMaterialResourceOptions,
): PrepareNormalTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "normalTexture",
    acceptsMaterial: isNormalOnlyStandardMaterial,
    notTexturedCode: "preparedNormalTexturedStandardMaterial.notNormalTextured",
    missingLayoutCode: "preparedNormalTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedNormalTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Normal textured StandardMaterial prepared caching requires exactly a normal texture binding.",
    missingLayoutMessage:
      "Normal textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Normal textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    diagnostics:
      result.diagnostics as readonly PreparedNormalTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareClearcoatTexturedStandardMaterialResource(
  options: PrepareClearcoatTexturedStandardMaterialResourceOptions,
): PrepareClearcoatTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "clearcoatTexture",
    acceptsMaterial: isClearcoatOnlyStandardMaterial,
    notTexturedCode:
      "preparedClearcoatTexturedStandardMaterial.notClearcoatTextured",
    missingLayoutCode:
      "preparedClearcoatTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedClearcoatTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Clearcoat textured StandardMaterial prepared caching requires exactly a clearcoat texture binding.",
    missingLayoutMessage:
      "Clearcoat textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Clearcoat textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedClearcoatTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedClearcoatTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareClearcoatRoughnessTexturedStandardMaterialResource(
  options: PrepareClearcoatRoughnessTexturedStandardMaterialResourceOptions,
): PrepareClearcoatRoughnessTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "clearcoatRoughnessTexture",
    acceptsMaterial: isClearcoatRoughnessOnlyStandardMaterial,
    notTexturedCode:
      "preparedClearcoatRoughnessTexturedStandardMaterial.notClearcoatRoughnessTextured",
    missingLayoutCode:
      "preparedClearcoatRoughnessTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedClearcoatRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Clearcoat roughness textured StandardMaterial prepared caching requires exactly a clearcoat roughness texture binding.",
    missingLayoutMessage:
      "Clearcoat roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Clearcoat roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedClearcoatRoughnessTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedClearcoatRoughnessTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareTransmissionTexturedStandardMaterialResource(
  options: PrepareTransmissionTexturedStandardMaterialResourceOptions,
): PrepareTransmissionTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "transmissionTexture",
    acceptsMaterial: isTransmissionOnlyStandardMaterial,
    notTexturedCode:
      "preparedTransmissionTexturedStandardMaterial.notTransmissionTextured",
    missingLayoutCode:
      "preparedTransmissionTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedTransmissionTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Transmission textured StandardMaterial prepared caching requires exactly a transmission texture binding.",
    missingLayoutMessage:
      "Transmission textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Transmission textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedTransmissionTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedTransmissionTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareSheenColorTexturedStandardMaterialResource(
  options: PrepareSheenColorTexturedStandardMaterialResourceOptions,
): PrepareSheenColorTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "sheenColorTexture",
    acceptsMaterial: isSheenColorOnlyStandardMaterial,
    notTexturedCode:
      "preparedSheenColorTexturedStandardMaterial.notSheenColorTextured",
    missingLayoutCode:
      "preparedSheenColorTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedSheenColorTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Sheen color textured StandardMaterial prepared caching requires exactly a sheen color texture binding.",
    missingLayoutMessage:
      "Sheen color textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Sheen color textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedSheenColorTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedSheenColorTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareSheenRoughnessTexturedStandardMaterialResource(
  options: PrepareSheenRoughnessTexturedStandardMaterialResourceOptions,
): PrepareSheenRoughnessTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "sheenRoughnessTexture",
    acceptsMaterial: isSheenRoughnessOnlyStandardMaterial,
    notTexturedCode:
      "preparedSheenRoughnessTexturedStandardMaterial.notSheenRoughnessTextured",
    missingLayoutCode:
      "preparedSheenRoughnessTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedSheenRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Sheen roughness textured StandardMaterial prepared caching requires exactly a sheen roughness texture binding.",
    missingLayoutMessage:
      "Sheen roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Sheen roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedSheenRoughnessTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedSheenRoughnessTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareIridescenceTexturedStandardMaterialResource(
  options: PrepareIridescenceTexturedStandardMaterialResourceOptions,
): PrepareIridescenceTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "iridescenceTexture",
    acceptsMaterial: isIridescenceOnlyStandardMaterial,
    notTexturedCode:
      "preparedIridescenceTexturedStandardMaterial.notIridescenceTextured",
    missingLayoutCode:
      "preparedIridescenceTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedIridescenceTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Iridescence textured StandardMaterial prepared caching requires exactly an iridescence texture binding.",
    missingLayoutMessage:
      "Iridescence textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Iridescence textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedIridescenceTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedIridescenceTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareIridescenceThicknessTexturedStandardMaterialResource(
  options: PrepareIridescenceThicknessTexturedStandardMaterialResourceOptions,
): PrepareIridescenceThicknessTexturedStandardMaterialResourceResult {
  const result = prepareSingleTexturedStandardMaterialResource(options, {
    field: "iridescenceThicknessTexture",
    acceptsMaterial: isIridescenceThicknessOnlyStandardMaterial,
    notTexturedCode:
      "preparedIridescenceThicknessTexturedStandardMaterial.notIridescenceThicknessTextured",
    missingLayoutCode:
      "preparedIridescenceThicknessTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedIridescenceThicknessTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Iridescence thickness textured StandardMaterial prepared caching requires exactly an iridescence thickness texture binding.",
    missingLayoutMessage:
      "Iridescence thickness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Iridescence thickness textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedIridescenceThicknessTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedIridescenceThicknessTexturedStandardMaterialDiagnostic[],
  };
}

export function prepareOcclusionEmissiveTexturedStandardMaterialResource(
  options: PrepareOcclusionEmissiveTexturedStandardMaterialResourceOptions,
): PrepareOcclusionEmissiveTexturedStandardMaterialResourceResult {
  const result = prepareTextureSetTexturedStandardMaterialResource(options, {
    acceptsMaterial: isOcclusionEmissiveOnlyStandardMaterial,
    createDependencies: createPreparedStandardTextureDependencyKeys,
    notTexturedCode:
      "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured",
    missingLayoutCode:
      "preparedOcclusionEmissiveTexturedStandardMaterial.missingLayout",
    missingPreparedBindGroupCode:
      "preparedOcclusionEmissiveTexturedStandardMaterial.missingPreparedBindGroup",
    notTexturedMessage:
      "Occlusion/emissive textured StandardMaterial prepared caching requires occlusion and/or emissive texture bindings with no other texture families.",
    missingLayoutMessage:
      "Occlusion/emissive textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
    missingPreparedBindGroupMessage:
      "Occlusion/emissive textured StandardMaterial prepared caching did not create a group-2 bind group.",
  });

  return {
    ...result,
    resource:
      result.resource as PreparedOcclusionEmissiveTexturedStandardMaterialResource | null,
    diagnostics:
      result.diagnostics as readonly PreparedOcclusionEmissiveTexturedStandardMaterialDiagnostic[],
  };
}

interface PreparedSingleTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

type PreparedSingleTexturedStandardMaterialCustomCode =
  | "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured"
  | "preparedBaseColorTexturedStandardMaterial.missingLayout"
  | "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured"
  | "preparedMetallicRoughnessTexturedStandardMaterial.missingLayout"
  | "preparedMetallicRoughnessTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedNormalTexturedStandardMaterial.notNormalTextured"
  | "preparedNormalTexturedStandardMaterial.missingLayout"
  | "preparedNormalTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedClearcoatTexturedStandardMaterial.notClearcoatTextured"
  | "preparedClearcoatTexturedStandardMaterial.missingLayout"
  | "preparedClearcoatTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedClearcoatRoughnessTexturedStandardMaterial.notClearcoatRoughnessTextured"
  | "preparedClearcoatRoughnessTexturedStandardMaterial.missingLayout"
  | "preparedClearcoatRoughnessTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedTransmissionTexturedStandardMaterial.notTransmissionTextured"
  | "preparedTransmissionTexturedStandardMaterial.missingLayout"
  | "preparedTransmissionTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedSheenColorTexturedStandardMaterial.notSheenColorTextured"
  | "preparedSheenColorTexturedStandardMaterial.missingLayout"
  | "preparedSheenColorTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedSheenRoughnessTexturedStandardMaterial.notSheenRoughnessTextured"
  | "preparedSheenRoughnessTexturedStandardMaterial.missingLayout"
  | "preparedSheenRoughnessTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedIridescenceTexturedStandardMaterial.notIridescenceTextured"
  | "preparedIridescenceTexturedStandardMaterial.missingLayout"
  | "preparedIridescenceTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedIridescenceThicknessTexturedStandardMaterial.notIridescenceThicknessTextured"
  | "preparedIridescenceThicknessTexturedStandardMaterial.missingLayout"
  | "preparedIridescenceThicknessTexturedStandardMaterial.missingPreparedBindGroup"
  | "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured"
  | "preparedOcclusionEmissiveTexturedStandardMaterial.missingLayout"
  | "preparedOcclusionEmissiveTexturedStandardMaterial.missingPreparedBindGroup";

type PreparedSingleTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code: PreparedSingleTexturedStandardMaterialCustomCode;
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

interface PrepareSingleTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

interface PrepareSingleTexturedStandardMaterialResourceConfig {
  readonly field: StandardTextureDependencyField;
  readonly acceptsMaterial: (material: StandardMaterialAsset) => boolean;
  readonly notTexturedCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly missingLayoutCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly missingPreparedBindGroupCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly notTexturedMessage: string;
  readonly missingLayoutMessage: string;
  readonly missingPreparedBindGroupMessage: string;
}

interface PrepareSingleTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedSingleTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedSingleTexturedStandardMaterialDiagnostic[];
}

function prepareSingleTexturedStandardMaterialResource(
  options: PrepareSingleTexturedStandardMaterialResourceOptions,
  config: PrepareSingleTexturedStandardMaterialResourceConfig,
): PrepareSingleTexturedStandardMaterialResourceResult {
  const result = prepareTextureSetTexturedStandardMaterialResource(options, {
    ...config,
    includeSingularResourceKeys: true,
    createDependencies: ({ registry, material }) => {
      const binding = standardTextureBinding(material, config.field);

      if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
      }

      const single = createPreparedStandardTextureBindingDependencyKeys({
        registry,
        field: config.field,
        binding,
      });

      return single.dependencies === null
        ? {
            valid: single.valid,
            dependencies: null,
            diagnostics: single.diagnostics,
          }
        : {
            valid: single.valid,
            dependencies: {
              bindings: [single.dependencies],
              cacheKeySegments: single.dependencies.cacheKeySegments,
            },
            diagnostics: single.diagnostics,
          };
    },
  });

  return {
    ...result,
    resource:
      result.resource as PreparedSingleTexturedStandardMaterialResource | null,
  };
}

interface PreparedTextureSetTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKeys: readonly string[];
  readonly samplerResourceKeys: readonly string[];
  readonly textureResourceKey?: string;
  readonly samplerResourceKey?: string;
}

interface PrepareTextureSetTexturedStandardMaterialResourceConfig {
  readonly acceptsMaterial: (material: StandardMaterialAsset) => boolean;
  readonly createDependencies: (
    options: CreatePreparedStandardTextureDependencyKeysOptions,
  ) => CreatePreparedStandardTextureDependencyKeysResult;
  readonly notTexturedCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly missingLayoutCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly missingPreparedBindGroupCode: PreparedSingleTexturedStandardMaterialCustomCode;
  readonly notTexturedMessage: string;
  readonly missingLayoutMessage: string;
  readonly missingPreparedBindGroupMessage: string;
  readonly includeSingularResourceKeys?: boolean;
}

interface PrepareTextureSetTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedTextureSetTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedSingleTexturedStandardMaterialDiagnostic[];
}

function prepareTextureSetTexturedStandardMaterialResource(
  options: PrepareSingleTexturedStandardMaterialResourceOptions,
  config: PrepareTextureSetTexturedStandardMaterialResourceConfig,
): PrepareTextureSetTexturedStandardMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (!config.acceptsMaterial(options.material)) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: config.notTexturedCode,
          materialKey: sourceMaterialKey,
          message: config.notTexturedMessage,
        },
      ],
    };
  }

  if (options.layout === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: config.missingLayoutCode,
          materialKey: sourceMaterialKey,
          message: config.missingLayoutMessage,
        },
      ],
    };
  }

  const dependencyResult = config.createDependencies({
    registry: options.registry,
    material: options.material,
  });

  if (!dependencyResult.valid || dependencyResult.dependencies === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: dependencyResult.diagnostics,
    };
  }

  const cacheKey = preparedTexturedStandardMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
  });
  const cached = options.cache.resources.get(cacheKey) as
    | PreparedTextureSetTexturedStandardMaterialResource
    | undefined;

  if (cached !== undefined) {
    cached.lastUsedFrame = options.frame ?? 0;

    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const preparation = createStandardMaterialPreparationPlan(options.material, {
    label: `prepared-material:${sourceMaterialKey}`,
  });
  const material = createStandardMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });
  const bindGroupPlan = createStandardMaterialBindGroupDescriptorPlan({
    materialResourceKey: material.resource?.resourceKey ?? null,
    dependencies:
      preparation.plan?.materialBuffer.dependencies ??
      emptyStandardMaterialDependencies(),
  });
  const bindGroup = createStandardMaterialBindGroupResource({
    device: options.device,
    plan: bindGroupPlan,
    layout: options.layout,
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
    textures: options.textures,
    samplers: options.samplers,
  });
  const diagnostics: PreparedSingleTexturedStandardMaterialDiagnostic[] = [
    ...preparation.diagnostics,
    ...material.diagnostics,
    ...bindGroupPlan.diagnostics,
    ...bindGroup.diagnostics,
  ];

  if (
    diagnostics.length > 0 ||
    !preparation.valid ||
    preparation.plan === null ||
    !material.valid ||
    material.resource === null ||
    !bindGroup.valid ||
    bindGroup.resource === null
  ) {
    if (bindGroup.resource === null && diagnostics.length === 0) {
      diagnostics.push({
        code: config.missingPreparedBindGroupCode,
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message: config.missingPreparedBindGroupMessage,
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const textureResourceKeys = dependencyResult.dependencies.bindings.map(
    (binding) => binding.texture.handleKey,
  );
  const samplerResourceKeys = dependencyResult.dependencies.bindings.map(
    (binding) => binding.sampler.handleKey,
  );
  const resource: PreparedTextureSetTexturedStandardMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    lastUsedFrame: options.frame ?? 0,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
    textureResourceKeys,
    samplerResourceKeys,
    ...(config.includeSingularResourceKeys
      ? {
          textureResourceKey: textureResourceKeys[0] ?? "missing",
          samplerResourceKey: samplerResourceKeys[0] ?? "missing",
        }
      : {}),
    materialResourceKey: material.resource.resourceKey,
    bindGroupResourceKey: bindGroup.resource.resourceKey,
    material: material.resource,
    bindGroup: bindGroup.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function preparedScalarStandardMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
  ].join("|");
}

export function preparedTexturedStandardMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly dependencyCacheKeySegments: readonly string[];
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
    ...input.dependencyCacheKeySegments,
  ].join("|");
}

function isScalarStandardMaterial(material: StandardMaterialAsset): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isBaseColorOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture !== null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isMetallicRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture !== null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isNormalOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture !== null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isOcclusionEmissiveOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    (material.occlusionTexture !== null || material.emissiveTexture !== null)
  );
}

function isClearcoatOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture !== null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isClearcoatRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture !== null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isTransmissionOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture !== null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isSheenColorOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture !== null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isSheenRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture !== null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isIridescenceOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture !== null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isIridescenceThicknessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture !== null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function emptyStandardMaterialDependencies(): Parameters<
  typeof createStandardMaterialBindGroupDescriptorPlan
>[0]["dependencies"] {
  const empty = { textureKey: null, samplerKey: null, texCoord: 0 };

  return {
    baseColor: empty,
    metallicRoughness: empty,
    clearcoat: empty,
    clearcoatRoughness: empty,
    transmission: empty,
    sheenColor: empty,
    sheenRoughness: empty,
    iridescence: empty,
    iridescenceThickness: empty,
    normal: empty,
    occlusion: empty,
    emissive: empty,
  };
}
