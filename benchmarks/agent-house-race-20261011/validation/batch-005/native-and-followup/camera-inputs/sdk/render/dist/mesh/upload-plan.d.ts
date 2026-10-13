import type { MeshAsset, MeshBufferUpdateRange, MeshIndexBufferDescriptor, MeshSubmeshDescriptor, MeshVertexStreamDescriptor } from "./types.js";
export type MeshUploadUsageHint = "vertex" | "index";
export type MeshUploadPlanDiagnosticCode = "meshUpload.missingVertexStreamData" | "meshUpload.invalidVertexStreamData" | "meshUpload.invalidIndexData" | "meshUpload.invalidUpdateRange";
export interface MeshUploadPlanDiagnostic {
    readonly code: MeshUploadPlanDiagnosticCode;
    readonly message: string;
    readonly streamId?: string;
    readonly field?: string;
}
export interface MeshVertexUploadDescriptor {
    readonly label: string;
    readonly streamId: string;
    readonly usage: MeshUploadUsageHint;
    readonly arrayStride: number;
    readonly vertexCount: number;
    readonly byteLength: number;
    readonly source: ArrayBufferView;
    readonly attributes: MeshVertexStreamDescriptor["attributes"];
    readonly updateRanges?: readonly MeshBufferUpdateRange[];
}
export interface MeshIndexUploadDescriptor {
    readonly label: string;
    readonly usage: MeshUploadUsageHint;
    readonly format: MeshIndexBufferDescriptor["format"];
    readonly indexCount: number;
    readonly byteLength: number;
    readonly source: ArrayBufferView;
    readonly updateRanges?: readonly MeshBufferUpdateRange[];
}
export interface MeshSubmeshUploadRange {
    readonly label: string;
    readonly topology: MeshSubmeshDescriptor["topology"];
    readonly materialSlot: number;
    readonly vertexStart: number;
    readonly vertexCount: number;
    readonly indexStart: number;
    readonly indexCount: number;
}
export interface MeshGpuUploadPlan {
    readonly label: string;
    readonly vertexStreams: readonly MeshVertexUploadDescriptor[];
    readonly indexBuffer?: MeshIndexUploadDescriptor;
    readonly submeshes: readonly MeshSubmeshUploadRange[];
}
export interface MeshGpuUploadPlanResult {
    readonly valid: boolean;
    readonly plan: MeshGpuUploadPlan | null;
    readonly diagnostics: readonly MeshUploadPlanDiagnostic[];
}
export declare function createMeshGpuUploadPlan(mesh: MeshAsset): MeshGpuUploadPlanResult;
//# sourceMappingURL=upload-plan.d.ts.map