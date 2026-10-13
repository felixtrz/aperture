import { type CommandEncoderFinishLike, type FinishCommandEncoderResult } from "../../gpu/command-buffer.js";
import { type CommandEncoderDeviceLike, type CreateCommandEncoderResult } from "../../gpu/command-encoder.js";
import { type CreateCurrentTextureColorTargetResult, type CurrentTextureContextLike, type CurrentTextureLike } from "../../app/presentation/current-texture-view.js";
import { type QueueSubmitLike } from "../queues/queue-submit.js";
import type { SubmitCommandBuffersReport } from "../queues/queue-submit.js";
import { type CreateRenderPassAttachmentPlanResult, type RenderPassAttachmentLoadOp, type RenderPassAttachmentStoreOp, type RenderPassColorAttachmentInput, type RenderPassDepthAttachmentInput } from "../passes/render-pass-attachments.js";
import { type RenderPassCommandExecutionReport } from "../passes/render-pass-command-executor.js";
import type { RenderPassCommand } from "../passes/render-pass-commands.js";
import { type RenderBundleCache, type RenderBundleDeviceLike, type RenderBundleEncoderDescriptorLike, type RenderBundleExecutionReport } from "../draw/render-bundle.js";
import { type GpuTimestampCommandEncoderLike, type GpuTimestampCommandReport, type GpuTimestampQueryResources } from "../../gpu/gpu-timing.js";
import { type GpuOcclusionCommandEncoderLike, type GpuOcclusionQueryResources, type GpuOcclusionQueryResolveReport } from "../../gpu/occlusion-query.js";
import { type BeginRenderPassResult, type EndRenderPassResult, type RenderPassCommandEncoderLike } from "../passes/render-pass-lifecycle.js";
export interface FrameBoundaryDeviceLike extends CommandEncoderDeviceLike, RenderBundleDeviceLike {
    createCommandEncoder?: () => RenderPassCommandEncoderLike & CommandEncoderFinishLike & FrameBoundaryReadbackCommandEncoderLike;
    createBuffer?: (descriptor: unknown) => FrameBoundaryReadbackBufferLike;
}
export interface FrameBoundaryReadbackSampleRequest {
    readonly id: string;
    readonly x: number;
    readonly y: number;
}
export interface FrameBoundaryReadbackOptions {
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly samples: readonly FrameBoundaryReadbackSampleRequest[];
}
export type FrameBoundaryReadbackFailureReason = "unsupported-texture-format" | "texture-size-invalid" | "buffer-usage-unavailable" | "map-mode-unavailable" | "create-buffer-unavailable" | "copy-texture-to-buffer-unavailable" | "map-read-unavailable" | "mapped-range-unavailable" | "readback-map-failed";
export interface FrameBoundaryReadbackPixel {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}
export interface FrameBoundaryReadbackOrigin {
    readonly x: number;
    readonly y: number;
}
export interface FrameBoundaryReadbackSample {
    readonly id: string;
    readonly origin: FrameBoundaryReadbackOrigin;
    readonly pixel: FrameBoundaryReadbackPixel;
}
export interface FrameBoundaryReadbackSuccess {
    readonly ok: true;
    readonly source: FrameBoundaryColorTargetSource;
    readonly format: string;
    readonly bytesPerRow: number;
    readonly samples: readonly FrameBoundaryReadbackSample[];
}
export interface FrameBoundaryReadbackFailure {
    readonly ok: false;
    readonly reason: FrameBoundaryReadbackFailureReason;
    readonly message: string;
    readonly clearOk: boolean;
}
export type FrameBoundaryReadbackResult = FrameBoundaryReadbackSuccess | FrameBoundaryReadbackFailure;
export interface FrameBoundaryReadbackBufferLike {
    mapAsync?: (mode: number) => Promise<void>;
    getMappedRange?: () => ArrayBuffer | ArrayBufferView;
    unmap?: () => void;
}
export interface FrameBoundaryReadbackCommandEncoderLike {
    copyTextureToBuffer?: (source: unknown, destination: unknown, copySize: unknown) => void;
}
interface FrameBoundaryReadbackCopyPlan {
    readonly ok: true;
    readonly source: FrameBoundaryColorTargetSource;
    readonly format: string;
    readonly byteOrder: TextureByteOrder;
    readonly bytesPerRow: number;
    readonly mapModeRead: number;
    readonly samples: readonly {
        readonly id: string;
        readonly origin: FrameBoundaryReadbackOrigin;
        readonly buffer: FrameBoundaryReadbackBufferLike;
    }[];
}
type FrameBoundaryReadbackPlan = FrameBoundaryReadbackCopyPlan | FrameBoundaryReadbackFailure;
export type FrameBoundaryColorTargetSource = "current-texture" | "offscreen-target";
export interface FrameBoundaryCurrentTextureTarget {
    readonly source: "current-texture";
}
export interface FrameBoundaryOffscreenTarget {
    readonly source: "offscreen-target";
    readonly texture: CurrentTextureLike | null | undefined;
}
export type FrameBoundaryColorTarget = FrameBoundaryCurrentTextureTarget | FrameBoundaryOffscreenTarget;
export interface FrameBoundaryMsaaColorTarget {
    readonly view: unknown;
    readonly sampleCount: number;
}
export interface FrameBoundaryViewRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export type FrameBoundaryPassRectangleDiagnosticCode = "frameBoundaryPassRectangle.invalidRectangle" | "frameBoundaryPassRectangle.missingSetViewport" | "frameBoundaryPassRectangle.missingSetScissorRect";
export interface FrameBoundaryPassRectangleDiagnostic {
    readonly code: FrameBoundaryPassRectangleDiagnosticCode;
    readonly message: string;
}
export interface FrameBoundaryPassRectangleReport {
    readonly valid: boolean;
    readonly viewport: FrameBoundaryViewRectangle | null;
    readonly scissor: FrameBoundaryViewRectangle | null;
    readonly diagnostics: readonly FrameBoundaryPassRectangleDiagnostic[];
}
type TextureByteOrder = "rgba" | "bgra";
export interface AssembleFrameBoundaryOptions {
    readonly context: CurrentTextureContextLike;
    readonly device: FrameBoundaryDeviceLike;
    readonly queue: QueueSubmitLike;
    readonly commands: readonly RenderPassCommand[];
    readonly label: string;
    readonly colorTarget?: FrameBoundaryColorTarget;
    readonly additionalColorTargets?: readonly RenderPassColorAttachmentInput[];
    readonly msaaColorTarget?: FrameBoundaryMsaaColorTarget | null;
    readonly colorLoadOp?: RenderPassAttachmentLoadOp;
    readonly msaaColorStoreOp?: RenderPassAttachmentStoreOp;
    readonly viewport?: FrameBoundaryViewRectangle | null;
    readonly scissor?: FrameBoundaryViewRectangle | null;
    readonly clearColor?: readonly number[];
    readonly depthTarget?: RenderPassDepthAttachmentInput | null;
    readonly readback?: FrameBoundaryReadbackOptions;
    readonly gpuTiming?: FrameBoundaryGpuTimingOptions;
    readonly occlusionQueries?: FrameBoundaryOcclusionQueryOptions;
    readonly renderBundle?: FrameBoundaryRenderBundleOptions;
}
export interface FrameBoundaryRenderBundleOptions {
    readonly cache: RenderBundleCache;
    readonly key: string;
    readonly descriptor: RenderBundleEncoderDescriptorLike;
    readonly bundledCommandCount?: number;
    readonly enabled?: boolean;
}
export interface FrameBoundaryGpuTimingOptions {
    readonly passName: string;
    readonly resources: GpuTimestampQueryResources;
    readonly startQuery?: number;
    readonly endQuery?: number;
    readonly resolveQueryCount?: number;
}
export interface FrameBoundaryOcclusionQueryOptions {
    readonly resources: GpuOcclusionQueryResources;
    readonly queryCount: number;
}
export interface FrameBoundaryGpuTimingCommandReport {
    readonly pass: string;
    readonly startQuery: number;
    readonly endQuery: number;
    readonly writeStart: GpuTimestampCommandReport | null;
    readonly writeEnd: GpuTimestampCommandReport | null;
    readonly resolve: GpuTimestampCommandReport | null;
    readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}
