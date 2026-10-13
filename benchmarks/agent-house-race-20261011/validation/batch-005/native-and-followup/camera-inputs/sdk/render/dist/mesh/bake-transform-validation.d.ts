import type { MeshAsset } from "./types.js";
export interface BakeAttributeBinding {
    readonly stream: number;
    readonly offset: number;
}
export interface BakeTriangleRange {
    readonly start: number;
    readonly end: number;
}
export interface BakeSourceLayout {
    readonly vertexCount: number;
    readonly position: BakeAttributeBinding;
    readonly normal?: BakeAttributeBinding;
    readonly tangent?: BakeAttributeBinding;
    readonly triangleRanges: readonly BakeTriangleRange[];
}
export declare function validateBakeSource(mesh: MeshAsset, mirrored: boolean): BakeSourceLayout;
//# sourceMappingURL=bake-transform-validation.d.ts.map