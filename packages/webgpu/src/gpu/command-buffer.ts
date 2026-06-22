import { commandBufferResourceKey } from "../resources/core/resource-keys.js";

export type CommandBufferFinishDiagnosticCode = "commandBuffer.missingFinish";

export interface CommandBufferFinishDiagnostic {
  readonly code: CommandBufferFinishDiagnosticCode;
  readonly message: string;
}

export interface CommandEncoderFinishLike {
  finish?: () => unknown;
}

export interface CommandBufferResource {
  readonly resourceKey: string;
  readonly commandBuffer: unknown;
}

export interface FinishCommandEncoderOptions {
  readonly encoder: CommandEncoderFinishLike;
  readonly label: string;
}

export interface FinishCommandEncoderResult {
  readonly valid: boolean;
  readonly resource: CommandBufferResource | null;
  readonly diagnostics: readonly CommandBufferFinishDiagnostic[];
}

export function finishCommandEncoder(
  options: FinishCommandEncoderOptions,
): FinishCommandEncoderResult {
  if (options.encoder.finish === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "commandBuffer.missingFinish",
          message: "Command encoder cannot finish command buffers.",
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey: commandBufferResourceKey(options.label),
      commandBuffer: options.encoder.finish(),
    },
    diagnostics: [],
  };
}
