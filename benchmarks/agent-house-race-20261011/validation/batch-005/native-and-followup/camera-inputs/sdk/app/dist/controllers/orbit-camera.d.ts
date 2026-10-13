import { type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
export interface OrbitCameraControllerOptions {
    /** The camera entity whose LocalTransform the controller writes. */
    readonly camera: EcsEntityRef;
    /** World-space point the camera orbits and looks at. */
    readonly target?: readonly [number, number, number];
    readonly distance?: number;
    /** Initial azimuth (radians, around world +Y; 0 places the camera on +Z). */
    readonly azimuth?: number;
    /** Initial elevation (radians above the horizon; clamped to ±(π/2 − ε)). */
    readonly elevation?: number;
    readonly minElevation?: number;
    readonly maxElevation?: number;
    readonly minDistance?: number;
    readonly maxDistance?: number;
    /** Radians of orbit per 1.0 of normalized pointer travel. */
    readonly rotateSpeed?: number;
    /** Distance change per 1.0 of wheel travel. */
    readonly zoomSpeed?: number;
}
export interface OrbitCameraController {
    readonly azimuth: number;
    readonly elevation: number;
    readonly distance: number;
    readonly target: readonly [number, number, number];
    /** Add to azimuth (unclamped, wraps naturally) + elevation (clamped). */
    rotate(deltaAzimuth: number, deltaElevation: number): void;
    /** Add to the orbit distance, clamped to [minDistance, maxDistance]. */
    zoom(deltaDistance: number): void;
    /** Map a normalized pointer drag delta to an orbit rotation. */
    orbitFromDrag(deltaX: number, deltaY: number): void;
    /** Map a wheel delta to a zoom (positive delta = zoom out / increase distance). */
    zoomFromWheel(delta: number): void;
    /** The camera eye position implied by the current orbit state. */
    eyePosition(): [number, number, number];
    /**
     * Write the camera's LocalTransform (translation = eye, rotation = look-at the
     * target). Returns false if the camera ref no longer resolves (destroyed/stale).
     */
    applyTo(world: EcsWorld): boolean;
}
export declare function createOrbitCameraController(options: OrbitCameraControllerOptions): OrbitCameraController;
//# sourceMappingURL=orbit-camera.d.ts.map