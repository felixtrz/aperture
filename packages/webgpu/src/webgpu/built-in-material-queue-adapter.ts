import type {
  DebugNormalMaterialAsset,
  MaterialAsset,
  MaterialQueueItem,
  MatcapMaterialAsset,
  StandardMaterialAsset,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  BUILT_IN_MATERIAL_QUEUE_FAMILIES,
  type BuiltInMaterialQueueFamily,
} from "./built-in-material-queue-family.js";
import {
  createUnsupportedBuiltInMaterialQueuePhaseDiagnostic,
  type BuiltInMaterialQueuePhaseDiagnostic,
} from "./built-in-material-queue-phase.js";
import {
  createQueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistration,
  type QueuedMaterialAdapterRegistry,
} from "./queued-material-adapter.js";
import {
  createQueuedMaterialPrepareRouteResult,
  type QueuedMaterialPrepareRouteAdapter,
} from "./queued-material-prepare-route.js";

export type BuiltInMaterialAsset =
  | UnlitMaterialAsset
  | MatcapMaterialAsset
  | StandardMaterialAsset
  | DebugNormalMaterialAsset;

export interface BuiltInMaterialQueueRouteAdapter
  extends
    QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily>,
    QueuedMaterialPrepareRouteAdapter<
      BuiltInMaterialQueueFamily,
      BuiltInMaterialAsset,
      BuiltInMaterialQueuePhaseDiagnostic
    > {
  readonly kind: BuiltInMaterialQueueFamily;
  isMaterialAsset(material: MaterialAsset): material is BuiltInMaterialAsset;
  validateQueueItem(
    queueItem: MaterialQueueItem,
  ): BuiltInMaterialQueuePhaseDiagnostic | null;
}

export function createBuiltInMaterialQueueRouteAdapterRegistry(
  adapters: readonly BuiltInMaterialQueueRouteAdapter[] = createBuiltInMaterialQueueRouteAdapters(),
): QueuedMaterialAdapterRegistry<BuiltInMaterialQueueRouteAdapter> {
  return createQueuedMaterialAdapterRegistry<BuiltInMaterialQueueRouteAdapter>(
    adapters,
  );
}

export function createBuiltInMaterialQueueRouteAdapters(): readonly BuiltInMaterialQueueRouteAdapter[] {
  return BUILT_IN_MATERIAL_QUEUE_FAMILIES.map((family) => ({
    kind: family,
    isMaterialAsset: (material): material is BuiltInMaterialAsset =>
      material.kind === family,
    acceptsMaterial: (material): material is BuiltInMaterialAsset =>
      material.kind === family,
    validateQueueItem: createUnsupportedBuiltInMaterialQueuePhaseDiagnostic,
    prepareRoute: (context) => createQueuedMaterialPrepareRouteResult(context),
  }));
}
