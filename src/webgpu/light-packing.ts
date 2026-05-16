import type {
  LightKind,
  LightPacket,
  RenderSnapshot,
} from "../rendering/index.js";
import type { WebGpuBufferDescriptor } from "./buffer.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";

export const PACKED_LIGHT_FLOAT_STRIDE = 8;
export const PACKED_LIGHT_METADATA_STRIDE = 6;

export const PackedLightKindId = {
  Ambient: 0,
  Directional: 1,
  Point: 2,
  Spot: 3,
  Environment: 4,
} as const;

export type PackedLightKindId =
  (typeof PackedLightKindId)[keyof typeof PackedLightKindId];

export interface PackedLightPackets {
  readonly count: number;
  readonly floatStride: typeof PACKED_LIGHT_FLOAT_STRIDE;
  readonly metadataStride: typeof PACKED_LIGHT_METADATA_STRIDE;
  readonly floats: Float32Array;
  readonly metadata: Int32Array;
}

export const DEFAULT_LIGHT_BUFFER_RESOURCE_KEY = "light-buffer:main";

export type LightBufferUsageIntent = "read-only-storage";

export interface LightBufferDescriptor {
  readonly resourceKey: string;
  readonly usageIntent: LightBufferUsageIntent;
  readonly count: number;
  readonly byteLength: number;
  readonly floatByteLength: number;
  readonly metadataByteLength: number;
  readonly packed: PackedLightPackets;
}

export interface CreateLightBufferDescriptorOptions {
  readonly resourceKey?: string;
}

export const DEFAULT_LIGHT_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export type LightBufferDescriptorPlanDiagnosticCode =
  "lightBufferDescriptor.invalidUsageFlags";

export interface LightBufferDescriptorPlanDiagnostic {
  readonly code: LightBufferDescriptorPlanDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface LightBufferDescriptorPlan {
  readonly resourceKey: string;
  readonly source: PackedLightPackets;
  readonly floatDescriptor: WebGpuBufferDescriptor;
  readonly metadataDescriptor: WebGpuBufferDescriptor;
}

export interface CreateLightBufferDescriptorPlanOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface CreateLightBufferDescriptorPlanResult {
  readonly valid: boolean;
  readonly plan: LightBufferDescriptorPlan | null;
  readonly diagnostics: readonly LightBufferDescriptorPlanDiagnostic[];
}

export type LightGpuBufferDiagnosticCode =
  | "lightGpuBuffer.nullDescriptorPlan"
  | "lightGpuBuffer.creationFailed";

export interface LightGpuBufferDiagnostic {
  readonly code: LightGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface LightGpuBufferResource {
  readonly resourceKey: string;
  readonly floatResourceKey: string;
  readonly metadataResourceKey: string;
  readonly floatBuffer: unknown;
  readonly metadataBuffer: unknown;
  readonly count: number;
}

export interface CreateLightGpuBuffersOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: LightBufferDescriptorPlan | null;
}

export interface CreateLightGpuBuffersResult {
  readonly valid: boolean;
  readonly resource: LightGpuBufferResource | null;
  readonly diagnostics: readonly LightGpuBufferDiagnostic[];
}

export type PackLightPacketsInput =
  | readonly LightPacket[]
  | Pick<RenderSnapshot, "lights">;

export type CreateLightBufferDescriptorInput =
  | PackedLightPackets
  | PackLightPacketsInput;

export function packLightPackets(
  input: PackLightPacketsInput,
): PackedLightPackets {
  const lights = isLightPacketArray(input) ? input : input.lights;
  const floats = new Float32Array(lights.length * PACKED_LIGHT_FLOAT_STRIDE);
  const metadata = new Int32Array(lights.length * PACKED_LIGHT_METADATA_STRIDE);

  lights.forEach((light, index) => {
    const floatOffset = index * PACKED_LIGHT_FLOAT_STRIDE;
    const metadataOffset = index * PACKED_LIGHT_METADATA_STRIDE;

    floats.set(
      [
        light.color[0] ?? 0,
        light.color[1] ?? 0,
        light.color[2] ?? 0,
        light.color[3] ?? 1,
        light.intensity,
        light.range,
        light.innerConeAngle,
        light.outerConeAngle,
      ],
      floatOffset,
    );
    metadata.set(
      [
        packedLightKindId(light.kind),
        light.worldTransformOffset,
        light.layerMask,
        light.lightId,
        light.entity.index,
        light.entity.generation,
      ],
      metadataOffset,
    );
  });

  return {
    count: lights.length,
    floatStride: PACKED_LIGHT_FLOAT_STRIDE,
    metadataStride: PACKED_LIGHT_METADATA_STRIDE,
    floats,
    metadata,
  };
}

export function createLightBufferDescriptor(
  input: CreateLightBufferDescriptorInput,
  options: CreateLightBufferDescriptorOptions = {},
): LightBufferDescriptor {
  const packed = isPackedLightPackets(input) ? input : packLightPackets(input);
  const floatByteLength = packed.floats.byteLength;
  const metadataByteLength = packed.metadata.byteLength;

  return {
    resourceKey: options.resourceKey ?? DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
    usageIntent: "read-only-storage",
    count: packed.count,
    byteLength: floatByteLength + metadataByteLength,
    floatByteLength,
    metadataByteLength,
    packed,
  };
}

export function createLightBufferDescriptorPlan(
  descriptor: LightBufferDescriptor,
  options: CreateLightBufferDescriptorPlanOptions = {},
): CreateLightBufferDescriptorPlanResult {
  const diagnostics: LightBufferDescriptorPlanDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_LIGHT_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "lightBufferDescriptor.invalidUsageFlags",
      field: "usage",
      message: "Light buffer usage flags must be a positive integer.",
    });
  }

  if (descriptor.count === 0 || descriptor.byteLength === 0) {
    return {
      valid: diagnostics.length === 0,
      plan: null,
      diagnostics,
    };
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  const label = options.label ?? descriptor.resourceKey;

  return {
    valid: true,
    plan: {
      resourceKey: descriptor.resourceKey,
      source: descriptor.packed,
      floatDescriptor: {
        label: `${label}/floats`,
        size: descriptor.floatByteLength,
        usage,
        initialData: descriptor.packed.floats,
      },
      metadataDescriptor: {
        label: `${label}/metadata`,
        size: descriptor.metadataByteLength,
        usage,
        initialData: descriptor.packed.metadata,
      },
    },
    diagnostics,
  };
}

