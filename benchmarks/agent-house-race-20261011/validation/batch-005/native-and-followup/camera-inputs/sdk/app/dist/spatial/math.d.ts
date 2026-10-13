import type { Entity, Vec3Like } from "@aperture-engine/simulation";
import { toVec2Tuple as tuple2, toVec3Tuple as tuple3 } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
export { tuple2, tuple3 };
export declare function entityRef(entity: Entity): EcsEntityRef;
export declare function normalizeTuple3(values: ArrayLike<number>): [number, number, number];
export declare function distanceBetween(a: Vec3Like, b: Vec3Like): number;
//# sourceMappingURL=math.d.ts.map