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
import type { BuiltInMaterialAsset } from "./built-in-material-queue-adapter.js";
import type { QueuedBuiltInAppResourceAdapter } from "./built-in-material-app-resource-adapter.js";
import type { QueuedMaterialAdapterRegistry } from "./queued-material-adapter.js";
import {
  createQueuedMaterialAppResourceItem,
  queuedMaterialAppResourceItemToRouteRoutedItem,
  type QueuedMaterialAppResourceItem,
  type QueuedMaterialAppResourceSet,
} from "./queued-material-app-resource-item.js";
import { routeQueuedMaterialPrepare } from "./queued-material-prepare-route.js";
import type { ReusableRouteCollector } from "./reusable-route-collector.js";
import {
  createReusableRouteCollector,
  resetReusableRouteCollector,
} from "./reusable-route-collector.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import {
  createWebGpuAppMaterialQueueRouteReportShell,
  webGpuAppMaterialQueueRouteReportShellToJsonValue,
  writeWebGpuAppMaterialQueueRouteReportShell,
  type WebGpuAppMaterialQueueRouteDiagnostic,
  type WebGpuAppMaterialQueueRouteDiagnosticSeverity,
  type WebGpuAppMaterialQueueRouteQueueItem,
  type WebGpuAppMaterialQueueRouteReportJsonValue,
  type WebGpuAppMaterialQueueRouteReportShell,
} from "./material-queue-route-report.js";

export type QueuedBuiltInAppResourceItem = QueuedMaterialAppResourceItem<
  BuiltInMaterialAsset,
  QueuedBuiltInMaterialAdapter
>;

export type QueuedBuiltInAppResourceSet =
  QueuedMaterialAppResourceSet<QueuedBuiltInAppResourceItem>;

export interface QueuedSourceMeshAsset {
  readonly asset: MeshAsset;
  readonly resourceKey: string;
}

export interface QueuedSourceMaterialAsset {
  readonly asset: MaterialAsset;
  readonly kind: string;
  readonly resourceKey: string;
  readonly sourceVersion: number;
}

export interface QueuedBuiltInAppRouteCollectorScratch {
  readonly sourceMeshAssets: Map<string, QueuedSourceMeshAsset>;
  readonly sourceMaterialAssets: Map<string, QueuedSourceMaterialAsset>;
  readonly routeCollector: ReusableRouteCollector<
    QueuedBuiltInAppResourceItem,
    unknown
  >;
  readonly routeReport: WebGpuAppMaterialQueueRouteReportShell;
}

export interface WebGpuAppUnsupportedMaterialQueueDiagnostic {
  readonly code:
    | "webGpuApp.unsupportedMaterialQueueFamily"
    | "webGpuApp.unsupportedMaterialQueuePhase"
    | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily"
    | "webGpuApp.unsupportedMaterialQueueTransparentFamily"
    | "webGpuApp.unsupportedMaterialQueueBlendPreset"
    | "webGpuApp.materialQueueAssetMismatch";
  readonly message: string;
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily?: string;
  readonly materialKind?: string;
  readonly renderPhase?: string;
  readonly blendPreset?: string | null;
  readonly entity?: MeshDrawPacket["entity"];
}

export interface WebGpuAppMaterialQueueRouteReportDiagnostic {
  readonly code: "webGpuApp.materialQueueRouteReport";
  readonly message: string;
  readonly report: WebGpuAppMaterialQueueRouteReportJsonValue;
}

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
          queuedPrepareRouteDiagnosticToAppDiagnostic(diagnostic, queueItem),
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

  const valid = diagnostics.length === 0 && items.length === queue.items.length;

  if (!valid) {
    diagnostics.push(
      createWebGpuAppMaterialQueueRouteReportDiagnostic({
        queueItems: queue.items,
        routedItems: items,
        diagnostics,
        shell: options.routeScratch.routeReport,
      }),
    );
  }

  return {
    valid,
    resourceSet: valid ? routeCollector.resourceSet : null,
    diagnostics,
  };
}

function indexQueuedSourceAssets(
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
  output: {
    readonly meshAssets: Map<string, QueuedSourceMeshAsset>;
    readonly materialAssets: Map<string, QueuedSourceMaterialAsset>;
  },
): void {
  output.meshAssets.clear();
  output.materialAssets.clear();

  for (const draw of snapshot.meshDraws) {
    const meshKey = assetHandleKey(draw.mesh);

    if (!output.meshAssets.has(meshKey)) {
      const meshEntry = assets.get<"mesh", MeshAsset>(draw.mesh);

      if (
        meshEntry !== undefined &&
        meshEntry.status === "ready" &&
        meshEntry.asset !== null
      ) {
        output.meshAssets.set(meshKey, {
          asset: meshEntry.asset,
          resourceKey: sourceAssetCacheKey(draw.mesh, meshEntry.version),
        });
      }
    }

    const materialKey = assetHandleKey(draw.material);

    if (output.materialAssets.has(materialKey)) {
      continue;
    }

    const materialEntry = assets.get<"material", MaterialAsset>(draw.material);
    const material = materialEntry?.asset ?? null;

    if (
      materialEntry === undefined ||
      materialEntry.status !== "ready" ||
      material === null
    ) {
      continue;
    }

    output.materialAssets.set(materialKey, {
      asset: material,
      kind: material.kind,
      resourceKey: sourceAssetCacheKey(draw.material, materialEntry.version),
      sourceVersion: materialEntry.version,
    });
  }
}

