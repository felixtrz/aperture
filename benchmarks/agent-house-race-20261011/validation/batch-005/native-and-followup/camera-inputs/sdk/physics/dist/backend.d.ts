import { PhysicsRigidBodyType } from "./components.js";
import type { PhysicsJointKind, PhysicsJointMotorMode, PhysicsJointMotorModel, PhysicsMaterialCombineRule, PhysicsQuat, PhysicsShape, PhysicsVec3 } from "./components.js";
import type { PhysicsColliderGeometryProvider } from "./collider-geometry.js";
export type PhysicsBackendKind = "rapier" | "test";
export type PhysicsBackendBuild = "performance" | "compat" | "deterministic" | "test";
export type PhysicsExecutionMode = "simulation-worker" | "physics-worker-transferable";
export type PhysicsEntityRef = string;
export interface PhysicsBackendCapabilities {
    readonly compoundColliders: boolean;
    readonly continuousCollisionDetection: boolean;
    readonly characterController: boolean;
    readonly linkedBodyContacts: boolean;
    readonly combinedPositionVelocityMotors: boolean;
    readonly motorForceLimits: boolean;
    readonly automaticBreakForce: boolean;
    readonly jointImpulseReadback: boolean;
    readonly pairedNonFixedFrameB: boolean;
}
export declare const TEST_PHYSICS_BACKEND_CAPABILITIES: PhysicsBackendCapabilities;
export declare const RAPIER_PHYSICS_BACKEND_CAPABILITIES: PhysicsBackendCapabilities;
export interface PhysicsTransform {
    readonly translation: PhysicsVec3;
    readonly rotation: PhysicsQuat;
}
export interface PhysicsVelocityValue {
    readonly linear: PhysicsVec3;
    readonly angular: PhysicsVec3;
}
export interface PhysicsExternalForceValue {
    readonly force: PhysicsVec3;
    readonly torque: PhysicsVec3;
}
export interface PhysicsExternalImpulseValue {
    readonly impulse: PhysicsVec3;
    readonly angularImpulse: PhysicsVec3;
}
export interface PhysicsColliderDescriptor {
    readonly entity?: PhysicsEntityRef;
    readonly shape: PhysicsShape;
    readonly scale?: PhysicsVec3;
    readonly offsetTranslation?: PhysicsVec3;
    readonly offsetRotation?: PhysicsQuat;
    readonly sensor?: boolean;
    readonly density?: number;
    readonly friction?: number;
    readonly restitution?: number;
    readonly frictionCombine?: PhysicsMaterialCombineRule;
    readonly restitutionCombine?: PhysicsMaterialCombineRule;
    readonly collisionGroups?: number;
    readonly solverGroups?: number;
}
export interface PhysicsJointDescriptor {
    readonly kind: PhysicsJointKind;
    readonly bodyARef: PhysicsEntityRef;
    readonly bodyBRef: PhysicsEntityRef;
    readonly anchorA: PhysicsVec3;
    readonly anchorB: PhysicsVec3;
    readonly frameA?: PhysicsQuat;
    readonly frameB?: PhysicsQuat;
    readonly axis: PhysicsVec3;
    readonly minLimit?: number;
    readonly maxLimit?: number;
    readonly motorMode?: PhysicsJointMotorMode;
    readonly motorModel?: PhysicsJointMotorModel;
    readonly motorTarget?: number;
    readonly motorVelocity?: number;
    readonly motorStiffness?: number;
    readonly motorDamping?: number;
    readonly motorFactor?: number;
    readonly motorMaxForce?: number;
    readonly contactsEnabled?: boolean;
    readonly breakForce?: number;
}
export interface PhysicsBackendInit {
    readonly gravity?: PhysicsVec3;
    readonly execution?: PhysicsExecutionMode;
    readonly colliderGeometryProvider?: PhysicsColliderGeometryProvider;
}
export type PhysicsCommand = {
    readonly kind: "setGravity";
    readonly gravity: PhysicsVec3;
} | {
    readonly kind: "upsertBody";
    readonly entity: PhysicsEntityRef;
    readonly transform: PhysicsTransform;
    readonly kinematicTarget?: PhysicsTransform;
    readonly bodyType?: PhysicsRigidBodyType;
    readonly gravityScale?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    readonly canSleep?: boolean;
    readonly ccdEnabled?: boolean;
    readonly lockTranslations?: readonly [boolean, boolean, boolean];
    readonly lockRotations?: readonly [boolean, boolean, boolean];
    readonly parented?: boolean;
    readonly velocity?: PhysicsVelocityValue;
    readonly externalForce?: PhysicsExternalForceValue;
    readonly externalImpulse?: PhysicsExternalImpulseValue;
    readonly collider?: PhysicsColliderDescriptor;
    readonly colliders?: readonly PhysicsColliderDescriptor[];
    readonly radius?: number;
} | {
    readonly kind: "destroyBody";
    readonly entity: PhysicsEntityRef;
} | {
    readonly kind: "upsertJoint";
    readonly entity: PhysicsEntityRef;
    readonly joint: PhysicsJointDescriptor;
} | {
    readonly kind: "destroyJoint";
    readonly entity: PhysicsEntityRef;
} | {
    readonly kind: "setVelocity";
    readonly entity: PhysicsEntityRef;
    readonly velocity: PhysicsVelocityValue;
} | {
    readonly kind: "emitTrigger";
    readonly entityA: PhysicsEntityRef;
    readonly entityB: PhysicsEntityRef;
};
export interface PhysicsCommandBuffer {
    readonly commands: readonly PhysicsCommand[];
}
export interface PhysicsBodyResult {
    readonly entity: PhysicsEntityRef;
    readonly transform: PhysicsTransform;
    readonly velocity: PhysicsVelocityValue;
    readonly sleeping: boolean;
}
export type PhysicsEventKind = "collisionStart" | "collisionStay" | "collisionEnd" | "triggerEnter" | "triggerStay" | "triggerExit" | "sleep" | "wake" | "contactForce" | "controllerGroundedChanged" | "jointBreak";
export interface PhysicsEvent {
    readonly kind: PhysicsEventKind;
    readonly frame: number;
    readonly fixedStep: number;
    readonly substep: number;
    readonly joint?: PhysicsEntityRef;
    readonly entityA: PhysicsEntityRef;
    readonly entityB: PhysicsEntityRef;
    readonly colliderA: PhysicsEntityRef;
    readonly colliderB: PhysicsEntityRef;
    readonly point?: PhysicsVec3;
    readonly normal?: PhysicsVec3;
    readonly force?: PhysicsVec3;
    readonly forceMagnitude?: number;
    readonly maxForceMagnitude?: number;
    readonly impulse?: number;
    readonly grounded?: boolean;
}
export interface PhysicsResultBuffer {
    readonly bodies: PhysicsBodyResult[];
    readonly events: PhysicsEvent[];
}
export type PhysicsUnsupportedFeatureCode = "physics.rigidBody.ccd.unsupported" | "physics.rigidBody.parentedBody.unsupported" | "physics.collider.assetShape.unsupported" | "physics.collider.asset.missing" | "physics.collider.asset.notReady" | "physics.collider.asset.invalid" | "physics.collider.asset.empty" | "physics.collider.scale.unsupported" | "physics.collider.scale.approximated" | "physics.collider.dynamicAssetShape.unsupported" | "physics.collider.cooking.failed" | "physics.joint.unsupported" | "physics.characterController.unsupported" | "physics.debugGeometry.unsupported" | "physics.joint.impulseReadback.unsupported" | "physics.joint.breakForce.unsupported" | "physics.joint.motorMaxForce.unsupported" | "physics.joint.frameB.unsupported";
export interface PhysicsUnsupportedFeature {
    readonly code: PhysicsUnsupportedFeatureCode;
    readonly feature: string;
    readonly backend: PhysicsBackendKind;
    readonly entity: PhysicsEntityRef;
    readonly value?: number;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly message: string;
    readonly suggestedFix: string;
}
export interface PhysicsSyncReport {
    readonly commandCount: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly jointCount: number;
    readonly unsupportedFeatureCount: number;
    readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
}
export interface PhysicsStepReport {
    readonly enabled: boolean;
    readonly backend: PhysicsBackendKind;
    readonly backendVersion: string;
    readonly backendBuild: PhysicsBackendBuild;
    readonly execution: PhysicsExecutionMode;
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
export interface PhysicsReadbackReport {
    readonly bodyCount: number;
    readonly eventCount: number;
}
export interface PhysicsRay {
    readonly origin: PhysicsVec3;
    readonly direction: PhysicsVec3;
    readonly maxDistance?: number;
}
export interface PhysicsQueryOptions {
    readonly collisionGroups?: number;
    readonly includeSensors?: boolean;
    readonly excludeEntity?: PhysicsEntityRef;
}
export interface PhysicsRaycastHit {
    readonly entity: PhysicsEntityRef;
    readonly collider?: PhysicsEntityRef;
    readonly point: PhysicsVec3;
    readonly normal: PhysicsVec3;
    readonly distance: number;
}
export interface PhysicsOverlapHit {
    readonly entity: PhysicsEntityRef;
    readonly collider?: PhysicsEntityRef;
}
export interface PhysicsShapeCast {
    readonly from: PhysicsTransform;
    readonly to: PhysicsTransform;
}
export interface PhysicsShapeCastHit {
    readonly entity: PhysicsEntityRef;
    readonly collider?: PhysicsEntityRef;
    readonly timeOfImpact: number;
    readonly point: PhysicsVec3;
    readonly normal: PhysicsVec3;
}
export interface PhysicsPointProjection {
    readonly entity: PhysicsEntityRef;
    readonly collider?: PhysicsEntityRef;
    readonly point: PhysicsVec3;
    readonly normal: PhysicsVec3;
    readonly distance: number;
    readonly inside: boolean;
}
export interface PhysicsCharacterAutostep {
    readonly maxHeight: number;
    readonly minWidth: number;
    readonly includeDynamicBodies?: boolean;
}
export interface PhysicsCharacterControllerSettings {
    readonly offset?: number;
    readonly up?: PhysicsVec3;
    readonly slide?: boolean;
    readonly maxSlopeClimbAngle?: number;
    readonly minSlopeSlideAngle?: number;
    readonly snapToGroundDistance?: number;
    readonly autostep?: PhysicsCharacterAutostep | false;
    readonly applyImpulsesToDynamicBodies?: boolean;
    readonly characterMass?: number | null;
}
export interface PhysicsCharacterMove {
    readonly entity: PhysicsEntityRef;
    readonly desiredTranslation: PhysicsVec3;
    readonly settings?: PhysicsCharacterControllerSettings;
    readonly options?: PhysicsQueryOptions;
}
export interface PhysicsCharacterCollision {
    readonly entity: PhysicsEntityRef | null;
    readonly translationDeltaApplied: PhysicsVec3;
    readonly translationDeltaRemaining: PhysicsVec3;
    readonly timeOfImpact: number;
    readonly point: PhysicsVec3;
    readonly normal: PhysicsVec3;
}
export interface PhysicsCharacterMoveResult {
    readonly entity: PhysicsEntityRef;
    readonly desiredTranslation: PhysicsVec3;
    readonly movement: PhysicsVec3;
    readonly targetTranslation: PhysicsVec3;
    readonly grounded: boolean;
    readonly collisions: readonly PhysicsCharacterCollision[];
}
export interface PhysicsDebugOptions {
    readonly colliderWireframes?: boolean;
    readonly contactNormals?: boolean;
    readonly contactNormalColor?: readonly [number, number, number, number];
    readonly contactNormalLength?: number;
    readonly bodyStateMarkers?: boolean;
    readonly activeBodyColor?: readonly [number, number, number, number];
    readonly sleepingBodyColor?: readonly [number, number, number, number];
    readonly bodyStateMarkerLength?: number;
    readonly broadphaseAabbs?: boolean;
    readonly broadphaseAabbColor?: readonly [number, number, number, number];
    readonly jointFrames?: boolean;
    readonly jointFrameColor?: readonly [number, number, number, number];
    readonly jointAxisColor?: readonly [number, number, number, number];
    readonly jointFrameLength?: number;
    readonly rayProbes?: readonly PhysicsDebugRayProbe[];
}
export interface PhysicsAabb {
    readonly min: PhysicsVec3;
    readonly max: PhysicsVec3;
}
export interface PhysicsDebugGeometry {
    readonly lines: readonly PhysicsDebugLine[];
}
export interface PhysicsDebugLine {
    readonly from: PhysicsVec3;
    readonly to: PhysicsVec3;
    readonly color: readonly [number, number, number, number];
}
export interface PhysicsDebugBoundsSummary {
    readonly min: PhysicsVec3;
    readonly max: PhysicsVec3;
}
export interface PhysicsDebugColorSummary {
    readonly color: readonly [number, number, number, number];
    readonly lineCount: number;
}
export interface PhysicsDebugSummary {
    readonly lineCount: number;
    readonly finiteLineCount: number;
    readonly invalidLineCount: number;
    readonly colorCount: number;
    readonly colors: readonly PhysicsDebugColorSummary[];
    readonly bounds: PhysicsDebugBoundsSummary | null;
}
export interface PhysicsDebugRayProbe {
    readonly ray: PhysicsRay;
    readonly options?: PhysicsQueryOptions;
    readonly hitColor?: readonly [number, number, number, number];
    readonly missColor?: readonly [number, number, number, number];
    readonly normalColor?: readonly [number, number, number, number];
    readonly normalLength?: number;
}
export interface PhysicsBackend {
    readonly kind: PhysicsBackendKind;
    readonly version: string;
    readonly build: PhysicsBackendBuild;
    readonly execution: PhysicsExecutionMode;
    readonly capabilities: PhysicsBackendCapabilities;
    init(options?: PhysicsBackendInit): Promise<void> | void;
    dispose(): void;
    sync(commands: PhysicsCommandBuffer): PhysicsSyncReport;
    step(fixedDelta: number, fixedStepIndex: number): PhysicsStepReport;
    readResults(out: PhysicsResultBuffer): PhysicsReadbackReport;
    raycastFirst(ray: PhysicsRay, options?: PhysicsQueryOptions): PhysicsRaycastHit | null;
    raycastAll(ray: PhysicsRay, options?: PhysicsQueryOptions): readonly PhysicsRaycastHit[];
    overlapShape?(shape: PhysicsShape, transform: PhysicsTransform, options?: PhysicsQueryOptions): readonly PhysicsOverlapHit[];
    castShapeFirst?(shape: PhysicsShape, cast: PhysicsShapeCast, options?: PhysicsQueryOptions): PhysicsShapeCastHit | null;
    projectPoint?(point: PhysicsVec3, options?: PhysicsQueryOptions): PhysicsPointProjection | null;
    moveCharacter?(move: PhysicsCharacterMove): PhysicsCharacterMoveResult | null;
    sleepBody?(entity: PhysicsEntityRef): boolean;
    wakeBody?(entity: PhysicsEntityRef): boolean;
    debugGeometry?(options?: PhysicsDebugOptions): PhysicsDebugGeometry;
}
export interface PhysicsUnsupportedFeatureCollectionOptions {
    readonly assetBackedColliders?: "unsupported" | "provider";
}
export declare function collectUnsupportedPhysicsCommandFeatures(backend: PhysicsBackendKind, buffer: PhysicsCommandBuffer, options?: PhysicsUnsupportedFeatureCollectionOptions): PhysicsUnsupportedFeature[];
export declare function collectUnsupportedPhysicsBodyFeatures(backend: PhysicsBackendKind, entity: PhysicsEntityRef, body: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>, options?: PhysicsUnsupportedFeatureCollectionOptions): PhysicsUnsupportedFeature[];
export declare function collectUnsupportedPhysicsJointFeatures(backend: PhysicsBackendKind, entity: PhysicsEntityRef, joint: PhysicsJointDescriptor): PhysicsUnsupportedFeature[];
export declare function physicsBodyCommandHasUnsupportedAssetCollider(body: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>, options?: PhysicsUnsupportedFeatureCollectionOptions): boolean;
export declare function physicsBodyCommandHasUnsupportedParentedBody(body: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>): boolean;
export declare function physicsBodyCommandHasUnsupportedSyncFeature(body: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>, options?: PhysicsUnsupportedFeatureCollectionOptions): boolean;
export declare function physicsJointCommandHasUnsupportedSyncFeature(backend: PhysicsBackendKind, joint: PhysicsJointDescriptor): boolean;
export declare function createUnsupportedJointImpulseReadbackFeature(backend: PhysicsBackendKind, entity: PhysicsEntityRef): PhysicsUnsupportedFeature;
export declare function createPhysicsResultBuffer(): PhysicsResultBuffer;
export declare function summarizePhysicsDebugGeometry(geometry: PhysicsDebugGeometry): PhysicsDebugSummary;
export declare function createPhysicsRayProbeDebugLines(probes: readonly PhysicsDebugRayProbe[] | undefined, raycastFirst: (ray: PhysicsRay, options?: PhysicsQueryOptions) => PhysicsRaycastHit | null): PhysicsDebugLine[];
export declare function createPhysicsAabbDebugLines(aabbs: readonly PhysicsAabb[], inputColor: readonly [number, number, number, number] | undefined): PhysicsDebugLine[];
//# sourceMappingURL=backend.d.ts.map