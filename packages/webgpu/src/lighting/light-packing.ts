import type {
  AreaLightShape,
  LightKind,
  LightPacket,
  RenderSnapshot,
  ShadowRequestPacket,
} from "@aperture-engine/render";
import type { PackedTransformDirtyRange } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../gpu/buffer.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";

// Slots 0-23: color/intensity/range-or-cascadeCount/cascade-far-bounds-or-cones/
// matrixBaseIndex-or-shape/cookie/position/direction/area extents.
// Slot 24: authored shadow strength (M4-T4); shadow-casting lights only.
// Slot 25: authored shadow receiver depthBias (M4-T5).
// Slot 26: authored shadow normal-offset bias (M4-T5).
// Slot 27: authored shadow filter radius in texels (M4-T7).
// Slot 28: authored shadow filtering type (0=hard, 1=PCF, 2=PCSS) (M4-T7).
export const PACKED_LIGHT_FLOAT_STRIDE = 29;
export const PACKED_LIGHT_METADATA_STRIDE = 6;

export const PackedLightKindId = {
  Ambient: 0,
  Directional: 1,
  Point: 2,
  Spot: 3,
  Environment: 4,
  RectArea: 5,
} as const;

export type PackedLightKindId =
  (typeof PackedLightKindId)[keyof typeof PackedLightKindId];

export const PackedAreaLightShapeId = {
  Rect: 1,
  Disk: 2,
  Sphere: 3,
} as const;

export type PackedAreaLightShapeId =
  (typeof PackedAreaLightShapeId)[keyof typeof PackedAreaLightShapeId];

export interface PackedLightPackets {
  readonly count: number;
  readonly floatStride: typeof PACKED_LIGHT_FLOAT_STRIDE;
  readonly metadataStride: typeof PACKED_LIGHT_METADATA_STRIDE;
  readonly floats: Float32Array;
  readonly metadata: Int32Array;
}

export interface LightPacketPackingScratch {
  floats: Float32Array;
  metadata: Int32Array;
  floatView: Float32Array;
  metadataView: Int32Array;
  readonly packed: {
    count: number;
    readonly floatStride: typeof PACKED_LIGHT_FLOAT_STRIDE;
    readonly metadataStride: typeof PACKED_LIGHT_METADATA_STRIDE;
    floats: Float32Array;
    metadata: Int32Array;
  };
  /** Previous frame's packed content for dirty diffing (AI-65). */
  previousFloats: Float32Array;
  previousMetadata: Int32Array;
  /** Element counts written on the previous frame (-1 before first write). */
  lastFloatCount: number;
  lastMetadataCount: number;
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
  /**
   * Changed 4-byte-element windows vs the previous descriptor write through
   * the same scratch (AI-65): null = byte-identical (skip the upload), full =
   * no comparable history. Offsets/counts are elements of the corresponding
   * packed array (floats are f32, metadata is i32 — both 4 bytes).
   */
  readonly floatsDirty?: PackedTransformDirtyRange | null | undefined;
  readonly metadataDirty?: PackedTransformDirtyRange | null | undefined;
}

