import { type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { SpawnCommands } from "../systems/spawn/types.js";
import type { HierarchyAccess } from "../systems/hierarchy.js";
import type { CameraAccess } from "../systems/cameras.js";
import type { InteractionAccess } from "../interaction/access.js";
/** The subset of the system context the gizmo needs (ApertureSystemContext satisfies it). */
export interface TranslateGizmoContext {
    readonly world: EcsWorld;
    readonly spawn: Pick<SpawnCommands, "mesh">;
    readonly hierarchy: Pick<HierarchyAccess, "setParent">;
    readonly interaction: Pick<InteractionAccess, "onDrag">;
    readonly cameras: Pick<CameraAccess, "main">;
}
export interface TranslateGizmoOptions {
    /** The entity the gizmo translates (its LocalTransform translation is written). */
    readonly target: EcsEntityRef;
    /** Handle length along its axis. */
    readonly size?: number;
    /** Handle cross-section thickness. */
    readonly thickness?: number;
    /** Pickable layer mask for the handles (so callers can exclude them). */
    readonly layerMask?: number;
    /** Tag applied to each handle entity. */
    readonly tag?: string;
}
export interface TranslateGizmoHandles {
    readonly x: EcsEntityRef;
    readonly y: EcsEntityRef;
    readonly z: EcsEntityRef;
}
export interface TranslateGizmo {
    readonly target: EcsEntityRef;
    readonly handles: TranslateGizmoHandles;
    /**
     * Re-align the axis handles to the WORLD axes at the target's current world
     * position, so a rotated/scaled target keeps a world-aligned gizmo (the handles
     * are children of the target and would otherwise inherit its rotation, making the
     * visible handle disagree with the world-axis drag). Call once per frame after
     * the target moves; it is a no-op for an unrotated, unit-scale target.
     */
    sync(world: EcsWorld): void;
    /** Unsubscribe the drag handlers and destroy the handle entities. */
    dispose(): void;
}
export declare function createTranslateGizmo(context: TranslateGizmoContext, options: TranslateGizmoOptions): TranslateGizmo;
//# sourceMappingURL=translate-gizmo.d.ts.map