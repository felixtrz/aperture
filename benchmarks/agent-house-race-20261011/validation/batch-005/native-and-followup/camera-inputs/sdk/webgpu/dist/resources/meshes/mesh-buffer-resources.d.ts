import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { MeshIndexBufferDescriptorPlan, MeshUploadBufferDescriptorPlan } from "./mesh-buffer-descriptors.js";
export type MeshGpuBufferCreationDiagnosticCode = "meshGpuBuffer.nullDescriptorPlan" | "meshGpuBuffer.vertexCreationFailed" | "meshGpuBuffer.indexCreationFailed";
export interface MeshGpuBufferCreationDiagnostic {
    readonly code: MeshGpuBufferCreationDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface MeshGpuVertexBufferResource {
    readonly streamId: string;
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly vertexCount: number;
}
export interface MeshGpuIndexBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly format: MeshIndexBufferDescriptorPlan["format"];
    readonly indexCount: number;
}
export interface MeshGpuBufferResource {
    readonly resourceKey: string;
    readonly vertexCount: number;
    readonly vertexBuffers: readonly MeshGpuVertexBufferResource[];
    readonly indexBuffer?: MeshGpuIndexBufferResource;
}
export interface CreateMeshGpuBuffersOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: MeshUploadBufferDescriptorPlan | null;
}
export interface CreateMeshGpuBuffersResult {
    readonly valid: boolean;
    readonly resource: MeshGpuBufferResource | null;
    readonly diagnostics: readonly MeshGpuBufferCreationDiagnostic[];
}
export declare function createMeshGpuBuffers(options: CreateMeshGpuBuffersOptions): CreateMeshGpuBuffersResult;
//# sourceMappingURL=mesh-buffer-resources.d.ts.map