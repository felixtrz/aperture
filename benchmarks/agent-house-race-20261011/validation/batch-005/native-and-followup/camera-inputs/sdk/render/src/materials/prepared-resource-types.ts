import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type {
  MaterialAssetDependencyReadinessDiagnostic,
  MaterialAssetDependencyReadinessReportJsonValue,
} from "./dependency-readiness.js";
import type { MaterialKind, MaterialPipelineKeyInput } from "./types.js";

export type PreparedMaterialResourceDiagnostic =
  | MaterialAssetDependencyReadinessDiagnostic
  | {
      readonly code:
        | "preparedMaterialResource.missingMaterial"
        | "preparedMaterialResource.materialNotReady"
        | "preparedMaterialResource.unsupportedMaterialKind"
        | "preparedMaterialResource.invalidMaterial";
      readonly message: string;
      readonly materialKey: string;
      readonly expectedMaterialFamily?: MaterialKind;
      readonly actualMaterialFamily?: MaterialKind;
      readonly field?: string;
    };

export interface PreparedMaterialTextureBindingResource {
  readonly field: string;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly texCoord?: number;
}

export interface PreparedMaterialResourceDescriptor {
  readonly resourceFamily: "material";
  readonly sourceMaterialKey: string;
  readonly materialKey: string;
  readonly label: string;
  readonly materialFamily: MaterialKind;
  readonly materialKind: MaterialKind;
  readonly pipelineKey: string;
  readonly pipelineKeyInput: MaterialPipelineKeyInput;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly dependencies: readonly string[];
  readonly textureBindings: readonly PreparedMaterialTextureBindingResource[];
  readonly dependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface CreatePreparedMaterialResourceDescriptorOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
  readonly expectedMaterialFamily?: MaterialKind;
}

export interface CreatePreparedMaterialResourceDescriptorResult {
  readonly valid: boolean;
  readonly descriptor: PreparedMaterialResourceDescriptor | null;
  readonly diagnostics: readonly PreparedMaterialResourceDiagnostic[];
}
