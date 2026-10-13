import type { MeshGpuUploadPlan, MeshIndexUploadDescriptor, MeshVertexUploadDescriptor } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
export declare const WEBGPU_BUFFER_USAGE_FLAGS: {
    readonly COPY_DST: 8;
    readonly INDEX: 16;
    readonly VERTEX: 32;
    readonly UNIFORM: 64;
    readonly STORAGE: 128;
    readonly INDIRECT: 256;
};
export interface MeshUploadBufferUsageConfig {
    readonly vertex: number;
    readonly index: number;
}
export type MeshUploadBufferDescriptorDiagnosticCode = "meshBuffer.nullPlan" | "meshBuffer.emptyVertexUploads" | "meshBuffer.invalidUsageFlags";
export interface MeshUploadBufferDescriptorDiagnostic {
    readonly code: MeshUploadBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface MeshVertexBufferDescriptorPlan {
    readonly streamId: string;
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: ArrayBufferView;
    readonly updateRanges?: MeshVertexUploadDescriptor["updateRanges"];
    readonly vertexCount: number;
}
export interface MeshIndexBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: ArrayBufferView;
    readonly updateRanges?: MeshIndexUploadDescriptor["updateRanges"];
    readonly format: MeshIndexUploadDescriptor["format"];
    readonly indexCount: number;
}
export interface MeshUploadBufferDescriptorPlan {
    readonly label: string;
    readonly vertexBuffers: readonly MeshVertexBufferDescriptorPlan[];
    readonly indexBuffer?: MeshIndexBufferDescriptorPlan;
}
export interface MeshUploadBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: MeshUploadBufferDescriptorPlan | null;
    readonly diagnostics: readonly MeshUploadBufferDescriptorDiagnostic[];
}
export declare const DEFAULT_MESH_UPLOAD_BUFFER_USAGE: MeshUploadBufferUsageConfig;
export declare function createMeshUploadBufferDescriptors(plan: MeshGpuUploadPlan | null, usage?: MeshUploadBufferUsageConfig): MeshUploadBufferDescriptorResult;
//# sourceMappingURL=mesh-buffer-descriptors.d.ts.map