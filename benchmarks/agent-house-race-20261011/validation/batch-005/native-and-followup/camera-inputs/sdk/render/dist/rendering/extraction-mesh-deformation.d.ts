import type { Entity } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { RenderDiagnostic } from "./snapshot.js";
export interface SkinExtraction {
    /** The typed joint palette, returned by reference (no per-extract copy). */
    readonly jointMatrices: ArrayLike<number>;
    readonly jointCount: number;
}
export declare function readSkinning(entity: Entity, mesh: MeshAsset, diagnostics: RenderDiagnostic[]): SkinExtraction | undefined | null;
export declare function pushBoneMatrices(values: number[], skinning: SkinExtraction): number;
export interface MorphExtraction {
    /** Number of morph targets the mesh carries (N, not capped). */
    readonly targetCount: number;
    /** Vertex count of the morphed mesh (delta indexing stride). */
    readonly vertexCount: number;
    /** Per-target blended weights, length === `targetCount`. */
    readonly weights: Float32Array;
    /** Target-major position deltas (the mesh's payload, by reference). */
    readonly positionDeltas: Float32Array;
    /** Target-major normal deltas (the mesh's payload, by reference). */
    readonly normalDeltas: Float32Array;
}
export declare function readMorphTargetWeights(entity: Entity, mesh: MeshAsset, diagnostics: RenderDiagnostic[]): MorphExtraction | undefined | null;
/**
 * Append a morphed instance's `targetCount` weights to the flat snapshot weight
 * buffer and return the float offset at which they start.
 */
export declare function pushMorphTargetWeights(values: number[], morph: MorphExtraction): number;
/**
 * Append a morphed mesh's target-major deltas (positions then normals) to the
 * flat snapshot delta buffer and return the float offset at which they start.
 */
export declare function pushMorphTargetDeltas(values: number[], morph: MorphExtraction): number;
/**
 * Write a morphed instance's descriptor (weightOffset, targetCount, deltaOffset,
 * vertexCount) into the per-instance descriptor buffer at its transform slot.
 */
export declare function pushMorphInstanceDescriptor(descriptors: number[], worldTransformOffset: number, descriptor: {
    readonly weightOffset: number;
    readonly targetCount: number;
    readonly deltaOffset: number;
    readonly vertexCount: number;
}): void;
//# sourceMappingURL=extraction-mesh-deformation.d.ts.map