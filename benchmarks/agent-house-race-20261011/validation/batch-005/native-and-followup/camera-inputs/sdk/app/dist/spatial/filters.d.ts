import type { Entity } from "@aperture-engine/simulation";
import type { SpatialPickableState, SpatialRaycastOptions } from "./types.js";
export declare function spatialEntryMatches(entry: {
    readonly layerMask?: number;
    readonly visible?: boolean;
    readonly pickable?: SpatialPickableState;
}, entity: Entity, options: SpatialRaycastOptions, sourceKind: "bounds" | "mesh"): boolean;
//# sourceMappingURL=filters.d.ts.map