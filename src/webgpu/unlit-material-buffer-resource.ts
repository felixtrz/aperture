import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import type { UnlitMaterialBufferDescriptorPlan } from "./unlit-material-buffer.js";
import { materialUniformBufferResourceKey } from "./resource-keys.js";

export type UnlitMaterialGpuBufferDiagnosticCode =
  | "unlitMaterialGpuBuffer.nullDescriptorPlan"
  | "unlitMaterialGpuBuffer.creationFailed";

export interface UnlitMaterialGpuBufferDiagnostic {
  readonly code: UnlitMaterialGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface UnlitMaterialGpuBufferResource {
  readonly resourceKey: string;
  readonly uniformBuffer: unknown;
  readonly dependencies: UnlitMaterialBufferDescriptorPlan["dependencies"];
}

export interface CreateUnlitMaterialGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: UnlitMaterialBufferDescriptorPlan | null;
}

export interface CreateUnlitMaterialGpuBufferResult {
  readonly valid: boolean;
  readonly resource: UnlitMaterialGpuBufferResource | null;
  readonly diagnostics: readonly UnlitMaterialGpuBufferDiagnostic[];
}

export function createUnlitMaterialGpuBuffer(
  options: CreateUnlitMaterialGpuBufferOptions,
): CreateUnlitMaterialGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "unlitMaterialGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create an unlit material GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = materialUniformBufferResourceKey(
    options.plan.descriptor.label ?? "unlit",
  );
  const result = createWebGpuBuffer({
    device: options.device,
    descriptor: options.plan.descriptor,
  });

  if (!result.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "unlitMaterialGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create unlit material uniform buffer '${resourceKey}': ${result.message}`,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey,
      uniformBuffer: result.buffer,
      dependencies: options.plan.dependencies,
    },
    diagnostics: [],
  };
}
