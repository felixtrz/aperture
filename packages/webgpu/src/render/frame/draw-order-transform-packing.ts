import type {
  PackedSnapshotTransforms,
  PackedTransformOffset,
  RenderWorldDrawPackage,
  RenderWorldDrawPackagePlan,
} from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  retireWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "../../gpu/buffer.js";
import { writeBufferData } from "../../app/app-frame-resource-utils.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../../resources/meshes/mesh-buffer-descriptors.js";
import {
  bindGroupResourceKey,
  worldTransformBufferResourceKey,
} from "../../resources/core/resource-keys.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
import { DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY } from "../passes/render-pass-draw-list.js";
import {
  createRenderPhaseBatchKey,
  createRenderPhaseBatchRunScratch,
  writeRenderPhaseBatchRuns,
  type RenderPhaseBatchRunScratch,
} from "../phase/render-phase-batching.js";

const MATRIX_FLOATS = 16;
const DRAW_ORDER_WORLD_TRANSFORM_LABEL = "WorldTransforms/draw-order";

export interface DrawOrderTransformPackingScratch {
  data: Float32Array;
  readonly selected: DrawOrderTransformSelectedPackage[];
  readonly worldTransformResourceKeyByRenderId: Map<number, string>;
  readonly bindGroups: UnlitBindGroupResource[];
  readonly offsets: PackedTransformOffset[];
  readonly batchRuns: RenderPhaseBatchRunScratch<RenderWorldDrawPackage>;
}

export interface DrawOrderTransformBufferCache {
  resource: DrawOrderTransformBufferResource | null;
  byteLength: number;
  lastData: Float32Array;
  readonly bindGroupsByPipelineKey: Map<string, UnlitBindGroupResource>;
}

export interface DrawOrderTransformBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offsets: readonly PackedTransformOffset[];
}

