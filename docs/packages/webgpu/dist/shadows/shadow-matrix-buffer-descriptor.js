export const SHADOW_MATRIX_BUFFER_STRIDE_BYTES = 16 * 4;
export function createShadowMatrixBufferDescriptorReport(input) {
    const upload = input.upload ?? "deferred";
    const viewProjectionReady = input.viewProjection.status !== "missing" &&
        input.viewProjection.status !== "unsupported";
    if (input.viewProjection.status === "not-required") {
        return {
            ready: true,
            status: "not-required",
            planCount: 0,
            matrixCount: 0,
            byteSize: 0,
            sections: {
                viewProjectionPlanning: true,
                bufferDescriptor: true,
                gpuAllocation: false,
                upload: true,
            },
            descriptor: null,
            diagnostics: [],
        };
    }
    const diagnostics = [];
    if (input.viewProjection.status === "missing") {
        diagnostics.push({
            code: "shadowMatrixBuffer.missingViewProjectionPlan",
            severity: "warning",
            message: "Shadow matrix buffer planning requires a shadow view/projection plan.",
        });
    }
    if (input.viewProjection.status === "unsupported") {
        diagnostics.push({
            code: "shadowMatrixBuffer.unsupportedViewProjectionPlan",
            severity: "warning",
            message: "Shadow matrix buffer planning does not support the current shadow view/projection plan.",
        });
    }
    const entries = input.viewProjection.plans.map((plan, index) => ({
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        planKey: plan.planKey,
        passKey: plan.passKey,
        matrixKey: plan.viewProjectionMatrixKey,
        offsetBytes: index * SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
        sizeBytes: SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
        upload,
    }));
    const byteSize = entries.length * SHADOW_MATRIX_BUFFER_STRIDE_BYTES;
    const descriptor = entries.length === 0
        ? null
        : {
            resourceKey: input.resourceKey ?? "shadow-matrix-buffer:directional",
            label: input.label ?? "DirectionalShadowMatrices/storage",
            usage: "read-only-storage-buffer",
            matrixCount: entries.length,
            strideBytes: SHADOW_MATRIX_BUFFER_STRIDE_BYTES,
            byteSize,
            entries,
        };
    if (descriptor !== null && upload === "deferred") {
        diagnostics.push({
            code: "shadowMatrixBuffer.uploadDeferred",
            severity: "warning",
            message: "Shadow matrix buffer descriptor is planned, but GPU buffer allocation and matrix upload are deferred.",
        });
    }
    const status = determineStatus({
        viewProjectionStatus: input.viewProjection.status,
        hasDescriptor: descriptor !== null,
        upload,
    });
    return {
        ready: status === "ready",
        status,
        planCount: input.viewProjection.planCount,
        matrixCount: entries.length,
        byteSize,
        sections: {
            viewProjectionPlanning: viewProjectionReady,
            bufferDescriptor: descriptor !== null,
            gpuAllocation: false,
            upload: status === "ready",
        },
        descriptor,
        diagnostics,
    };
}
export function shadowMatrixBufferDescriptorReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        planCount: report.planCount,
        matrixCount: report.matrixCount,
        byteSize: report.byteSize,
        sections: { ...report.sections },
        descriptor: report.descriptor === null
            ? null
            : {
                ...report.descriptor,
                entries: report.descriptor.entries.map((entry) => ({ ...entry })),
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowMatrixBufferDescriptorReportToJson(report) {
    return JSON.stringify(shadowMatrixBufferDescriptorReportToJsonValue(report));
}
function determineStatus(input) {
    if (input.viewProjectionStatus === "unsupported") {
        return "unsupported";
    }
    if (input.viewProjectionStatus === "missing" || !input.hasDescriptor) {
        return "missing";
    }
    if (input.upload === "deferred") {
        return "deferred";
    }
    return "ready";
}
//# sourceMappingURL=shadow-matrix-buffer-descriptor.js.map