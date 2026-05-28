import type {
  AssetRegistry,
  AssetStatus,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type { MaterialKind } from "./types.js";

export type MaterialDependencyKind = "texture" | "sampler";
export type MaterialAssetDependencyReadinessStatus =
  | "ready"
  | "missing"
  | "registered"
  | "loading"
  | "failed";

export type MaterialAssetDependencyReadinessDiagnosticCode =
  | "materialDependency.missingMaterial"
  | "materialDependency.materialNotReady"
  | "materialDependency.missingTextureHandle"
  | "materialDependency.missingSamplerHandle"
  | "materialDependency.dependencyMissing"
  | "materialDependency.dependencyRegistered"
  | "materialDependency.dependencyLoading"
  | "materialDependency.dependencyFailed";

export interface MaterialAssetDependencyReadinessDiagnostic {
  readonly code: MaterialAssetDependencyReadinessDiagnosticCode;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly dependencyKind?: MaterialDependencyKind;
  readonly dependencyKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly status?: MaterialAssetDependencyReadinessStatus;
}

export interface MaterialAssetDependencySlotReadiness {
  readonly field: string;
  readonly dependency: MaterialDependencyKind;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handleKey: string | null;
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly ready: boolean;
}

export interface MaterialAssetDependencyReadinessReport {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly dependencies: readonly MaterialAssetDependencySlotReadiness[];
  readonly slots: readonly MaterialAssetDependencySlotReadiness[];
  readonly diagnostics: readonly MaterialAssetDependencyReadinessDiagnostic[];
}

export interface MaterialAssetDependencyReadinessDiagnosticJsonValue {
  readonly code: MaterialAssetDependencyReadinessDiagnosticCode;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly dependencyKind?: MaterialDependencyKind;
  readonly dependencyKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly status?: MaterialAssetDependencyReadinessStatus;
}

export interface MaterialAssetDependencySlotReadinessJsonValue {
  readonly field: string;
  readonly dependency: MaterialDependencyKind;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handleKey: string | null;
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly ready: boolean;
}

export interface MaterialAssetDependencyReadinessReportJsonValue {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly dependencies: readonly MaterialAssetDependencySlotReadinessJsonValue[];
  readonly slots: readonly MaterialAssetDependencySlotReadinessJsonValue[];
  readonly diagnostics: readonly MaterialAssetDependencyReadinessDiagnosticJsonValue[];
}

export interface MaterialAssetDependencyReadinessOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}
