import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { morphTargetWeightBufferResourceKey } from "../core/resource-keys.js";

export const MORPH_TARGET_WEIGHT_FLOATS = 4;
export const DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export type MorphTargetWeightBufferDescriptorDiagnosticCode =
  | "morphTargetWeightBuffer.notMorphed"
  | "morphTargetWeightBuffer.missingData"
  | "morphTargetWeightBuffer.invalidUsageFlags";

export interface MorphTargetWeightBufferDescriptorDiagnostic {
  readonly code: MorphTargetWeightBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly field?: string;
}

export interface MorphTargetWeightBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly renderId: number;
  readonly weightCount: number;
}

export interface CreateMorphTargetWeightBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface MorphTargetWeightBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: MorphTargetWeightBufferDescriptorPlan | null;
  readonly diagnostics: readonly MorphTargetWeightBufferDescriptorDiagnostic[];
}

export type MorphTargetWeightGpuBufferDiagnosticCode =
  | "morphTargetWeightGpuBuffer.nullDescriptorPlan"
  | "morphTargetWeightGpuBuffer.creationFailed";

export interface MorphTargetWeightGpuBufferDiagnostic {
  readonly code: MorphTargetWeightGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface MorphTargetWeightGpuBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly renderId: number;
  readonly weightCount: number;
}

export interface CreateMorphTargetWeightGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: MorphTargetWeightBufferDescriptorPlan | null;
}

export interface CreateMorphTargetWeightGpuBufferResult {
  readonly valid: boolean;
  readonly resource: MorphTargetWeightGpuBufferResource | null;
  readonly diagnostics: readonly MorphTargetWeightGpuBufferDiagnostic[];
}

export function morphTargetWeightBufferResourceKeyForRenderId(
  renderId: number,
): string {
  return morphTargetWeightBufferResourceKey(`render:${renderId}`);
}

export function createMorphTargetWeightBufferDescriptor(
  snapshot: Pick<RenderSnapshot, "morphTargetWeights">,
  draw: MeshDrawPacket,
  options: CreateMorphTargetWeightBufferDescriptorOptions = {},
): MorphTargetWeightBufferDescriptorResult {
  const diagnostics: MorphTargetWeightBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE;

  if (!draw.batchKey.morphed) {
    diagnostics.push({
      code: "morphTargetWeightBuffer.notMorphed",
      renderId: draw.renderId,
      field: "batchKey.morphed",
      message: `Render id ${draw.renderId} is not a morphed draw.`,
    });
  }

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "morphTargetWeightBuffer.invalidUsageFlags",
      renderId: draw.renderId,
      field: "usage",
      message:
        "Morph target weight storage-buffer usage flags must be a positive integer.",
    });
  }

  const source = snapshot.morphTargetWeights ?? new Float32Array(0);
  const firstInstance = draw.worldTransformOffset / 16;
  const requiredEnd = (firstInstance + 1) * MORPH_TARGET_WEIGHT_FLOATS;

  if (
    !Number.isInteger(firstInstance) ||
    firstInstance < 0 ||
    requiredEnd > source.length
  ) {
    diagnostics.push({
      code: "morphTargetWeightBuffer.missingData",
      renderId: draw.renderId,
      field: "morphTargetWeights",
      message: `Render id ${draw.renderId} references morph weights through instance ${firstInstance}, but the snapshot morph weight buffer length is ${source.length}.`,
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  return {
    valid: true,
    plan: {
      descriptor: {
        label: options.label ?? `MorphTargetWeights/render:${draw.renderId}`,
        size: source.byteLength,
        usage,
        initialData: source,
      },
      source,
      renderId: draw.renderId,
      weightCount: source.length / MORPH_TARGET_WEIGHT_FLOATS,
    },
    diagnostics,
  };
}

export function createMorphTargetWeightGpuBuffer(
  options: CreateMorphTargetWeightGpuBufferOptions,
): CreateMorphTargetWeightGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "morphTargetWeightGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a morph target weight GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = morphTargetWeightBufferResourceKeyForRenderId(
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
          code: "morphTargetWeightGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create morph target weight buffer '${resourceKey}': ${result.message}`,
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
      weightCount: options.plan.weightCount,
    },
    diagnostics: [],
  };
}
