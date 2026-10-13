import type { MeshAsset, MeshSubmeshDescriptor } from "../mesh/index.js";
import type { MeshMergeDiagnostic, MeshMergeSource, SourceLayout } from "./mesh-merge-types.js";
export declare function collectSourceLayouts(sources: readonly MeshMergeSource[], diagnostics: MeshMergeDiagnostic[]): readonly SourceLayout[];
export declare function validateCompatibility(input: {
    readonly sources: readonly MeshMergeSource[];
    readonly firstMesh: MeshAsset;
    readonly indexed: boolean;
    readonly topology: MeshSubmeshDescriptor["topology"];
    readonly diagnostics: MeshMergeDiagnostic[];
}): void;
//# sourceMappingURL=mesh-merge-validation.d.ts.map