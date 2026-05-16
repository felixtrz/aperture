import type { PackedSnapshotTransforms } from "../rendering/index.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { worldTransformBufferResourceKey } from "./resource-keys.js";

export type WorldTransformBufferDescriptorDiagnosticCode =
  | "worldTransformBuffer.emptyData"
  | "worldTransformBuffer.invalidUsageFlags"
  | "worldTransformBuffer.packDiagnostic";

export interface WorldTransformBufferDescriptorDiagnostic {
  readonly code: WorldTransformBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly sourceCode?: string;
}

export interface WorldTransformBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly offsets: PackedSnapshotTransforms["offsets"];
}

export interface CreateWorldTransformBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface WorldTransformBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: WorldTransformBufferDescriptorPlan | null;
  readonly diagnostics: readonly WorldTransformBufferDescriptorDiagnostic[];
}

export type WorldTransformGpuBufferDiagnosticCode =
  | "worldTransformGpuBuffer.nullDescriptorPlan"
  | "worldTransformGpuBuffer.creationFailed";

export interface WorldTransformGpuBufferDiagnostic {
  readonly code: WorldTransformGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface WorldTransformGpuBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offsets: WorldTransformBufferDescriptorPlan["offsets"];
}

export interface CreateWorldTransformGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: WorldTransformBufferDescriptorPlan | null;
}

export interface CreateWorldTransformGpuBufferResult {
  readonly valid: boolean;
  readonly resource: WorldTransformGpuBufferResource | null;
  readonly diagnostics: readonly WorldTransformGpuBufferDiagnostic[];
}

export const DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function createWorldTransformBufferDescriptor(
  packed: PackedSnapshotTransforms,
  options: CreateWorldTransformBufferDescriptorOptions = {},
): WorldTransformBufferDescriptorResult {
  const diagnostics: WorldTransformBufferDescriptorDiagnostic[] =
    packed.diagnostics.map((diagnostic) => ({
      code: "worldTransformBuffer.packDiagnostic",
      sourceCode: diagnostic.code,
      message: diagnostic.message,
    }));
  const usage = options.usage ?? DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "worldTransformBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "World transform storage buffer usage flags must be a positive integer.",
    });
  }

  if (packed.data.byteLength === 0 || packed.offsets.length === 0) {
    diagnostics.push({
      code: "worldTransformBuffer.emptyData",
      field: "data",
      message:
        "Packed world transform data must contain at least one transform matrix.",
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  return {
    valid: true,
    plan: {
      source: packed.data,
      offsets: packed.offsets,
      descriptor: {
        label: options.label ?? "WorldTransforms/storage",
        size: packed.data.byteLength,
        usage,
        initialData: packed.data,
      },
    },
    diagnostics,
  };
}

export function createWorldTransformGpuBuffer(
  options: CreateWorldTransformGpuBufferOptions,
): CreateWorldTransformGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "worldTransformGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a world transform GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = worldTransformBufferResourceKey(
    options.plan.descriptor.label ?? "WorldTransforms/storage",
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
          code: "worldTransformGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create world transform buffer '${resourceKey}': ${result.message}`,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey,
      buffer: result.buffer,
      offsets: options.plan.offsets,
    },
    diagnostics: [],
  };
}
