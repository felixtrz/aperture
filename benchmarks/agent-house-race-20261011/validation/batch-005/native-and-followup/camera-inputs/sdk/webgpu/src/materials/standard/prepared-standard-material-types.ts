import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type { StandardMaterialAsset } from "@aperture-engine/render";
import type {
  StandardMaterialBindGroupDescriptorDiagnostic,
  StandardMaterialBindGroupLayoutResource,
  StandardMaterialBindGroupResource,
  StandardMaterialBindGroupResourceDiagnostic,
} from "./standard-bind-group.js";
import type {
  StandardMaterialGpuBufferDiagnostic,
  StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
import type {
  StandardMaterialBufferDescriptorDiagnostic,
  StandardMaterialPackingDiagnostic,
} from "./standard-material-buffer.js";
import type { StandardFrameGpuResourceDeviceLike } from "./standard-frame-resources.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../../resources/textures/texture-resources.js";
import type { PreparedStandardTextureDependencyDiagnostic } from "./prepared-standard-material-dependencies.js";

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