interface DrawOrderTransformSelectedPackage {
  readonly drawPackage: RenderWorldDrawPackage;
  readonly resolvedPipelineKey: string;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

interface MutableRenderWorldDrawPackage {
  transformPackedOffset: number;
}

export interface PrepareDrawOrderTransformPackingOptions {
  readonly device: WebGpuBufferDeviceLike & {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  };
  readonly packages: RenderWorldDrawPackagePlan;
  readonly transforms: PackedSnapshotTransforms;
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly cache: DrawOrderTransformBufferCache;
  readonly scratch: DrawOrderTransformPackingScratch;
}

export interface PrepareDrawOrderTransformPackingResult {
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly worldTransformResourceKeyByRenderId: ReadonlyMap<number, string>;
}

export function createDrawOrderTransformPackingScratch(): DrawOrderTransformPackingScratch {
  return {
    data: new Float32Array(0),
    selected: [],
    worldTransformResourceKeyByRenderId: new Map(),
    bindGroups: [],
    offsets: [],
    batchRuns: createRenderPhaseBatchRunScratch(),
  };
}

export function createDrawOrderTransformBufferCache(): DrawOrderTransformBufferCache {
  return {
    resource: null,
    byteLength: 0,
    lastData: new Float32Array(0),
    bindGroupsByPipelineKey: new Map(),
  };
}

export function prepareDrawOrderTransformPacking(
  options: PrepareDrawOrderTransformPackingOptions,
): PrepareDrawOrderTransformPackingResult | null {
  resetScratch(options.scratch);
  selectPackableRuns(options);

  if (options.scratch.selected.length === 0) {
    return null;
  }

  const source = sourceView(options.transforms);
  const floatCount = options.scratch.selected.length * MATRIX_FLOATS;

  ensureDataCapacity(options.scratch, floatCount);

  for (const selected of options.scratch.selected) {
    options.scratch.data.set(
      source.subarray(
        selected.sourceOffset,
        selected.sourceOffset + MATRIX_FLOATS,
      ),
      selected.packedOffset,
    );
    options.scratch.offsets.push({
      renderId: selected.drawPackage.renderId,
      sourceOffset: selected.sourceOffset,
      packedOffset: selected.packedOffset,
    });
  }

  const data = options.scratch.data.subarray(0, floatCount);
  const resource = prepareDrawOrderTransformBuffer({
    device: options.device,
    cache: options.cache,
    data,
    offsets: options.scratch.offsets,
  });

  if (resource === null) {
    return null;
  }

  const bindGroups = prepareDrawOrderTransformBindGroups({
    device: options.device,
    cache: options.cache,
    resource,
    selected: options.scratch.selected,
    pipelines: options.pipelines,
    scratch: options.scratch,
  });

  if (bindGroups.length === 0) {
    return null;
  }

  for (const selected of options.scratch.selected) {
    (
      selected.drawPackage as MutableRenderWorldDrawPackage
    ).transformPackedOffset = selected.packedOffset;
    options.scratch.worldTransformResourceKeyByRenderId.set(
      selected.drawPackage.renderId,
      resource.resourceKey,
    );
  }

  return {
    bindGroups: [...options.bindGroups, ...bindGroups],
    worldTransformResourceKeyByRenderId:
      options.scratch.worldTransformResourceKeyByRenderId,
  };
}

function resetScratch(scratch: DrawOrderTransformPackingScratch): void {
  scratch.selected.length = 0;
  scratch.worldTransformResourceKeyByRenderId.clear();
  scratch.bindGroups.length = 0;
  scratch.offsets.length = 0;
}

function selectPackableRuns(
  options: Pick<
    PrepareDrawOrderTransformPackingOptions,
    "packages" | "pipelineKeysByRenderId" | "scratch" | "transforms"
  >,
): void {
  const packages = options.packages.packages;
  const source = sourceView(options.transforms);

  writeRenderPhaseBatchRuns(packages, options.scratch.batchRuns, {
    minRunLength: 2,
    includeRecords: false,
    eligibleForRecord: (drawPackage) =>
      isEligible(drawPackage, options.transforms),
    keyForRecord: (drawPackage) =>
      drawOrderPackingKey(drawPackage, {
        source,
        resolvedPipelineKey:
          options.pipelineKeysByRenderId?.get(drawPackage.renderId) ??
          drawPackage.batchKey.pipelineKey,
      }),
  });

  for (const run of options.scratch.batchRuns.runs) {
    for (let index = run.start; index < run.end; index += 1) {
      const drawPackage = packages[index];

      if (drawPackage === undefined) {
        continue;
      }

      options.scratch.selected.push({
        drawPackage,
        resolvedPipelineKey:
          options.pipelineKeysByRenderId?.get(drawPackage.renderId) ??
          drawPackage.batchKey.pipelineKey,
        sourceOffset: drawPackage.transformPackedOffset,
        packedOffset: options.scratch.selected.length * MATRIX_FLOATS,
      });
    }
  }
}

function isEligible(
  drawPackage: RenderWorldDrawPackage,
  transforms: PackedSnapshotTransforms,
): boolean {
  const packet = drawPackage.packet;
  const pipelineKey = drawPackage.batchKey.pipelineKey;

  return (
    packet.sortKey.queue === "opaque" &&
    drawPackage.batchKey.skinned === false &&
    drawPackage.batchKey.morphed === false &&
    packet.occlusionQuery !== true &&
    packet.instanceTintOffset === undefined &&
    packet.instanceAttributePacketIndex === undefined &&
    packet.boneMatrixOffset === undefined &&
    packet.boneMatrixCount === undefined &&
    packet.morphDeltaOffset === undefined &&
    packet.morphTargetCount === undefined &&
    packet.morphWeightOffset === undefined &&
    packet.morphVertexCount === undefined &&
    !pipelineKeyContainsToken(pipelineKey, "skinned") &&
    !pipelineKeyContainsToken(pipelineKey, "morphed") &&
    !pipelineKeyContainsToken(pipelineKey, "motion-vector") &&
    hasMatrix(transforms, drawPackage.transformPackedOffset)
  );
}

function pipelineKeyContainsToken(pipelineKey: string, token: string): boolean {
  let tokenStart = 0;

  while (tokenStart <= pipelineKey.length) {
    const separator = pipelineKey.indexOf("|", tokenStart);
    const tokenEnd = separator === -1 ? pipelineKey.length : separator;

    if (
      tokenEnd - tokenStart === token.length &&
      pipelineKey.startsWith(token, tokenStart)
    ) {
      return true;
    }

    if (separator === -1) {
      break;
    }

    tokenStart = separator + 1;
  }

  return false;
}

function drawOrderPackingKey(
  drawPackage: RenderWorldDrawPackage,
  options: {
    readonly source: Float32Array;
    readonly resolvedPipelineKey: string;
  },
): string {
  const packet = drawPackage.packet;
  const batch = drawPackage.batchKey;

  return createRenderPhaseBatchKey({
    phase: packet.sortKey.queue,
    pipelineKey: options.resolvedPipelineKey,
    meshResourceKey: drawPackage.meshResourceKey,
    materialResourceKey: drawPackage.materialResourceKey,
    materialParameterKey: drawPackage.materialResourceKey,
    meshLayoutKey: batch.meshLayoutKey,
    topology: batch.topology,
    submesh: packet.submesh,
    vertexStart: packet.vertexStart,
    vertexCount: packet.vertexCount,
    indexStart: packet.indexStart,
    indexCount: packet.indexCount,
    layerMask: packet.layerMask,
    receivesShadow: packet.receivesShadow !== false,
    negativeScale: matrixHasNegativeScale(
      options.source,
      drawPackage.transformPackedOffset,
    ),
  });
}

function hasMatrix(
  transforms: PackedSnapshotTransforms,
  offset: number,
): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= 0 &&
    offset + MATRIX_FLOATS <= sourceView(transforms).length
  );
}

