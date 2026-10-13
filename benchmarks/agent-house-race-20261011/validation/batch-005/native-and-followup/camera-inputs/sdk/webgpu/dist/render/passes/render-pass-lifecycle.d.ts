import type { RenderPassAttachmentDescriptorPlan } from "./render-pass-attachments.js";
import type { RenderPassEncoderLike } from "./render-pass-command-executor.js";
export type RenderPassLifecycleDiagnosticCode = "renderPassLifecycle.nullAttachmentPlan" | "renderPassLifecycle.missingBeginRenderPass" | "renderPassLifecycle.missingEnd";
export interface RenderPassLifecycleDiagnostic {
    readonly code: RenderPassLifecycleDiagnosticCode;
    readonly message: string;
}
export interface RenderPassEncoderWithEndLike extends RenderPassEncoderLike {
    end?: () => void;
}
export interface RenderPassCommandEncoderLike {
    beginRenderPass?: (descriptor: RenderPassAttachmentDescriptorPlan) => RenderPassEncoderWithEndLike;
}
export interface BeginRenderPassOptions {
    readonly encoder: RenderPassCommandEncoderLike;
    readonly plan: RenderPassAttachmentDescriptorPlan | null;
}
export interface BeginRenderPassResult {
    readonly valid: boolean;
    readonly pass: RenderPassEncoderWithEndLike | null;
    readonly diagnostics: readonly RenderPassLifecycleDiagnostic[];
}
export interface EndRenderPassResult {
    readonly valid: boolean;
    readonly ended: boolean;
    readonly diagnostics: readonly RenderPassLifecycleDiagnostic[];
}
export declare function beginPlannedRenderPass(options: BeginRenderPassOptions): BeginRenderPassResult;
export declare function endPlannedRenderPass(pass: RenderPassEncoderWithEndLike): EndRenderPassResult;
//# sourceMappingURL=render-pass-lifecycle.d.ts.map