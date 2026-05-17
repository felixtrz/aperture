import type { PackedSnapshotTransforms } from "@aperture-engine/render";
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

export interface WorldTransformBufferDescriptorScratch {
  source: Float32Array;
  readonly descriptor: {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
    initialData?: ArrayBufferView;
  };
  readonly plan: {
    descriptor: WebGpuBufferDescriptor;
    source: Float32Array;
    offsets: PackedSnapshotTransforms["offsets"];
  };
  readonly diagnostics: WorldTransformBufferDescriptorDiagnostic[];
  readonly result: {
    valid: boolean;
    plan: WorldTransformBufferDescriptorPlan | null;
    diagnostics: readonly WorldTransformBufferDescriptorDiagnostic[];
  };
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

export function createWorldTransformBufferDescriptorScratch(): WorldTransformBufferDescriptorScratch {
  const descriptor = {
    size: 0,
    usage: DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE,
  };
  const plan = {
    descriptor,
    source: new Float32Array(0),
    offsets: [],
  };
  const diagnostics: WorldTransformBufferDescriptorDiagnostic[] = [];

  return {
    source: new Float32Array(0),
    descriptor,
    plan,
    diagnostics,
    result: { valid: false, plan: null, diagnostics },
  };
}

export function writeWorldTransformBufferDescriptor(
  packed: PackedSnapshotTransforms,
  scratch: WorldTransformBufferDescriptorScratch,
  options: CreateWorldTransformBufferDescriptorOptions = {},
): WorldTransformBufferDescriptorResult {
  const diagnostics = scratch.diagnostics;

  diagnostics.length = 0;

  for (const diagnostic of packed.diagnostics) {
    diagnostics.push({
      code: "worldTransformBuffer.packDiagnostic",
      sourceCode: diagnostic.code,
      message: diagnostic.message,
    });
  }

  const usage = options.usage ?? DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "worldTransformBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "World transform storage buffer usage flags must be a positive integer.",
    });
  }

  const floatCount = packed.floatCount ?? packed.data.length;
  const source = sourceViewFor(scratch, packed.data, floatCount);

  if (source.byteLength === 0 || packed.offsets.length === 0) {
    diagnostics.push({
      code: "worldTransformBuffer.emptyData",
      field: "data",
      message:
        "Packed world transform data must contain at least one transform matrix.",
    });
  }

  if (diagnostics.length > 0) {
    scratch.result.valid = false;
    scratch.result.plan = null;
    return scratch.result;
  }

  scratch.descriptor.label = options.label ?? "WorldTransforms/storage";
  scratch.descriptor.size = source.byteLength;
  scratch.descriptor.usage = usage;
  scratch.descriptor.initialData = source;
  scratch.plan.source = source;
  scratch.plan.offsets = packed.offsets;
  scratch.result.valid = true;
  scratch.result.plan = scratch.plan;

  return scratch.result;
}

export function createWorldTransformBufferDescriptor(
  packed: PackedSnapshotTransforms,
  options: CreateWorldTransformBufferDescriptorOptions = {},
): WorldTransformBufferDescriptorResult {
  return writeWorldTransformBufferDescriptor(
    packed,
    createWorldTransformBufferDescriptorScratch(),
    options,
  );
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

function sourceViewFor(
  scratch: WorldTransformBufferDescriptorScratch,
  data: Float32Array,
  floatCount: number,
): Float32Array {
  if (floatCount === data.length) {
    scratch.source = data;
    return data;
  }

  if (
    scratch.source.buffer !== data.buffer ||
    scratch.source.byteOffset !== data.byteOffset ||
    scratch.source.length !== floatCount
  ) {
    scratch.source = data.subarray(0, floatCount);
  }

  return scratch.source;
}
