export function createShadowPassPlanReport(input) {
    const submission = input.submission ?? "deferred";
    if (input.shadowRequests.length === 0) {
        return {
            ready: true,
            status: "not-required",
            requestCount: 0,
            textureCount: input.textures.textureCount,
            passCount: 0,
            sections: {
                shadowRequests: true,
                textureResources: input.textures.ready,
                passPlans: true,
                passSubmission: true,
                gpuCommands: false,
            },
            passes: [],
            diagnostics: [],
        };
    }
    const diagnostics = [];
    if (!input.textures.ready) {
        diagnostics.push({
            code: "shadowPassPlan.missingTextureResources",
            severity: "warning",
            message: "Shadow pass planning requires valid renderer-owned shadow texture resource descriptors.",
        });
    }
    const requestsByKey = new Map(input.shadowRequests.map((request) => [
        shadowPassInputKey(request.shadowId, request.lightId),
        request,
    ]));
    const usedDepthViews = new Set();
    const passes = [];
    for (const texture of input.textures.textures) {
        const request = requestsByKey.get(shadowPassInputKey(texture.shadowId, texture.lightId));
        if (request === undefined) {
            diagnostics.push({
                code: "shadowPassPlan.missingShadowRequest",
                severity: "error",
                message: `Shadow texture resource '${texture.resourceKey}' has no matching extracted shadow request.`,
            });
            continue;
        }
        for (const pass of createShadowPassPlans(texture, request, submission)) {
            const depthViewKey = `${pass.textureKey}:${pass.viewKey}`;
            const depthLoadOp = usedDepthViews.has(depthViewKey) ? "load" : "clear";
            usedDepthViews.add(depthViewKey);
            passes.push({ ...pass, depthLoadOp });
        }
    }
    if (submission === "unsupported") {
        diagnostics.push({
            code: "shadowPassPlan.submissionUnsupported",
            severity: "warning",
            message: "Shadow pass submission is not supported for the planned shadow resources.",
        });
    }
    else if (submission === "deferred" && passes.length > 0) {
        diagnostics.push({
            code: "shadowPassPlan.submissionDeferred",
            severity: "warning",
            message: "Shadow pass descriptors are planned, but GPU command submission is not implemented yet.",
        });
    }
    const hasMissingInput = diagnostics.some((diagnostic) => diagnostic.code === "shadowPassPlan.missingTextureResources" ||
        diagnostic.code === "shadowPassPlan.missingShadowRequest");
    const status = determineStatus(submission, hasMissingInput);
    return {
        ready: status === "ready",
        status,
        requestCount: input.shadowRequests.length,
        textureCount: input.textures.textureCount,
        passCount: passes.length,
        sections: {
            shadowRequests: true,
            textureResources: input.textures.ready,
            passPlans: !hasMissingInput,
            passSubmission: status === "ready",
            gpuCommands: status === "ready",
        },
        passes,
        diagnostics,
    };
}
export function shadowPassPlanReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        requestCount: report.requestCount,
        textureCount: report.textureCount,
        passCount: report.passCount,
        sections: { ...report.sections },
        passes: report.passes.map((pass) => ({ ...pass })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowPassPlanReportToJson(report) {
    return JSON.stringify(shadowPassPlanReportToJsonValue(report));
}
function createShadowPassPlans(texture, request, submission) {
    const passCount = texture.lightKind === "directional"
        ? Math.max(1, texture.cascadeCount ?? 1)
        : texture.faceCount;
    return Array.from({ length: passCount }, (_, passIndex) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind ?? "directional",
        cascadeIndex: texture.lightKind === "directional" ? passIndex : 0,
        cascadeCount: texture.lightKind === "directional" ? passCount : 1,
        faceIndex: texture.lightKind === "point" ? passIndex : 0,
        faceCount: texture.faceCount,
        passKey: texture.lightKind === "directional" && passCount > 1
            ? `shadow-pass:${request.shadowId}:light:${request.lightId}:cascade:${passIndex}`
            : texture.faceCount === 1
                ? `shadow-pass:${request.shadowId}:light:${request.lightId}`
                : `shadow-pass:${request.shadowId}:light:${request.lightId}:face:${passIndex}`,
        resourceKey: texture.resourceKey,
        textureKey: texture.textureKey,
        viewKey: texture.attachmentViewKeys[passIndex] ?? texture.viewKey,
        width: texture.width,
        height: texture.height,
        depthFormat: texture.depthFormat,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        // Standard [0,1] depth with a less-equal caster test: clear to the far value
        // (1) so the nearest caster wins on every pass. This applies to cube point
        // shadows too (6 perspective faces) — clearing those to 0 left the depth
        // test rejecting every fragment, so the cube recorded no occluders.
        depthClearValue: 1,
        submission,
    }));
}
function determineStatus(submission, hasMissingInput) {
    if (hasMissingInput) {
        return "missing";
    }
    return submission;
}
function shadowPassInputKey(shadowId, lightId) {
    return `${shadowId}:${lightId}`;
}
//# sourceMappingURL=shadow-pass-plan.js.map