export interface LightBufferDescriptorScratch {
  readonly packing: LightPacketPackingScratch;
  readonly descriptor: {
    resourceKey: string;
    usageIntent: LightBufferUsageIntent;
    count: number;
    byteLength: number;
    floatByteLength: number;
    metadataByteLength: number;
    packed: PackedLightPackets;
    floatsDirty?: PackedTransformDirtyRange | null | undefined;
    metadataDirty?: PackedTransformDirtyRange | null | undefined;
  };
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

export interface LightBufferDescriptorPlanScratch {
  readonly floatDescriptor: {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
    initialData?: ArrayBufferView;
  };
  readonly metadataDescriptor: {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
    initialData?: ArrayBufferView;
  };
  readonly plan: {
    resourceKey: string;
    source: PackedLightPackets;
    floatDescriptor: WebGpuBufferDescriptor;
    metadataDescriptor: WebGpuBufferDescriptor;
  };
  readonly diagnostics: LightBufferDescriptorPlanDiagnostic[];
  readonly result: {
    valid: boolean;
    plan: LightBufferDescriptorPlan | null;
    diagnostics: readonly LightBufferDescriptorPlanDiagnostic[];
  };
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

export interface LightGpuBufferDiagnosticJsonValue {
  readonly code: LightGpuBufferDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface LightGpuBufferResourceJsonValue {
  readonly resourceKey: string;
  readonly floatResourceKey: string;
  readonly metadataResourceKey: string;
  readonly count: number;
}

export interface CreateLightGpuBuffersResultJsonValue {
  readonly valid: boolean;
  readonly resource: LightGpuBufferResourceJsonValue | null;
  readonly counts: {
    readonly lights: number;
    readonly gpuBuffers: number;
    readonly diagnostics: number;
  };
  readonly diagnostics: readonly LightGpuBufferDiagnosticJsonValue[];
}

export type PackLightPacketsInput =
  | readonly LightPacket[]
  | (Pick<RenderSnapshot, "lights" | "transforms"> &
      Partial<Pick<RenderSnapshot, "shadowRequests">>);

export type CreateLightBufferDescriptorInput =
  | PackedLightPackets
  | PackLightPacketsInput;

export function packLightPackets(
  input: PackLightPacketsInput,
): PackedLightPackets {
  return writePackedLightPackets(input, createLightPacketPackingScratch());
}

export function createLightPacketPackingScratch(
  lightCapacity = 0,
): LightPacketPackingScratch {
  const floats = new Float32Array(lightCapacity * PACKED_LIGHT_FLOAT_STRIDE);
  const metadata = new Int32Array(lightCapacity * PACKED_LIGHT_METADATA_STRIDE);
  const packed: LightPacketPackingScratch["packed"] = {
    count: 0,
    floatStride: PACKED_LIGHT_FLOAT_STRIDE,
    metadataStride: PACKED_LIGHT_METADATA_STRIDE,
    floats,
    metadata,
  };

  return {
    floats,
    metadata,
    floatView: floats,
    metadataView: metadata,
    packed,
    previousFloats: new Float32Array(0),
    previousMetadata: new Int32Array(0),
    lastFloatCount: -1,
    lastMetadataCount: -1,
  };
}

export function writePackedLightPackets(
  input: PackLightPacketsInput,
  scratch: LightPacketPackingScratch,
): PackedLightPackets {
  const lights = isLightPacketArray(input) ? input : input.lights;
  const transforms = isLightPacketArray(input) ? null : input.transforms;
  const directionalShadows = isLightPacketArray(input)
    ? null
    : directionalShadowMetadata(input.shadowRequests ?? []);
  const shadowParams = isLightPacketArray(input)
    ? null
    : shadowParamsByLight(input.shadowRequests ?? []);

  ensureLightPacketCapacity(scratch, lights.length);

  for (let index = 0; index < lights.length; index += 1) {
    const light = lights[index];

    if (light === undefined) {
      continue;
    }

    const floatOffset = index * PACKED_LIGHT_FLOAT_STRIDE;
    const metadataOffset = index * PACKED_LIGHT_METADATA_STRIDE;
    const directionalShadow =
      light.kind === "directional"
        ? (directionalShadows?.get(light.lightId) ?? null)
        : null;
    const directionalFarBounds =
      directionalShadow === null
        ? null
        : directionalCascadeFarBounds(
            directionalShadow.cascadeCount,
            light.range,
          );
    const transformData = packedLightTransformData(light, transforms);

    scratch.floats.set(
      [
        light.color[0] ?? 0,
        light.color[1] ?? 0,
        light.color[2] ?? 0,
        light.color[3] ?? 1,
        light.intensity,
        directionalShadow?.cascadeCount ?? light.range,
        directionalFarBounds?.[0] ?? light.innerConeAngle,
        directionalFarBounds?.[1] ?? light.outerConeAngle,
        directionalFarBounds?.[2] ?? light.width ?? 0,
        directionalFarBounds?.[3] ?? light.height ?? 0,
        directionalShadow?.matrixBaseIndex ??
          packedAreaLightShapeId(light.shape),
        light.cookieTexture === undefined || light.cookieTexture === null
          ? 0
          : Math.max(light.cookieIntensity ?? 1, 0),
        transformData.position[0],
        transformData.position[1],
        transformData.position[2],
        transformData.direction[0],
        transformData.direction[1],
        transformData.direction[2],
        transformData.areaHalfWidth[0],
        transformData.areaHalfWidth[1],
        transformData.areaHalfWidth[2],
        transformData.areaHalfHeight[0],
        transformData.areaHalfHeight[1],
        transformData.areaHalfHeight[2],
        shadowParams?.get(light.lightId)?.strength ?? 1,
        shadowParams?.get(light.lightId)?.depthBias ?? 0,
        shadowParams?.get(light.lightId)?.normalBias ?? 0,
        shadowParams?.get(light.lightId)?.filterRadius ?? 1,
        shadowParams?.get(light.lightId)?.shadowType ?? 1,
      ],
      floatOffset,
    );
    scratch.metadata.set(
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
  }

  scratch.packed.count = lights.length;
  scratch.packed.floats = lightFloatView(scratch, lights.length);
  scratch.packed.metadata = lightMetadataView(scratch, lights.length);

  return scratch.packed;
}

interface PackedLightTransformData {
  readonly position: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
  readonly areaHalfWidth: readonly [number, number, number];
  readonly areaHalfHeight: readonly [number, number, number];
}

function packedLightTransformData(
  light: LightPacket,
  transforms: Float32Array | null,
): PackedLightTransformData {
  if (
    transforms === null ||
    !Number.isInteger(light.worldTransformOffset) ||
    light.worldTransformOffset < 0 ||
    light.worldTransformOffset + 15 >= transforms.length
  ) {
    return fallbackLightTransformData(light);
  }

  const offset = light.worldTransformOffset;
  const width = light.width ?? 1;
  const height = light.height ?? 1;
  const position = [
    transforms[offset + 12] ?? 0,
    transforms[offset + 13] ?? 0,
    transforms[offset + 14] ?? 0,
  ] as const;
  const direction = normalizeVec3(
    [
      -(transforms[offset + 8] ?? 0),
      -(transforms[offset + 9] ?? 0),
      -(transforms[offset + 10] ?? 1),
    ],
    [0, 0, -1],
  );
  const areaHalfWidth = scaleVec3(
    normalizeVec3(
      [
        transforms[offset] ?? 1,
        transforms[offset + 1] ?? 0,
        transforms[offset + 2] ?? 0,
      ],
      [1, 0, 0],
    ),
    width * 0.5,
  );
  const areaHalfHeight = scaleVec3(
    normalizeVec3(
      [
        transforms[offset + 4] ?? 0,
        transforms[offset + 5] ?? 1,
        transforms[offset + 6] ?? 0,
      ],
      [0, 1, 0],
    ),
    height * 0.5,
  );

  return { position, direction, areaHalfWidth, areaHalfHeight };
}

function fallbackLightTransformData(
  light: LightPacket,
): PackedLightTransformData {
  const halfWidth = (light.width ?? 1) * 0.5;
  const halfHeight = (light.height ?? 1) * 0.5;

  return {
    position: [0, 0, 0],
    direction: [0, 0, -1],
    areaHalfWidth: [halfWidth, 0, 0],
    areaHalfHeight: [0, halfHeight, 0],
  };
}

function normalizeVec3(
  value: readonly [number, number, number],
  fallback: readonly [number, number, number],
): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 0.0001) {
    return fallback;
  }

