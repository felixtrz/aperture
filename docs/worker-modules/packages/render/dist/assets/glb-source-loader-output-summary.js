import { createGltfEcsReplayReadinessSummaryJsonValue } from "./gltf-ecs-command-replay-readiness.js";
import { createGlbSourceLoaderEcsCommandPlanSummaryJsonValue } from "./glb-source-loader-output-summary-ecs-command-plan.js";
import { createGlbSourceLoaderMeshConstructionSummaryJsonValue } from "./glb-source-loader-output-summary-mesh.js";
import { createGlbSourceLoaderSourceRegistrationSummaryJsonValue } from "./glb-source-loader-output-summary-source-registration.js";
export function createGlbSourceLoaderOutputSummaryJsonValue(report, options = {}) {
    return createGltfSourceLoaderOutputSummaryJsonValue(report.importReport, options);
}
export function createGltfSourceLoaderOutputSummaryJsonValue(report, options = {}) {
    return {
        meshConstruction: createGlbSourceLoaderMeshConstructionSummaryJsonValue(report),
        sourceRegistration: createGlbSourceLoaderSourceRegistrationSummaryJsonValue(options.sourceRegistration ?? null),
        ecsCommandPlan: createGlbSourceLoaderEcsCommandPlanSummaryJsonValue(options.ecsCommandPlan ?? null),
        ecsReplayReadiness: createGltfEcsReplayReadinessSummaryJsonValue(options.ecsCommandPlan ?? null),
    };
}
//# sourceMappingURL=glb-source-loader-output-summary.js.map