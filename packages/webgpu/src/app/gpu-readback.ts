import {
  createGpuPassTimingReport,
  createGpuTimestampQueryResourcesChecked,
  createGpuTimestampReadbackBuffer,
  readGpuTimestampQueryResults,
  type GpuPassTimingReport,
  type GpuTimestampQueryDeviceLike,
  type GpuTimestampQueryDiagnostic,
  type GpuTimestampQueryResources,
  type GpuTimestampReadbackResult,
} from "../gpu/gpu-timing.js";
import {
  readGpuOcclusionQueryResults,
  updateGpuOcclusionFeedbackState,
  type GpuOcclusionFeedbackFallbackReason,
  type GpuOcclusionFeedbackState,
  type GpuOcclusionQueryDiagnostic,
  type GpuOcclusionQueryReadbackResult,
  type GpuOcclusionQueryResources,
} from "../gpu/occlusion-query.js";
import {
  createWebGpuAppDiagnosticsSummary,
  type WebGpuAppDiagnosticsSummary,
} from "./app-diagnostics-summary.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type {
  WebGpuAppGpuTimingCacheEntry,
  WebGpuAppResourceCache,
} from "./resource-cache.js";
import type { WebGpuAppOcclusionQueryReport } from "./app.js";

interface WebGpuAppGpuDeviceContext {
  readonly initialization: {
    readonly device: unknown;
  };
}

interface WebGpuAppOcclusionCullingState {
  readonly queryCandidateDraws: number;
  readonly queriedDraws: number;
  readonly skippedFromQuery: number;
  readonly skippedRenderIds: readonly number[];
  readonly forcedProbeDraws: number;
  readonly forcedProbeRenderIds: readonly number[];
  readonly fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}

export interface WebGpuAppGpuTimingReadback {
  readonly passName: string;
  readonly passNames?: readonly string[];
  readonly resources: GpuTimestampQueryResources;
  /**
   * Returns the frame's readback buffer to the pass's rotation ring once the
   * CPU read unmapped it (or once the owner knows it will never map it).
   * Until then the buffer must not be reused by another frame's submit.
   */
  readonly release?: () => void;
}

export interface WebGpuAppOcclusionQueryReadback {
  readonly passName: string;
  readonly viewId: number;
  readonly resources: GpuOcclusionQueryResources;
  readonly renderIds: readonly number[];
}

/**
 * How many readback buffers a pass rotates through before a frame skips GPU
 * timing instead of reusing a buffer an in-flight frame still owns. Two covers
 * one overlapped frame (map pending while the next frame submits); three adds
 * slack for a second overlap without growing per-pass GPU memory meaningfully.
 */
const WEBGPU_APP_GPU_TIMING_READBACK_RING_CAPACITY = 3;

export interface WebGpuAppGpuTimingFrameLease {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
  readonly release?: () => void;
}

export async function createWebGpuAppGpuTimingForTarget(
  app: WebGpuAppGpuDeviceContext,
  cache: WebGpuAppResourceCache,
  label: string,
  target: WebGpuAppFrameBoundaryTarget,
): Promise<WebGpuAppGpuTimingFrameLease> {
  const passName =
    target.renderTargetKey === null ? "main" : `main:${target.renderTargetKey}`;
  return createWebGpuAppGpuTimingForPass(app, cache, label, passName, 2);
}

export async function createWebGpuAppGpuTimingForPass(
  app: WebGpuAppGpuDeviceContext,
  cache: WebGpuAppResourceCache,
  label: string,
  passName: string,
  queryCount: number,
): Promise<WebGpuAppGpuTimingFrameLease> {
  const normalizedQueryCount = Math.max(2, Math.ceil(queryCount));
  const cacheKey = `${passName}:${normalizedQueryCount}`;
  let entry = cache.gpuTimings.get(cacheKey);

  if (entry === undefined) {
    const created = await createGpuTimestampQueryResourcesChecked({
      device: app.initialization.device as GpuTimestampQueryDeviceLike,
      label: `${label}:${passName}:gpu-timing`,
      queryCount: normalizedQueryCount,
    });

    entry = {
      passName,
      resources: created.resources,
      diagnostics: created.diagnostics,
      readbackRing:
        created.resources === null ? [] : [created.resources.readbackBuffer],
      busyReadbacks: new Set(),
    };
    cache.gpuTimings.set(cacheKey, entry);
  }

  if (entry.resources === null) {
    return {
      passName: entry.passName,
      resources: null,
      diagnostics: entry.diagnostics,
    };
  }

  // AI-11 keeps frames pipelined, so a previous frame's timing readback can
  // still be mapped (or pending map) while this frame encodes its submit.
  // Lease a readback buffer that no in-flight frame owns; submitting a copy
  // into a mapped buffer is a WebGPU validation error ("used in submit while
  // mapped"). When the ring is exhausted, skip timing for this frame rather
  // than reuse a busy buffer or grow without bound.
  const readbackBuffer = leaseGpuTimingReadbackBuffer(
    app,
    entry,
    entry.resources,
  );

  if (readbackBuffer === null) {
    return {
      passName: entry.passName,
      resources: null,
      diagnostics: entry.diagnostics,
    };
  }

  const busyReadbacks = entry.busyReadbacks;
  const resources =
    readbackBuffer === entry.resources.readbackBuffer
      ? entry.resources
      : { ...entry.resources, readbackBuffer };

  return {
    passName: entry.passName,
    resources,
    diagnostics: entry.diagnostics,
    release: () => {
      busyReadbacks.delete(readbackBuffer);
    },
  };
}

