import type { Entity } from "@aperture-engine/simulation";
import type { SpatialPickableState, SpatialRaycastOptions } from "./types.js";

export function spatialEntryMatches(
  entry: {
    readonly layerMask?: number;
    readonly visible?: boolean;
    readonly pickable?: SpatialPickableState;
  },
  entity: Entity,
  options: SpatialRaycastOptions,
  sourceKind: "bounds" | "mesh",
): boolean {
  if (entry.visible === false || options.filter?.(entity) === false) {
    return false;
  }

  if (entry.pickable?.enabled === false) {
    return false;
  }

  if (
    sourceKind === "mesh" &&
    entry.pickable?.precision !== undefined &&
    entry.pickable.precision !== "visual-mesh"
  ) {
    return false;
  }

  return (
    spatialLayerMatches(entry.layerMask, options.layerMask) &&
    (entry.pickable?.layerMask === undefined ||
      spatialLayerMatches(entry.pickable.layerMask, options.layerMask))
  );
}

function spatialLayerMatches(
  objectLayerMask: number | undefined,
  queryLayerMask: number | undefined,
): boolean {
  return (
    (((objectLayerMask ?? 0x00000001) >>> 0) &
      ((queryLayerMask ?? 0xffffffff) >>> 0)) !==
    0
  );
}
