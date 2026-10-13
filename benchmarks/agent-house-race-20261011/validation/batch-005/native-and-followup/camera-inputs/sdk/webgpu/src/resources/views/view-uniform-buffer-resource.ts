import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../../gpu/buffer.js";
import { viewUniformBufferResourceKey } from "../core/resource-keys.js";
import type { ViewUniformBufferDescriptorPlan } from "./view-uniform-buffer.js";

export type ViewUniformGpuBufferDiagnosticCode =
  | "viewUniformGpuBuffer.nullDescriptorPlan"
  | "viewUniformGpuBuffer.creationFailed";

export interface ViewUniformGpuBufferDiagnostic {
  readonly code: ViewUniformGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface ViewUniformGpuBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly views: ViewUniformBufferDescriptorPlan["views"];
}

export interface CreateViewUniformGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: ViewUniformBufferDescriptorPlan | null;
}

export interface CreateViewUniformGpuBufferResult {
  readonly valid: boolean;
  readonly resource: ViewUniformGpuBufferResource | null;
  readonly diagnostics: readonly ViewUniformGpuBufferDiagnostic[];
}

export function createViewUniformGpuBuffer(
  options: CreateViewUniformGpuBufferOptions,
): CreateViewUniformGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "viewUniformGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a view uniform GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = viewUniformBufferResourceKey(
    options.plan.descriptor.label ?? "ViewUniforms/uniform",
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
          code: "viewUniformGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create view uniform buffer '${resourceKey}': ${result.message}`,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey,
      buffer: result.buffer,
      views: options.plan.views,
    },
    diagnostics: [],
  };
}
