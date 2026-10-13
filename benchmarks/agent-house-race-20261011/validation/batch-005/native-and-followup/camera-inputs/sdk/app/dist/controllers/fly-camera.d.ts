import { type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
export interface FlyCameraControllerOptions {
    /** The camera entity whose LocalTransform the controller writes. */
    readonly camera: EcsEntityRef;
    readonly position?: readonly [number, number, number];
    /** Initial yaw (radians around world +Y; 0 looks down -Z). */
    readonly yaw?: number;
    /** Initial pitch (radians; positive looks up; clamped to ±(π/2 − ε)). */
    readonly pitch?: number;
    readonly minPitch?: number;
    readonly maxPitch?: number;
    /** Radians of look per 1.0 of normalized pointer travel. */
    readonly lookSpeed?: number;
}
export interface FlyCameraController {
    readonly yaw: number;
    readonly pitch: number;
    readonly position: readonly [number, number, number];
    /** Add to yaw (unclamped, wraps naturally) + pitch (clamped). */
    look(deltaYaw: number, deltaPitch: number): void;
    /** Map a normalized pointer drag delta to a look rotation (drag up looks up). */
    lookFromDrag(deltaX: number, deltaY: number): void;
    /** Unit forward direction implied by the current yaw/pitch. */
    forward(): [number, number, number];
    /** Unit rightward direction (horizontal, perpendicular to forward). */
    right(): [number, number, number];
    /**
     * Translate the eye: `forwardAmount` along forward() (pitched), `rightAmount`
     * along right(), `upAmount` along world +Y.
     */
    move(forwardAmount: number, rightAmount: number, upAmount: number): void;
    /**
     * Write the camera's LocalTransform (translation = eye, rotation looks along
     * forward()). Returns false if the camera ref no longer resolves.
     */
    applyTo(world: EcsWorld): boolean;
}
export declare function createFlyCameraController(options: FlyCameraControllerOptions): FlyCameraController;
//# sourceMappingURL=fly-camera.d.ts.map