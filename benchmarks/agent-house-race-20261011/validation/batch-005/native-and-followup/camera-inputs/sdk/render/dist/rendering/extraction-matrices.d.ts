import { type Entity, type Mat4 } from "@aperture-engine/simulation";
export declare function readWorldMatrix(entity: Entity): Mat4;
export declare function pushMatrix(values: number[], matrix: Mat4 | readonly number[]): number;
export declare function pushTranslationMatrix(values: number[], position: readonly [number, number, number]): number;
//# sourceMappingURL=extraction-matrices.d.ts.map