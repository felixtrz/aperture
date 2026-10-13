import { gltfMeshSourceAssetRegistrationReportToJsonValue, registerGltfMeshSourceAssetsFromConstructionReport, } from "./gltf-mesh-source-registration.js";
import { gltfSourceAssetRegistrationReportToJsonValue, registerGltfSourceAssetsFromMappingReport, } from "./gltf-source-registration.js";
export function registerGltfSourceAssetsFromReports(options) {
    const sourceRegistration = options.assetMapping === undefined
        ? null
        : registerGltfSourceAssetsFromMappingReport({
            registry: options.registry,
            report: options.assetMapping,
        });
    const meshRegistration = options.meshConstruction === undefined
        ? null
        : registerGltfMeshSourceAssetsFromConstructionReport({
            registry: options.registry,
            report: options.meshConstruction,
        });
    const stages = [
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
export function gltfSourceRegistrationOrchestrationReportToJsonValue(report) {
    return {
        valid: report.valid,
        sourceRegistration: report.sourceRegistration === null
            ? null
            : gltfSourceAssetRegistrationReportToJsonValue(report.sourceRegistration),
        meshRegistration: report.meshRegistration === null
            ? null
            : gltfMeshSourceAssetRegistrationReportToJsonValue(report.meshRegistration),
        stages: report.stages.map((stage) => ({ ...stage })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfSourceRegistrationOrchestrationReportToJson(report) {
    return JSON.stringify(gltfSourceRegistrationOrchestrationReportToJsonValue(report));
}
function stageSummary(stage, report) {
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
function createDiagnostics(input) {
    const diagnostics = [];
    if (input.sourceRegistration === null && input.meshRegistration === null) {
        diagnostics.push({
            code: "gltfSourceRegistration.missingInput",
            severity: "error",
            message: "GLB source registration requires an asset mapping report or a mesh construction report.",
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
//# sourceMappingURL=gltf-source-registration-orchestration.js.map