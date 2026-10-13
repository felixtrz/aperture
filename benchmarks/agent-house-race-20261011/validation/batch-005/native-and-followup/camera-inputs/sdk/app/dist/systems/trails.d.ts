import { type MeshAsset } from "@aperture-engine/render";
import { type AssetRegistry, type Entity, type MaterialHandle, type Vec3Like } from "@aperture-engine/simulation";
import type { DynamicMesh, MeshAccess, MeshPublishResult } from "./meshes.js";
import type { SpawnCommands } from "./spawn/types.js";
export interface GroundRibbonTrailOptions {
    readonly label?: string;
    readonly width?: number;
    readonly maxSegments?: number;
    readonly minSegmentLength?: number;
    readonly color?: Vec3Like;
    readonly opacity?: number;
    readonly material?: string | MaterialHandle;
    readonly materialLabel?: string;
    readonly depthBias?: number;
    readonly depthBiasSlopeScale?: number;
    readonly entityKey?: string;
    readonly name?: string;
    readonly tags?: readonly string[];
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
}
export interface GroundRibbonTrailTrackOptions {
    readonly emit?: boolean;
    readonly alpha?: number;
    readonly color?: Vec3Like;
    readonly width?: number;
}
export interface GroundRibbonTrail {
    readonly mesh: DynamicMesh;
    readonly material: MaterialHandle;
    readonly entity: Entity;
    addSegment(start: Vec3Like, end: Vec3Like, options?: GroundRibbonTrailTrackOptions): boolean;
    track(point: Vec3Like | null, options?: GroundRibbonTrailTrackOptions): boolean;
    flush(): MeshPublishResult | null;
    getMeshAsset(): MeshAsset;
}
export interface TrailAccess {
    groundRibbon(id: string, options?: GroundRibbonTrailOptions): GroundRibbonTrail;
}
export declare function createTrailAccess(options: {
    readonly registry: AssetRegistry;
    readonly meshes: MeshAccess;
    readonly spawn: SpawnCommands;
}): TrailAccess;
//# sourceMappingURL=trails.d.ts.map