import type { DrawCommandDescriptor, DrawCommandDescriptorDiagnostic } from "../draw/draw-command.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
export declare const DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY = "__aperture_draw_order_world_transforms__";
export type RenderPassDrawListDiagnosticCode = "renderPassDrawList.missingPipelineResource" | "renderPassDrawList.missingBindGroupResource";
export interface RenderPassDrawListDiagnostic {
    readonly code: RenderPassDrawListDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly pipelineKey?: string;
    readonly bindGroup?: {
        readonly group: number;
        readonly materialResourceKey?: string;
    };
}
export interface RenderPassDrawListRecord {
    readonly renderId: number;
    readonly pipelineKey: string;
    readonly bindGroupKeys: readonly string[];
    readonly meshResourceKey: string;
    readonly materialResourceKey: string;
    readonly vertexBufferKeys: readonly string[];
    readonly vertexCount: number;
    readonly vertexStart?: number;
    readonly indexBufferKey: string | null;
    readonly indexCount: number | null;
    readonly indexStart?: number | null;
    readonly instanceCount: number;
    readonly transformPackedOffset: number;
    readonly occlusionQuery?: boolean;
}
export interface RenderPassDrawListOptions {
    readonly drawCommands: readonly DrawCommandDescriptor[];
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly requiredBindGroupGroups?: readonly number[];
}
export interface RenderPassDrawListPlan {
    readonly valid: boolean;
    readonly draws: readonly RenderPassDrawListRecord[];
    readonly diagnostics: readonly (DrawCommandDescriptorDiagnostic | RenderPassDrawListDiagnostic)[];
}
export interface RenderPassDrawListScratch {
    readonly draws: RenderPassDrawListRecord[];
    readonly diagnostics: RenderPassDrawListDiagnostic[];
    readonly drawPool: RenderPassDrawListRecord[];
    readonly pipelineKeys: Set<string>;
    readonly resolvedBindGroups: UnlitBindGroupResource[];
    readonly plan: RenderPassDrawListPlan;
}
export declare function planRenderPassDrawList(options: RenderPassDrawListOptions): RenderPassDrawListPlan;
export declare function createRenderPassDrawListScratch(capacity?: number): RenderPassDrawListScratch;
export declare function writeRenderPassDrawList(options: RenderPassDrawListOptions, scratch: RenderPassDrawListScratch): RenderPassDrawListPlan;
//# sourceMappingURL=render-pass-draw-list.d.ts.map