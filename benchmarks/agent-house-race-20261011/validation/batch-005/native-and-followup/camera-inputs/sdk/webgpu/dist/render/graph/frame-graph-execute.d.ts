import { type CommandEncoderDeviceLike, type CreateCommandEncoderResult } from "../../gpu/command-encoder.js";
import { type FinishCommandEncoderResult } from "../../gpu/command-buffer.js";
import { type QueueSubmitLike, type SubmitCommandBuffersReport } from "../queues/queue-submit.js";
import { type EncodeFrameBoundaryIntoOptions, type FrameBoundaryDeviceLike, type FrameBoundaryEncodeReport, type FrameBoundaryEncoderHandle } from "../frame/frame-boundary.js";
import { type ComputePassCommandExecutionReport, type ComputePassEncoderLike } from "../passes/compute-pass-commands.js";
import { type CommandSubmissionMetricsReport } from "../../gpu/command-submission-metrics.js";
import type { CompiledFrameGraph } from "./frame-graph-compile.js";
import type { RenderPassNode } from "./frame-graph.js";
/**
 * A handle resolved to a concrete GPU view for use as a render-pass attachment.
 * `kind` lets the executor route it to a color vs depth attachment slot.
 */
export interface FrameGraphResolvedAttachment {
    readonly kind: "color" | "depth";
    readonly view: unknown;
    readonly resolveTarget?: unknown;
}
/**
 * Resolves graph handle ids to concrete GPU resources at execute time. The graph
 * model stays GPU-free (M3-T1); this is where ids become device views, supplied
 * by the route/resource layer (T3+).
 */
export type FrameGraphRenderNodeBoundary = Omit<EncodeFrameBoundaryIntoOptions, "encoder">;
export interface FrameGraphResources {
    resolveAttachment(handleId: string): FrameGraphResolvedAttachment | null;
    resolveReadbackTexture?(handleId: string): unknown;
    /**
     * Optional fast path for real routes: a fully-resolved boundary encode payload
     * (attachments + commands + readback/timing/occlusion) for a render node, built
     * by existing route code so encoding stays byte-identical to the legacy
     * assembleFrameBoundary path. When it returns a payload, it takes precedence
     * over resolveAttachment; the executor injects the shared encoder.
     */
    resolveRenderBoundary?(node: RenderPassNode): FrameGraphRenderNodeBoundary | null;
}
export interface ComputeCommandEncoderLike {
    beginComputePass?: (descriptor?: unknown) => ComputePassEncoderLike & {
        end?: () => void;
    };
}
export type FrameGraphExecuteEncoderHandle = FrameBoundaryEncoderHandle & ComputeCommandEncoderLike;
export interface ExecuteFrameGraphOptions {
    readonly device: FrameBoundaryDeviceLike & CommandEncoderDeviceLike;
    readonly queue: QueueSubmitLike;
    readonly compiled: CompiledFrameGraph;
    readonly resources: FrameGraphResources;
    readonly label?: string;
}
export type FrameGraphExecuteDiagnosticCode = "frameGraphExecute.compileNotOk" | "frameGraphExecute.encoderUnavailable" | "frameGraphExecute.missingComputePass" | "frameGraphExecute.unresolvedWrite";
export interface FrameGraphExecuteDiagnostic {
    readonly code: FrameGraphExecuteDiagnosticCode;
    readonly message: string;
}
export interface FrameGraphRenderNodeReport {
    readonly name: string;
    readonly kind: "render";
    readonly valid: boolean;
    readonly encode: FrameBoundaryEncodeReport;
}
export interface FrameGraphComputeNodeReport {
    readonly name: string;
    readonly kind: "compute";
    readonly valid: boolean;
    readonly execution: ComputePassCommandExecutionReport | null;
}
export type FrameGraphNodeReport = FrameGraphRenderNodeReport | FrameGraphComputeNodeReport;
export interface ExecuteFrameGraphReport {
    readonly valid: boolean;
    readonly encoder: CreateCommandEncoderResult | null;
    readonly nodes: readonly FrameGraphNodeReport[];
    readonly finish: FinishCommandEncoderResult | null;
    readonly submit: SubmitCommandBuffersReport | null;
    readonly metrics: CommandSubmissionMetricsReport;
    readonly diagnostics: readonly FrameGraphExecuteDiagnostic[];
}
export declare function executeFrameGraph(options: ExecuteFrameGraphOptions): ExecuteFrameGraphReport;
//# sourceMappingURL=frame-graph-execute.d.ts.map