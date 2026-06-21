export function routeQueuedMaterialPrepare(registry, context) {
    const adapter = registry.get(context.queueItem.materialFamily);
    if (adapter === null) {
        return createQueuedMaterialPrepareRouteFailure(context, {
            status: "skipped",
            diagnostics: [missingAdapterDiagnostic(context)],
        });
    }
    if (!adapter.acceptsMaterial(context.material)) {
        return createQueuedMaterialPrepareRouteFailure(context, {
            status: "failed",
            diagnostics: [materialMismatchDiagnostic(context)],
        });
    }
    const routeDiagnostic = adapter.validateQueueItem(context.queueItem);
    if (routeDiagnostic !== null) {
        return createQueuedMaterialPrepareRouteFailure(context, {
            status: "failed",
            diagnostics: [
                routeDiagnostic,
            ],
        });
    }
    return adapter.prepareRoute(context);
}
export function createQueuedMaterialPrepareRouteResult(context, options = {}) {
    return {
        valid: options.valid ?? true,
        status: options.status ?? "prepared",
        family: context.queueItem.materialFamily,
        materialKey: context.queueItem.materialKey,
        meshResourceKey: context.queueItem.meshResourceKey,
        materialResourceKey: context.queueItem.materialResourceKey,
        pipelineKey: context.queueItem.pipelineKey,
        sourceVersion: context.sourceVersion,
        frame: context.frame,
        diagnostics: options.diagnostics ?? [],
    };
}
function createQueuedMaterialPrepareRouteFailure(context, options) {
    return createQueuedMaterialPrepareRouteResult(context, {
        valid: false,
        status: options.status,
        diagnostics: options.diagnostics,
    });
}
function missingAdapterDiagnostic(context) {
    const materialKind = readQueuedMaterialKind(context.material);
    return {
        code: "queuedMaterialPrepareRoute.missingAdapter",
        renderId: context.queueItem.renderId,
        drawIndex: context.queueItem.drawIndex,
        materialFamily: context.queueItem.materialFamily,
        ...(materialKind === undefined ? {} : { materialKind }),
        materialKey: context.queueItem.materialKey,
        entity: context.queueItem.entity,
        message: `No queued material prepare route adapter is registered for material family '${context.queueItem.materialFamily}'.`,
    };
}
function materialMismatchDiagnostic(context) {
    const materialKind = readQueuedMaterialKind(context.material);
    return {
        code: "queuedMaterialPrepareRoute.materialMismatch",
        renderId: context.queueItem.renderId,
        drawIndex: context.queueItem.drawIndex,
        materialFamily: context.queueItem.materialFamily,
        ...(materialKind === undefined ? {} : { materialKind }),
        materialKey: context.queueItem.materialKey,
        entity: context.queueItem.entity,
        message: materialKind === undefined
            ? `Queued material family '${context.queueItem.materialFamily}' does not match source material.`
            : `Queued material family '${context.queueItem.materialFamily}' does not match source material kind '${materialKind}'.`,
    };
}
function readQueuedMaterialKind(material) {
    return typeof material === "object" &&
        material !== null &&
        "kind" in material &&
        typeof material.kind === "string"
        ? material.kind
        : undefined;
}
//# sourceMappingURL=queued-material-prepare-route.js.map