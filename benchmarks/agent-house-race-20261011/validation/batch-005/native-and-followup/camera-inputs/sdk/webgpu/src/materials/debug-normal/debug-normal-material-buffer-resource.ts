import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../../gpu/buffer.js";
import type { DebugNormalMaterialBufferDescriptorPlan } from "./debug-normal-material-buffer.js";
import { materialUniformBufferResourceKey } from "../../resources/core/resource-keys.js";

export type DebugNormalMaterialGpuBufferDiagnosticCode =
  | "debugNormalMaterialGpuBuffer.nullDescriptorPlan"
  | "debugNormalMaterialGpuBuffer.creationFailed";

export interface DebugNormalMaterialGpuBufferDiagnostic {
  readonly code: DebugNormalMaterialGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface DebugNormalMaterialGpuBufferResource {
  readonly resourceKey: string;
  readonly uniformBuffer: unknown;
  readonly dependencies: DebugNormalMaterialBufferDescriptorPlan["dependencies"];
}

export interface DebugNormalMaterialGpuBufferResourceJsonValue {
  readonly resourceKey: string;
  readonly dependencies: DebugNormalMaterialBufferDescriptorPlan["dependencies"];
}

export interface CreateDebugNormalMaterialGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: DebugNormalMaterialBufferDescriptorPlan | null;
}

export interface CreateDebugNormalMaterialGpuBufferResult {
  readonly valid: boolean;
  readonly resource: DebugNormalMaterialGpuBufferResource | null;
  readonly diagnostics: readonly DebugNormalMaterialGpuBufferDiagnostic[];
}

export function createDebugNormalMaterialGpuBuffer(
  options: CreateDebugNormalMaterialGpuBufferOptions,
): CreateDebugNormalMaterialGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "debugNormalMaterialGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a debug-normal material GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = materialUniformBufferResourceKey(
    options.plan.descriptor.label ?? "debug-normal",
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
          code: "debugNormalMaterialGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create debug-normal material uniform buffer '${resourceKey}': ${result.message}`,
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

export function debugNormalMaterialGpuBufferResourceToJsonValue(
  resource: DebugNormalMaterialGpuBufferResource,
): DebugNormalMaterialGpuBufferResourceJsonValue {
  return {
    resourceKey: resource.resourceKey,
    dependencies: resource.dependencies,
  };
}
