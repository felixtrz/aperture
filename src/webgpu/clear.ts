import type {
  WebGpuCanvasContextLike,
  WebGpuDeviceLike,
  WebGpuFailure,
} from "./index.js";
import { finishCommandEncoder } from "./command-buffer.js";
import { createCommandEncoderResource } from "./command-encoder.js";
import { createCurrentTextureColorTarget } from "./current-texture-view.js";
import { submitCommandBuffers } from "./queue-submit.js";
import {
  createRenderPassAttachmentPlan,
  type RenderPassAttachmentDescriptorPlan,
} from "./render-pass-attachments.js";
import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type RenderPassCommandEncoderLike,
  type RenderPassEncoderWithEndLike,
} from "./render-pass-lifecycle.js";

export type WebGpuClearFailureReason =
  | "queue-unavailable"
  | "encoder-unavailable"
  | "current-texture-unavailable"
  | "texture-view-unavailable";

export interface WebGpuClearFailure {
  readonly ok: false;
  readonly reason: WebGpuClearFailureReason;
  readonly message: string;
}

export interface WebGpuClearSuccess {
  readonly ok: true;
  readonly commandBuffer: unknown;
}

export type WebGpuClearResult = WebGpuClearSuccess | WebGpuClearFailure;

export interface WebGpuClearColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface WebGpuClearOptions {
  readonly device: WebGpuClearDeviceLike;
  readonly context: WebGpuClearContextLike;
  readonly color?: WebGpuClearColor;
  readonly depth?: number;
  readonly stencil?: number;
}

export interface WebGpuClearDeviceLike extends WebGpuDeviceLike {
  readonly queue?: {
    submit(commandBuffers: readonly unknown[]): void;
  };
  createCommandEncoder?: () => WebGpuCommandEncoderLike;
}

export interface WebGpuClearContextLike extends WebGpuCanvasContextLike {
  getCurrentTexture?: () => WebGpuTextureLike | null;
}

export interface WebGpuTextureLike {
  createView?: () => unknown;
}

export interface WebGpuCommandEncoderLike {
  beginRenderPass(descriptor: unknown): WebGpuRenderPassEncoderLike;
  finish(): unknown;
}

export interface WebGpuRenderPassEncoderLike {
  end(): void;
}

export function clearWebGpuCanvas(
  options: WebGpuClearOptions,
): WebGpuClearResult {
  if (options.device.queue === undefined) {
    return failure("queue-unavailable", "WebGPU device queue is unavailable.");
  }

  if (options.device.createCommandEncoder === undefined) {
    return failure(
      "encoder-unavailable",
      "WebGPU device cannot create a command encoder.",
    );
  }

  const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
  const colorTarget = createCurrentTextureColorTarget({
    context: options.context,
    clearColor: [color.r, color.g, color.b, color.a],
    loadOp: "clear",
    storeOp: "store",
  });

  if (!colorTarget.valid || colorTarget.target === null) {
    const reason =
      colorTarget.diagnostics[0]?.code ===
      "currentTextureView.missingTextureView"
        ? "texture-view-unavailable"
        : "current-texture-unavailable";

    return failure(
      reason,
      reason === "texture-view-unavailable"
        ? "WebGPU current texture did not provide a texture view."
        : "WebGPU context did not provide a current texture.",
    );
  }

  const attachmentPlan = createRenderPassAttachmentPlan({
    colorTargets: [colorTarget.target],
  });

  if (!attachmentPlan.valid || attachmentPlan.plan === null) {
    return failure(
      "texture-view-unavailable",
      "WebGPU clear target is invalid.",
    );
  }

  const encoderResource = createCommandEncoderResource({
    device: options.device,
    label: "clear",
  });

  if (!encoderResource.valid || encoderResource.resource === null) {
    return failure(
      "encoder-unavailable",
      "WebGPU device cannot create a command encoder.",
    );
  }

  const encoder = encoderResource.resource
    .encoder as RenderPassCommandEncoderLike & WebGpuCommandEncoderLike;
  const begin = beginPlannedRenderPass({
    encoder,
    plan: withDepthStencil(attachmentPlan.plan, options),
  });

  if (!begin.valid || begin.pass === null) {
    return failure(
      "encoder-unavailable",
      "WebGPU command encoder cannot begin a render pass.",
    );
  }

  const end = endPlannedRenderPass(begin.pass as RenderPassEncoderWithEndLike);

  if (!end.valid) {
    return failure(
      "encoder-unavailable",
      "WebGPU render pass encoder cannot end a render pass.",
    );
  }

  const finished = finishCommandEncoder({
    encoder,
    label: "clear",
  });

  if (!finished.valid || finished.resource === null) {
    return failure(
      "encoder-unavailable",
      "WebGPU command encoder cannot finish command buffers.",
    );
  }

  const submitted = submitCommandBuffers({
    queue: options.device.queue,
    commandBuffers: [finished.resource],
  });

  if (!submitted.valid) {
    return failure("queue-unavailable", "WebGPU device queue is unavailable.");
  }

  return { ok: true, commandBuffer: finished.resource.commandBuffer };
}

function failure(
  reason: WebGpuClearFailureReason,
  message: string,
): WebGpuClearFailure {
  return { ok: false, reason, message };
}

function withDepthStencil(
  plan: RenderPassAttachmentDescriptorPlan,
  options: WebGpuClearOptions,
): RenderPassAttachmentDescriptorPlan {
  if (options.depth === undefined && options.stencil === undefined) {
    return plan;
  }

  return {
    ...plan,
    depthStencilAttachment: {
      view: plan.colorAttachments[0]?.view,
      depthClearValue: options.depth,
      depthLoadOp: options.depth === undefined ? "load" : "clear",
      depthStoreOp: options.depth === undefined ? "store" : "store",
      stencilClearValue: options.stencil,
      stencilLoadOp: options.stencil === undefined ? undefined : "clear",
      stencilStoreOp: options.stencil === undefined ? undefined : "store",
    } as NonNullable<
      RenderPassAttachmentDescriptorPlan["depthStencilAttachment"]
    >,
  };
}
