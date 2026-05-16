import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { materialUniformBufferResourceKey } from "./resource-keys.js";
import type { StandardMaterialBufferDescriptorPlan } from "./standard-material-buffer.js";

export type StandardMaterialGpuBufferDiagnosticCode =
  | "standardMaterialGpuBuffer.nullDescriptorPlan"
  | "standardMaterialGpuBuffer.creationFailed";

export interface StandardMaterialGpuBufferDiagnostic {
  readonly code: StandardMaterialGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface StandardMaterialGpuBufferResource {
  readonly resourceKey: string;
  readonly uniformBuffer: unknown;
  readonly dependencies: StandardMaterialBufferDescriptorPlan["dependencies"];
  readonly featureFlags: number;
}

export interface CreateStandardMaterialGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: StandardMaterialBufferDescriptorPlan | null;
}

export interface CreateStandardMaterialGpuBufferResult {
  readonly valid: boolean;
  readonly resource: StandardMaterialGpuBufferResource | null;
  readonly diagnostics: readonly StandardMaterialGpuBufferDiagnostic[];
}

export function createStandardMaterialGpuBuffer(
  options: CreateStandardMaterialGpuBufferOptions,
): CreateStandardMaterialGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "standardMaterialGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a standard material GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = materialUniformBufferResourceKey(
    options.plan.descriptor.label ?? "standard",
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
          code: "standardMaterialGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create standard material uniform buffer '${resourceKey}': ${result.message}`,
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
      featureFlags: options.plan.featureFlags,
    },
    diagnostics: [],
  };
}
