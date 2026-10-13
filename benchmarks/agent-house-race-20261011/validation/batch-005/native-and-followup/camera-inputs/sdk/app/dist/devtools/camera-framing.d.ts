import { type Entity } from "@aperture-engine/simulation";
import type { ApertureApp } from "../advanced.js";
import type { EcsEntityRef } from "../config.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
type Vec3 = readonly [number, number, number];
/** Machine-readable evidence for a one-shot fit of static mesh source bounds. */
export interface CameraFramingReport {
    readonly source: "mesh-local-aabb";
    readonly subjects: readonly EcsEntityRef[];
    readonly meshes: readonly EcsEntityRef[];
    readonly includeDescendants: boolean;
    readonly bounds: {
        readonly min: Vec3;
        readonly max: Vec3;
    };
    readonly center: Vec3;
    readonly translation: Vec3;
    readonly projection: "perspective" | "orthographic";
    readonly aspect: number;
    readonly padding: number;
    readonly distance: number;
    readonly near: number;
    readonly far: number;
    readonly orthographicHeight?: number;
    readonly approximation: "static-mesh-bounds";
    readonly projectionCheck: {
        readonly maxAbsNdcX: number;
        readonly maxAbsNdcY: number;
        readonly minNdcDepth: number;
        readonly maxNdcDepth: number;
        readonly tolerance: number;
    };
}
/**
 * Dev-only authoring operation. Source mesh AABBs and ECS world transforms are
 * authoritative inputs; no camera visibility, GPU readback, or scene graph is
 * consulted. All validation finishes before authored camera fields are written.
 */
export declare function frameCameraEntities(app: ApertureApp, camera: Entity, payload: Record<string, unknown>, viewportAspect?: number): GeneratedDevtoolsToolResult;
export {};
//# sourceMappingURL=camera-framing.d.ts.map