import type { PhysicsBackend, PhysicsBackendCapabilities, PhysicsCharacterMove, PhysicsCharacterMoveResult, PhysicsEntityRef, PhysicsDebugGeometry, PhysicsDebugOptions, PhysicsDebugSummary, PhysicsEvent, PhysicsOverlapHit, PhysicsPointProjection, PhysicsQueryOptions, PhysicsRay, PhysicsRaycastHit, PhysicsShape, PhysicsShapeCast, PhysicsShapeCastHit, PhysicsStepReport, PhysicsSyncReport, PhysicsQuat, PhysicsTransform, PhysicsUnsupportedFeature, PhysicsVec3, PhysicsWorldStepReport } from "@aperture-engine/physics";
import { type EcsWorld, type Entity } from "@aperture-engine/simulation";
export interface PhysicsApplyForceOptions {
    readonly point?: PhysicsVec3;
    readonly torque?: PhysicsVec3;
}
export interface PhysicsApplyImpulseOptions {
    readonly point?: PhysicsVec3;
    readonly angularImpulse?: PhysicsVec3;
}
export interface PhysicsBreakJointOptions {
    readonly frame?: number;
    readonly fixedStep?: number;
    readonly substep?: number;
}
/**
 * Target pose for a kinematic body. `rotation` is optional: omit it to nudge a
 * body's translation while preserving its current orientation (see GH #28).
 */
export interface KinematicTargetTransform {
    readonly translation: PhysicsVec3;
    readonly rotation?: PhysicsQuat;
}
export type PhysicsCharacterMoveInput = Omit<PhysicsCharacterMove, "entity"> & {
    readonly entity: Entity | PhysicsEntityRef;
};
export interface PhysicsEventFamilySummary {
    readonly contacts: number;
    readonly collisions: number;
    readonly triggers: number;
    readonly sleepWake: number;
    readonly contactForces: number;
    readonly controllerGroundedChanged: number;
    readonly jointBreaks: number;
}
export interface PhysicsAccessSummary {
    readonly backend: PhysicsBackendSummary | null;
    readonly sync: PhysicsSyncSummary | null;
    readonly step: PhysicsStepSummary | null;
    readonly readback: PhysicsReadbackSummary | null;
    readonly writeback: PhysicsWritebackSummary | null;
    readonly unsupportedFeatureCount: number;
    readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
    readonly eventCount: number;
    readonly eventKinds: Readonly<Record<string, number>>;
    readonly eventFamilies: PhysicsEventFamilySummary;
    readonly events: readonly PhysicsEvent[];
}
export interface PhysicsBackendSummary {
    readonly kind: PhysicsBackend["kind"];
    readonly version: string;
    readonly build: PhysicsBackend["build"];
    readonly execution: PhysicsBackend["execution"];
    readonly capabilities: PhysicsBackendCapabilities;
}
export interface PhysicsSyncSummary {
    readonly commandCount: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly jointCount: number;
    readonly unsupportedFeatureCount: number;
    readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
}
export interface PhysicsStepSummary {
    readonly enabled: boolean;
    readonly backend: PhysicsStepReport["backend"];
    readonly backendVersion: string;
    readonly backendBuild: PhysicsStepReport["backendBuild"];
    readonly execution: PhysicsStepReport["execution"];
    readonly fixedDelta: number;
    readonly fixedStep: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly jointCount: number;
    readonly eventCount: number;
    readonly queryCount: number;
    readonly syncToBackendMs: number;
    readonly backendStepMs: number;
    readonly writebackMs: number;
}
export interface PhysicsReadbackSummary {
    readonly bodyCount: number;
    readonly eventCount: number;
}
export interface PhysicsWritebackSummary {
    readonly bodyCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly missingEntities: number;
}
export interface PhysicsEventAccess {
    (): readonly PhysicsEvent[];
    all(): readonly PhysicsEvent[];
    byKind(kind: PhysicsEvent["kind"]): readonly PhysicsEvent[];
    contacts(): readonly PhysicsEvent[];
    collisionStarted(): readonly PhysicsEvent[];
    collisionStayed(): readonly PhysicsEvent[];
    collisionEnded(): readonly PhysicsEvent[];
    triggerEntered(): readonly PhysicsEvent[];
    triggerStayed(): readonly PhysicsEvent[];
    triggerExited(): readonly PhysicsEvent[];
    sleeping(): readonly PhysicsEvent[];
    waking(): readonly PhysicsEvent[];
    contactForces(): readonly PhysicsEvent[];
    controllerGroundedChanged(): readonly PhysicsEvent[];
    jointBroken(): readonly PhysicsEvent[];
}
export interface PhysicsAccess {
    setBackend(backend: PhysicsBackend | null): void;
    getBackend(): PhysicsBackend | null;
    setEvents(events: readonly PhysicsEvent[]): void;
    setSyncReport(report: PhysicsSyncReport | null): void;
    setStepReport(report: PhysicsWorldStepReport | null): void;
    clearEvents(): void;
    readonly events: PhysicsEventAccess;
    summary(): PhysicsAccessSummary;
    raycastFirst(ray: PhysicsRay, options?: PhysicsQueryOptions): PhysicsRaycastHit | null;
    raycastAll(ray: PhysicsRay, options?: PhysicsQueryOptions): readonly PhysicsRaycastHit[];
    overlapShape(shape: PhysicsShape, transform: PhysicsTransform, options?: PhysicsQueryOptions): readonly PhysicsOverlapHit[];
    castShapeFirst(shape: PhysicsShape, cast: PhysicsShapeCast, options?: PhysicsQueryOptions): PhysicsShapeCastHit | null;
    projectPoint(point: PhysicsVec3, options?: PhysicsQueryOptions): PhysicsPointProjection | null;
    applyForce(entity: Entity, force: PhysicsVec3, options?: PhysicsApplyForceOptions): void;
    applyImpulse(entity: Entity, impulse: PhysicsVec3, options?: PhysicsApplyImpulseOptions): void;
    setLinearVelocity(entity: Entity, velocity: PhysicsVec3): void;
    setAngularVelocity(entity: Entity, velocity: PhysicsVec3): void;
    /** Read the body's most recent linear velocity (written back each step). */
    getLinearVelocity(entity: Entity): PhysicsVec3;
    /** Read the body's most recent angular velocity (written back each step). */
    getAngularVelocity(entity: Entity): PhysicsVec3;
    setKinematicTarget(entity: Entity, transform: KinematicTargetTransform): void;
    sleepBody(entity: Entity): boolean;
    wakeBody(entity: Entity): boolean;
    breakJoint(entity: Entity, options?: PhysicsBreakJointOptions): boolean;
    moveCharacter(move: PhysicsCharacterMoveInput): PhysicsCharacterMoveResult | null;
    debugGeometry(options?: PhysicsDebugOptions): PhysicsDebugGeometry;
    debugSummary(options?: PhysicsDebugOptions): PhysicsDebugSummary;
}
export interface CreatePhysicsAccessOptions {
    readonly world?: EcsWorld;
}
export declare function createPhysicsAccess(options?: CreatePhysicsAccessOptions): PhysicsAccess;
//# sourceMappingURL=physics.d.ts.map