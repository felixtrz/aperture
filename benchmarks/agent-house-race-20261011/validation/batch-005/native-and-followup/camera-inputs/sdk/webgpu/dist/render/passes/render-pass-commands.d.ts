import type { ResolvedRenderPassDraw } from "./render-pass-resources.js";
export type RenderPassCommandKind = "setPipeline" | "setBindGroup" | "setVertexBuffer" | "setIndexBuffer" | "beginOcclusionQuery" | "endOcclusionQuery" | "draw" | "drawIndexed" | "drawIndirect" | "drawIndexedIndirect";
export type RenderPassStateCommandKind = "setPipeline" | "setBindGroup" | "setVertexBuffer" | "setIndexBuffer";
export type RenderPassCommandDiagnosticCode = "renderPassCommand.invalidVertexCount" | "renderPassCommand.invalidIndexCount" | "renderPassCommand.invalidTransformOffset";
export interface RenderPassCommandDiagnostic {
    readonly code: RenderPassCommandDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
}
export interface SetPipelineCommand {
    readonly kind: "setPipeline";
    readonly renderId: number;
    readonly pipelineKey: string;
    readonly pipeline: unknown;
}
export interface SetBindGroupCommand {
    readonly kind: "setBindGroup";
    readonly renderId: number;
    readonly index: number;
    readonly resourceKey: string;
    readonly bindGroup: unknown;
}
export interface SetVertexBufferCommand {
    readonly kind: "setVertexBuffer";
    readonly renderId: number;
    readonly slot: number;
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface SetIndexBufferCommand {
    readonly kind: "setIndexBuffer";
    readonly renderId: number;
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly format: string;
}
export interface BeginOcclusionQueryCommand {
    readonly kind: "beginOcclusionQuery";
    readonly renderId: number;
    readonly queryIndex: number;
}
export interface EndOcclusionQueryCommand {
    readonly kind: "endOcclusionQuery";
    readonly renderId: number;
    readonly queryIndex: number;
}
export interface DrawCommand {
    readonly kind: "draw";
    readonly renderId: number;
    readonly vertexCount: number;
    readonly instanceCount: number;
    readonly firstVertex: number;
    readonly firstInstance: number;
}
export interface DrawIndexedCommand {
    readonly kind: "drawIndexed";
    readonly renderId: number;
    readonly indexCount: number;
    readonly instanceCount: number;
    readonly firstIndex: number;
    readonly baseVertex: number;
    readonly firstInstance: number;
}
export interface DrawIndirectCommand {
    readonly kind: "drawIndirect";
    readonly renderId: number;
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly offset: number;
    readonly vertexCount: number;
    readonly instanceCount: number;
    readonly firstVertex: number;
    readonly firstInstance: number;
}
export interface DrawIndexedIndirectCommand {
    readonly kind: "drawIndexedIndirect";
    readonly renderId: number;
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly offset: number;
    readonly indexCount: number;
    readonly instanceCount: number;
    readonly firstIndex: number;
    readonly baseVertex: number;
    readonly firstInstance: number;
}
export type RenderPassCommand = SetPipelineCommand | SetBindGroupCommand | SetVertexBufferCommand | SetIndexBufferCommand | BeginOcclusionQueryCommand | EndOcclusionQueryCommand | DrawCommand | DrawIndexedCommand | DrawIndirectCommand | DrawIndexedIndirectCommand;
export interface RenderPassCommandPlanOptions {
    readonly draws: readonly ResolvedRenderPassDraw[];
}
export interface RenderPassCommandPlan {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly drawCount: number;
    readonly indexedDrawCount: number;
    readonly nonIndexedDrawCount: number;
    readonly occlusionQueryCount: number;
    readonly occlusionQueryRenderIds: readonly number[];
    readonly pressure: RenderPassCommandPressureReport;
    readonly diagnostics: readonly RenderPassCommandDiagnostic[];
}
export interface RenderPassStateCommandPressure {
    readonly planned: number;
    readonly emitted: number;
    readonly elided: number;
}
export interface RenderPassStateCommandPressureReport extends RenderPassStateCommandPressure {
    readonly setPipeline: RenderPassStateCommandPressure;
    readonly setBindGroup: RenderPassStateCommandPressure;
    readonly setVertexBuffer: RenderPassStateCommandPressure;
    readonly setIndexBuffer: RenderPassStateCommandPressure;
}
export interface RenderPassCommandPressureReport {
    readonly resolvedDraws: number;
    readonly drawCommands: number;
    readonly stateCommands: RenderPassStateCommandPressureReport;
}
export interface RenderPassCommandScratch {
    readonly commands: RenderPassCommand[];
    readonly diagnostics: RenderPassCommandDiagnostic[];
    readonly commandPool: RenderPassCommand[];
    readonly sortedBindGroups: ResolvedRenderPassDraw["bindGroups"][number][];
    readonly activeBindGroupResourceKeys: Map<number, string>;
    readonly activeBindGroups: Map<number, unknown>;
    readonly activeVertexBufferResourceKeys: Map<number, string>;
    readonly activeVertexBuffers: Map<number, unknown>;
    readonly occlusionQueryRenderIds: number[];
    readonly pressure: RenderPassCommandPressureReport;
    readonly plan: RenderPassCommandPlan;
}
export declare function planRenderPassCommands(options: RenderPassCommandPlanOptions): RenderPassCommandPlan;
export declare function createRenderPassCommandScratch(capacity?: number): RenderPassCommandScratch;
export declare function writeRenderPassCommands(options: RenderPassCommandPlanOptions, scratch: RenderPassCommandScratch): RenderPassCommandPlan;
//# sourceMappingURL=render-pass-commands.d.ts.map