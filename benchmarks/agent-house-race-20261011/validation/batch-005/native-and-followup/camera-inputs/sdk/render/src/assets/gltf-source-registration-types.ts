import type {
  AssetDiagnostic,
  AssetRegistry,
} from "@aperture-engine/simulation";

import type { GltfMaterialTextureSlot } from "../materials/index.js";
import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";

export type GltfSourceAssetRegistrationKind =
  | "texture"
  | "sampler"
  | "material";

export type GltfSourceAssetRegistrationDiagnosticSeverity = "error" | "warning";

export type GltfSourceAssetRegistrationDiagnosticCode =
  | "gltfRegistration.rootInvalid"
  | "gltfRegistration.duplicateAssetKey"
  | "gltfRegistration.invalidPlannedAsset"
  | "gltfRegistration.missingDependency";

export interface GltfSourceAssetRegistrationDiagnostic {
  readonly code: GltfSourceAssetRegistrationDiagnosticCode;
  readonly severity: GltfSourceAssetRegistrationDiagnosticSeverity;
  readonly message: string;
  readonly kind?: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey?: string;
  readonly registeredHandleKey?: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly dependencyKey?: string;
}

export interface GltfRegisteredSourceAsset {
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly dependencyHandleKeys?: readonly string[];
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface GltfSkippedSourceAsset {
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly reason: GltfSourceAssetRegistrationDiagnosticCode;
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
}

export interface GltfSourceAssetRegistrationOptions {
  readonly registry: AssetRegistry;
  readonly report: GltfAssetMappingReport;
}

export interface GltfSourceAssetRegistrationReport {
  readonly valid: boolean;
  readonly written: readonly GltfRegisteredSourceAsset[];
  readonly skipped: readonly GltfSkippedSourceAsset[];
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
}

export type GltfSourceAssetRegistrationReportJsonValue =
  GltfSourceAssetRegistrationReport;
