import { type Entity, type QuatTuple, type Vec3Like, type Vec3Tuple } from "@aperture-engine/simulation";
export interface FollowCameraControllerOptions {
    /**
     * World-space offset from the computed look point to the camera eye.
     *
     * The default ground-plane follow basis is derived from this offset:
     * right = normalize([offset.z, 0, -offset.x]) and
     * forward = normalize([-offset.x, 0, -offset.z]).
     */
    readonly offset: Vec3Like;
    /** Initial smoothed target point. Defaults to [0, 0, 0]. */
    readonly initialTarget?: Vec3Like;
    /** Optional explicit deadzone/lead right axis. Defaults to the offset basis. */
    readonly rightAxis?: Vec3Like;
    /** Optional explicit deadzone/lead forward axis. Defaults to the offset basis. */
    readonly forwardAxis?: Vec3Like;
    /** Multiplier applied to lead velocity projected onto the follow basis. */
    readonly leadFactor?: number;
    /** Radius of the screen-space deadzone in world units. */
    readonly deadzoneRadius?: number;
    /**
     * Exponential smoothing rate. Values <= 0 mean instant follow after the first
     * update; positive values use expSmoothingAlpha(delta, smoothing).
     */
    readonly smoothing?: number;
    /** Shift the look point opposite the follow forward axis. */
    readonly screenShiftUp?: number;
    /** Add RenderInterpolation to the camera entity when writing. Defaults true. */
    readonly enableRenderInterpolation?: boolean;
}
export interface FollowCameraUpdateInput {
    readonly delta: number;
    readonly target: Vec3Like;
    /**
     * World-space velocity used only for camera lead. Apps can choose whether this
     * is physical velocity, facing-direction speed, input intent, or zero.
     */
    readonly leadVelocity?: Vec3Like;
}
export interface FollowCameraPose {
    readonly target: Vec3Tuple;
    readonly desiredTarget: Vec3Tuple;
    readonly smoothedTarget: Vec3Tuple;
    readonly lookPoint: Vec3Tuple;
    readonly eye: Vec3Tuple;
    readonly rotation: QuatTuple;
    readonly lead: readonly [number, number];
}
export interface FollowCameraController {
    readonly smoothedTarget: Vec3Tuple;
    readonly rightAxis: Vec3Tuple;
    readonly forwardAxis: Vec3Tuple;
    reset(target?: Vec3Like): void;
    update(input: FollowCameraUpdateInput): FollowCameraPose;
    writeTo(camera: Entity, input: FollowCameraUpdateInput): FollowCameraPose;
}
export declare function createFollowCameraController(options: FollowCameraControllerOptions): FollowCameraController;
export declare function writeFollowCameraPose(camera: Entity, pose: FollowCameraPose, options?: {
    readonly enableRenderInterpolation?: boolean;
}): void;
//# sourceMappingURL=follow-camera.d.ts.map