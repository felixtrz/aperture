import {
  createGpuPassTimingReport,
  createGpuTimestampQueryResourcesChecked,
  readGpuTimestampQueryResults,
  type GpuPassTimingReport,
  type GpuTimestampQueryDeviceLike,
  type GpuTimestampQueryDiagnostic,
  type GpuTimestampQueryResources,
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
import type { WebGpuAppResourceCache } from "./resource-cache.js";
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
  readonly resources: GpuTimestampQueryResources;
}

export interface WebGpuAppOcclusionQueryReadback {
  readonly passName: string;
  readonly viewId: number;
  readonly resources: GpuOcclusionQueryResources;
  readonly renderIds: readonly number[];
}

export async function createWebGpuAppGpuTimingForTarget(
  app: WebGpuAppGpuDeviceContext,
  cache: WebGpuAppResourceCache,
  label: string,
  target: WebGpuAppFrameBoundaryTarget,
): Promise<{
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}> {
  const passName =
    target.renderTargetKey === null ? "main" : `main:${target.renderTargetKey}`;
  const cacheKey = `${passName}:2`;
  const cached = cache.gpuTimings.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const created = await createGpuTimestampQueryResourcesChecked({
    device: app.initialization.device as GpuTimestampQueryDeviceLike,
    label: `${label}:${passName}:gpu-timing`,
    queryCount: 2,
  });
  const entry = {
    passName,
    resources: created.resources,
    diagnostics: created.diagnostics,
  };

  cache.gpuTimings.set(cacheKey, entry);
  return entry;
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
      passNames: [readback.passName],
      readback: await readGpuTimestampQueryResults(readback.resources),
      diagnostics: input.diagnostics,
    });
  }

  const passReports: GpuPassTimingReport[] = [];

  for (const readback of input.readbacks) {
    passReports.push(
      createGpuPassTimingReport({
        passNames: [readback.passName],
        readback: await readGpuTimestampQueryResults(readback.resources),
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
