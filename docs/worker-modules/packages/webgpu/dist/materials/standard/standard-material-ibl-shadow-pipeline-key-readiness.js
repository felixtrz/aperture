export function createStandardMaterialIblShadowPipelineKeyReadinessReport(input) {
    if (input.standardMaterialCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: 0,
            featureCount: 0,
            sections: {
                bindingReadiness: true,
                pipelineKeyMetadata: true,
                pipelineDescriptor: false,
                bindGroupLayout: false,
                shaderSampling: false,
            },
            features: [],
            diagnostics: [],
        };
    }
    if (input.bindingReadiness.status === "missing") {
        return {
            ready: false,
            status: "missing",
            standardMaterialCount: input.standardMaterialCount,
            featureCount: 0,
            sections: {
                bindingReadiness: false,
                pipelineKeyMetadata: false,
                pipelineDescriptor: false,
                bindGroupLayout: false,
                shaderSampling: false,
            },
            features: [],
            diagnostics: [
                {
                    code: "standardMaterialIblShadowPipelineKey.missingBindingReadiness",
                    severity: "warning",
                    message: "StandardMaterial IBL/shadow pipeline-key readiness requires binding readiness metadata.",
                },
            ],
        };
    }
    const features = summarizeFeatures(input.bindingReadiness);
    const diagnostics = features.flatMap((feature) => [
        {
            code: "standardMaterialIblShadowPipelineKey.deferredFeature",
            severity: "warning",
            feature: feature.feature,
            message: `${feature.pipelineKeyToken} is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.`,
        },
    ]);
    if (features.length > 0) {
        diagnostics.push({
            code: "standardMaterialIblShadowPipelineKey.shaderSamplingDeferred",
            severity: "warning",
            message: "StandardMaterial IBL/shadow pipeline-key metadata is planned, but WGSL, bind-group layouts, and shader sampling remain deferred.",
        });
    }
    return {
        ready: false,
        status: "deferred",
        standardMaterialCount: input.standardMaterialCount,
        featureCount: features.length,
        sections: {
            bindingReadiness: true,
            pipelineKeyMetadata: true,
            pipelineDescriptor: false,
            bindGroupLayout: false,
            shaderSampling: false,
        },
        features,
        diagnostics,
    };
}
export function standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        featureCount: report.featureCount,
        sections: { ...report.sections },
        features: report.features.map((feature) => ({ ...feature })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialIblShadowPipelineKeyReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report));
}
function summarizeFeatures(bindingReadiness) {
    const counts = new Map();
    for (const slot of bindingReadiness.slots) {
        counts.set(slotToFeature(slot.kind), (counts.get(slotToFeature(slot.kind)) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([feature, requiredBySlotCount]) => ({
        feature,
        pipelineKeyToken: pipelineKeyTokenForFeature(feature),
        source: feature === "ibl-diffuse-irradiance" ||
            feature === "ibl-specular-prefilter"
            ? "ibl"
            : "shadow",
        requiredBySlotCount,
        readiness: "deferred",
    }))
        .sort((a, b) => a.pipelineKeyToken.localeCompare(b.pipelineKeyToken));
}
function slotToFeature(slotKind) {
    if (slotKind === "ibl-diffuse") {
        return "ibl-diffuse-irradiance";
    }
    if (slotKind === "ibl-specular") {
        return "ibl-specular-prefilter";
    }
    if (slotKind === "shadow-view-projection") {
        return "shadow-view-projection";
    }
    return "shadow-map";
}
function pipelineKeyTokenForFeature(feature) {
    switch (feature) {
        case "ibl-diffuse-irradiance":
            return "iblDiffuseIrradiance";
        case "ibl-specular-prefilter":
            return "iblSpecularPrefilter";
        case "shadow-view-projection":
            return "shadowViewProjection";
        case "shadow-map":
            return "shadowMap";
    }
}
//# sourceMappingURL=standard-material-ibl-shadow-pipeline-key-readiness.js.map