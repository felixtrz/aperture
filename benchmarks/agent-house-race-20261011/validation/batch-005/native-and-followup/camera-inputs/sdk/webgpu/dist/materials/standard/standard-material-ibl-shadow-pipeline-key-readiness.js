export function createStandardMaterialIblShadowPipelineKeyReadinessReport(input) {
    if (input.standardMaterialCount === 0) {
        return emptyReport("not-required", input.standardMaterialCount, true);
    }
    if (input.bindingReadiness.status === "missing") {
        return {
            ...emptyReport("missing", input.standardMaterialCount, false),
            diagnostics: [
                {
                    code: "standardMaterialIblShadowPipelineKey.missingBindingReadiness",
                    severity: "warning",
                    message: "StandardMaterial IBL/shadow pipeline readiness requires available binding metadata.",
                },
            ],
        };
    }
    const pipelineKeys = input.submittedPipelineKeys ?? [];
    const features = summarizeFeatures(input.bindingReadiness).map((feature) => {
        const token = selectedPipelineToken(feature.feature, pipelineKeys);
        const slotsReady = input.bindingReadiness.slots
            .filter((slot) => slotToFeature(slot.kind) === feature.feature)
            .every((slot) => slot.readiness === "available");
        const active = slotsReady && pipelineKeys.some((key) => hasPipelineToken(key, token));
        return {
            ...feature,
            pipelineKeyToken: token,
            readiness: active ? "available" : "inactive",
        };
    });
    const bindGroupAvailable = input.bindGroupAvailable ?? input.bindingReadiness.status === "available";
    const shaderSampling = features.length > 0 &&
        bindGroupAvailable &&
        features.every((feature) => feature.readiness === "available");
    const diagnostics = features.flatMap((feature) => feature.readiness === "available"
        ? []
        : [
            {
                code: "standardMaterialIblShadowPipelineKey.featureInactive",
                severity: "warning",
                feature: feature.feature,
                message: `${feature.pipelineKeyToken} is required by binding state but is not active in the submitted StandardMaterial pipeline.`,
            },
        ]);
    return {
        ready: shaderSampling,
        status: shaderSampling ? "available" : "inactive",
        standardMaterialCount: input.standardMaterialCount,
        featureCount: features.length,
        sections: {
            bindingReadiness: input.bindingReadiness.ready,
            pipelineKeyMetadata: true,
            pipelineDescriptor: pipelineKeys.length > 0,
            bindGroupLayout: bindGroupAvailable,
            shaderSampling,
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
function emptyReport(status, standardMaterialCount, ready) {
    return {
        ready,
        status,
        standardMaterialCount,
        featureCount: 0,
        sections: {
            bindingReadiness: ready,
            pipelineKeyMetadata: ready,
            pipelineDescriptor: ready,
            bindGroupLayout: ready,
            shaderSampling: false,
        },
        features: [],
        diagnostics: [],
    };
}
function summarizeFeatures(bindingReadiness) {
    const counts = new Map();
    for (const slot of bindingReadiness.slots) {
        const feature = slotToFeature(slot.kind);
        counts.set(feature, (counts.get(feature) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([feature, requiredBySlotCount]) => ({
        feature,
        pipelineKeyToken: selectedPipelineToken(feature, []),
        source: feature === "ibl-diffuse-irradiance" ||
            feature === "ibl-specular-prefilter"
            ? "ibl"
            : "shadow",
        requiredBySlotCount,
    }))
        .sort((a, b) => a.feature.localeCompare(b.feature));
}
function slotToFeature(slotKind) {
    if (slotKind === "ibl-diffuse")
        return "ibl-diffuse-irradiance";
    if (slotKind === "ibl-specular")
        return "ibl-specular-prefilter";
    if (slotKind === "shadow-view-projection")
        return "shadow-view-projection";
    return "shadow-map";
}
function selectedPipelineToken(feature, keys) {
    switch (feature) {
        case "ibl-diffuse-irradiance":
            return "iblDiffuse";
        case "ibl-specular-prefilter":
            return keys.some((key) => hasPipelineToken(key, "iblSpecularBrdf"))
                ? "iblSpecularBrdf"
                : "iblSpecularProof";
        case "shadow-view-projection":
        case "shadow-map":
            return "shadowMap";
    }
}
function hasPipelineToken(key, token) {
    return `|${key}|`.includes(`|${token}|`);
}
//# sourceMappingURL=standard-material-ibl-shadow-pipeline-key-readiness.js.map