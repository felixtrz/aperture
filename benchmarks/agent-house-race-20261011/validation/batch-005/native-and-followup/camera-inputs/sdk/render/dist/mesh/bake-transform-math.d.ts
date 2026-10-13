export type BakeVector3 = readonly [number, number, number];
export interface BakeAffineTransform {
    readonly matrix: readonly number[];
    readonly linear: readonly number[];
    readonly cofactors: readonly number[];
    readonly orientation: 1 | -1;
}
export declare function readBakeTransform(value: ArrayLike<number>): BakeAffineTransform;
export declare function multiplyBakeVector(matrix: readonly number[], vector: BakeVector3): BakeVector3;
export declare function normalizedBakeVector(vector: BakeVector3, path: string): BakeVector3;
export declare function bakePosition(transform: BakeAffineTransform, p: BakeVector3, path: string): BakeVector3;
export declare function bakeNormal(transform: BakeAffineTransform, n: BakeVector3, path: string): BakeVector3;
export declare function orthogonalBakeTangent(tangent: BakeVector3, normal: BakeVector3, path: string): BakeVector3;
export declare function finiteBakeFloat(value: number, path: string): number;
//# sourceMappingURL=bake-transform-math.d.ts.map