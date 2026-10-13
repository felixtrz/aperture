import type { MeshAsset, MeshIndexBufferDescriptor, MeshSubmeshDescriptor, MeshVertexStreamDescriptor } from "../mesh/index.js";
import type { MergedMeshSubmeshRange, MeshMergeDiagnostic, SourceLayout } from "./mesh-merge-types.js";
export declare function mergeVertexStreams(firstMesh: MeshAsset, sources: readonly SourceLayout[]): readonly MeshVertexStreamDescriptor[];
export declare function mergeIndexBuffer(sources: readonly SourceLayout[], diagnostics: MeshMergeDiagnostic[]): MeshIndexBufferDescriptor | undefined;
export declare function mergeSubmeshes(sources: readonly SourceLayout[], indexed: boolean, ranges: MergedMeshSubmeshRange[]): readonly MeshSubmeshDescriptor[];
//# sourceMappingURL=mesh-merge-assembly.d.ts.map