function leaseGpuTimingReadbackBuffer(
  app: WebGpuAppGpuDeviceContext,
  entry: WebGpuAppGpuTimingCacheEntry,
  resources: GpuTimestampQueryResources,
): GpuTimestampQueryResources["readbackBuffer"] | null {
  let leased = entry.readbackRing.find(
    (buffer) => !entry.busyReadbacks.has(buffer),
  );

  if (leased === undefined) {
    if (
      entry.readbackRing.length >= WEBGPU_APP_GPU_TIMING_READBACK_RING_CAPACITY
    ) {
      return null;
    }

    const created = createGpuTimestampReadbackBuffer({
      device: app.initialization.device as GpuTimestampQueryDeviceLike,
      label: `${resources.label}/readback#${entry.readbackRing.length}`,
      byteLength: resources.byteLength,
    });

    if (created === null) {
      return null;
    }

    entry.readbackRing.push(created);
    leased = created;
  }

  entry.busyReadbacks.add(leased);
  return leased;
}

/**
 * Returns leased timing readback buffers without reading them. Frame paths
 * that encode GPU timestamps but never map the readback (no timing report on
 * their route) must release their leases or the rotation ring would saturate
 * and silently disable timing.
 */
export function releaseWebGpuAppGpuTimingReadbacks(
  readbacks: readonly WebGpuAppGpuTimingReadback[],
): void {
  for (const readback of readbacks) {
    readback.release?.();
  }
}

export async function readWebGpuAppGpuTimings(input: {
  readonly readbacks: readonly WebGpuAppGpuTimingReadback[];
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}): Promise<GpuPassTimingReport | undefined> {
  if (input.readbacks.length === 0) {
    return undefined;
  }

  if (input.readbacks.length === 1) {
    const readback = input.readbacks[0];

    if (readback === undefined) {
      return undefined;
    }

    return createGpuPassTimingReport({
      passNames: readback.passNames ?? [readback.passName],
      readback: await readWebGpuAppGpuTimingReadback(readback),
      diagnostics: input.diagnostics,
    });
  }

  const passReports: GpuPassTimingReport[] = [];

  for (const readback of input.readbacks) {
    passReports.push(
      createGpuPassTimingReport({
        passNames: readback.passNames ?? [readback.passName],
        readback: await readWebGpuAppGpuTimingReadback(readback),
      }),
    );
  }

  return {
    ready:
      input.diagnostics.length === 0 &&
      passReports.every((report) => report.ready),
    supported: passReports.some((report) => report.supported),
    queryCount: passReports.reduce((sum, report) => sum + report.queryCount, 0),
    passes: passReports.flatMap((report) => report.passes),
    diagnostics: [
      ...input.diagnostics,
      ...passReports.flatMap((report) => report.diagnostics),
    ],
  };
}

async function readWebGpuAppGpuTimingReadback(
  readback: WebGpuAppGpuTimingReadback,
): Promise<GpuTimestampReadbackResult> {
  try {
    return await readGpuTimestampQueryResults(readback.resources);
  } finally {
    // The read unmaps the buffer (even on failure), so the lease can return to
    // the pass's rotation ring for a later frame.
    readback.release?.();
  }
}

