import type { AssetRegistry } from "@aperture-engine/simulation";
import {
  writePackedSnapshotPreviousTransforms,
  type PackedPreviousSnapshotTransformHistoryReport,
  type PackedSnapshotPreviousTransforms,
  type PackedSnapshotTransformHistoryUpdateReport,
  type PackedSnapshotTransforms,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { writeBufferData } from "./app-frame-resource-utils.js";
import { createWebGpuAppFrameBoundaryTargets } from "./frame-target.js";
import type { WebGpuAppPostPassCache } from "./resource-cache.js";
import {
  createWorldTransformGpuBuffer,
  writeWorldTransformBufferDescriptor,
  type WorldTransformGpuBufferResource,
} from "../resources/transforms/world-transform-buffer.js";
import type {
  WebGpuApp,
  WebGpuAppMotionVectorFallbackReason,
  WebGpuAppMotionVectorReport,
  WebGpuAppMotionVectorStatus,
} from "./app.js";

interface WebGpuAppSceneMotionVectorPlan {
  readonly required: boolean;
  readonly colorFormat: string | null;
  readonly fallbackReason?: WebGpuAppMotionVectorFallbackReason;
}

export function createWebGpuAppSceneMotionVectorPlan(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly snapshot: RenderSnapshot;
}): WebGpuAppSceneMotionVectorPlan {
  const needsMotionVectors = options.app.postEffects.some(
    (effect) =>
      effect.enabled !== false && effect.requiresMotionVectors === true,
  );

  if (!needsMotionVectors) {
    return {
      required: false,
      colorFormat: null,
      fallbackReason: "not-required",
    };
  }

  if (options.app.msaa.sampleCount > 1) {
    return { required: true, colorFormat: null, fallbackReason: "msaa" };
  }

  if (
    (options.snapshot.spriteDraws?.length ?? 0) > 0 ||
    (options.snapshot.skyboxes?.length ?? 0) > 0 ||
    (options.snapshot.proceduralSkies?.length ?? 0) > 0
  ) {
    return {
      required: true,
      colorFormat: null,
      fallbackReason: "unsupported-scene-packets",
    };
  }

  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );

  if (
    targetPlan.diagnostics.length > 0 ||
    targetPlan.targets.length !== 1 ||
    targetPlan.targets[0]?.source !== "swapchain"
  ) {
    return {
      required: true,
      colorFormat: null,
      fallbackReason: "unsupported-target",
    };
  }

  return { required: true, colorFormat: options.app.initialization.format };
}

interface WebGpuAppPreviousObjectTransformResourceResult {
  readonly resource: WorldTransformGpuBufferResource | null;
  readonly packed: PackedSnapshotPreviousTransforms | null;
  readonly history: PackedPreviousSnapshotTransformHistoryReport;
  readonly diagnostics: readonly unknown[];
}

