import type {
  InstanceAttributeLayout,
  PackedSnapshotInstanceAttributes,
} from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { instanceAttributeBufferResourceKey } from "./resource-keys.js";

export type InstanceAttributeBufferDescriptorDiagnosticCode =
  | "instanceAttributeBuffer.emptyData"
  | "instanceAttributeBuffer.layoutMismatch"
  | "instanceAttributeBuffer.invalidUsageFlags"
  | "instanceAttributeBuffer.packDiagnostic";

export interface InstanceAttributeBufferDescriptorDiagnostic {
  readonly code: InstanceAttributeBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly sourceCode?: string;
}

export interface InstanceAttributeBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly layout: InstanceAttributeLayout;
  readonly offsets: PackedSnapshotInstanceAttributes["offsets"];
  readonly vertexCount: number;
}

export interface CreateInstanceAttributeBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface InstanceAttributeBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: InstanceAttributeBufferDescriptorPlan | null;
  readonly diagnostics: readonly InstanceAttributeBufferDescriptorDiagnostic[];
}

export type InstanceAttributeGpuBufferDiagnosticCode =
  | "instanceAttributeGpuBuffer.nullDescriptorPlan"
  | "instanceAttributeGpuBuffer.creationFailed";

export interface InstanceAttributeGpuBufferDiagnostic {
  readonly code: InstanceAttributeGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface InstanceAttributeGpuBufferResource {
  readonly streamId: "instanceAttributes";
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly vertexCount: number;
  readonly layout: InstanceAttributeLayout;
  readonly offsets: InstanceAttributeBufferDescriptorPlan["offsets"];
}

export interface CreateInstanceAttributeGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: InstanceAttributeBufferDescriptorPlan | null;
}

export interface CreateInstanceAttributeGpuBufferResult {
  readonly valid: boolean;
  readonly resource: InstanceAttributeGpuBufferResource | null;
  readonly diagnostics: readonly InstanceAttributeGpuBufferDiagnostic[];
}

export const DEFAULT_INSTANCE_ATTRIBUTE_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.VERTEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function createInstanceAttributeVertexBufferLayout(
  layout: InstanceAttributeLayout,
) {
  return {
    arrayStride: layout.stride,
    stepMode: "instance",
    attributes: layout.attributes.map((attribute) => ({
      shaderLocation: attribute.shaderLocation,
      offset: attribute.offset,
      format: attribute.format,
    })),
  } as const;
}

export function createInstanceAttributeBufferDescriptor(
  packed: PackedSnapshotInstanceAttributes,
  options: CreateInstanceAttributeBufferDescriptorOptions = {},
): InstanceAttributeBufferDescriptorResult {
  const diagnostics: InstanceAttributeBufferDescriptorDiagnostic[] = [];

  for (const diagnostic of packed.diagnostics) {
    diagnostics.push({
      code: "instanceAttributeBuffer.packDiagnostic",
      sourceCode: diagnostic.code,
      message: diagnostic.message,
    });
  }

  const usage = options.usage ?? DEFAULT_INSTANCE_ATTRIBUTE_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "instanceAttributeBuffer.invalidUsageFlags",
      field: "usage",
      message:
        "Instance attribute vertex buffer usage flags must be a positive integer.",
    });
  }

  const source = packed.data.subarray(0, packed.floatCount);
  const vertexCount = source.length / packed.layout.strideFloats;

  if (source.byteLength === 0 || packed.offsets.length === 0) {
    diagnostics.push({
      code: "instanceAttributeBuffer.emptyData",
      field: "data",
      message:
        "Packed instance attribute data must contain at least one instance row.",
    });
  }

  if (!Number.isInteger(vertexCount)) {
    diagnostics.push({
      code: "instanceAttributeBuffer.layoutMismatch",
      field: "layout",
      message:
        "Packed instance attribute data length must be divisible by the layout stride.",
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  return {
    valid: true,
    plan: {
      descriptor: {
        label: options.label ?? "InstanceAttributes/vertex",
        size: source.byteLength,
        usage,
        initialData: source,
      },
      source,
      layout: packed.layout,
      offsets: packed.offsets,
      vertexCount,
    },
    diagnostics,
  };
}

export function createInstanceAttributeGpuBuffer(
  options: CreateInstanceAttributeGpuBufferOptions,
): CreateInstanceAttributeGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "instanceAttributeGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create an instance attribute GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = instanceAttributeBufferResourceKey(
    options.plan.descriptor.label ?? "InstanceAttributes/vertex",
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
          code: "instanceAttributeGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create instance attribute buffer '${resourceKey}': ${result.message}`,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      streamId: "instanceAttributes",
      resourceKey,
      buffer: result.buffer,
      vertexCount: options.plan.vertexCount,
      layout: options.plan.layout,
      offsets: options.plan.offsets,
    },
    diagnostics: [],
  };
}