function sourceView(transforms: PackedSnapshotTransforms): Float32Array {
  return transforms.floatCount === undefined
    ? transforms.data
    : transforms.data.subarray(0, transforms.floatCount);
}

function matrixHasNegativeScale(source: Float32Array, offset: number): boolean {
  const a00 = source[offset] ?? 0;
  const a01 = source[offset + 1] ?? 0;
  const a02 = source[offset + 2] ?? 0;
  const a10 = source[offset + 4] ?? 0;
  const a11 = source[offset + 5] ?? 0;
  const a12 = source[offset + 6] ?? 0;
  const a20 = source[offset + 8] ?? 0;
  const a21 = source[offset + 9] ?? 0;
  const a22 = source[offset + 10] ?? 0;
  const determinant =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  return determinant < 0;
}

function ensureDataCapacity(
  scratch: DrawOrderTransformPackingScratch,
  floatCount: number,
): void {
  if (scratch.data.length < floatCount) {
    scratch.data = new Float32Array(floatCount);
  }
}

function prepareDrawOrderTransformBuffer(input: {
  readonly device: WebGpuBufferDeviceLike;
  readonly cache: DrawOrderTransformBufferCache;
  readonly data: Float32Array;
  readonly offsets: readonly PackedTransformOffset[];
}): DrawOrderTransformBufferResource | null {
  const resourceKey = worldTransformBufferResourceKey(
    DRAW_ORDER_WORLD_TRANSFORM_LABEL,
  );

  if (
    input.cache.resource !== null &&
    input.cache.byteLength === input.data.byteLength
  ) {
    if (!sameFloat32Data(input.cache.lastData, input.data)) {
      if (
        !writeBufferData(input.device, input.cache.resource.buffer, input.data)
      ) {
        return null;
      }

      input.cache.lastData.set(input.data);
    }

    input.cache.resource = {
      resourceKey,
      buffer: input.cache.resource.buffer,
      offsets: input.offsets,
    };
    return input.cache.resource;
  }

  if (input.cache.resource !== null) {
    retireWebGpuBuffer(input.device, input.cache.resource.buffer);
    input.cache.resource = null;
    input.cache.byteLength = 0;
    input.cache.lastData = new Float32Array(0);
    input.cache.bindGroupsByPipelineKey.clear();
  }

  const buffer = createWebGpuBuffer({
    device: input.device,
    descriptor: {
      label: DRAW_ORDER_WORLD_TRANSFORM_LABEL,
      size: input.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: input.data,
    },
  });

  if (!buffer.ok) {
    return null;
  }

  input.cache.resource = {
    resourceKey,
    buffer: buffer.buffer,
    offsets: input.offsets,
  };
  input.cache.byteLength = input.data.byteLength;
  input.cache.lastData = input.data.slice();
  input.cache.bindGroupsByPipelineKey.clear();

  return input.cache.resource;
}