export function prepareWebGpuAppPreviousObjectTransformResource(options: {
  readonly device: unknown;
  readonly cache: WebGpuAppPostPassCache;
  readonly currentTransforms: PackedSnapshotTransforms;
  readonly required: boolean;
}): WebGpuAppPreviousObjectTransformResourceResult {
  if (!options.required) {
    return {
      resource: null,
      packed: null,
      history: emptyPreviousObjectTransformHistoryReport(),
      diagnostics: [],
    };
  }

  const packed = writePackedSnapshotPreviousTransforms(
    options.currentTransforms,
    options.cache.previousWorldTransformsByRenderId,
    options.cache.previousWorldTransformsScratch,
  );
  const descriptor = writeWorldTransformBufferDescriptor(
    packed,
    options.cache.previousWorldTransformDescriptorScratch,
    {
      label: previousWorldTransformBufferLabel(
        packed.floatCount ?? packed.data.length,
      ),
    },
  );
  const diagnostics: unknown[] = [
    ...packed.diagnostics,
    ...descriptor.diagnostics,
  ];

  if (descriptor.plan === null) {
    options.cache.previousWorldTransformResource = null;
    options.cache.previousWorldTransformByteLength = 0;
    return {
      resource: null,
      packed,
      history: packed.history,
      diagnostics,
    };
  }

  const byteLength = descriptor.plan.source.byteLength;
  const cached = options.cache.previousWorldTransformResource;

  if (
    cached !== null &&
    options.cache.previousWorldTransformByteLength === byteLength &&
    writeBufferData(options.device, cached.buffer, descriptor.plan.source)
  ) {
    return {
      resource: cached,
      packed,
      history: packed.history,
      diagnostics,
    };
  }

  const resource = createWorldTransformGpuBuffer({
    device: options.device as Parameters<
      typeof createWorldTransformGpuBuffer
    >[0]["device"],
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);
  options.cache.previousWorldTransformResource = resource.resource;
  options.cache.previousWorldTransformByteLength =
    resource.resource === null ? 0 : byteLength;

  return {
    resource: resource.resource,
    packed,
    history: packed.history,
    diagnostics,
  };
}

export function createWebGpuAppMotionVectorReport(options: {
  readonly plan: WebGpuAppSceneMotionVectorPlan;
  readonly objectHistory: PackedPreviousSnapshotTransformHistoryReport;
  readonly resource: WorldTransformGpuBufferResource | null;
  readonly update: PackedSnapshotTransformHistoryUpdateReport;
}): WebGpuAppMotionVectorReport {
  const missingPreviousBuffer =
    options.plan.required &&
    options.plan.colorFormat !== null &&
    options.resource === null;
  const fallbackReason = missingPreviousBuffer
    ? "missing-previous-object-transform-buffer"
    : options.plan.fallbackReason;
  const status: WebGpuAppMotionVectorStatus = !options.plan.required
    ? "disabled"
    : options.plan.colorFormat === null || missingPreviousBuffer
      ? "fallback-clear"
      : "scene-attachment";

  return {
    required: options.plan.required,
    status,
    colorFormat: missingPreviousBuffer ? null : options.plan.colorFormat,
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
    objectTransforms: {
      available: options.resource !== null,
      resourceKey: options.resource?.resourceKey ?? null,
      total: options.objectHistory.total,
      used: options.objectHistory.used,
      fallback: options.objectHistory.fallback,
      missing: options.objectHistory.missing,
      stored: options.update.stored,
      staleRemoved: options.update.staleRemoved,
    },
  };
}

export function encodePostPassMotionVectorClearColor(options: {
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly cache: Pick<
    WebGpuAppPostPassCache,
    "previousViewProjectionByViewId"
  >;
}): readonly [number, number, number, number] {
  const current = readSnapshotViewProjectionMatrix(
    options.snapshot,
    options.view,
  );

  if (current === null) {
    return [0.5, 0.5, 0.5, 1];
  }

  const previous = options.cache.previousViewProjectionByViewId.get(
    options.view.viewId,
  );
  const motion =
    previous === undefined
      ? [0, 0]
      : screenMotionForViewProjectionMatrices(current, previous);
  const stored = previous ?? new Float32Array(16);

  stored.set(current);
  options.cache.previousViewProjectionByViewId.set(options.view.viewId, stored);

  return [
    encodeSignedMotionComponent(motion[0] ?? 0),
    encodeSignedMotionComponent(motion[1] ?? 0),
    0.5,
    1,
  ];
}

export function rememberCurrentViewProjectionMatrices(
  snapshot: RenderSnapshot,
  previousViewProjectionByViewId: Map<number, Float32Array>,
): void {
  for (const view of snapshot.views) {
    const current = readSnapshotViewProjectionMatrix(snapshot, view);

    if (current === null) {
      continue;
    }

    const stored =
      previousViewProjectionByViewId.get(view.viewId) ?? new Float32Array(16);

    stored.set(current);
    previousViewProjectionByViewId.set(view.viewId, stored);
  }
}

function emptyPreviousObjectTransformHistoryReport(): PackedPreviousSnapshotTransformHistoryReport {
  return { total: 0, used: 0, fallback: 0, missing: [] };
}

function previousWorldTransformBufferLabel(floatCount: number): string {
  return `PreviousWorldTransforms/storage/${floatCount}`;
}

function readSnapshotViewProjectionMatrix(
  snapshot: RenderSnapshot,
  view: RenderSnapshot["views"][number],
): Float32Array | null {
  const offset = view.viewProjectionMatrixOffset;

  if (offset < 0 || offset + 16 > snapshot.viewMatrices.length) {
    return null;
  }

  return snapshot.viewMatrices.subarray(offset, offset + 16);
}

function screenMotionForViewProjectionMatrices(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
): readonly [number, number] {
  const currentNdc = projectWorldOriginToNdc(current);
  const previousNdc = projectWorldOriginToNdc(previous);

  return [
    (currentNdc[0] - previousNdc[0]) * 0.5,
    (currentNdc[1] - previousNdc[1]) * -0.5,
  ];
}

function projectWorldOriginToNdc(
  matrix: ArrayLike<number>,
): readonly [number, number] {
  const w = finiteNonZero(matrix[15] ?? 1);

  return [(matrix[12] ?? 0) / w, (matrix[13] ?? 0) / w];
}

function finiteNonZero(value: number): number {
  return Number.isFinite(value) && Math.abs(value) > 0.000001 ? value : 1;
}

function encodeSignedMotionComponent(value: number): number {
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, -1), 1) : 0;
  return clamped * 0.5 + 0.5;
}
