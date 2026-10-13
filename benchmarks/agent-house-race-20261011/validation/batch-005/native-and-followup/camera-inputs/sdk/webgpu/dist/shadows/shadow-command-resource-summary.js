export function createShadowCommandResourceSummaryReport(input) {
    const status = determineStatus(input);
    const diagnostics = createDiagnostics(input, status);
    return {
        ready: status === "ready" || status === "not-required",
        status,
        counts: {
            requests: input.passPlan.requestCount,
            textures: input.textures.textureCount,
            passes: input.passPlan.passCount,
            viewProjectionPlans: input.viewProjection.planCount,
            matrices: input.matrixBuffer.matrixCount,
            casterLists: input.casterDrawList.listCount,
            commandPlans: input.commandPlan.counts.commandPlans,
            drawCommands: input.commandPlan.counts.drawCommands,
        },
        sections: {
            textureResources: input.textures.ready,
            passPlans: sectionAvailable(input.passPlan.status),
            viewProjectionPlanning: sectionAvailable(input.viewProjection.status),
            matrixBufferDescriptor: sectionAvailable(input.matrixBuffer.status),
            casterDrawLists: sectionAvailable(input.casterDrawList.status),
            commandPlans: sectionAvailable(input.commandPlan.status),
            gpuAllocation: false,
            commandEncoding: input.commandPlan.sections.commandEncoding,
        },
        resourceKeys: {
            textures: input.textures.textures
                .map((texture) => texture.textureKey)
                .sort(),
            views: input.textures.textures.map((texture) => texture.viewKey).sort(),
            passes: input.passPlan.passes.map((pass) => pass.passKey).sort(),
            matrixBuffers: input.matrixBuffer.descriptor === null
                ? []
                : [input.matrixBuffer.descriptor.resourceKey],
            commands: input.commandPlan.commands
                .map((command) => command.commandKey)
                .sort(),
        },
        diagnostics,
    };
}
export function shadowCommandResourceSummaryReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        counts: { ...report.counts },
        sections: { ...report.sections },
        resourceKeys: {
            textures: [...report.resourceKeys.textures],
            views: [...report.resourceKeys.views],
            passes: [...report.resourceKeys.passes],
            matrixBuffers: [...report.resourceKeys.matrixBuffers],
            commands: [...report.resourceKeys.commands],
        },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowCommandResourceSummaryReportToJson(report) {
    return JSON.stringify(shadowCommandResourceSummaryReportToJsonValue(report));
}
function determineStatus(input) {
    if (input.passPlan.requestCount === 0) {
        return "not-required";
    }
    if (input.viewProjection.status === "unsupported" ||
        input.matrixBuffer.status === "unsupported" ||
        input.commandPlan.status === "unsupported") {
        return "unsupported";
    }
    if (!input.textures.ready ||
        input.passPlan.status === "missing" ||
        input.viewProjection.status === "missing" ||
        input.matrixBuffer.status === "missing" ||
        input.casterDrawList.status === "missing" ||
        input.commandPlan.status === "missing") {
        return "missing";
    }
    if (input.passPlan.status === "deferred" ||
        input.viewProjection.status === "deferred" ||
        input.matrixBuffer.status === "deferred" ||
        input.casterDrawList.status === "deferred" ||
        input.commandPlan.status === "deferred" ||
        !input.textures.sections.gpuAllocation) {
        return "deferred";
    }
    return "ready";
}
function createDiagnostics(input, status) {
    if (status === "not-required") {
        return [];
    }
    const diagnostics = [];
    if (!input.textures.ready) {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingTextureResources",
            severity: "warning",
            message: "Shadow command resource summary requires valid shadow texture resource descriptors.",
        });
    }
    addStatusDiagnostics(diagnostics, input);
    if (input.textures.textureCount > 0 &&
        !input.textures.sections.gpuAllocation) {
        diagnostics.push({
            code: "shadowCommandResourceSummary.textureAllocationDeferred",
            severity: "warning",
            message: "Shadow texture resources are planned, but GPU texture allocation is deferred.",
        });
    }
    if (input.commandPlan.status === "deferred") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.commandEncodingDeferred",
            severity: "warning",
            message: "Shadow command plans are available as data, but GPU command encoding is deferred.",
        });
    }
    return diagnostics;
}
function addStatusDiagnostics(diagnostics, input) {
    if (input.passPlan.status === "missing") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingPassPlan",
            severity: "warning",
            message: "Shadow command resource summary requires shadow pass plans.",
        });
    }
    if (input.viewProjection.status === "missing") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingViewProjection",
            severity: "warning",
            message: "Shadow command resource summary requires directional shadow view/projection plans.",
        });
    }
    else if (input.viewProjection.status === "unsupported") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.unsupportedViewProjection",
            severity: "warning",
            message: "Shadow command resource summary currently supports directional shadow view/projection plans only.",
        });
    }
    if (input.matrixBuffer.status === "missing") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingMatrixBuffer",
            severity: "warning",
            message: "Shadow command resource summary requires a shadow matrix-buffer descriptor.",
        });
    }
    else if (input.matrixBuffer.status === "unsupported") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.unsupportedMatrixBuffer",
            severity: "warning",
            message: "Shadow command resource summary cannot use the current matrix-buffer descriptor.",
        });
    }
    if (input.casterDrawList.status === "missing") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingCasterDrawList",
            severity: "warning",
            message: "Shadow command resource summary requires shadow caster draw lists.",
        });
    }
    if (input.commandPlan.status === "missing") {
        diagnostics.push({
            code: "shadowCommandResourceSummary.missingCommandPlan",
            severity: "warning",
            message: "Shadow command resource summary requires command plans.",
        });
    }
}
function sectionAvailable(status) {
    return status !== "missing" && status !== "unsupported";
}
//# sourceMappingURL=shadow-command-resource-summary.js.map