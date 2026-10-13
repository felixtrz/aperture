import { type GltfBufferResolver } from "./gltf-accessor-float-reader.js";
export interface GltfImportedSkin {
    readonly skinIndex: number;
    /** glTF node indices of the joints, in skin.joints order. */
    readonly jointNodeIndices: readonly number[];
    readonly jointCount: number;
    /** Flat column-major inverse-bind matrices, length === jointCount * 16. */
    readonly inverseBindMatrices: Float32Array;
    /** glTF node index of the common skeleton root, or null. */
    readonly skeletonNodeIndex: number | null;
}
export type GltfSkinImportDiagnosticCode = "gltfSkin.malformedSkins" | "gltfSkin.malformedSkin" | "gltfSkin.missingJoints" | "gltfSkin.invalidJointIndex" | "gltfSkin.inverseBindDecodeFailed" | "gltfSkin.inverseBindCountMismatch";
export interface GltfSkinImportDiagnostic {
    readonly code: GltfSkinImportDiagnosticCode;
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly skinIndex?: number;
}
export interface GltfSkinImportReport {
    readonly valid: boolean;
    readonly skins: readonly GltfImportedSkin[];
    readonly diagnostics: readonly GltfSkinImportDiagnostic[];
}
/** Parse all skins from a glTF root into engine skeleton descriptors. */
export declare function importGltfSkins(input: {
    readonly root: unknown;
    readonly resolveBufferBytes: GltfBufferResolver;
}): GltfSkinImportReport;
/** Look up an imported skin by its glTF index. */
export declare function findImportedSkin(report: GltfSkinImportReport, skinIndex: number): GltfImportedSkin | null;
//# sourceMappingURL=gltf-skin-import.d.ts.map