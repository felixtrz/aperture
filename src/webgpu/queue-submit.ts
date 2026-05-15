import type { CommandBufferResource } from "./command-buffer.js";

export type QueueSubmitDiagnosticCode =
  | "queueSubmit.missingSubmit"
  | "queueSubmit.emptyCommandBuffers";

export interface QueueSubmitDiagnostic {
  readonly code: QueueSubmitDiagnosticCode;
  readonly message: string;
}

export interface QueueSubmitLike {
  submit?: (commandBuffers: readonly unknown[]) => void;
}

export interface SubmitCommandBuffersOptions {
  readonly queue: QueueSubmitLike;
  readonly commandBuffers: readonly CommandBufferResource[];
}

export interface SubmitCommandBuffersReport {
  readonly valid: boolean;
  readonly submitted: number;
  readonly skipped: number;
  readonly commandBufferKeys: readonly string[];
  readonly diagnostics: readonly QueueSubmitDiagnostic[];
}

export function submitCommandBuffers(
  options: SubmitCommandBuffersOptions,
): SubmitCommandBuffersReport {
  if (options.commandBuffers.length === 0) {
    return {
      valid: false,
      submitted: 0,
      skipped: 0,
      commandBufferKeys: [],
      diagnostics: [
        {
          code: "queueSubmit.emptyCommandBuffers",
          message: "Queue submission requires at least one command buffer.",
        },
      ],
    };
  }

  const commandBufferKeys = options.commandBuffers.map(
    (resource) => resource.resourceKey,
  );

  if (options.queue.submit === undefined) {
    return {
      valid: false,
      submitted: 0,
      skipped: options.commandBuffers.length,
      commandBufferKeys,
      diagnostics: [
        {
          code: "queueSubmit.missingSubmit",
          message: "WebGPU queue cannot submit command buffers.",
        },
      ],
    };
  }

  options.queue.submit(
    options.commandBuffers.map((resource) => resource.commandBuffer),
  );

  return {
    valid: true,
    submitted: options.commandBuffers.length,
    skipped: 0,
    commandBufferKeys,
    diagnostics: [],
  };
}