export interface FrameBoundaryAssemblyReport {
    readonly valid: boolean;
    readonly texture: CreateCurrentTextureColorTargetResult;
    readonly attachments: CreateRenderPassAttachmentPlanResult | null;
    readonly encoder: CreateCommandEncoderResult | null;
    readonly begin: BeginRenderPassResult | null;
    readonly rectangle?: FrameBoundaryPassRectangleReport | null;
    readonly execution: RenderPassCommandExecutionReport | null;
    readonly renderBundle?: RenderBundleExecutionReport | null;
    readonly end: EndRenderPassResult | null;
    readonly finish: FinishCommandEncoderResult | null;
    readonly submit: SubmitCommandBuffersReport | null;
    readonly readback?: FrameBoundaryReadbackPlan | null;
    readonly gpuTiming?: FrameBoundaryGpuTimingCommandReport | null;
    readonly occlusionQueries?: GpuOcclusionQueryResolveReport | null;
}
/**
 * The encoder-side surface of a frame boundary: the union of methods the begin/
 * execute/end/readback/timing/occlusion steps require on a single command encoder.
 */
export type FrameBoundaryEncoderHandle = RenderPassCommandEncoderLike & CommandEncoderFinishLike & FrameBoundaryReadbackCommandEncoderLike & GpuTimestampCommandEncoderLike & GpuOcclusionCommandEncoderLike;
export interface EncodeFrameBoundaryIntoOptions {
    /** The shared encoder to encode this boundary into (no create/finish/submit). */
    readonly encoder: FrameBoundaryEncoderHandle | undefined;
    readonly device: FrameBoundaryDeviceLike;
    /** Pre-built attachment plan (already resolved to concrete views + load/store). */
    readonly attachments: CreateRenderPassAttachmentPlanResult | null;
    readonly commands: readonly RenderPassCommand[];
    readonly label: string;
    readonly colorTargetSource: FrameBoundaryColorTargetSource;
    /** Source texture for readback copies (when `readback` is set). */
    readonly readbackTexture?: unknown;
    readonly viewport?: FrameBoundaryViewRectangle | null;
    readonly scissor?: FrameBoundaryViewRectangle | null;
    readonly readback?: FrameBoundaryReadbackOptions;
    readonly gpuTiming?: FrameBoundaryGpuTimingOptions;
    readonly occlusionQueries?: FrameBoundaryOcclusionQueryOptions;
    readonly renderBundle?: FrameBoundaryRenderBundleOptions;
}
export interface FrameBoundaryEncodeReport {
    readonly valid: boolean;
    readonly begin: BeginRenderPassResult | null;
    readonly rectangle: FrameBoundaryPassRectangleReport | null;
    readonly execution: RenderPassCommandExecutionReport | null;
    readonly renderBundle: RenderBundleExecutionReport | null;
    readonly end: EndRenderPassResult | null;
    readonly readback: FrameBoundaryReadbackPlan | null;
    readonly gpuTiming: FrameBoundaryGpuTimingCommandReport | null;
    readonly occlusionQueries: GpuOcclusionQueryResolveReport | null;
}
/**
 * Encode ONE render boundary (timing-start → begin → rectangles → draw commands
 * → end → timing-end → occlusion resolve → timing resolve → readback copy) into a
 * CALLER-PROVIDED encoder. It never creates, finishes, or submits the encoder —
 * that is the caller's job. This is the single-encoder primitive the FrameGraph
 * executor (M3) uses to fold every pass into one GPUCommandEncoder;
 * `assembleFrameBoundary` is the legacy one-pass wrapper around it.
 */
