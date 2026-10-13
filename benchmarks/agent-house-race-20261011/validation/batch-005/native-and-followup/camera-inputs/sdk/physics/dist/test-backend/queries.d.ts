import type { PhysicsPointProjection, PhysicsQueryOptions, PhysicsRay, PhysicsRaycastHit, PhysicsShapeCast, PhysicsShapeCastHit } from "../backend.js";
import type { PhysicsVec3 } from "../components.js";
import type { TestBody, TestCollider } from "./types.js";
export declare function raycastSphere(ray: PhysicsRay, body: TestBody, collider: TestCollider, maxDistance: number): PhysicsRaycastHit | null;
export declare function castSphereBounds(queryRadius: number, cast: PhysicsShapeCast, body: TestBody, collider: TestCollider): PhysicsShapeCastHit | null;
export declare function projectPointToBody(point: PhysicsVec3, body: TestBody, collider: TestCollider): PhysicsPointProjection;
export declare function nearestCharacterHit(bodies: ReadonlyMap<string, TestBody>, character: TestBody, cast: PhysicsShapeCast, options: PhysicsQueryOptions): PhysicsShapeCastHit | null;
export declare function characterMovementAfterHit(desiredTranslation: PhysicsVec3, hit: PhysicsShapeCastHit, slide: boolean): PhysicsVec3;
export declare function isCharacterGrounded(bodies: ReadonlyMap<string, TestBody>, character: TestBody, up: PhysicsVec3, options: PhysicsQueryOptions, snapDistance: number): boolean;
export declare function queryAllowsCollider(body: TestBody, collider: TestCollider, options: PhysicsQueryOptions): boolean;
//# sourceMappingURL=queries.d.ts.map