  return [
    cleanSignedZero(value[0] / length),
    cleanSignedZero(value[1] / length),
    cleanSignedZero(value[2] / length),
  ];
}

function scaleVec3(
  value: readonly [number, number, number],
  scale: number,
): readonly [number, number, number] {
  return [
    cleanSignedZero(value[0] * scale),
    cleanSignedZero(value[1] * scale),
    cleanSignedZero(value[2] * scale),
  ];
}

function cleanSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function createLightBufferDescriptor(
  input: CreateLightBufferDescriptorInput,
  options: CreateLightBufferDescriptorOptions = {},
): LightBufferDescriptor {
  return writeLightBufferDescriptor(
    input,
    createLightBufferDescriptorScratch(),
    options,
  );
}

export function createLightBufferDescriptorScratch(
  lightCapacity = 0,
): LightBufferDescriptorScratch {
  const packing = createLightPacketPackingScratch(lightCapacity);
  const descriptor = {
    resourceKey: DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
    usageIntent: "read-only-storage" as const,
    count: 0,
    byteLength: 0,
    floatByteLength: 0,
    metadataByteLength: 0,
    packed: packing.packed,
  };

  return { packing, descriptor };
}

export function writeLightBufferDescriptor(
  input: CreateLightBufferDescriptorInput,
  scratch: LightBufferDescriptorScratch,
  options: CreateLightBufferDescriptorOptions = {},
): LightBufferDescriptor {
  const throughScratch = !isPackedLightPackets(input);
  const packed = isPackedLightPackets(input)
    ? input
    : writePackedLightPackets(input, scratch.packing);
  const floatByteLength = packed.floats.byteLength;
  const metadataByteLength = packed.metadata.byteLength;

  scratch.descriptor.resourceKey =
    options.resourceKey ?? DEFAULT_LIGHT_BUFFER_RESOURCE_KEY;
  scratch.descriptor.count = packed.count;
  scratch.descriptor.byteLength = floatByteLength + metadataByteLength;
  scratch.descriptor.floatByteLength = floatByteLength;
  scratch.descriptor.metadataByteLength = metadataByteLength;
  scratch.descriptor.packed = packed;

  if (throughScratch) {
    const packing = scratch.packing;
    scratch.descriptor.floatsDirty = diffPackedElements(
      packing.previousFloats,
      packed.floats,
      packing.lastFloatCount,
    );
    scratch.descriptor.metadataDirty = diffPackedElements(
      packing.previousMetadata,
      packed.metadata,
      packing.lastMetadataCount,
    );

    if (packing.previousFloats.length < packed.floats.length) {
      packing.previousFloats = new Float32Array(packed.floats.length);
    }
    if (packing.previousMetadata.length < packed.metadata.length) {
      packing.previousMetadata = new Int32Array(packed.metadata.length);
    }
    packing.previousFloats.set(packed.floats);
    packing.previousMetadata.set(packed.metadata);
    packing.lastFloatCount = packed.floats.length;
    packing.lastMetadataCount = packed.metadata.length;
  } else {
    // Pre-packed inputs carry no scratch history — consumers full-write.
    scratch.descriptor.floatsDirty = undefined;
    scratch.descriptor.metadataDirty = undefined;
  }

  return scratch.descriptor;
}

/**
 * AI-65: contiguous changed window of a packed light array vs its previous
 * frame copy. Null = byte-identical; full when the element count changed or
 * no history exists yet.
 */
function diffPackedElements(
  previous: Float32Array | Int32Array,
  next: Float32Array | Int32Array,
  lastCount: number,
): PackedTransformDirtyRange | null {
  const count = next.length;

  if (lastCount !== count || previous.length < count) {
    return count === 0
      ? null
      : { floatOffset: 0, floatCount: count, full: true };
  }

  let first = -1;

  for (let index = 0; index < count; index += 1) {
    if (previous[index] !== next[index]) {
      first = index;
      break;
    }
  }

  if (first === -1) {
    return null;
  }

  let last = first;

  for (let index = count - 1; index > first; index -= 1) {
    if (previous[index] !== next[index]) {
      last = index;
      break;
    }
  }

  return { floatOffset: first, floatCount: last - first + 1, full: false };
}

export function createLightBufferDescriptorPlan(
  descriptor: LightBufferDescriptor,
  options: CreateLightBufferDescriptorPlanOptions = {},
): CreateLightBufferDescriptorPlanResult {
  return writeLightBufferDescriptorPlan(
    descriptor,
    createLightBufferDescriptorPlanScratch(),
    options,
  );
}

export function createLightBufferDescriptorPlanScratch(): LightBufferDescriptorPlanScratch {
  const floatDescriptor = {
    size: 0,
    usage: DEFAULT_LIGHT_BUFFER_USAGE,
  };
  const metadataDescriptor = {
    size: 0,
    usage: DEFAULT_LIGHT_BUFFER_USAGE,
  };
  const plan = {
    resourceKey: DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
    source: createLightPacketPackingScratch().packed,
    floatDescriptor,
    metadataDescriptor,
  };
  const diagnostics: LightBufferDescriptorPlanDiagnostic[] = [];

  return {
    floatDescriptor,
    metadataDescriptor,
    plan,
    diagnostics,
    result: { valid: false, plan: null, diagnostics },
  };
}

export function writeLightBufferDescriptorPlan(
  descriptor: LightBufferDescriptor,
  scratch: LightBufferDescriptorPlanScratch,
  options: CreateLightBufferDescriptorPlanOptions = {},
): CreateLightBufferDescriptorPlanResult {
  const diagnostics = scratch.diagnostics;

  diagnostics.length = 0;

  const usage = options.usage ?? DEFAULT_LIGHT_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "lightBufferDescriptor.invalidUsageFlags",
      field: "usage",
      message: "Light buffer usage flags must be a positive integer.",
    });
  }

  if (descriptor.count === 0 || descriptor.byteLength === 0) {
    scratch.result.valid = diagnostics.length === 0;
    scratch.result.plan = null;
    return scratch.result;
  }

  if (diagnostics.length > 0) {
    scratch.result.valid = false;
    scratch.result.plan = null;
    return scratch.result;
  }

  const label = options.label ?? descriptor.resourceKey;

  scratch.floatDescriptor.label = `${label}/floats`;
  scratch.floatDescriptor.size = descriptor.floatByteLength;
  scratch.floatDescriptor.usage = usage;
  scratch.floatDescriptor.initialData = descriptor.packed.floats;
  scratch.metadataDescriptor.label = `${label}/metadata`;
  scratch.metadataDescriptor.size = descriptor.metadataByteLength;
  scratch.metadataDescriptor.usage = usage;
  scratch.metadataDescriptor.initialData = descriptor.packed.metadata;
  scratch.plan.resourceKey = descriptor.resourceKey;
  scratch.plan.source = descriptor.packed;
  scratch.result.valid = true;
  scratch.result.plan = scratch.plan;

  return scratch.result;
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

