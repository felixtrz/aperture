import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import type { MatcapMaterialBufferDescriptorPlan } from "./matcap-material-buffer.js";
import { materialUniformBufferResourceKey } from "./resource-keys.js";

export type MatcapMaterialGpuBufferDiagnosticCode =
  | "matcapMaterialGpuBuffer.nullDescriptorPlan"
  | "matcapMaterialGpuBuffer.creationFailed";

export interface MatcapMaterialGpuBufferDiagnostic {
  readonly code: MatcapMaterialGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface MatcapMaterialGpuBufferResource {
  readonly resourceKey: string;
  readonly uniformBuffer: unknown;
  readonly dependencies: MatcapMaterialBufferDescriptorPlan["dependencies"];
}

export interface CreateMatcapMaterialGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: MatcapMaterialBufferDescriptorPlan | null;
}

export interface CreateMatcapMaterialGpuBufferResult {
  readonly valid: boolean;
  readonly resource: MatcapMaterialGpuBufferResource | null;
  readonly diagnostics: readonly MatcapMaterialGpuBufferDiagnostic[];
}

export function createMatcapMaterialGpuBuffer(
  options: CreateMatcapMaterialGpuBufferOptions,
): CreateMatcapMaterialGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "matcapMaterialGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a matcap material GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = materialUniformBufferResourceKey(
    options.plan.descriptor.label ?? "matcap",
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
          code: "matcapMaterialGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create matcap material uniform buffer '${resourceKey}': ${result.message}`,
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