export function createLightGpuBuffers(
  options: CreateLightGpuBuffersOptions,
): CreateLightGpuBuffersResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create light GPU buffers from a null descriptor plan.",
        },
      ],
    };
  }

  const floatResourceKey = `${options.plan.resourceKey}/floats`;
  const metadataResourceKey = `${options.plan.resourceKey}/metadata`;
  const floatResult = createWebGpuBuffer({
    device: options.device,
    descriptor: options.plan.floatDescriptor,
  });
  const metadataResult = createWebGpuBuffer({
    device: options.device,
    descriptor: options.plan.metadataDescriptor,
  });
  const diagnostics: LightGpuBufferDiagnostic[] = [];

  if (!floatResult.ok) {
    diagnostics.push({
      code: "lightGpuBuffer.creationFailed",
      reason: floatResult.reason,
      resourceKey: floatResourceKey,
      message: `Failed to create light float buffer '${floatResourceKey}': ${floatResult.message}`,
    });
  }

  if (!metadataResult.ok) {
    diagnostics.push({
      code: "lightGpuBuffer.creationFailed",
      reason: metadataResult.reason,
      resourceKey: metadataResourceKey,
      message: `Failed to create light metadata buffer '${metadataResourceKey}': ${metadataResult.message}`,
    });
  }

  if (!floatResult.ok || !metadataResult.ok) {
    return { valid: false, resource: null, diagnostics };
  }

  return {
    valid: true,
    resource: {
      resourceKey: options.plan.resourceKey,
      floatResourceKey,
      metadataResourceKey,
      floatBuffer: floatResult.buffer,
      metadataBuffer: metadataResult.buffer,
      count: options.plan.source.count,
    },
    diagnostics,
  };
}

function isLightPacketArray(
  input: PackLightPacketsInput,
): input is readonly LightPacket[] {
  return Array.isArray(input);
}

function isPackedLightPackets(
  input: CreateLightBufferDescriptorInput,
): input is PackedLightPackets {
  return (
    typeof input === "object" &&
    input !== null &&
    "floats" in input &&
    "metadata" in input &&
    "floatStride" in input &&
    "metadataStride" in input
  );
}

export function packedLightKindId(kind: LightKind): PackedLightKindId {
  switch (kind) {
    case "ambient":
      return PackedLightKindId.Ambient;
    case "directional":
      return PackedLightKindId.Directional;
    case "point":
      return PackedLightKindId.Point;
    case "spot":
      return PackedLightKindId.Spot;
    case "environment":
      return PackedLightKindId.Environment;
  }
}
