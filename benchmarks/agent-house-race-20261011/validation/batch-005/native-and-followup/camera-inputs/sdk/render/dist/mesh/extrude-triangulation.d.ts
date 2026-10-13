import type { ExtrudePoint } from "./extrude-types.js";
/** Earcut may simplify collinear hole bridges; split their T-junctions again. */
export declare function triangulateExtrudeCaps(rings: readonly (readonly ExtrudePoint[])[]): number[];
//# sourceMappingURL=extrude-triangulation.d.ts.map