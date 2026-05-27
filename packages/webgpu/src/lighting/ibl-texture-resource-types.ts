import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import type { PmremComputeStorageFormat } from "./pmrem-compute-pipeline.js";
import type {
  CreateTextureGpuResourceResult,
  TextureGpuDeviceLike,
  TextureGpuResource,
  TextureGpuResourceDiagnostic,
} from "../resources/textures/texture-resources.js";

export type IblTextureResourceStatus =
  | "available"
  | "missing"
  | "unsupported"
  | "not-required";

export type IblTextureResourceDiagnostic =
  | TextureGpuResourceDiagnostic
  | {
      readonly code:
        | "iblTextureResource.missingTexturePreparation"
        | "iblTextureResource.unsupportedTextureSlots"
        | "iblTextureResource.invalidDiffuseCubeSource"
        | "iblTextureResource.invalidSpecularPmremSource"
        | "iblTextureResource.specularPmremDeviceUnsupported"
        | "iblTextureResource.specularPmremDispatchFailed"
        | "iblTextureResource.specularProofUploadPlaceholder"
        | "iblTextureResource.specularPrefilteringDeferred";
      readonly severity: "warning" | "error";
      readonly message: string;
      readonly resourceKey?: string;
    };

export interface DiffuseIblCubeSource {
  readonly resourceKey?: string;
  readonly sourceResourceKey?: string;
  readonly environmentMapResourceKey?: string;
  readonly label?: string;
  readonly faceSize: number;
  readonly faces: readonly Uint8Array[];
  readonly format?: PmremComputeStorageFormat;
}

export interface SpecularIblPmremSource {
  readonly resourceKey?: string;
  readonly sourceResourceKey?: string;
  readonly environmentMapResourceKey?: string;
  readonly label?: string;
  readonly faceSize: number;
  readonly faces: readonly Uint8Array[];
  readonly format?: PmremComputeStorageFormat;
  readonly mipLevelCount?: number;
}

export interface CreateDiffuseIblTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly size?: number;
  readonly cache?: Map<string, TextureGpuResource>;
  readonly diffuseSources?: readonly DiffuseIblCubeSource[];
}

export interface CreateSpecularIblTextureResourceOptions {
  readonly device: TextureGpuDeviceLike;
  readonly textures: IblTexturePreparationReport;
  readonly size?: number;
  readonly cache?: Map<string, TextureGpuResource>;
  readonly pmremSources?: readonly SpecularIblPmremSource[];
}

export interface DiffuseIblTextureResourceReport {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly diffuseTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly specularPrefiltering: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

export interface SpecularIblTextureResourceReport {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly specularSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly specularTextureResource: boolean;
    readonly gpuAllocation: boolean;
    readonly proofUpload: boolean;
    readonly prefiltering: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly resources: readonly CreateTextureGpuResourceResult[];
  readonly diagnostics: readonly IblTextureResourceDiagnostic[];
}

export interface DiffuseIblTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly diffuseSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: DiffuseIblTextureResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly resourceKey: string;
    readonly descriptor: {
      readonly label?: string;
      readonly size: readonly [number, number, number];
      readonly format: string;
      readonly usage: number;
      readonly mipLevelCount?: number;
    } | null;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
  }[];
}

export interface SpecularIblTextureResourceReportJsonValue {
  readonly ready: boolean;
  readonly status: IblTextureResourceStatus;
  readonly textureSlotCount: number;
  readonly specularSlotCount: number;
  readonly createdTextureCount: number;
  readonly reusedTextureCount: number;
  readonly sections: SpecularIblTextureResourceReport["sections"];
  readonly resources: readonly {
    readonly valid: boolean;
    readonly resourceKey: string;
    readonly descriptor: {
      readonly label?: string;
      readonly size: readonly [number, number, number];
      readonly format: string;
      readonly usage: number;
      readonly mipLevelCount?: number;
    } | null;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
  }[];
}
