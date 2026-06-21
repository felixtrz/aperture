export function createIblPreparationPassPlanReport(input) {
    const submission = input.submission ?? "deferred";
    if (input.textures.slotCount === 0) {
        return {
            ready: true,
            status: "not-required",
            slotCount: 0,
            passCount: 0,
            sections: {
                texturePreparation: true,
                passPlans: true,
                passSubmission: true,
                shaderSampling: false,
            },
            passes: [],
            diagnostics: [],
        };
    }
    const diagnostics = [];
    if (input.textures.status === "missing") {
        diagnostics.push({
            code: "iblPreparationPass.missingTexturePreparation",
            severity: "warning",
            message: "IBL preparation pass planning requires valid IBL texture preparation descriptors.",
        });
    }
    if (input.textures.status === "unsupported" ||
        input.textures.slots.some((slot) => slot.preparation === "unsupported")) {
        diagnostics.push({
            code: "iblPreparationPass.unsupportedSlots",
            severity: "warning",
            message: "IBL preparation pass planning cannot proceed while diffuse or specular texture slots are unsupported.",
        });
    }
    const passes = input.textures.slots
        .filter(isPreparedTextureSlot)
        .map((slot) => createPreparationPass(slot, submission));
    if (submission === "unsupported" && passes.length > 0) {
        diagnostics.push({
            code: "iblPreparationPass.submissionUnsupported",
            severity: "warning",
            message: "IBL texture preparation pass submission is unsupported for the planned resources.",
        });
    }
    else if (submission === "deferred" && passes.length > 0) {
        diagnostics.push({
            code: "iblPreparationPass.submissionDeferred",
            severity: "warning",
            message: "IBL texture preparation passes are planned, but GPU submission is not implemented yet.",
        });
    }
    const status = determineStatus({
        textureStatus: input.textures.status,
        submission,
        hasUnsupportedSlots: diagnostics.some((diagnostic) => diagnostic.code === "iblPreparationPass.unsupportedSlots"),
    });
    return {
        ready: status === "ready",
        status,
        slotCount: input.textures.slotCount,
        passCount: passes.length,
        sections: {
            texturePreparation: input.textures.status === "ready" ||
                input.textures.status === "deferred",
            passPlans: status === "ready" || status === "deferred",
            passSubmission: status === "ready",
            shaderSampling: false,
        },
        passes,
        diagnostics,
    };
}
export function iblPreparationPassPlanReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        slotCount: report.slotCount,
        passCount: report.passCount,
        sections: { ...report.sections },
        passes: report.passes.map((pass) => ({
            ...pass,
            environmentIds: [...pass.environmentIds],
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function iblPreparationPassPlanReportToJson(report) {
    return JSON.stringify(iblPreparationPassPlanReportToJsonValue(report));
}
function isPreparedTextureSlot(slot) {
    return (slot.sourceResourceKey !== null &&
        slot.textureKey !== null &&
        slot.viewKey !== null &&
        slot.samplerKey !== null);
}
function createPreparationPass(slot, submission) {
    return {
        passKey: `ibl-pass:${slot.environmentMapResourceKey}:${slot.kind}`,
        environmentMapResourceKey: slot.environmentMapResourceKey,
        environmentIds: [...slot.environmentIds],
        kind: slot.kind,
        sourceResourceKey: slot.sourceResourceKey,
        textureKey: slot.textureKey,
        viewKey: slot.viewKey,
        samplerKey: slot.samplerKey,
        operation: slot.kind === "diffuse" ? "irradiance-convolution" : "specular-prefilter",
        submission,
    };
}
function determineStatus(input) {
    if (input.textureStatus === "not-required") {
        return "not-required";
    }
    if (input.textureStatus === "missing") {
        return "missing";
    }
    if (input.textureStatus === "unsupported" || input.hasUnsupportedSlots) {
        return "unsupported";
    }
    return input.submission;
}
//# sourceMappingURL=ibl-preparation-pass-plan.js.map