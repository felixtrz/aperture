export function createShadowPassAttachmentDescriptorReport(options) {
    if (options.shadowPassPlan.requestCount === 0) {
        return report({
            status: "not-required",
            passCount: 0,
            attachments: [],
            diagnostics: [],
        });
    }
    const diagnostics = [];
    const resourcesByPass = new Map(options.depthTextureResources.resources.map((resource) => [
        shadowInputKey(resource.shadowId, resource.lightId),
        resource,
    ]));
    const attachments = [];
    if (options.shadowPassPlan.passCount === 0) {
        diagnostics.push({
            code: "shadowPassAttachmentDescriptor.missingPassPlan",
            severity: "warning",
            message: "Shadow pass attachment descriptor planning requires shadow pass plans.",
        });
    }
    for (const pass of options.shadowPassPlan.passes) {
        const resource = resourcesByPass.get(shadowInputKey(pass.shadowId, pass.lightId));
        const hasAttachmentView = resource?.attachmentViews.some((view) => view.viewKey === pass.viewKey) ??
            false;
        if (resource?.allocation.resource === null ||
            resource === undefined ||
            !hasAttachmentView) {
            diagnostics.push({
                code: "shadowPassAttachmentDescriptor.missingDepthView",
                severity: "warning",
                passKey: pass.passKey,
                shadowId: pass.shadowId,
                lightId: pass.lightId,
                resourceKey: pass.viewKey,
                message: `Shadow pass '${pass.passKey}' requires a live depth texture view for its attachment descriptor.`,
            });
            continue;
        }
        attachments.push({
            passKey: pass.passKey,
            shadowId: pass.shadowId,
            lightId: pass.lightId,
            textureKey: resource.textureKey,
            viewKey: pass.viewKey,
            width: pass.width,
            height: pass.height,
            depthFormat: pass.depthFormat,
            depthLoadOp: pass.depthLoadOp,
            depthStoreOp: pass.depthStoreOp,
            depthClearValue: pass.depthClearValue,
        });
    }
    if (attachments.length > 0 && options.shadowPassPlan.status === "deferred") {
        diagnostics.push({
            code: "shadowPassAttachmentDescriptor.passSubmissionDeferred",
            severity: "warning",
            message: "Shadow pass depth attachments are planned, but command encoder execution and pass submission are deferred.",
        });
    }
    const hasMissing = diagnostics.some((diagnostic) => diagnostic.code === "shadowPassAttachmentDescriptor.missingPassPlan" ||
        diagnostic.code === "shadowPassAttachmentDescriptor.missingDepthView");
    return report({
        status: hasMissing
            ? "missing"
            : options.shadowPassPlan.status === "deferred"
                ? "deferred"
                : "ready",
        passCount: options.shadowPassPlan.passCount,
        attachments,
        diagnostics,
    });
}
export function shadowPassAttachmentDescriptorReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        passCount: report.passCount,
        attachmentCount: report.attachmentCount,
        sections: { ...report.sections },
        attachments: report.attachments.map((attachment) => ({ ...attachment })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowPassAttachmentDescriptorReportToJson(report) {
    return JSON.stringify(shadowPassAttachmentDescriptorReportToJsonValue(report));
}
function report(input) {
    return {
        ready: input.status === "ready" || input.status === "not-required",
        status: input.status,
        passCount: input.passCount,
        attachmentCount: input.attachments.length,
        sections: {
            passPlans: input.passCount > 0,
            depthTextureResources: input.attachments.length > 0,
            depthAttachments: input.attachments.length > 0,
            commandEncoder: false,
            passSubmission: false,
            shaderSampling: false,
        },
        attachments: input.attachments,
        diagnostics: input.diagnostics,
    };
}
function shadowInputKey(shadowId, lightId) {
    return `${shadowId}:${lightId}`;
}
//# sourceMappingURL=shadow-pass-attachment-descriptor.js.map