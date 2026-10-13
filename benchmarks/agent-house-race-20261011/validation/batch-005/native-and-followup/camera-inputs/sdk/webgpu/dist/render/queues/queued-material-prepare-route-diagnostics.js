export function queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(diagnostic, queueItem) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
        return diagnostic;
    }
    const candidate = diagnostic;
    if (candidate.code === "queuedMaterialPrepareRoute.missingAdapter") {
        return {
            code: "webGpuApp.unsupportedMaterialQueueFamily",
            renderId: queueItem.renderId,
            drawIndex: queueItem.drawIndex,
            materialFamily: queueItem.materialFamily,
            entity: queueItem.entity,
            message: `WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not '${queueItem.materialFamily}'.`,
        };
    }
    if (candidate.code === "queuedMaterialPrepareRoute.materialMismatch") {
        return {
            code: "webGpuApp.materialQueueAssetMismatch",
            renderId: queueItem.renderId,
            drawIndex: queueItem.drawIndex,
            materialFamily: queueItem.materialFamily,
            ...optionalString("materialKind", candidate.materialKind),
            entity: queueItem.entity,
            message: `Render object ${queueItem.renderId} pipeline family '${queueItem.materialFamily}' does not match material asset kind '${String(candidate.materialKind)}'.`,
        };
    }
    return diagnostic;
}
function optionalString(key, value) {
    return typeof value === "string"
        ? { [key]: value }
        : {};
}
//# sourceMappingURL=queued-material-prepare-route-diagnostics.js.map