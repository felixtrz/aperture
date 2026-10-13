import { type EcsWorld } from "@aperture-engine/simulation";
import { type PhysicsBackend, type PhysicsCommandBuffer, type PhysicsReadbackReport, type PhysicsResultBuffer, type PhysicsStepReport, type PhysicsSyncReport } from "./backend.js";
export interface PhysicsWorldSyncState {
    readonly knownEntities: Set<string>;
    readonly knownJoints: Set<string>;
    readonly sleepingStates: Map<string, boolean>;
    readonly resultBuffer: PhysicsResultBuffer;
}
export interface PhysicsWorldWritebackReport {
    readonly bodyCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly missingEntities: number;
}
export interface PhysicsWorldStepOptions {
    readonly world: EcsWorld;
    readonly backend: PhysicsBackend;
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly state?: PhysicsWorldSyncState;
}
export interface PhysicsWorldStepReport {
    readonly sync: PhysicsSyncReport;
    readonly step: PhysicsStepReport;
    readonly readback: PhysicsReadbackReport;
    readonly writeback: PhysicsWorldWritebackReport;
    readonly events: readonly PhysicsResultBuffer["events"][number][];
}
export declare function createPhysicsWorldSyncState(): PhysicsWorldSyncState;
export declare function collectPhysicsCommands(world: EcsWorld, state?: PhysicsWorldSyncState): PhysicsCommandBuffer;
/**
 * Add WorldTransform to parented RigidBody entities authored with only a
 * LocalTransform, so the following resolveWorldTransforms pass produces the
 * world pose physics sync needs (AI-3). Without this, a parented body would
 * fall back to its parent-local pose and be rejected as unsupported.
 */
export declare function ensureParentedPhysicsBodyWorldTransforms(world: EcsWorld): number;
export declare function stepPhysicsWorld(options: PhysicsWorldStepOptions): PhysicsWorldStepReport;
export declare function applyPhysicsResultsToWorld(world: EcsWorld, results: PhysicsResultBuffer): PhysicsWorldWritebackReport;
//# sourceMappingURL=ecs-sync.d.ts.map