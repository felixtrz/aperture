import type {
  MaterialQueueItem,
  MeshAsset,
  MeshDrawPacket,
} from "@aperture-engine/render";
import type { QueuedMaterialAdapterRegistration } from "./queued-material-adapter.js";
import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";
import {
  webGpuAppMaterialQueueRouteReportShellToJsonValue,
  writeWebGpuAppMaterialQueueRouteReportShell,
  type WebGpuAppMaterialQueueRouteDiagnostic,
  type WebGpuAppMaterialQueueRouteQueueItem,
  type WebGpuAppMaterialQueueRouteReportJsonValue,
  type WebGpuAppMaterialQueueRouteReportShell,
  type WebGpuAppMaterialQueueRouteRoutedItem,
} from "./material-queue-route-report.js";

export interface QueuedMaterialAppResourceItem<
  TMaterial = unknown,
  TAdapter extends QueuedMaterialAdapterRegistration =
    QueuedMaterialAdapterRegistration,
> {
  readonly queueItem: MaterialQueueItem;
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly adapter: TAdapter;
  readonly draw: MeshDrawPacket;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly sourceMeshKey: string;
  readonly material: TMaterial;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
}

export interface QueuedMaterialAppResourceSet<
  TItem extends QueuedMaterialAppResourceItem = QueuedMaterialAppResourceItem,
> {
  readonly items: readonly TItem[];
}

export interface QueuedMaterialAppRouteReportDiagnostic {
  readonly code: "webGpuApp.materialQueueRouteReport";
  readonly message: string;
  readonly report: WebGpuAppMaterialQueueRouteReportJsonValue;
}

export interface CreateQueuedMaterialAppResourceItemOptions<
  TMaterial,
  TAdapter extends QueuedMaterialAdapterRegistration,
> {
  readonly queueItem: MaterialQueueItem;
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly adapter: TAdapter;
  readonly draw: MeshDrawPacket;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly sourceMeshKey: string;
  readonly material: TMaterial;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
}

export function createQueuedMaterialAppResourceItem<
  TMaterial,
  TAdapter extends QueuedMaterialAdapterRegistration,
>(
  options: CreateQueuedMaterialAppResourceItemOptions<TMaterial, TAdapter>,
): QueuedMaterialAppResourceItem<TMaterial, TAdapter> {
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

export function queuedMaterialAppResourceItemToRouteRoutedItem(
  item: QueuedMaterialAppResourceItem,
): WebGpuAppMaterialQueueRouteRoutedItem {
  return {
    renderId: item.queueItem.renderId,
    drawIndex: item.queueItem.drawIndex,
    materialFamily: item.queueItem.materialFamily,
    renderPhase: item.queueItem.renderPhase,
  };
}

export function materialQueueItemToRouteQueueItem(
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

export function createQueuedMaterialAppRouteReportDiagnostic(input: {
  readonly queueItems: readonly MaterialQueueItem[];
  readonly routedItems: readonly QueuedMaterialAppResourceItem[];
  readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
  readonly shell: WebGpuAppMaterialQueueRouteReportShell;
}): QueuedMaterialAppRouteReportDiagnostic {
  writeWebGpuAppMaterialQueueRouteReportShell(
    {
      queueItems: input.queueItems.map(materialQueueItemToRouteQueueItem),
      routedItems: input.routedItems.map(
        queuedMaterialAppResourceItemToRouteRoutedItem,
      ),
      diagnostics: input.diagnostics,
    },
    input.shell,
  );

  return {
    code: "webGpuApp.materialQueueRouteReport",
    message: "WebGPU app material queue routing failed.",
    report: webGpuAppMaterialQueueRouteReportShellToJsonValue(input.shell),
  };
}
