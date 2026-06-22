import type {
  GltfReportDrivenGlbImportReport,
  GltfReportDrivenImportReport,
} from "./gltf-report-driven-import.js";
import { createGltfEcsReplayReadinessSummaryJsonValue } from "./gltf-ecs-command-replay-readiness.js";
import { createGlbSourceLoaderEcsCommandPlanSummaryJsonValue } from "./glb-source-loader-output-summary-ecs-command-plan.js";
import { createGlbSourceLoaderMeshConstructionSummaryJsonValue } from "./glb-source-loader-output-summary-mesh.js";
import { createGlbSourceLoaderSourceRegistrationSummaryJsonValue } from "./glb-source-loader-output-summary-source-registration.js";
import type {
  GlbSourceLoaderOutputSummaryJsonValue,
  GlbSourceLoaderOutputSummaryOptions,
} from "./glb-source-loader-output-summary-types.js";

export type {
  GlbSourceLoaderEcsCommandPlanSummaryJsonValue,
  GlbSourceLoaderMeshConstructionSummaryJsonValue,
  GlbSourceLoaderOutputSummaryJsonValue,
  GlbSourceLoaderOutputSummaryOptions,
  GlbSourceLoaderSourceRegistrationSummaryJsonValue,
  GlbSourceLoaderSummaryStatus,
} from "./glb-source-loader-output-summary-types.js";

export function createGlbSourceLoaderOutputSummaryJsonValue(
  report: GltfReportDrivenGlbImportReport,
  options: GlbSourceLoaderOutputSummaryOptions = {},
): GlbSourceLoaderOutputSummaryJsonValue {
  return createGltfSourceLoaderOutputSummaryJsonValue(
    report.importReport,
    options,
  );
}

export function createGltfSourceLoaderOutputSummaryJsonValue(
  report: GltfReportDrivenImportReport | null,
  options: GlbSourceLoaderOutputSummaryOptions = {},
): GlbSourceLoaderOutputSummaryJsonValue {
  return {
    meshConstruction:
      createGlbSourceLoaderMeshConstructionSummaryJsonValue(report),
    sourceRegistration: createGlbSourceLoaderSourceRegistrationSummaryJsonValue(
      options.sourceRegistration ?? null,
    ),
    ecsCommandPlan: createGlbSourceLoaderEcsCommandPlanSummaryJsonValue(
      options.ecsCommandPlan ?? null,
    ),
    ecsReplayReadiness: createGltfEcsReplayReadinessSummaryJsonValue(
      options.ecsCommandPlan ?? null,
    ),
  };
}
