import { commandEncoderResourceKey } from "../resources/core/resource-keys.js";

export type CommandEncoderCreationDiagnosticCode =
  "commandEncoder.missingCreateCommandEncoder";

export interface CommandEncoderCreationDiagnostic {
  readonly code: CommandEncoderCreationDiagnosticCode;
  readonly message: string;
}

export interface CommandEncoderDeviceLike {
  createCommandEncoder?: () => unknown;
}

export interface CommandEncoderResource {
  readonly resourceKey: string;
  readonly encoder: unknown;
}

export interface CreateCommandEncoderOptions {
  readonly device: CommandEncoderDeviceLike;
  readonly label: string;
}

export interface CreateCommandEncoderResult {
  readonly valid: boolean;
  readonly resource: CommandEncoderResource | null;
  readonly diagnostics: readonly CommandEncoderCreationDiagnostic[];
}

export function createCommandEncoderResource(
  options: CreateCommandEncoderOptions,
): CreateCommandEncoderResult {
  if (options.device.createCommandEncoder === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "commandEncoder.missingCreateCommandEncoder",
          message: "WebGPU device cannot create command encoders.",
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey: commandEncoderResourceKey(options.label),
      encoder: options.device.createCommandEncoder(),
    },
    diagnostics: [],
  };
}