export declare function encodeFrameBoundaryInto(options: EncodeFrameBoundaryIntoOptions): FrameBoundaryEncodeReport;
export interface FrameBoundaryTargetPlanOptions {
    readonly context: CurrentTextureContextLike;
    readonly colorTarget?: FrameBoundaryColorTarget;
    readonly colorLoadOp?: RenderPassAttachmentLoadOp;
    readonly clearColor?: readonly number[];
    readonly msaaColorTarget?: FrameBoundaryMsaaColorTarget | null;
    readonly msaaColorStoreOp?: RenderPassAttachmentStoreOp;
    readonly additionalColorTargets?: readonly RenderPassColorAttachmentInput[];
    readonly depthTarget?: RenderPassDepthAttachmentInput | null;
    readonly occlusionQuerySet?: unknown;
}
export interface FrameBoundaryTargetPlan {
    readonly texture: CreateCurrentTextureColorTargetResult;
    readonly attachments: CreateRenderPassAttachmentPlanResult | null;
}
/**
 * Resolve a frame boundary's color target (swapchain or off-screen) and build
 * its render-pass attachment plan (color + optional MSAA resolve + extra color
 * targets + depth + occlusion query set). Extracted so the single-encoder graph
 * executor's route ports build attachments through the EXACT same path as the
 * legacy assembleFrameBoundary wrapper — keeping per-pass encoding identical.
 */
export declare function buildFrameBoundaryTargetPlan(options: FrameBoundaryTargetPlanOptions): FrameBoundaryTargetPlan;
export declare function assembleFrameBoundary(options: AssembleFrameBoundaryOptions): FrameBoundaryAssemblyReport;
export declare function mapFrameBoundaryReadbackSamples(plan: FrameBoundaryReadbackPlan | null | undefined, frameOk: boolean): Promise<FrameBoundaryReadbackResult | undefined>;
export {};
//# sourceMappingURL=frame-boundary.d.ts.map