export async function readWebGpuAppOcclusionQueries(input: {
  readonly readbacks: readonly WebGpuAppOcclusionQueryReadback[];
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
  readonly queryCount: number;
  readonly frame: number;
  readonly feedbackState: GpuOcclusionFeedbackState;
  readonly culling: WebGpuAppOcclusionCullingState;
}): Promise<WebGpuAppOcclusionQueryReport | undefined> {
  if (
    input.queryCount === 0 &&
    input.diagnostics.length === 0 &&
    input.culling.queryCandidateDraws === 0 &&
    input.culling.skippedFromQuery === 0 &&
    input.culling.forcedProbeDraws === 0 &&
    input.culling.fallbackReason === null
  ) {
    return undefined;
  }

  const readbackResults: {
    readonly viewId: number;
    readonly result: GpuOcclusionQueryReadbackResult;
  }[] = [];

  for (const readback of input.readbacks) {
    readbackResults.push({
      viewId: readback.viewId,
      result: await readGpuOcclusionQueryResults(
        readback.resources,
        readback.renderIds,
      ),
    });
  }

  const diagnostics = [
    ...input.diagnostics,
    ...readbackResults.flatMap((entry) => entry.result.diagnostics),
  ];
  const allReadbacksValid =
    readbackResults.length > 0 &&
    readbackResults.every((entry) => entry.result.valid);
  const status =
    input.queryCount === 0
      ? "inactive"
      : allReadbacksValid &&
          diagnostics.every((entry) => entry.severity !== "error")
        ? "ready"
        : "unsupported";

  if (status === "ready") {
    for (const readback of readbackResults) {
      updateGpuOcclusionFeedbackState({
        state: input.feedbackState,
        viewId: readback.viewId,
        frame: input.frame,
        status,
        testedRenderIds: readback.result.testedRenderIds,
        visibleRenderIds: readback.result.visibleRenderIds,
        occludedRenderIds: readback.result.occludedRenderIds,
      });
    }
  } else if (status === "unsupported") {
    updateGpuOcclusionFeedbackState({
      state: input.feedbackState,
      viewId: 0,
      frame: input.frame,
      status,
      testedRenderIds: [],
      visibleRenderIds: [],
      occludedRenderIds: [],
    });
  }

  return {
    status,
    queryCount: input.queryCount,
    queryCandidateDraws: input.culling.queryCandidateDraws,
    queriedDraws: input.culling.queriedDraws,
    resolvedQueryResults: readbackResults.reduce(
      (total, entry) =>
        total + (entry.result.valid ? entry.result.testedRenderIds.length : 0),
      0,
    ),
    skippedFromQuery: input.culling.skippedFromQuery,
    skippedRenderIds: [...input.culling.skippedRenderIds],
    forcedProbeDraws: input.culling.forcedProbeDraws,
    forcedProbeRenderIds: [...input.culling.forcedProbeRenderIds],
    fallbackReason:
      status === "unsupported" ? "unsupported" : input.culling.fallbackReason,
    testedRenderIds: readbackResults.flatMap(
      (entry) => entry.result.testedRenderIds,
    ),
    visibleRenderIds: readbackResults.flatMap(
      (entry) => entry.result.visibleRenderIds,
    ),
    occludedRenderIds: readbackResults.flatMap(
      (entry) => entry.result.occludedRenderIds,
    ),
    sampleCounts: readbackResults.flatMap((entry) => entry.result.sampleCounts),
    diagnostics,
  };
}

export function newOcclusionQueryDiagnostics(
  report: WebGpuAppOcclusionQueryReport | undefined,
  existing: readonly GpuOcclusionQueryDiagnostic[],
): readonly GpuOcclusionQueryDiagnostic[] {
  if (report === undefined) {
    return [];
  }

  return report.diagnostics.filter(
    (diagnostic) => !existing.includes(diagnostic),
  );
}

export function createWebGpuAppDiagnosticsSummaryWithGpuTimings(
  summary: WebGpuAppDiagnosticsSummary,
  gpuTimings: GpuPassTimingReport,
): WebGpuAppDiagnosticsSummary {
  return createWebGpuAppDiagnosticsSummary({
    ...(summary.materialQueue === undefined
      ? {}
      : { materialQueue: summary.materialQueue }),
    ...(summary.materialQueueRoute === undefined
      ? {}
      : { materialQueueRoute: summary.materialQueueRoute }),
    ...(summary.routedResourceSet === undefined
      ? {}
      : { routedResourceSet: summary.routedResourceSet }),
    ...(summary.builtInAppResourceAdapters === undefined
      ? {}
      : { builtInAppResourceAdapters: summary.builtInAppResourceAdapters }),
    ...(summary.renderFrameQueue === undefined
      ? {}
      : { renderFrameQueue: summary.renderFrameQueue }),
    ...(summary.renderQueueSortPhases === undefined
      ? {}
      : { renderQueueSortPhases: summary.renderQueueSortPhases }),
    gpuTimings,
    ...(summary.directLighting === undefined
      ? {}
      : { directLighting: summary.directLighting }),
  });
}
