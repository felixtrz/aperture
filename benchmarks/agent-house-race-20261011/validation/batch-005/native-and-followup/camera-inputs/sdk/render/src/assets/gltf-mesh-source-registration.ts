import type {
  AssetDiagnostic,
  AssetRegistry,
} from "@aperture-engine/simulation";

import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import { registerGltfPlannedMeshSourceAsset } from "./gltf-mesh-source-registration-writers.js";

export type GltfMeshSourceAssetRegistrationKind = "mesh";

export type GltfMeshSourceAssetRegistrationDiagnosticSeverity =
  | "error"
  | "warning";

export type GltfMeshSourceAssetRegistrationDiagnosticCode =
  | "gltfMeshRegistration.invalidConstructionReport"
  | "gltfMeshRegistration.invalidPlannedAsset"
  | "gltfMeshRegistration.duplicateAssetKey"
  | "gltfMeshRegistration.invalidHandleKey";

export interface GltfMeshSourceAssetRegistrationDiagnostic {
  readonly code: GltfMeshSourceAssetRegistrationDiagnosticCode;
  readonly severity: GltfMeshSourceAssetRegistrationDiagnosticSeverity;
  readonly message: string;
  readonly kind?: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey?: string;
  readonly registeredHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
}

export interface GltfRegisteredMeshSourceAsset {
  readonly kind: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface GltfSkippedMeshSourceAsset {
  readonly kind: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly reason: GltfMeshSourceAssetRegistrationDiagnosticCode;
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}

export interface GltfMeshSourceAssetRegistrationOptions {
  readonly registry: AssetRegistry;
  readonly report: GltfMeshAssetConstructionReport;
}

export interface GltfMeshSourceAssetRegistrationReport {
  readonly valid: boolean;
  readonly written: readonly GltfRegisteredMeshSourceAsset[];
  readonly skipped: readonly GltfSkippedMeshSourceAsset[];
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}

export type GltfMeshSourceAssetRegistrationReportJsonValue =
  GltfMeshSourceAssetRegistrationReport;

export function registerGltfMeshSourceAssetsFromConstructionReport(
  options: GltfMeshSourceAssetRegistrationOptions,
): GltfMeshSourceAssetRegistrationReport {
  const diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[] = [];
  const written: GltfRegisteredMeshSourceAsset[] = [];
  const skipped: GltfSkippedMeshSourceAsset[] = [];

  if (!options.report.valid && options.report.meshes.length === 0) {
    diagnostics.push({
      code: "gltfMeshRegistration.invalidConstructionReport",
      severity: "error",
      message:
        "No mesh source assets were registered because the construction report is invalid.",
    });
    return result({ diagnostics, written, skipped });
  }

  for (const mesh of options.report.meshes) {
    registerGltfPlannedMeshSourceAsset({
      registry: options.registry,
      report: options.report,
      mesh,
      diagnostics,
      written,
      skipped,
    });
  }

  return result({ diagnostics, written, skipped });
}

export function gltfMeshSourceAssetRegistrationReportToJsonValue(
  report: GltfMeshSourceAssetRegistrationReport,
): GltfMeshSourceAssetRegistrationReportJsonValue {
  return {
    valid: report.valid,
    written: report.written.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    skipped: report.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshSourceAssetRegistrationReportToJson(
  report: GltfMeshSourceAssetRegistrationReport,
): string {
  return JSON.stringify(
    gltfMeshSourceAssetRegistrationReportToJsonValue(report),
  );
}

function result(input: {
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
  readonly written: readonly GltfRegisteredMeshSourceAsset[];
  readonly skipped: readonly GltfSkippedMeshSourceAsset[];
}): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    written: input.written,
    skipped: input.skipped,
    diagnostics: input.diagnostics,
  };
}