export function createLightGpuBuffersResultToJsonValue(
  result: CreateLightGpuBuffersResult,
): CreateLightGpuBuffersResultJsonValue {
  return {
    valid: result.valid,
    resource:
      result.resource === null
        ? null
        : {
            resourceKey: result.resource.resourceKey,
            floatResourceKey: result.resource.floatResourceKey,
            metadataResourceKey: result.resource.metadataResourceKey,
            count: result.resource.count,
          },
    counts: {
      lights: result.resource?.count ?? 0,
      gpuBuffers: result.resource === null ? 0 : 2,
      diagnostics: result.diagnostics.length,
    },
    diagnostics: result.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      ...(diagnostic.reason === undefined ? {} : { reason: diagnostic.reason }),
      ...(diagnostic.resourceKey === undefined
        ? {}
        : { resourceKey: diagnostic.resourceKey }),
    })),
  };
}

export function createLightGpuBuffersResultToJson(
  result: CreateLightGpuBuffersResult,
): string {
  return JSON.stringify(createLightGpuBuffersResultToJsonValue(result));
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

interface DirectionalShadowMetadata {
  readonly cascadeCount: number;
  readonly matrixBaseIndex: number;
}

interface PackedShadowParams {
  readonly strength: number;
  readonly depthBias: number;
  readonly normalBias: number;
  readonly filterRadius: number;
  readonly shadowType: number;
}

/**
 * Per-light shadow params keyed by lightId, for ALL shadow-casting kinds
 * (directional/point/spot) — not just directional. Sourced from the authored
 * ShadowRequestPacket (M4-T3) so the shader can read per-light strength
 * (M4-T4) without a new binding.
 */
function shadowParamsByLight(
  shadowRequests: readonly ShadowRequestPacket[],
): ReadonlyMap<number, PackedShadowParams> {
  const params = new Map<number, PackedShadowParams>();

  for (const request of shadowRequests) {
    params.set(request.lightId, {
      strength: clampUnit(request.strength ?? 1),
      depthBias: Math.max(0, request.depthBias ?? 0),
      normalBias: Math.max(0, request.normalBias ?? 0),
      filterRadius: Math.max(0, request.filterRadius ?? 1),
      shadowType: Math.min(2, Math.max(0, Math.round(request.shadowType ?? 1))),
    });
  }

  return params;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function directionalShadowMetadata(
  shadowRequests: readonly ShadowRequestPacket[],
): ReadonlyMap<number, DirectionalShadowMetadata> {
  const metadata = new Map<number, DirectionalShadowMetadata>();
  let matrixBaseIndex = 0;

  for (const request of shadowRequests) {
    if (
      request.lightKind !== undefined &&
      request.lightKind !== "directional"
    ) {
      continue;
    }

    const cascadeCount = clampDirectionalCascadeCount(
      request.cascadeCount ?? 1,
    );

    metadata.set(request.lightId, {
      cascadeCount,
      matrixBaseIndex,
    });
    matrixBaseIndex += cascadeCount;
  }

  return metadata;
}

function directionalCascadeFarBounds(
  cascadeCount: number,
  shadowDistance: number,
): readonly [number, number, number, number] {
  const count = clampDirectionalCascadeCount(cascadeCount);
  const maximumDistance = Math.max(1, shadowDistance);
  const minimumDistance = Math.min(0.1, maximumDistance * 0.5);
  const bounds = [
    maximumDistance,
    maximumDistance,
    maximumDistance,
    maximumDistance,
  ] as [number, number, number, number];

  for (let index = 0; index < count; index += 1) {
    const fraction = (index + 1) / count;
    const linear =
      minimumDistance + (maximumDistance - minimumDistance) * fraction;
    const logarithmic =
      minimumDistance * Math.pow(maximumDistance / minimumDistance, fraction);
    bounds[index] =
      index + 1 === count ? maximumDistance : (linear + logarithmic) * 0.5;
  }

  return bounds;
}

function clampDirectionalCascadeCount(value: number): 1 | 2 | 3 | 4 {
  if (!Number.isInteger(value)) {
    return 1;
  }

  return Math.min(4, Math.max(1, value)) as 1 | 2 | 3 | 4;
}

function ensureLightPacketCapacity(
  scratch: LightPacketPackingScratch,
  lightCount: number,
): void {
  const floatCount = lightCount * PACKED_LIGHT_FLOAT_STRIDE;
  const metadataCount = lightCount * PACKED_LIGHT_METADATA_STRIDE;

  if (scratch.floats.length < floatCount) {
    let capacity = Math.max(PACKED_LIGHT_FLOAT_STRIDE, scratch.floats.length);

    while (capacity < floatCount) {
      capacity *= 2;
    }

    scratch.floats = new Float32Array(capacity);
  }

  if (scratch.metadata.length < metadataCount) {
    let capacity = Math.max(
      PACKED_LIGHT_METADATA_STRIDE,
      scratch.metadata.length,
    );

    while (capacity < metadataCount) {
      capacity *= 2;
    }

    scratch.metadata = new Int32Array(capacity);
  }
}

function lightFloatView(
  scratch: LightPacketPackingScratch,
  lightCount: number,
): Float32Array {
  const floatCount = lightCount * PACKED_LIGHT_FLOAT_STRIDE;

  if (floatCount === scratch.floats.length) {
    scratch.floatView = scratch.floats;
    return scratch.floats;
  }

  if (
    scratch.floatView.buffer !== scratch.floats.buffer ||
    scratch.floatView.byteOffset !== scratch.floats.byteOffset ||
    scratch.floatView.length !== floatCount
  ) {
    scratch.floatView = scratch.floats.subarray(0, floatCount);
  }

  return scratch.floatView;
}

function lightMetadataView(
  scratch: LightPacketPackingScratch,
  lightCount: number,
): Int32Array {
  const metadataCount = lightCount * PACKED_LIGHT_METADATA_STRIDE;

  if (metadataCount === scratch.metadata.length) {
    scratch.metadataView = scratch.metadata;
    return scratch.metadata;
  }

  if (
    scratch.metadataView.buffer !== scratch.metadata.buffer ||
    scratch.metadataView.byteOffset !== scratch.metadata.byteOffset ||
    scratch.metadataView.length !== metadataCount
  ) {
    scratch.metadataView = scratch.metadata.subarray(0, metadataCount);
  }

  return scratch.metadataView;
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
    case "rect-area":
      return PackedLightKindId.RectArea;
  }
}

export function packedAreaLightShapeId(
  shape: AreaLightShape | undefined,
): PackedAreaLightShapeId {
  switch (shape) {
    case "disk":
      return PackedAreaLightShapeId.Disk;
    case "sphere":
      return PackedAreaLightShapeId.Sphere;
    case "rect":
    case undefined:
      return PackedAreaLightShapeId.Rect;
  }
}
