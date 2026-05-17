import type { AssetRegistry } from "@aperture-engine/simulation";

import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import {
  gltfMeshSourceAssetRegistrationReportToJsonValue,
  registerGltfMeshSourceAssetsFromConstructionReport,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfMeshSourceAssetRegistrationReportJsonValue,
} from "./gltf-mesh-source-registration.js";
import {
  gltfSourceAssetRegistrationReportToJsonValue,
  registerGltfSourceAssetsFromMappingReport,
  type GltfSourceAssetRegistrationReport,
  type GltfSourceAssetRegistrationReportJsonValue,
} from "./gltf-source-registration.js";

export type GltfSourceRegistrationStage =
  | "materialTextureSamplerRegistration"
  | "meshRegistration";

export type GltfSourceRegistrationStageStatus =
  | "provided"
  | "missing"
  | "failed";

export type GltfSourceRegistrationOrchestrationDiagnosticCode =
  | "gltfSourceRegistration.missingInput"
  | "gltfSourceRegistration.failedStage";

export interface GltfSourceRegistrationStageSummary {
  readonly stage: GltfSourceRegistrationStage;
  readonly status: GltfSourceRegistrationStageStatus;
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly diagnosticCount: number;
}

export interface GltfSourceRegistrationOrchestrationDiagnostic {
  readonly code: GltfSourceRegistrationOrchestrationDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly stage?: GltfSourceRegistrationStage;
}

export interface GltfSourceRegistrationOrchestrationOptions {
  readonly registry: AssetRegistry;
  readonly assetMapping?: GltfAssetMappingReport;
  readonly meshConstruction?: GltfMeshAssetConstructionReport;
}

export interface GltfSourceRegistrationOrchestrationReport {
  readonly valid: boolean;
  readonly sourceRegistration: GltfSourceAssetRegistrationReport | null;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport | null;
  readonly stages: readonly GltfSourceRegistrationStageSummary[];
  readonly diagnostics: readonly GltfSourceRegistrationOrchestrationDiagnostic[];
}

export interface GltfSourceRegistrationOrchestrationReportJsonValue extends Omit<
  GltfSourceRegistrationOrchestrationReport,
  "sourceRegistration" | "meshRegistration"
> {
  readonly sourceRegistration: GltfSourceAssetRegistrationReportJsonValue | null;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReportJsonValue | null;
}

export function registerGltfSourceAssetsFromReports(
  options: GltfSourceRegistrationOrchestrationOptions,
): GltfSourceRegistrationOrchestrationReport {
  const sourceRegistration =
    options.assetMapping === undefined
      ? null
      : registerGltfSourceAssetsFromMappingReport({
          registry: options.registry,
          report: options.assetMapping,
        });
  const meshRegistration =
    options.meshConstruction === undefined
      ? null
      : registerGltfMeshSourceAssetsFromConstructionReport({
          registry: options.registry,
          report: options.meshConstruction,
        });
  const stages: GltfSourceRegistrationStageSummary[] = [
    stageSummary("materialTextureSamplerRegistration", sourceRegistration),
    stageSummary("meshRegistration", meshRegistration),
  ];
  const diagnostics = createDiagnostics({
    sourceRegistration,
    meshRegistration,
    stages,
  });

  return {
    valid: diagnostics.length === 0,
    sourceRegistration,
    meshRegistration,
    stages,
    diagnostics,
  };
}

export function gltfSourceRegistrationOrchestrationReportToJsonValue(
  report: GltfSourceRegistrationOrchestrationReport,
): GltfSourceRegistrationOrchestrationReportJsonValue {
  return {
    valid: report.valid,
    sourceRegistration:
      report.sourceRegistration === null
        ? null
        : gltfSourceAssetRegistrationReportToJsonValue(
            report.sourceRegistration,
          ),
    meshRegistration:
      report.meshRegistration === null
        ? null
        : gltfMeshSourceAssetRegistrationReportToJsonValue(
            report.meshRegistration,
          ),
    stages: report.stages.map((stage) => ({ ...stage })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSourceRegistrationOrchestrationReportToJson(
  report: GltfSourceRegistrationOrchestrationReport,
): string {
  return JSON.stringify(
    gltfSourceRegistrationOrchestrationReportToJsonValue(report),
  );
}

function stageSummary(
  stage: GltfSourceRegistrationStage,
  report:
    | GltfSourceAssetRegistrationReport
    | GltfMeshSourceAssetRegistrationReport
    | null,
): GltfSourceRegistrationStageSummary {
  if (report === null) {
    return {
      stage,
      status: "missing",
      writtenCount: 0,
      skippedCount: 0,
      diagnosticCount: 0,
    };
  }

  return {
    stage,
    status: report.valid ? "provided" : "failed",
    writtenCount: report.written.length,
    skippedCount: report.skipped.length,
    diagnosticCount: report.diagnostics.length,
  };
}

function createDiagnostics(input: {
  readonly sourceRegistration: GltfSourceAssetRegistrationReport | null;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport | null;
  readonly stages: readonly GltfSourceRegistrationStageSummary[];
}): readonly GltfSourceRegistrationOrchestrationDiagnostic[] {
  const diagnostics: GltfSourceRegistrationOrchestrationDiagnostic[] = [];

  if (input.sourceRegistration === null && input.meshRegistration === null) {
    diagnostics.push({
      code: "gltfSourceRegistration.missingInput",
      severity: "error",
      message:
        "GLB source registration requires an asset mapping report or a mesh construction report.",
    });
  }

  for (const stage of input.stages) {
    if (stage.status !== "failed") {
      continue;
    }

    diagnostics.push({
      code: "gltfSourceRegistration.failedStage",
      severity: "error",
      stage: stage.stage,
      message: `GLB source registration stage '${stage.stage}' failed.`,
    });
  }

  return diagnostics;
}
