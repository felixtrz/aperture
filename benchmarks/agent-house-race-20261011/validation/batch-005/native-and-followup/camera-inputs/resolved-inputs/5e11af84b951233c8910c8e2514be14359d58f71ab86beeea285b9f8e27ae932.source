export function createWebGpuAppMaterialQueueRouteReport(options) {
    const shell = writeWebGpuAppMaterialQueueRouteReportShell(options, createWebGpuAppMaterialQueueRouteReportShell());
    return webGpuAppMaterialQueueRouteReportShellToReport(shell);
}
export function createWebGpuAppMaterialQueueRouteReportShell() {
    return {
        valid: true,
        queueItemCount: 0,
        routedItemCount: 0,
        skippedItemCount: 0,
        byFamily: new Map(),
        byPhase: new Map(),
        diagnosticSummary: {
            total: 0,
            bySeverity: { info: 0, warning: 0, error: 0 },
            byCode: {},
        },
        diagnostics: [],
        routedKeys: new Set(),
    };
}
export function resetWebGpuAppMaterialQueueRouteReportShell(shell) {
    shell.valid = true;
    shell.queueItemCount = 0;
    shell.routedItemCount = 0;
    shell.skippedItemCount = 0;
    shell.byFamily.clear();
    shell.byPhase.clear();
    shell.diagnostics.length = 0;
    shell.routedKeys.clear();
    resetDiagnosticSummary(shell.diagnosticSummary);
    return shell;
}
export function writeWebGpuAppMaterialQueueRouteReportShell(options, shell) {
    resetWebGpuAppMaterialQueueRouteReportShell(shell);
    for (const item of options.routedItems) {
        shell.routedKeys.add(routeItemKey(item));
    }
    for (const item of options.queueItems) {
        const routed = shell.routedKeys.has(routeItemKey(item));
        if (routed) {
            shell.routedItemCount += 1;
        }
        incrementBucket(shell.byFamily, item.materialFamily, routed);
        incrementBucket(shell.byPhase, item.renderPhase, routed);
    }
    shell.queueItemCount = options.queueItems.length;
    shell.skippedItemCount = shell.queueItemCount - shell.routedItemCount;
    shell.diagnostics.push(...(options.diagnostics ?? []));
    writeDiagnosticSummary(shell.diagnostics, shell.diagnosticSummary);
    shell.valid =
        shell.skippedItemCount === 0 &&
            shell.diagnostics.every((diagnostic) => diagnosticSeverity(diagnostic) !== "error");
    return shell;
}
export function webGpuAppMaterialQueueRouteReportShellToReport(shell) {
    return {
        valid: shell.valid,
        queueItemCount: shell.queueItemCount,
        routedItemCount: shell.routedItemCount,
        skippedItemCount: shell.skippedItemCount,
        byFamily: [...shell.byFamily.values()].map(freezeBucket),
        byPhase: [...shell.byPhase.values()].map(freezeBucket),
        diagnosticSummary: copyDiagnosticSummary(shell.diagnosticSummary),
        diagnostics: [...shell.diagnostics],
    };
}
export function webGpuAppMaterialQueueRouteReportToJsonValue(report) {
    return {
        valid: report.valid,
        queueItemCount: report.queueItemCount,
        routedItemCount: report.routedItemCount,
        skippedItemCount: report.skippedItemCount,
        byFamily: report.byFamily.map((entry) => ({ ...entry })),
        byPhase: report.byPhase.map((entry) => ({ ...entry })),
        diagnosticSummary: {
            total: report.diagnosticSummary.total,
            bySeverity: { ...report.diagnosticSummary.bySeverity },
            byCode: { ...report.diagnosticSummary.byCode },
        },
        diagnostics: report.diagnostics.map(diagnosticToJsonValue),
    };
}
export function webGpuAppMaterialQueueRouteReportShellToJsonValue(shell) {
    return webGpuAppMaterialQueueRouteReportToJsonValue(webGpuAppMaterialQueueRouteReportShellToReport(shell));
}
export function webGpuAppMaterialQueueRouteReportToJson(report) {
    return JSON.stringify(webGpuAppMaterialQueueRouteReportToJsonValue(report));
}
export function unknownToWebGpuAppMaterialQueueRouteDiagnostics(diagnostic) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
        return [];
    }
    const candidate = diagnostic;
    if (typeof candidate.code !== "string") {
        return [];
    }
    return [
        {
            code: candidate.code,
            message: typeof candidate.message === "string" ? candidate.message : "",
            ...optionalUnknownSeverity(candidate.severity),
            ...optionalUnknownNumber("renderId", candidate.renderId),
            ...optionalUnknownNumber("drawIndex", candidate.drawIndex),
            ...optionalUnknownString("materialFamily", candidate.materialFamily),
            ...optionalUnknownString("materialKind", candidate.materialKind),
            ...optionalUnknownString("renderPhase", candidate.renderPhase),
            ...optionalUnknownBlendPreset(candidate.blendPreset),
            ...optionalUnknownEntity(candidate.entity),
        },
    ];
}
function routeItemKey(input) {
    return `${input.renderId}:${input.drawIndex}`;
}
function incrementBucket(buckets, key, routed) {
    let bucket = buckets.get(key);
    if (bucket === undefined) {
        bucket = {
            key,
            queuedCount: 0,
            routedCount: 0,
            skippedCount: 0,
        };
        buckets.set(key, bucket);
    }
    bucket.queuedCount += 1;
    if (routed) {
        bucket.routedCount += 1;
    }
    else {
        bucket.skippedCount += 1;
    }
}
function freezeBucket(bucket) {
    return { ...bucket };
}
function copyDiagnosticSummary(summary) {
    return {
        total: summary.total,
        bySeverity: { ...summary.bySeverity },
        byCode: { ...summary.byCode },
    };
}
function diagnosticSeverity(diagnostic) {
    return diagnostic.severity ?? "error";
}
function diagnosticToJsonValue(diagnostic) {
    return {
        code: diagnostic.code,
        message: diagnostic.message,
        ...optionalSeverity(diagnostic.severity),
        ...optionalNumber("renderId", diagnostic.renderId),
        ...optionalNumber("drawIndex", diagnostic.drawIndex),
        ...optionalString("materialFamily", diagnostic.materialFamily),
        ...optionalString("materialKind", diagnostic.materialKind),
        ...optionalString("renderPhase", diagnostic.renderPhase),
        ...optionalBlendPreset(diagnostic.blendPreset),
        ...optionalEntity(diagnostic.entity),
    };
}
function optionalSeverity(value) {
    return value === undefined ? {} : { severity: value };
}
function optionalNumber(key, value) {
    return value === undefined
        ? {}
        : { [key]: value };
}
function optionalString(key, value) {
    return value === undefined
        ? {}
        : { [key]: value };
}
function optionalBlendPreset(value) {
    return value === undefined ? {} : { blendPreset: value };
}
function optionalEntity(value) {
    return value === undefined
        ? {}
        : {
            entity: { ...value },
        };
}
function optionalUnknownSeverity(value) {
    return value === "info" || value === "warning" || value === "error"
        ? { severity: value }
        : {};
}
function optionalUnknownNumber(key, value) {
    return typeof value === "number" && Number.isFinite(value)
        ? { [key]: value }
        : {};
}
function optionalUnknownString(key, value) {
    return typeof value === "string"
        ? { [key]: value }
        : {};
}
function optionalUnknownBlendPreset(value) {
    return typeof value === "string" || value === null
        ? { blendPreset: value }
        : {};
}
function optionalUnknownEntity(value) {
    if (typeof value !== "object" || value === null) {
        return {};
    }
    const entity = value;
    return typeof entity.index === "number" &&
        Number.isFinite(entity.index) &&
        typeof entity.generation === "number" &&
        Number.isFinite(entity.generation)
        ? {
            entity: {
                index: entity.index,
                generation: entity.generation,
            },
        }
        : {};
}
function resetDiagnosticSummary(summary) {
    summary.total = 0;
    summary.bySeverity.info = 0;
    summary.bySeverity.warning = 0;
    summary.bySeverity.error = 0;
    for (const key of Object.keys(summary.byCode)) {
        delete summary.byCode[key];
    }
}
function writeDiagnosticSummary(diagnostics, summary) {
    resetDiagnosticSummary(summary);
    summary.total = diagnostics.length;
    for (const diagnostic of diagnostics) {
        const severity = diagnosticSeverity(diagnostic);
        summary.bySeverity[severity] += 1;
        summary.byCode[diagnostic.code] =
            (summary.byCode[diagnostic.code] ?? 0) + 1;
    }
}
//# sourceMappingURL=material-queue-route-report.js.map