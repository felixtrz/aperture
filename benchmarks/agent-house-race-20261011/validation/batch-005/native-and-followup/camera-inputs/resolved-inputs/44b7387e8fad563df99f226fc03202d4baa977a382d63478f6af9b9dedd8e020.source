export function createStandardMaterialShadowReadinessReport(input) {
    if (input.standardMaterialCount === 0 ||
        input.shadowPassPlan.requestCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: input.standardMaterialCount,
            shadowRequestCount: input.shadowPassPlan.requestCount,
            passCount: input.shadowPassPlan.passCount,
            sections: {
                shadowRequests: true,
                shadowTextureResources: true,
                shadowPassPlan: true,
                passSubmission: true,
                shaderSampling: false,
            },
            diagnostics: [],
        };
    }
    const diagnostics = [];
    const missingDiagnostics = input.shadowPassPlan.diagnostics.filter((diagnostic) => diagnostic.code === "shadowPassPlan.missingTextureResources" ||
        diagnostic.code === "shadowPassPlan.missingShadowRequest");
    const unsupportedDiagnostics = input.shadowPassPlan.diagnostics.filter((diagnostic) => diagnostic.code === "shadowPassPlan.submissionUnsupported");
    const deferredDiagnostics = input.shadowPassPlan.diagnostics.filter((diagnostic) => diagnostic.code === "shadowPassPlan.submissionDeferred");
    if (input.shadowPassPlan.status === "missing" ||
        missingDiagnostics.length > 0) {
        diagnostics.push({
            code: "standardMaterialShadow.missingPassPlan",
            severity: "warning",
            passPlanDiagnostics: missingDiagnostics,
            message: "StandardMaterial shadows require renderer-owned shadow texture resources and pass plans.",
        });
    }
    if (input.shadowPassPlan.status === "unsupported" ||
        unsupportedDiagnostics.length > 0) {
        diagnostics.push({
            code: "standardMaterialShadow.unsupportedPassSubmission",
            severity: "warning",
            passPlanDiagnostics: unsupportedDiagnostics,
            message: "StandardMaterial shadows have pass planning data, but shadow pass submission is unsupported.",
        });
    }
    if (input.shadowPassPlan.status === "deferred" ||
        deferredDiagnostics.length > 0) {
        diagnostics.push({
            code: "standardMaterialShadow.passSubmissionDeferred",
            severity: "warning",
            passPlanDiagnostics: deferredDiagnostics,
            message: "StandardMaterial shadows have pass planning data, but shadow pass submission is deferred.",
        });
    }
    diagnostics.push({
        code: "standardMaterialShadow.shaderSamplingDeferred",
        severity: "warning",
        passPlanDiagnostics: [],
        message: "StandardMaterial shadow pass planning is reported for readiness, but shader shadow sampling is not implemented yet.",
    });
    const status = determineStatus(input.shadowPassPlan.status);
    return {
        ready: status === "available",
        status,
        standardMaterialCount: input.standardMaterialCount,
        shadowRequestCount: input.shadowPassPlan.requestCount,
        passCount: input.shadowPassPlan.passCount,
        sections: {
            shadowRequests: input.shadowPassPlan.sections.shadowRequests,
            shadowTextureResources: input.shadowPassPlan.sections.textureResources,
            shadowPassPlan: input.shadowPassPlan.sections.passPlans,
            passSubmission: input.shadowPassPlan.sections.passSubmission,
            shaderSampling: false,
        },
        diagnostics,
    };
}
export function standardMaterialShadowReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        shadowRequestCount: report.shadowRequestCount,
        passCount: report.passCount,
        sections: { ...report.sections },
        diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            passPlanDiagnostics: diagnostic.passPlanDiagnostics.map((passPlanDiagnostic) => ({ ...passPlanDiagnostic })),
        })),
    };
}
export function standardMaterialShadowReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialShadowReadinessReportToJsonValue(report));
}
function determineStatus(passPlanStatus) {
    if (passPlanStatus === "ready") {
        return "available";
    }
    if (passPlanStatus === "not-required") {
        return "not-required";
    }
    return passPlanStatus;
}
//# sourceMappingURL=standard-material-shadow-readiness.js.map