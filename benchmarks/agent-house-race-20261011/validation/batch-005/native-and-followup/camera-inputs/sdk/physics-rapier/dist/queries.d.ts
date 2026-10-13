import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsPointProjection, PhysicsQueryOptions, PhysicsShape, PhysicsShapeCast, PhysicsShapeCastHit, PhysicsVec3 } from "@aperture-engine/physics";
import type { RapierBodyEntry, RapierColliderEntry } from "./types.js";
export declare function queryFilterFlags(options: PhysicsQueryOptions): RAPIER.QueryFilterFlags | undefined;
export declare function queryFilterGroups(options: PhysicsQueryOptions): number | undefined;
export declare function castShapeFirstByCollider(bodies: ReadonlyMap<string, RapierBodyEntry>, shape: PhysicsShape, cast: PhysicsShapeCast, options: PhysicsQueryOptions): PhysicsShapeCastHit | null;
export declare function projectPointByCollider(bodies: ReadonlyMap<string, RapierBodyEntry>, point: PhysicsVec3, options: PhysicsQueryOptions): PhysicsPointProjection | null;
export declare function queryAllowsCollider(entry: RapierBodyEntry, colliderEntry: RapierColliderEntry, options: PhysicsQueryOptions): boolean;
//# sourceMappingURL=queries.d.ts.map