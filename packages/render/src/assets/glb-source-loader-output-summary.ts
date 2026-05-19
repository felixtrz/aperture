import type { GltfReportDrivenGlbImportReport } from "./gltf-report-driven-import.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";

export type GlbSourceLoaderSummaryStatus = "absent" | "ready" | "invalid";

export interface GlbSourceLoaderMeshConstructionSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly meshCount: number;
  readonly submeshCount: number;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly diagnosticsCount: number;
}

export interface GlbSourceLoaderOutputSummaryJsonValue {
  readonly meshConstruction: GlbSourceLoaderMeshConstructionSummaryJsonValue;
  readonly sourceRegistration: GlbSourceLoaderSourceRegistrationSummaryJsonValue;
}

export interface GlbSourceLoaderSourceRegistrationSummaryJsonValue {
  readonly status: GlbSourceLoaderSummaryStatus;
  readonly valid: boolean | null;
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
  readonly stages: readonly {
    readonly stage: string;
    readonly status: string;
    readonly writtenCount: number;
    readonly skippedCount: number;
    readonly diagnosticCount: number;
  }[];
}

export interface GlbSourceLoaderOutputSummaryOptions {
  readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
}

export function createGlbSourceLoaderOutputSummaryJsonValue(
  report: GltfReportDrivenGlbImportReport,
  options: GlbSourceLoaderOutputSummaryOptions = {},
): GlbSourceLoaderOutputSummaryJsonValue {
  return {
    meshConstruction: createMeshConstructionSummary(report),
    sourceRegistration: createSourceRegistrationSummary(
      options.sourceRegistration ?? null,
    ),
  };
}

function createMeshConstructionSummary(
  report: GltfReportDrivenGlbImportReport,
): GlbSourceLoaderMeshConstructionSummaryJsonValue {
  const importReport = report.importReport;
  const meshConstruction = importReport?.meshConstruction ?? null;

  if (meshConstruction === null) {
    return {
      status: "absent",
      valid: null,
      meshCount: 0,
      submeshCount: 0,
      vertexCount: 0,
      indexCount: 0,
      diagnosticsCount: 0,
    };
  }

  const dependencyDiagnosticsCount =
    (importReport?.accessorValidation?.diagnostics.length ?? 0) +
    (importReport?.accessorDecoding?.diagnostics.length ?? 0);
  const valid =
    meshConstruction.valid &&
    (importReport?.accessorValidation?.valid ?? true) &&
    (importReport?.accessorDecoding?.valid ?? true);

  return {
    status: valid ? "ready" : "invalid",
    valid,
    meshCount: meshConstruction.meshes.length,
    submeshCount: meshConstruction.meshes.reduce(
      (total, mesh) => total + (mesh.mesh?.submeshes.length ?? 0),
      0,
    ),
    vertexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.vertexCount,
          0,
        ) ?? 0),
      0,
    ),
    indexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.indexCount,
          0,
        ) ?? 0),
      0,
    ),
    diagnosticsCount:
      meshConstruction.diagnostics.length + dependencyDiagnosticsCount,
  };
}

function createSourceRegistrationSummary(
  report: GltfSourceRegistrationOrchestrationReport | null,
): GlbSourceLoaderSourceRegistrationSummaryJsonValue {
  if (report === null) {
    return {
      status: "absent",
      valid: null,
      writtenCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
      stages: [],
    };
  }

  return {
    status: report.valid ? "ready" : "invalid",
    valid: report.valid,
    writtenCount: report.stages.reduce(
      (total, stage) => total + stage.writtenCount,
      0,
    ),
    skippedCount: report.stages.reduce(
      (total, stage) => total + stage.skippedCount,
      0,
    ),
    diagnosticsCount:
      report.diagnostics.length +
      report.stages.reduce((total, stage) => total + stage.diagnosticCount, 0),
    stages: report.stages.map((stage) => ({ ...stage })),
  };
}
