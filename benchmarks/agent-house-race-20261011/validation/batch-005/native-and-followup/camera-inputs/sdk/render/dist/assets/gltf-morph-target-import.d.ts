import { type GltfBufferResolver } from "./gltf-accessor-float-reader.js";
export interface GltfImportedPrimitiveMorphTargets {
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly targetCount: number;
    readonly vertexCount: number;
    readonly hasNormals: boolean;
    /** Target-major position deltas, length === targetCount * vertexCount * 3. */
    readonly positionDeltas: Float32Array;
    /** Target-major normal deltas (zero where absent), same length. */
    readonly normalDeltas: Float32Array;
}
export type GltfMorphTargetImportDiagnosticCode = "gltfMorph.malformedMeshes" | "gltfMorph.malformedTarget" | "gltfMorph.positionDecodeFailed" | "gltfMorph.vertexCountMismatch";
export interface GltfMorphTargetImportDiagnostic {
    readonly code: GltfMorphTargetImportDiagnosticCode;
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly meshIndex?: number;
    readonly primitiveIndex?: number;
    readonly targetIndex?: number;
}
export interface GltfMorphTargetImportReport {
    readonly valid: boolean;
    readonly primitives: readonly GltfImportedPrimitiveMorphTargets[];
    readonly diagnostics: readonly GltfMorphTargetImportDiagnostic[];
}
/** Import every morph target of every mesh primitive in a glTF root. */
export declare function importGltfMorphTargets(input: {
    readonly root: unknown;
    readonly resolveBufferBytes: GltfBufferResolver;
}): GltfMorphTargetImportReport;
//# sourceMappingURL=gltf-morph-target-import.d.ts.map