function sameFloat32Data(first: Float32Array, second: Float32Array): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }

  return true;
}

function prepareDrawOrderTransformBindGroups(input: {
  readonly device: {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  };
  readonly cache: DrawOrderTransformBufferCache;
  readonly resource: DrawOrderTransformBufferResource;
  readonly selected: readonly DrawOrderTransformSelectedPackage[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly scratch: DrawOrderTransformPackingScratch;
}): readonly UnlitBindGroupResource[] {
  if (input.device.createBindGroup === undefined) {
    return [];
  }

  const pipelineByKey = new Map(
    input.pipelines.flatMap((pipeline) =>
      pipeline.ok ? [[pipeline.key, pipeline.pipeline] as const] : [],
    ),
  );
  const pipelineKeys = new Set(
    input.selected.map((selected) => selected.resolvedPipelineKey),
  );

  for (const pipelineKey of pipelineKeys) {
    const cached = input.cache.bindGroupsByPipelineKey.get(pipelineKey);

    if (cached !== undefined) {
      input.scratch.bindGroups.push(cached);
      continue;
    }

    const pipeline = pipelineByKey.get(pipelineKey);
    const layout = getBindGroupLayout(pipeline, 1);

    if (layout === null) {
      continue;
    }

    const resourceKey = bindGroupResourceKey(
      `draw-order-world-transforms/group-1/${pipelineKey}/${input.resource.resourceKey}`,
    );
    const bindGroup = createDrawOrderTransformBindGroup(
      input,
      pipelineKey,
      layout,
    );

    if (bindGroup === null) {
      continue;
    }

    const resource: UnlitBindGroupResource = {
      group: 1,
      resourceKey,
      layoutKey: `draw-order-world-transforms/group-1/${pipelineKey}`,
      bindGroup,
      entryResourceKeys: [
        input.resource.resourceKey,
        DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY,
        pipelineKey,
      ],
    };

    input.cache.bindGroupsByPipelineKey.set(pipelineKey, resource);
    input.scratch.bindGroups.push(resource);
  }

  if (input.scratch.bindGroups.length !== pipelineKeys.size) {
    input.scratch.bindGroups.length = 0;
  }

  return input.scratch.bindGroups;
}

function createDrawOrderTransformBindGroup(
  input: {
    readonly device: {
      readonly createBindGroup?: (descriptor: unknown) => unknown;
    };
    readonly resource: DrawOrderTransformBufferResource;
  },
  pipelineKey: string,
  layout: unknown,
): unknown | null {
  try {
    return (
      input.device.createBindGroup?.({
        label: `draw-order-world-transforms/group-1/${pipelineKey}`,
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: input.resource.buffer },
          },
        ],
      }) ?? null
    );
  } catch {
    return null;
  }
}

function getBindGroupLayout(pipeline: unknown, group: number): unknown | null {
  const getBindGroupLayout =
    typeof pipeline === "object" && pipeline !== null
      ? (pipeline as { readonly getBindGroupLayout?: unknown })
          .getBindGroupLayout
      : undefined;

  if (typeof getBindGroupLayout !== "function") {
    return null;
  }

  return getBindGroupLayout.call(pipeline, group);
}
