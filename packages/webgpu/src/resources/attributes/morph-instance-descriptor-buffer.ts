import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { morphInstanceDescriptorBufferResourceKey } from "../core/resource-keys.js";

/** Four `u32` per instance: (weightOffset, targetCount, deltaOffset, vertexCount). */
export const MORPH_INSTANCE_DESCRIPTOR_U32 = 4;
export const DEFAULT_MORPH_INSTANCE_DESCRIPTOR_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export type MorphInstanceDescriptorBufferDescriptorDiagnosticCode =
  | "morphInstanceDescriptorBuffer.notMorphed"
  | "morphInstanceDescriptorBuffer.missingData"
  | "morphInstanceDescriptorBuffer.invalidUsageFlags";

export interface MorphInstanceDescriptorBufferDescriptorDiagnostic {
  readonly code: MorphInstanceDescriptorBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly field?: string;
}

export interface MorphInstanceDescriptorBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Uint32Array;
  readonly renderId: number;
  readonly instanceCount: number;
}

export interface CreateMorphInstanceDescriptorBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface MorphInstanceDescriptorBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: MorphInstanceDescriptorBufferDescriptorPlan | null;
  readonly diagnostics: readonly MorphInstanceDescriptorBufferDescriptorDiagnostic[];
}

export type MorphInstanceDescriptorGpuBufferDiagnosticCode =
  | "morphInstanceDescriptorGpuBuffer.nullDescriptorPlan"
  | "morphInstanceDescriptorGpuBuffer.creationFailed";

export interface MorphInstanceDescriptorGpuBufferDiagnostic {
  readonly code: MorphInstanceDescriptorGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface MorphInstanceDescriptorGpuBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly renderId: number;
  readonly instanceCount: number;
}

export interface CreateMorphInstanceDescriptorGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: MorphInstanceDescriptorBufferDescriptorPlan | null;
}

export interface CreateMorphInstanceDescriptorGpuBufferResult {
  readonly valid: boolean;
  readonly resource: MorphInstanceDescriptorGpuBufferResource | null;
  readonly diagnostics: readonly MorphInstanceDescriptorGpuBufferDiagnostic[];
}

export function morphInstanceDescriptorBufferResourceKeyForRenderId(
  renderId: number,
): string {
  return morphInstanceDescriptorBufferResourceKey(`render:${renderId}`);
}

export function createMorphInstanceDescriptorBufferDescriptor(
  snapshot: Pick<RenderSnapshot, "morphInstanceDescriptors">,
  draw: MeshDrawPacket,
  options: CreateMorphInstanceDescriptorBufferDescriptorOptions = {},
): MorphInstanceDescriptorBufferDescriptorResult {
  const diagnostics: MorphInstanceDescriptorBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_MORPH_INSTANCE_DESCRIPTOR_BUFFER_USAGE;

  if (!draw.batchKey.morphed) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.notMorphed",
      renderId: draw.renderId,
      field: "batchKey.morphed",
      message: `Render id ${draw.renderId} is not a morphed draw.`,
    });
  }

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.invalidUsageFlags",
      renderId: draw.renderId,
      field: "usage",
      message:
        "Morph instance descriptor storage-buffer usage flags must be a positive integer.",
    });
  }

  const source = snapshot.morphInstanceDescriptors ?? new Uint32Array(0);
  const instanceIndex = draw.worldTransformOffset / 16;
  const requiredEnd = (instanceIndex + 1) * MORPH_INSTANCE_DESCRIPTOR_U32;

  if (
    !Number.isInteger(instanceIndex) ||
    instanceIndex < 0 ||
    requiredEnd > source.length
  ) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.missingData",
      renderId: draw.renderId,
      field: "morphInstanceDescriptors",
      message: `Render id ${draw.renderId} references the morph descriptor for instance ${instanceIndex}, but the snapshot descriptor buffer length is ${source.length}.`,
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  return {
    valid: true,
    plan: {
      descriptor: {
        label:
          options.label ?? `MorphInstanceDescriptors/render:${draw.renderId}`,
        size: source.byteLength,
        usage,
        initialData: source,
      },
      source,
      renderId: draw.renderId,
      instanceCount: source.length / MORPH_INSTANCE_DESCRIPTOR_U32,
    },
    diagnostics,
  };
}

export function createMorphInstanceDescriptorGpuBuffer(
  options: CreateMorphInstanceDescriptorGpuBufferOptions,
): CreateMorphInstanceDescriptorGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "morphInstanceDescriptorGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a morph instance descriptor GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = morphInstanceDescriptorBufferResourceKeyForRenderId(
    options.plan.renderId,
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
          code: "morphInstanceDescriptorGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create morph instance descriptor buffer '${resourceKey}': ${result.message}`,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey,
      buffer: result.buffer,
      renderId: options.plan.renderId,
      instanceCount: options.plan.instanceCount,
    },
    diagnostics: [],
  };
}
