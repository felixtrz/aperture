import type {
  MaterialQueueItem,
  MeshAsset,
  MeshDrawPacket,
} from "@aperture-engine/render";
import type { QueuedMaterialAdapterRegistration } from "./queued-material-adapter.js";
import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";

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
