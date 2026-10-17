import type { RenderPassAttachmentDescriptorPlan } from "./render-pass-attachments.js";
import type { RenderPassEncoderLike } from "./render-pass-command-executor.js";

export type RenderPassLifecycleDiagnosticCode =
  | "renderPassLifecycle.nullAttachmentPlan"
  | "renderPassLifecycle.missingBeginRenderPass"
  | "renderPassLifecycle.missingEnd";

export interface RenderPassLifecycleDiagnostic {
  readonly code: RenderPassLifecycleDiagnosticCode;
  readonly message: string;
}

export interface RenderPassEncoderWithEndLike extends RenderPassEncoderLike {
  end?: () => void;
}

export interface RenderPassCommandEncoderLike {
  beginRenderPass?: (
    descriptor: RenderPassAttachmentDescriptorPlan,
  ) => RenderPassEncoderWithEndLike;
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

export function beginPlannedRenderPass(
  options: BeginRenderPassOptions,
): BeginRenderPassResult {
  if (options.plan === null) {
    return {
      valid: false,
      pass: null,
      diagnostics: [
        {
          code: "renderPassLifecycle.nullAttachmentPlan",
          message: "Cannot begin a render pass from a null attachment plan.",
        },
      ],
    };
  }

  if (options.encoder.beginRenderPass === undefined) {
    return {
      valid: false,
      pass: null,
      diagnostics: [
        {
          code: "renderPassLifecycle.missingBeginRenderPass",
          message: "Command encoder cannot begin render passes.",
        },
      ],
    };
  }

  return {
    valid: true,
    pass: options.encoder.beginRenderPass(options.plan),
    diagnostics: [],
  };
}

export function endPlannedRenderPass(
  pass: RenderPassEncoderWithEndLike,
): EndRenderPassResult {
  if (pass.end === undefined) {
    return {
      valid: false,
      ended: false,
      diagnostics: [
        {
          code: "renderPassLifecycle.missingEnd",
          message: "Render pass encoder cannot end render passes.",
        },
      ],
    };
  }

  pass.end();
  return { valid: true, ended: true, diagnostics: [] };
}
