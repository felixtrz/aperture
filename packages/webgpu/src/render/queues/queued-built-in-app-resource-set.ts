import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  createPreparedMaterialQueueResourceKeyResolver,
  createPreparedMeshQueueResourceKeyResolver,
  writeMaterialQueueFromSnapshot,
  type MaterialAsset,
  type MaterialQueueItem,
  type MaterialQueueScratch,
  type MeshAsset,
  type MeshDrawPacket,
  type PreparedMaterialStore,
  type PreparedMeshStore,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { BuiltInMaterialAsset } from "../../materials/core/built-in-material-queue-adapter.js";
import type { QueuedBuiltInAppResourceAdapter } from "../../materials/core/built-in-material-app-resource-adapter.js";
import type { QueuedMaterialAdapterRegistry } from "./queued-material-adapter.js";
import {
  createQueuedMaterialAppResourceItem,
  createQueuedMaterialAppRouteReportDiagnostic,
  type QueuedMaterialAppRouteReportDiagnostic,
  type QueuedMaterialAppResourceItem,
  type QueuedMaterialAppResourceSet,
} from "./queued-material-app-resource-item.js";
import { routeQueuedMaterialPrepare } from "./queued-material-prepare-route.js";
import type { ReusableRouteCollector } from "./reusable-route-collector.js";
import {
  createReusableRouteCollector,
  resetReusableRouteCollector,
} from "./reusable-route-collector.js";
import {
  createWebGpuAppMaterialQueueRouteReportShell,
  unknownToWebGpuAppMaterialQueueRouteDiagnostics,
  type WebGpuAppMaterialQueueRouteReportShell,
} from "../../materials/core/material-queue-route-report.js";
import {
  indexQueuedSourceAssets,
  type QueuedSourceMaterialAsset,
  type QueuedSourceMeshAsset,
} from "./queued-source-assets.js";
import { queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic } from "./queued-material-prepare-route-diagnostics.js";
export type { WebGpuAppUnsupportedMaterialQueueDiagnostic } from "./queued-material-prepare-route-diagnostics.js";

export type QueuedBuiltInAppResourceItem = QueuedMaterialAppResourceItem<
  BuiltInMaterialAsset,
  QueuedBuiltInMaterialAdapter
>;

export type QueuedBuiltInAppResourceSet =
  QueuedMaterialAppResourceSet<QueuedBuiltInAppResourceItem>;

export interface QueuedBuiltInAppRouteCollectorScratch {
  readonly sourceMeshAssets: Map<string, QueuedSourceMeshAsset>;
  readonly sourceMaterialAssets: Map<string, QueuedSourceMaterialAsset>;
  readonly routeCollector: ReusableRouteCollector<
    QueuedBuiltInAppResourceItem,
    unknown
  >;
  readonly routeReport: WebGpuAppMaterialQueueRouteReportShell;
}

export type WebGpuAppMaterialQueueRouteReportDiagnostic =
  QueuedMaterialAppRouteReportDiagnostic;

export type QueuedBuiltInMaterialAdapter = QueuedBuiltInAppResourceAdapter<
  unknown,
  unknown
>;

export interface CollectQueuedBuiltInAppResourceSetOptions {
  readonly assets: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly materialQueueScratch: MaterialQueueScratch;
  readonly routeScratch: QueuedBuiltInAppRouteCollectorScratch;
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
  readonly adapters: QueuedMaterialAdapterRegistry<QueuedBuiltInMaterialAdapter>;
}

export interface CollectQueuedBuiltInAppResourceSetResult {
  readonly valid: boolean;
  readonly resourceSet: QueuedBuiltInAppResourceSet | null;
  readonly diagnostics: readonly unknown[];
}

export function createQueuedBuiltInAppRouteCollectorScratch(): QueuedBuiltInAppRouteCollectorScratch {
  return {
    sourceMeshAssets: new Map(),
    sourceMaterialAssets: new Map(),
    routeCollector: createReusableRouteCollector<
      QueuedBuiltInAppResourceItem,
      unknown
    >(),
    routeReport: createWebGpuAppMaterialQueueRouteReportShell(),
  };
}

export function createSingleQueuedBuiltInAppResourceItem(options: {
  readonly adapters: QueuedMaterialAdapterRegistry<QueuedBuiltInMaterialAdapter>;
  readonly draw: MeshDrawPacket;
  readonly drawIndex: number;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly material: MaterialAsset;
  readonly materialKey: string;
  readonly materialVersion: number;
  readonly frame: number;
}): QueuedBuiltInAppResourceItem | null {
  const adapter = options.adapters.get(options.material.kind);

  if (adapter === null || !adapter.isMaterialAsset(options.material)) {
    return null;
  }

  const sourceMeshKey = assetHandleKey(options.draw.mesh);
  const sourceMaterialKey = assetHandleKey(options.draw.material);
  const queueItem: MaterialQueueItem = {
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
      material: options.material as BuiltInMaterialAsset,
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

export function collectQueuedBuiltInAppResourceSet(
  options: CollectQueuedBuiltInAppResourceSetOptions,
): CollectQueuedBuiltInAppResourceSetResult {
  const meshAssets = options.routeScratch.sourceMeshAssets;
  const materialAssets = options.routeScratch.sourceMaterialAssets;
  const routeCollector = resetReusableRouteCollector(
    options.routeScratch.routeCollector,
  );
  const resolvePreparedMeshResourceKey =
    createPreparedMeshQueueResourceKeyResolver(options.meshes);
  const resolvePreparedMaterialResourceKey =
    createPreparedMaterialQueueResourceKeyResolver(options.materials);

  indexQueuedSourceAssets(options.assets, options.snapshot, {
    meshAssets,
    materialAssets,
  });

  const queue = writeMaterialQueueFromSnapshot(
    { meshDraws: options.snapshot.meshDraws, diagnostics: [] },
    {
      meshResourceKey: resolvePreparedMeshResourceKey,
      materialResourceKey: resolvePreparedMaterialResourceKey,
    },
    options.materialQueueScratch,
  );
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
      diagnostics.push(
        ...route.diagnostics.map((diagnostic) =>
          queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
            diagnostic,
            queueItem,
          ),
        ),
      );
      continue;
    }

    if (route.meshResourceKey === null || route.materialResourceKey === null) {
      continue;
    }

    const adapter = options.adapters.get(queueItem.materialFamily);

    if (adapter === null || !adapter.isMaterialAsset(material.asset)) {
      continue;
    }

    items.push(
      createQueuedMaterialAppResourceItem({
        queueItem,
        prepareRoute: route,
        adapter,
        draw,
        mesh: mesh.asset,
        meshKey: mesh.resourceKey,
        sourceMeshKey: queueItem.meshKey,
        material: material.asset as BuiltInMaterialAsset,
        materialKey: material.resourceKey,
        sourceMaterialKey: queueItem.materialKey,
      }),
    );
  }

  const routeDiagnostics = diagnostics.flatMap(
    unknownToWebGpuAppMaterialQueueRouteDiagnostics,
  );
  const needsRouteReport =
    routeDiagnostics.length > 0 || items.length !== queue.items.length;
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

const createWebGpuAppMaterialQueueRouteReportDiagnostic =
  createQueuedMaterialAppRouteReportDiagnostic;
