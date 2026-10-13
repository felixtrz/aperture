import type {
  MeshDrawPacket,
  PackedTransformOffset,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDescriptor,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { morphInstanceDescriptorBufferResourceKey } from "../core/resource-keys.js";

/** Four `u32` per instance: (weightOffset, targetCount, deltaOffset, vertexCount). */
const MORPH_INSTANCE_DESCRIPTOR_U32 = 4;
const DEFAULT_MORPH_INSTANCE_DESCRIPTOR_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

type MorphInstanceDescriptorBufferDescriptorDiagnosticCode =
  | "morphInstanceDescriptorBuffer.notMorphed"
  | "morphInstanceDescriptorBuffer.missingData"
  | "morphInstanceDescriptorBuffer.invalidUsageFlags";

export interface MorphInstanceDescriptorBufferDescriptorDiagnostic {
  readonly code: MorphInstanceDescriptorBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly field?: string;
}

interface MorphInstanceDescriptorBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Uint32Array;
  readonly renderId: number;
  readonly instanceCount: number;
}

export interface CreateMorphInstanceDescriptorBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
  readonly transformOffsets?: readonly MorphInstanceDescriptorTransformOffset[];
}

export type MorphInstanceDescriptorTransformOffset = Pick<
  PackedTransformOffset,
  "packedOffset" | "renderId" | "sourceOffset"
>;

export interface MorphInstanceDescriptorBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: MorphInstanceDescriptorBufferDescriptorPlan | null;
  readonly diagnostics: readonly MorphInstanceDescriptorBufferDescriptorDiagnostic[];
}

type MorphInstanceDescriptorGpuBufferDiagnosticCode =
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

function morphInstanceDescriptorBufferResourceKeyForRenderId(
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
  const sourceInstanceIndex = draw.worldTransformOffset / 16;
  const drawTransformOffset = findDrawTransformOffset(
    options.transformOffsets,
    draw,
  );
  const packedTransformOffset =
    drawTransformOffset?.packedOffset ?? draw.worldTransformOffset;
  const packedInstanceIndex = packedTransformOffset / 16;
  const sourceRequiredEnd =
    (sourceInstanceIndex + 1) * MORPH_INSTANCE_DESCRIPTOR_U32;
  const packedSource =
    options.transformOffsets === undefined
      ? source
      : packMorphInstanceDescriptors(source, options.transformOffsets);
  const packedRequiredEnd =
    (packedInstanceIndex + 1) * MORPH_INSTANCE_DESCRIPTOR_U32;

  if (
    !Number.isInteger(sourceInstanceIndex) ||
    sourceInstanceIndex < 0 ||
    sourceRequiredEnd > source.length
  ) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.missingData",
      renderId: draw.renderId,
      field: "morphInstanceDescriptors",
      message: `Render id ${draw.renderId} references the morph descriptor for source instance ${sourceInstanceIndex}, but the snapshot descriptor buffer length is ${source.length}.`,
    });
  }

  if (options.transformOffsets !== undefined && drawTransformOffset === null) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.missingData",
      renderId: draw.renderId,
      field: "transformOffsets",
      message: `Render id ${draw.renderId} has no packed transform offset for source offset ${draw.worldTransformOffset}.`,
    });
  }

  if (
    !Number.isInteger(packedInstanceIndex) ||
    packedInstanceIndex < 0 ||
    packedRequiredEnd > packedSource.length
  ) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.missingData",
      renderId: draw.renderId,
      field: "morphInstanceDescriptors",
      message: `Render id ${draw.renderId} references the morph descriptor for packed instance ${packedInstanceIndex}, but the packed descriptor buffer length is ${packedSource.length}.`,
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
        size: packedSource.byteLength,
        usage,
        initialData: packedSource,
      },
      source: packedSource,
      renderId: draw.renderId,
      instanceCount: packedSource.length / MORPH_INSTANCE_DESCRIPTOR_U32,
    },
    diagnostics,
  };
}

function findDrawTransformOffset(
  offsets: readonly MorphInstanceDescriptorTransformOffset[] | undefined,
  draw: MeshDrawPacket,
): MorphInstanceDescriptorTransformOffset | null {
  if (offsets === undefined) {
    return null;
  }

  return (
    offsets.find(
      (offset) =>
        offset.renderId === draw.renderId &&
        offset.sourceOffset === draw.worldTransformOffset,
    ) ?? null
  );
}

function packMorphInstanceDescriptors(
  source: Uint32Array,
  offsets: readonly MorphInstanceDescriptorTransformOffset[],
): Uint32Array {
  const maxPackedInstance = offsets.reduce((max, offset) => {
    const instanceIndex = offset.packedOffset / 16;

    return Number.isInteger(instanceIndex) && instanceIndex >= 0
      ? Math.max(max, instanceIndex)
      : max;
  }, -1);

  if (maxPackedInstance < 0) {
    return new Uint32Array(0);
  }

  const packed = new Uint32Array(
    (maxPackedInstance + 1) * MORPH_INSTANCE_DESCRIPTOR_U32,
  );

  for (const offset of offsets) {
    const sourceInstance = offset.sourceOffset / 16;
    const packedInstance = offset.packedOffset / 16;

    if (
      !Number.isInteger(sourceInstance) ||
      !Number.isInteger(packedInstance) ||
      sourceInstance < 0 ||
      packedInstance < 0
    ) {
      continue;
    }

    const sourceSlot = sourceInstance * MORPH_INSTANCE_DESCRIPTOR_U32;
    const packedSlot = packedInstance * MORPH_INSTANCE_DESCRIPTOR_U32;

    if (sourceSlot + MORPH_INSTANCE_DESCRIPTOR_U32 > source.length) {
      continue;
    }

    packed.set(
      source.subarray(sourceSlot, sourceSlot + MORPH_INSTANCE_DESCRIPTOR_U32),
      packedSlot,
    );
  }

  return packed;
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
