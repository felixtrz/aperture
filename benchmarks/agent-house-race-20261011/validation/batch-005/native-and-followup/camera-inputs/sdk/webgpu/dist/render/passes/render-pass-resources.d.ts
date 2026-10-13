import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { InstanceAttributeGpuBufferResource } from "../../resources/attributes/instance-attribute-buffer.js";
import type { InstanceTintGpuBufferResource } from "../../resources/attributes/instance-tint-buffer.js";
import type { RenderPassDrawListDiagnostic, RenderPassDrawListRecord } from "./render-pass-draw-list.js";
import type { UnlitBindGroupResource, UnlitBindGroupResourceDiagnostic } from "../../materials/unlit/unlit-bind-group.js";
export type RenderPassResourceDiagnosticCode = "renderPassResource.missingPipeline" | "renderPassResource.missingBindGroup" | "renderPassResource.missingVertexBuffer" | "renderPassResource.missingIndexBuffer";
export interface RenderPassResourceDiagnostic {
    readonly code: RenderPassResourceDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly resourceKey: string;
}
export interface ResolvedRenderPassBindGroup {
    readonly group: number;
    readonly resourceKey: string;
    readonly bindGroup: unknown;
}
export interface ResolvedRenderPassVertexBuffer {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly vertexCount: number;
}
export interface ResolvedRenderPassIndexBuffer {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly format: string;
    readonly indexCount: number;
}
export interface ResolvedRenderPassDraw {
    readonly renderId: number;
    readonly pipelineKey: string;
    readonly pipeline: unknown;
    readonly bindGroups: readonly ResolvedRenderPassBindGroup[];
    readonly vertexBuffers: readonly ResolvedRenderPassVertexBuffer[];
    readonly vertexCount: number;
    readonly vertexStart?: number;
    readonly indexBuffer: ResolvedRenderPassIndexBuffer | null;
    readonly indexCount: number | null;
    readonly indexStart?: number | null;
    readonly instanceCount: number;
    readonly transformPackedOffset: number;
    readonly occlusionQuery?: boolean;
}
export interface ResolveRenderPassResourcesOptions {
    readonly drawList: readonly RenderPassDrawListRecord[];
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly meshResources: readonly MeshGpuBufferResource[];
    readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
    readonly instanceAttributeResources?: readonly InstanceAttributeGpuBufferResource[];
}
export interface ResolveRenderPassResourcesResult {
    readonly valid: boolean;
    readonly draws: readonly ResolvedRenderPassDraw[];
    readonly diagnostics: readonly (RenderPassDrawListDiagnostic | UnlitBindGroupResourceDiagnostic | RenderPassResourceDiagnostic)[];
}
export interface ResolveRenderPassResourcesScratch {
    readonly draws: ResolvedRenderPassDraw[];
    readonly diagnostics: RenderPassResourceDiagnostic[];
    readonly drawPool: ResolvedRenderPassDraw[];
    readonly bindGroupPool: ResolvedRenderPassBindGroup[];
    readonly vertexBufferPool: ResolvedRenderPassVertexBuffer[];
    readonly indexBufferPool: ResolvedRenderPassIndexBuffer[];
    readonly pipelines: Map<string, unknown>;
    readonly bindGroups: Map<string, UnlitBindGroupResource>;
    readonly vertexBuffers: Map<string, MeshGpuBufferResource["vertexBuffers"][number]>;
    readonly indexBuffers: Map<string, NonNullable<MeshGpuBufferResource["indexBuffer"]>>;
    readonly plan: ResolveRenderPassResourcesResult;
    bindGroupCursor: number;
    vertexBufferCursor: number;
    indexBufferCursor: number;
}
export declare function resolveRenderPassResources(options: ResolveRenderPassResourcesOptions): ResolveRenderPassResourcesResult;
export declare function createResolveRenderPassResourcesScratch(capacity?: number): ResolveRenderPassResourcesScratch;
export declare function writeResolveRenderPassResources(options: ResolveRenderPassResourcesOptions, scratch: ResolveRenderPassResourcesScratch): ResolveRenderPassResourcesResult;
//# sourceMappingURL=render-pass-resources.d.ts.map