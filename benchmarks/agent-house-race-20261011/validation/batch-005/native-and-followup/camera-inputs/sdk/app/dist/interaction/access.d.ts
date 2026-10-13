import type { EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { type PointerFrameInput, type PointerInteractionEvent, type PointerInteractionStateOptions } from "./pointer-events.js";
export type InteractionFilter = EcsEntityRef | {
    readonly tag: string;
} | ((entity: EcsEntityRef) => boolean);
export type InteractionCallback = (event: PointerInteractionEvent) => void;
export type InteractionUnsubscribe = () => void;
export interface InteractionAccess {
    onEnter(callback: InteractionCallback): InteractionUnsubscribe;
    onEnter(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    onLeave(callback: InteractionCallback): InteractionUnsubscribe;
    onLeave(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    onDown(callback: InteractionCallback): InteractionUnsubscribe;
    onDown(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    onUp(callback: InteractionCallback): InteractionUnsubscribe;
    onUp(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    onClick(callback: InteractionCallback): InteractionUnsubscribe;
    onClick(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    /** Fires for dragStart / drag / dragEnd (discriminate via `event.type`). */
    onDrag(callback: InteractionCallback): InteractionUnsubscribe;
    onDrag(filter: InteractionFilter, callback: InteractionCallback): InteractionUnsubscribe;
    /** The entity currently under the pointer (null when nothing is hit). */
    hoveredEntity(): EcsEntityRef | null;
    /**
     * Restrict the built-in per-frame interaction pick (runInteractionFrame) to a
     * spatial layer mask — e.g. to exclude a gizmo/overlay layer from the scene
     * interaction. `null` (the default) picks across all layers. NOTE: the gizmo's
     * own handles must remain on a layer this mask includes for their drag events
     * to fire; exclude the gizmo layer only when the app drives the gizmo itself.
     */
    setPickLayerMask(layerMask: number | null): void;
}
export interface InteractionRuntime extends InteractionAccess {
    processFrame(input: PointerFrameInput): readonly PointerInteractionEvent[];
    /** The layer mask the interaction driver should apply to its scene pick. */
    readonly pickLayerMask: number | null;
}
export declare function createInteractionAccess(world: EcsWorld, options?: PointerInteractionStateOptions): InteractionRuntime;
//# sourceMappingURL=access.d.ts.map