function createWebGpuAppMaterialQueueRouteReportDiagnostic(input: {
  readonly queueItems: readonly MaterialQueueItem[];
  readonly routedItems: readonly QueuedBuiltInAppResourceItem[];
  readonly diagnostics: readonly unknown[];
  readonly shell: WebGpuAppMaterialQueueRouteReportShell;
}): WebGpuAppMaterialQueueRouteReportDiagnostic {
  writeWebGpuAppMaterialQueueRouteReportShell(
    {
      queueItems: input.queueItems.map(materialQueueItemToRouteQueueItem),
      routedItems: input.routedItems.map(
        queuedMaterialAppResourceItemToRouteRoutedItem,
      ),
      diagnostics: input.diagnostics.flatMap(unknownToRouteDiagnostic),
    },
    input.shell,
  );

  return {
    code: "webGpuApp.materialQueueRouteReport",
    message: "WebGPU app material queue routing failed.",
    report: webGpuAppMaterialQueueRouteReportShellToJsonValue(input.shell),
  };
}

function materialQueueItemToRouteQueueItem(
  item: MaterialQueueItem,
): WebGpuAppMaterialQueueRouteQueueItem {
  return {
    renderId: item.renderId,
    drawIndex: item.drawIndex,
    materialFamily: item.materialFamily,
    renderPhase: item.renderPhase,
    entity: item.entity,
  };
}

function queuedPrepareRouteDiagnosticToAppDiagnostic(
  diagnostic: unknown,
  queueItem: MaterialQueueItem,
): unknown {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return diagnostic;
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly materialKind?: unknown;
  };

  if (candidate.code === "queuedMaterialPrepareRoute.missingAdapter") {
    return {
      code: "webGpuApp.unsupportedMaterialQueueFamily",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      materialFamily: queueItem.materialFamily,
      entity: queueItem.entity,
      message: `WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not '${queueItem.materialFamily}'.`,
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
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
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
  }

  return diagnostic;
}

function unknownToRouteDiagnostic(
  diagnostic: unknown,
): WebGpuAppMaterialQueueRouteDiagnostic[] {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return [];
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly severity?: unknown;
    readonly renderId?: unknown;
    readonly drawIndex?: unknown;
    readonly materialFamily?: unknown;
    readonly materialKind?: unknown;
    readonly renderPhase?: unknown;
    readonly blendPreset?: unknown;
    readonly entity?: unknown;
  };

  if (typeof candidate.code !== "string") {
    return [];
  }

  return [
    {
      code: candidate.code,
      message: typeof candidate.message === "string" ? candidate.message : "",
      ...optionalRouteSeverity(candidate.severity),
      ...optionalNumber("renderId", candidate.renderId),
      ...optionalNumber("drawIndex", candidate.drawIndex),
      ...optionalString("materialFamily", candidate.materialFamily),
      ...optionalString("materialKind", candidate.materialKind),
      ...optionalString("renderPhase", candidate.renderPhase),
      ...optionalBlendPreset(candidate.blendPreset),
      ...optionalRouteEntity(candidate.entity),
    },
  ];
}

function optionalRouteSeverity(value: unknown): {
  readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity;
} {
  return value === "info" || value === "warning" || value === "error"
    ? { severity: value }
    : {};
}

function optionalNumber<Key extends "renderId" | "drawIndex">(
  key: Key,
  value: unknown,
): { readonly [Property in Key]?: number } {
  return typeof value === "number" && Number.isFinite(value)
    ? ({ [key]: value } as { readonly [Property in Key]?: number })
    : {};
}

function optionalString<
  Key extends "materialFamily" | "materialKind" | "renderPhase",
>(key: Key, value: unknown): { readonly [Property in Key]?: string } {
  return typeof value === "string"
    ? ({ [key]: value } as { readonly [Property in Key]?: string })
    : {};
}

function optionalBlendPreset(value: unknown): {
  readonly blendPreset?: string | null;
} {
  return typeof value === "string" || value === null
    ? { blendPreset: value }
    : {};
}

function optionalRouteEntity(value: unknown): {
  readonly entity?: NonNullable<
    WebGpuAppMaterialQueueRouteDiagnostic["entity"]
  >;
} {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entity = value as {
    readonly index?: unknown;
    readonly generation?: unknown;
  };

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
