import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";
import type { GlbSourceLoaderSourceRegistrationSummaryJsonValue } from "./glb-source-loader-output-summary-types.js";

export function createGlbSourceLoaderSourceRegistrationSummaryJsonValue(
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
