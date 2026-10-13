import { type Entity } from "@aperture-engine/simulation";
import type { GeneratedDevtoolsToolResult } from "./types.js";
/** Projection fields use degrees at the semantic tool boundary. */
export interface CameraProjectionOptions {
    readonly projection?: "perspective" | "orthographic";
    /** Vertical perspective field of view in degrees, strictly between 0 and 180. */
    readonly fovYDegrees?: number;
    /** Positive near clip distance in scene units; must remain below far after Float32 rounding. */
    readonly near?: number;
    /** Finite far clip distance in scene units. */
    readonly far?: number;
    /** Positive full vertical orthographic span in scene units. */
    readonly orthographicHeight?: number;
}
/** Validate the complete Float32 candidate before changing any authored field. */
export declare function setCameraProjection(camera: Entity, payload: Record<string, unknown>, viewportAspect?: number): GeneratedDevtoolsToolResult;
//# sourceMappingURL=camera-projection.d.ts.map