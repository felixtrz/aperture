export function createWebGpuAppDiagnosticsSummary(input) {
    const summary = {
        sectionCount: 0,
    };
    if (input.materialQueue !== undefined) {
        summary.sectionCount += 1;
        summary.materialQueue = input.materialQueue;
    }
    if (input.materialQueueRoute !== undefined) {
        summary.sectionCount += 1;
        summary.materialQueueRoute = input.materialQueueRoute;
    }
    if (input.routedResourceSet !== undefined) {
        summary.sectionCount += 1;
        summary.routedResourceSet = input.routedResourceSet;
    }
    if (input.builtInAppResourceAdapters !== undefined) {
        summary.sectionCount += 1;
        summary.builtInAppResourceAdapters = input.builtInAppResourceAdapters;
    }
    if (input.renderFrameQueue !== undefined) {
        summary.sectionCount += 1;
        summary.renderFrameQueue = input.renderFrameQueue;
    }
    if (input.renderQueueSortPhases !== undefined) {
        summary.sectionCount += 1;
        summary.renderQueueSortPhases = input.renderQueueSortPhases;
    }
    if (input.gpuTimings !== undefined) {
        summary.sectionCount += 1;
        summary.gpuTimings = input.gpuTimings;
    }
    if (input.directLighting !== undefined) {
        summary.sectionCount += 1;
        summary.directLighting = input.directLighting;
    }
    return summary;
}
export function collectWebGpuAppMaterialQueueRouteReport(diagnostics) {
    for (const diagnostic of diagnostics) {
        if (typeof diagnostic !== "object" || diagnostic === null) {
            continue;
        }
        const candidate = diagnostic;
        if (candidate.code === "webGpuApp.materialQueueRouteReport" &&
            typeof candidate.report === "object" &&
            candidate.report !== null) {
            return candidate.report;
        }
    }
    return null;
}
export function collectWebGpuAppMaterialDependencyReadiness(diagnostics) {
    const readiness = [];
    for (const diagnostic of diagnostics) {
        if (typeof diagnostic !== "object" ||
            diagnostic === null ||
            diagnostic.code !==
                "webGpuApp.materialDependenciesNotReady") {
            continue;
        }
        const candidate = diagnostic;
        if (typeof candidate.materialDependencyReadiness === "object" &&
            candidate.materialDependencyReadiness !== null) {
            readiness.push(candidate.materialDependencyReadiness);
        }
    }
    return readiness;
}
//# sourceMappingURL=app-diagnostics-summary.js.map