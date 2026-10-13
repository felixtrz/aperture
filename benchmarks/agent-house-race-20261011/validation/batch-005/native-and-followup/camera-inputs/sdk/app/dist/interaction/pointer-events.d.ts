import type { EcsEntityRef } from "../config.js";
export type PointerInteractionEventType = "enter" | "leave" | "down" | "up" | "click" | "dragStart" | "drag" | "dragEnd";
export interface PointerInteractionEvent {
    readonly type: PointerInteractionEventType;
    readonly entity: EcsEntityRef;
    readonly position: readonly [number, number];
    /**
     * World-space picking point for this frame — the hit entity's bounding-box entry
     * point, refined to the triangle-mesh surface when the entity uses
     * `Pickable.precision: "visual-mesh"`.
     */
    readonly point?: readonly [number, number, number];
    /** World-space delta from the drag origin (drag / dragEnd only). */
    readonly delta?: readonly [number, number, number];
}
export interface PointerFrameInput {
    readonly position: readonly [number, number];
    readonly pressed: boolean;
    readonly time: number;
    /** The entity under the pointer this frame (null when nothing is hit). */
    readonly hitEntity: EcsEntityRef | null;
    /**
     * World-space point for this frame — the hit entity's bounding-box entry point,
     * refined to the mesh surface for `Pickable.precision: "visual-mesh"` entities.
     */
    readonly worldPoint: readonly [number, number, number] | null;
}
export interface PointerInteractionStateOptions {
    /** Normalized pointer-space movement that promotes a press into a drag. */
    readonly dragThreshold?: number;
}
export declare class PointerInteractionState {
    #private;
    constructor(options?: PointerInteractionStateOptions);
    get hoveredEntity(): EcsEntityRef | null;
    update(input: PointerFrameInput): PointerInteractionEvent[];
}
export declare function sameRef(a: EcsEntityRef | null, b: EcsEntityRef | null): boolean;
//# sourceMappingURL=pointer-events.d.ts.map