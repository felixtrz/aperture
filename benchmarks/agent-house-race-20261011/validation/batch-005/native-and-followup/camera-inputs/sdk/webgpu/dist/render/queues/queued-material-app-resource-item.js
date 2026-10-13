import { webGpuAppMaterialQueueRouteReportShellToJsonValue, writeWebGpuAppMaterialQueueRouteReportShell, } from "../../materials/core/material-queue-route-report.js";
export function createQueuedMaterialAppResourceItem(options) {
    return {
        queueItem: options.queueItem,
        prepareRoute: options.prepareRoute,
        adapter: options.adapter,
        draw: options.draw,
        mesh: options.mesh,
        meshKey: options.meshKey,
        sourceMeshKey: options.sourceMeshKey,
        material: options.material,
        materialKey: options.materialKey,
        sourceMaterialKey: options.sourceMaterialKey,
    };
}
export function queuedMaterialAppResourceItemToRouteRoutedItem(item) {
    return {
        renderId: item.queueItem.renderId,
        drawIndex: item.queueItem.drawIndex,
        materialFamily: item.queueItem.materialFamily,
        renderPhase: item.queueItem.renderPhase,
    };
}
export function queuedMaterialAppResourceItemToJsonValue(item) {
    return {
        renderId: item.queueItem.renderId,
        drawIndex: item.queueItem.drawIndex,
        materialFamily: item.queueItem.materialFamily,
        renderPhase: item.queueItem.renderPhase,
        pipelineKey: item.queueItem.pipelineKey,
        meshKey: item.meshKey,
        sourceMeshKey: item.sourceMeshKey,
        materialKey: item.materialKey,
        sourceMaterialKey: item.sourceMaterialKey,
        meshResourceKey: item.meshKey,
        materialResourceKey: item.materialKey,
    };
}
export function materialQueueItemToRouteQueueItem(item) {
    return {
        renderId: item.renderId,
        drawIndex: item.drawIndex,
        materialFamily: item.materialFamily,
        renderPhase: item.renderPhase,
        entity: item.entity,
    };
}
export function createQueuedMaterialAppRouteReportDiagnostic(input) {
    writeWebGpuAppMaterialQueueRouteReportShell({
        queueItems: input.queueItems.map(materialQueueItemToRouteQueueItem),
        routedItems: input.routedItems.map(queuedMaterialAppResourceItemToRouteRoutedItem),
        diagnostics: input.diagnostics,
    }, input.shell);
    const report = webGpuAppMaterialQueueRouteReportShellToJsonValue(input.shell);
    return {
        code: "webGpuApp.materialQueueRouteReport",
        message: report.valid
            ? "WebGPU app material queue routing reported diagnostics."
            : "WebGPU app material queue routing failed.",
        routedItems: input.routedItems.map(queuedMaterialAppResourceItemToJsonValue),
        report,
    };
}
//# sourceMappingURL=queued-material-app-resource-item.js.map