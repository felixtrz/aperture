import type { RenderWorldDrawPackage } from "@aperture-engine/render";
import type { InstanceAttributeGpuBufferResource } from "../../resources/attributes/instance-attribute-buffer.js";
import type { InstanceTintGpuBufferResource } from "../../resources/attributes/instance-tint-buffer.js";
import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
export type DrawCommandDescriptorDiagnosticCode = "drawCommand.missingMeshResource" | "drawCommand.missingInstanceAttributeResource" | "drawCommand.missingInstanceAttributePacket" | "drawCommand.missingInstanceTintResource" | "drawCommand.missingInstanceTintOffset";
export interface DrawCommandDescriptorDiagnostic {
    readonly code: DrawCommandDescriptorDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly resourceKey: string;
}
export interface DrawCommandDescriptor {
    readonly renderId: number;
    readonly pipelineKey: string;
    readonly requiredBindGroupGroups?: readonly number[];
    readonly topology: RenderWorldDrawPackage["batchKey"]["topology"];
    readonly meshResourceKey: string;
    readonly materialResourceKey: string;
    readonly vertexBufferKeys: readonly string[];
    readonly vertexCount: number;
    readonly vertexStart?: number;
    readonly indexBufferKey: string | null;
    readonly indexCount: number | null;
    readonly indexStart?: number | null;
    readonly transformPackedOffset: number;
    readonly worldTransformResourceKey?: string;
    readonly occlusionQuery?: boolean;
}
export interface DrawCommandDescriptorPlan {
    readonly descriptors: readonly DrawCommandDescriptor[];
    readonly diagnostics: readonly DrawCommandDescriptorDiagnostic[];
}
export interface CreateDrawCommandDescriptorOptions {
    readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
    readonly instanceAttributeResources?: readonly InstanceAttributeGpuBufferResource[];
    readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
    readonly worldTransformResourceKeyByRenderId?: ReadonlyMap<number, string>;
}
export interface DrawCommandDescriptorScratch {
    readonly descriptors: DrawCommandDescriptor[];
    readonly diagnostics: DrawCommandDescriptorDiagnostic[];
    readonly descriptorPool: DrawCommandDescriptor[];
    readonly meshByResourceKey: Map<string, MeshGpuBufferResource>;
    readonly plan: DrawCommandDescriptorPlan;
}
/**
 * The canonical pipeline key carried by a draw's render-pass commands. When a
 * prepared GPU pipeline exists for the draw, frame preparation records its
 * resolved cache key in `pipelineKeysByRenderId`; otherwise commands fall back
 * to the authored batch pipeline key. Every consumer that needs to match a
 * draw's `setPipeline` command key (e.g. ID-buffer pick pipeline preparation)
 * must derive it through this helper so creation and lookup cannot drift.
 */
export declare function resolveDrawCommandPipelineKey(renderId: number, authoredPipelineKey: string, pipelineKeysByRenderId?: ReadonlyMap<number, string>): string;
export declare function createDrawCommandDescriptors(packages: readonly RenderWorldDrawPackage[], meshResources: readonly MeshGpuBufferResource[], options?: CreateDrawCommandDescriptorOptions): DrawCommandDescriptorPlan;
export declare function createDrawCommandDescriptorScratch(capacity?: number): DrawCommandDescriptorScratch;
export declare function writeDrawCommandDescriptors(packages: readonly RenderWorldDrawPackage[], meshResources: readonly MeshGpuBufferResource[], scratch: DrawCommandDescriptorScratch, options?: CreateDrawCommandDescriptorOptions): DrawCommandDescriptorPlan;
//# sourceMappingURL=draw-command.d.ts.map