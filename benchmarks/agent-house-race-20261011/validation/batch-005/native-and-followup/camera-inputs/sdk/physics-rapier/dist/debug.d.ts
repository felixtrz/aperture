import type RAPIER from "@dimforge/rapier3d-compat";
import { type PhysicsDebugGeometry, type PhysicsDebugLine, type PhysicsDebugOptions } from "@aperture-engine/physics";
import type { RapierBodyEntry, RapierJointEntry } from "./types.js";
export declare function debugGeometryFromRapierBuffers(buffers: {
    readonly vertices: Float32Array;
    readonly colors: Float32Array;
}): PhysicsDebugGeometry;
export declare function broadphaseAabbDebugLines(bodies: ReadonlyMap<string, RapierBodyEntry>, options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function contactNormalDebugLines(world: RAPIER.World, bodies: ReadonlyMap<string, RapierBodyEntry>, options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function bodyStateDebugLines(bodies: ReadonlyMap<string, RapierBodyEntry>, options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function jointFrameDebugLines(bodies: ReadonlyMap<string, RapierBodyEntry>, joints: ReadonlyMap<string, RapierJointEntry>, options: PhysicsDebugOptions): PhysicsDebugLine[];
//# sourceMappingURL=debug.d.ts.map