import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createPreparedMaterialQueueResourceKeyResolver, createPreparedMeshQueueResourceKeyResolver, writeMaterialQueueFromSnapshot, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createQueuedMaterialAppResourceItem, createQueuedMaterialAppRouteReportDiagnostic, } from "./queued-material-app-resource-item.js";
import { routeQueuedMaterialPrepare } from "./queued-material-prepare-route.js";
import { createReusableRouteCollector, resetReusableRouteCollector, } from "./reusable-route-collector.js";
import { createWebGpuAppMaterialQueueRouteReportShell, unknownToWebGpuAppMaterialQueueRouteDiagnostics, } from "../../materials/core/material-queue-route-report.js";
import { indexQueuedSourceAssets, } from "./queued-source-assets.js";
import { queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic } from "./queued-material-prepare-route-diagnostics.js";
export function createQueuedBuiltInAppRouteCollectorScratch() {
    return {
        sourceMeshAssets: new Map(),
        sourceMaterialAssets: new Map(),
        routeCollector: createReusableRouteCollector(),
        routeReport: createWebGpuAppMaterialQueueRouteReportShell(),
    };
}
export function createSingleQueuedBuiltInAppResourceItem(options) {
    const adapter = options.adapters.get(options.material.kind);
    if (adapter === null || !adapter.isMaterialAsset(options.material)) {
        return null;
    }
    const sourceMeshKey = assetHandleKey(options.draw.mesh);
    const sourceMaterialKey = assetHandleKey(options.draw.material);
    const queueItem = {
        renderId: options.draw.renderId,
        drawIndex: options.drawIndex,
        entity: options.draw.entity,
        renderPhase: options.draw.sortKey.queue,
        materialFamily: adapter.kind,
        pipelineKey: options.draw.batchKey.pipelineKey,
        meshKey: sourceMeshKey,
        materialKey: sourceMaterialKey,
        meshResourceKey: options.meshKey,
        materialResourceKey: options.materialKey,
        meshLayoutKey: options.draw.batchKey.meshLayoutKey,
        topology: options.draw.batchKey.topology,
        depth: options.draw.sortKey.depth,
        sortKey: {
            renderPhase: options.draw.sortKey.queue,
            viewId: options.draw.sortKey.viewId,
            layer: options.draw.sortKey.layer,
            order: options.draw.sortKey.order,
            pipelineKey: options.draw.batchKey.pipelineKey,
            materialResourceKey: options.materialKey,
            meshResourceKey: options.meshKey,
            depth: options.draw.sortKey.depth,
            stableId: options.draw.sortKey.stableId,
            drawIndex: options.drawIndex,
        },
    };
    return {
        queueItem,
        prepareRoute: adapter.prepareRoute({
            queueItem,
            material: options.material,
            sourceVersion: options.materialVersion,
            frame: options.frame,
        }),
        adapter,
        draw: options.draw,
        mesh: options.mesh,
        meshKey: options.meshKey,
        sourceMeshKey,
        material: options.material,
        materialKey: options.materialKey,
        sourceMaterialKey,
    };
}
export function collectQueuedBuiltInAppResourceSet(options) {
    const meshAssets = options.routeScratch.sourceMeshAssets;
    const materialAssets = options.routeScratch.sourceMaterialAssets;
    const routeCollector = resetReusableRouteCollector(options.routeScratch.routeCollector);
    const resolvePreparedMeshResourceKey = createPreparedMeshQueueResourceKeyResolver(options.meshes);
    const resolvePreparedMaterialResourceKey = createPreparedMaterialQueueResourceKeyResolver(options.materials);
    indexQueuedSourceAssets(options.assets, options.snapshot, {
        meshAssets,
        materialAssets,
    });
    const queue = writeMaterialQueueFromSnapshot({ meshDraws: options.snapshot.meshDraws, diagnostics: [] }, {
        meshResourceKey: resolvePreparedMeshResourceKey,
        materialResourceKey: resolvePreparedMaterialResourceKey,
    }, options.materialQueueScratch);
    const diagnostics = routeCollector.diagnostics;
    const items = routeCollector.items;
    diagnostics.push(...queue.diagnostics);
    for (const queueItem of queue.items) {
        const draw = options.snapshot.meshDraws[queueItem.drawIndex];
        if (draw === undefined) {
            continue;
        }
        const mesh = meshAssets.get(queueItem.meshKey);
        const material = materialAssets.get(queueItem.materialKey);
        if (mesh === undefined || material === undefined) {
            continue;
        }
        const route = routeQueuedMaterialPrepare(options.adapters, {
            queueItem,
            material: material.asset,
            sourceVersion: material.sourceVersion,
            frame: options.snapshot.frame,
        });
        if (!route.valid) {
            diagnostics.push(...route.diagnostics.map((diagnostic) => queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(diagnostic, queueItem)));
            continue;
        }
        if (route.meshResourceKey === null || route.materialResourceKey === null) {
            continue;
        }
        const adapter = options.adapters.get(queueItem.materialFamily);
        if (adapter === null || !adapter.isMaterialAsset(material.asset)) {
            continue;
        }
        items.push(createQueuedMaterialAppResourceItem({
            queueItem,
            prepareRoute: route,
            adapter,
            draw,
            mesh: mesh.asset,
            meshKey: mesh.resourceKey,
            sourceMeshKey: queueItem.meshKey,
            material: material.asset,
            materialKey: material.resourceKey,
            sourceMaterialKey: queueItem.materialKey,
        }));
    }
    const routeDiagnostics = diagnostics.flatMap(unknownToWebGpuAppMaterialQueueRouteDiagnostics);
    const needsRouteReport = routeDiagnostics.length > 0 || items.length !== queue.items.length;
    const routeReport = needsRouteReport
        ? createWebGpuAppMaterialQueueRouteReportDiagnostic({
            queueItems: queue.items,
            routedItems: items,
            diagnostics: routeDiagnostics,
            shell: options.routeScratch.routeReport,
        })
        : null;
    const valid = routeReport?.report.valid ?? true;
    if (routeReport !== null) {
        diagnostics.push(routeReport);
    }
    return {
        valid,
        resourceSet: valid ? routeCollector.resourceSet : null,
        diagnostics,
    };
}
const createWebGpuAppMaterialQueueRouteReportDiagnostic = createQueuedMaterialAppRouteReportDiagnostic;
//# sourceMappingURL=queued-built-in-app-resource-set.js.map