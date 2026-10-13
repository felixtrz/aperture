import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import type {
  GltfSourceAssetRegistrationDiagnosticCode,
  GltfSourceAssetRegistrationReport,
} from "./gltf-source-registration.js";

export type GltfPrimitiveMaterialResolutionSource =
  | "registered"
  | "available"
  | "default";

export type GltfPrimitiveMaterialResolutionDiagnosticCode =
  | "gltfPrimitiveMaterial.unregisteredMaterial"
  | "gltfPrimitiveMaterial.skippedMaterial"
  | "gltfPrimitiveMaterial.duplicateMaterialUnavailable"
  | "gltfPrimitiveMaterial.failedMaterialDependency"
  | "gltfPrimitiveMaterial.defaultMaterialRequired"
  | "gltfPrimitiveMaterial.defaultMaterialUnavailable";

export interface GltfPrimitiveMaterialResolutionDiagnostic {
  readonly code: GltfPrimitiveMaterialResolutionDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey?: string;
  readonly registrationReason?: GltfSourceAssetRegistrationDiagnosticCode;
  readonly dependencyKey?: string;
}

export interface GltfResolvedPrimitiveMaterial {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey: string;
  readonly source: GltfPrimitiveMaterialResolutionSource;
}

export interface GltfUnresolvedPrimitiveMaterial {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey?: string;
  readonly reason: GltfPrimitiveMaterialResolutionDiagnosticCode;
  readonly diagnostics: readonly GltfPrimitiveMaterialResolutionDiagnostic[];
}

export interface GltfPrimitiveMaterialResolutionReport {
  readonly valid: boolean;
  readonly resolved: readonly GltfResolvedPrimitiveMaterial[];
  readonly unresolved: readonly GltfUnresolvedPrimitiveMaterial[];
  readonly diagnostics: readonly GltfPrimitiveMaterialResolutionDiagnostic[];
}

export type GltfPrimitiveMaterialResolutionReportJsonValue =
  GltfPrimitiveMaterialResolutionReport;

export interface GltfPrimitiveMaterialResolutionOptions {
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly registrationReport: GltfSourceAssetRegistrationReport;
  readonly availableMaterialHandleKeys?: readonly string[];
  readonly defaultMaterialHandleKey?: string;
  readonly keyPrefix?: string;
}
