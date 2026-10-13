import { type PhysicsQuat, type PhysicsVec3 } from "../components.js";
import type { PhysicsBodyResult, PhysicsCommandBuffer, PhysicsExternalForceValue, PhysicsExternalImpulseValue, PhysicsTransform, PhysicsVelocityValue } from "../backend.js";
import type { TestBody, TestCollider } from "./types.js";
export declare function bodyResult(body: TestBody): PhysicsBodyResult;
export declare function collidersForCommand(command: Extract<PhysicsCommandBuffer["commands"][number], {
    readonly kind: "upsertBody";
}>): readonly TestCollider[];
export declare function colliderCount(bodies: ReadonlyMap<string, TestBody>): number;
export declare function colliderCenter(body: TestBody, collider: TestCollider): PhysicsVec3;
export declare function cloneTransform(transform: PhysicsTransform): PhysicsTransform;
export declare function kinematicTransformForCommand(command: Extract<PhysicsCommandBuffer["commands"][number], {
    readonly kind: "upsertBody";
}>): PhysicsTransform | undefined;
export declare function cloneVelocity(velocity: PhysicsVelocityValue): PhysicsVelocityValue;
export declare function zeroVelocity(): PhysicsVelocityValue;
export declare function cloneExternalForce(value: PhysicsExternalForceValue): PhysicsExternalForceValue;
export declare function zeroExternalForce(): PhysicsExternalForceValue;
export declare function cloneExternalImpulse(value: PhysicsExternalImpulseValue): PhysicsExternalImpulseValue;
export declare function zeroExternalImpulse(): PhysicsExternalImpulseValue;
export declare function applyForceAndImpulse(body: TestBody, fixedDelta: number, gravity: PhysicsVec3): void;
export declare function integrateTranslation(body: TestBody, fixedDelta: number): PhysicsVec3;
export declare function integrateRotation(body: TestBody, fixedDelta: number): PhysicsQuat;
export declare function applyDamping(body: TestBody, fixedDelta: number): void;
export declare function maskLockedAxes(value: PhysicsVec3, locks: readonly [boolean, boolean, boolean]): PhysicsVec3;
export declare function velocityMagnitude(velocity: PhysicsVelocityValue): number;
export declare function bodyRadius(body: TestBody): number;
//# sourceMappingURL=bodies.d.ts.map