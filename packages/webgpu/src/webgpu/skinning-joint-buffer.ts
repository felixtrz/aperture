import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { skinningJointBufferResourceKey } from "./resource-keys.js";

export const SKINNING_JOINT_MATRIX_FLOATS = 16;
export const DEFAULT_SKINNING_JOINT_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export type SkinningJointBufferDescriptorDiagnosticCode =
  | "skinningJointBuffer.notSkinned"
  | "skinningJointBuffer.missingOffset"
  | "skinningJointBuffer.missingCount"
  | "skinningJointBuffer.missingData"
  | "skinningJointBuffer.invalidUsageFlags";

export interface SkinningJointBufferDescriptorDiagnostic {
  readonly code: SkinningJointBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly field?: string;
}

export interface SkinningJointBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly jointCount: number;
}

export interface CreateSkinningJointBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface SkinningJointBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: SkinningJointBufferDescriptorPlan | null;
  readonly diagnostics: readonly SkinningJointBufferDescriptorDiagnostic[];
}

export type SkinningJointGpuBufferDiagnosticCode =
  | "skinningJointGpuBuffer.nullDescriptorPlan"
  | "skinningJointGpuBuffer.creationFailed";

export interface SkinningJointGpuBufferDiagnostic {
  readonly code: SkinningJointGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface SkinningJointGpuBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly renderId: number;
  readonly jointCount: number;
  readonly sourceOffset: number;
}

export interface CreateSkinningJointGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: SkinningJointBufferDescriptorPlan | null;
}

export interface CreateSkinningJointGpuBufferResult {
  readonly valid: boolean;
  readonly resource: SkinningJointGpuBufferResource | null;
  readonly diagnostics: readonly SkinningJointGpuBufferDiagnostic[];
}

export function skinningJointBufferResourceKeyForRenderId(
  renderId: number,
): string {
  return skinningJointBufferResourceKey(`render:${renderId}`);
}

export function createSkinningJointBufferDescriptor(
  snapshot: Pick<RenderSnapshot, "bones">,
  draw: MeshDrawPacket,
  options: CreateSkinningJointBufferDescriptorOptions = {},
): SkinningJointBufferDescriptorResult {
  const diagnostics: SkinningJointBufferDescriptorDiagnostic[] = [];
  const usage = options.usage ?? DEFAULT_SKINNING_JOINT_BUFFER_USAGE;
  const sourceOffset = draw.boneMatrixOffset;
  const jointCount = draw.boneMatrixCount;

  if (!draw.batchKey.skinned) {
    diagnostics.push({
      code: "skinningJointBuffer.notSkinned",
      renderId: draw.renderId,
      field: "batchKey.skinned",
      message: `Render id ${draw.renderId} is not a skinned draw.`,
    });
  }

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "skinningJointBuffer.invalidUsageFlags",
      renderId: draw.renderId,
      field: "usage",
      message:
        "Skinning joint matrix storage-buffer usage flags must be a positive integer.",
    });
  }

  if (sourceOffset === undefined) {
    diagnostics.push({
      code: "skinningJointBuffer.missingOffset",
      renderId: draw.renderId,
      field: "boneMatrixOffset",
      message: `Render id ${draw.renderId} is skinned but has no bone matrix offset.`,
    });
  }

  if (jointCount === undefined || jointCount <= 0) {
    diagnostics.push({
      code: "skinningJointBuffer.missingCount",
      renderId: draw.renderId,
      field: "boneMatrixCount",
      message: `Render id ${draw.renderId} is skinned but has no positive bone matrix count.`,
    });
  }

  const source = snapshot.bones ?? new Float32Array(0);
  const requiredEnd =
    sourceOffset === undefined || jointCount === undefined
      ? 0
      : sourceOffset + jointCount * SKINNING_JOINT_MATRIX_FLOATS;

  if (
    sourceOffset !== undefined &&
    jointCount !== undefined &&
    (sourceOffset < 0 ||
      sourceOffset % SKINNING_JOINT_MATRIX_FLOATS !== 0 ||
      requiredEnd > source.length)
  ) {
    diagnostics.push({
      code: "skinningJointBuffer.missingData",
      renderId: draw.renderId,
      field: "bones",
      message: `Render id ${draw.renderId} references bone matrices ${sourceOffset}..${requiredEnd}, but the snapshot bone buffer length is ${source.length}.`,
    });
  }

  if (
    diagnostics.length > 0 ||
    sourceOffset === undefined ||
    jointCount == null
  ) {
    return { valid: false, plan: null, diagnostics };
  }

  const matrixSource = source.slice(sourceOffset, requiredEnd);

  return {
    valid: true,
    plan: {
      descriptor: {
        label: options.label ?? `SkinningJointMatrices/render:${draw.renderId}`,
        size: matrixSource.byteLength,
        usage,
        initialData: matrixSource,
      },
      source: matrixSource,
      renderId: draw.renderId,
      sourceOffset,
      jointCount,
    },
    diagnostics,
  };
}

export function createSkinningJointGpuBuffer(
  options: CreateSkinningJointGpuBufferOptions,
): CreateSkinningJointGpuBufferResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "skinningJointGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a skinning joint GPU buffer from a null descriptor plan.",
        },
      ],
    };
  }

  const resourceKey = skinningJointBufferResourceKeyForRenderId(
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
          code: "skinningJointGpuBuffer.creationFailed",
          reason: result.reason,
          resourceKey,
          message: `Failed to create skinning joint buffer '${resourceKey}': ${result.message}`,
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
      jointCount: options.plan.jointCount,
      sourceOffset: options.plan.sourceOffset,
    },
    diagnostics: [],
  };
}
