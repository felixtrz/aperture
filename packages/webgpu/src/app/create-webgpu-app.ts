import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createRenderSnapshotChangeSet,
  createKtx2TextureCompressionSupportFromFeatures,
  RenderWorld,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { registerWebGpuAppEnvironmentResourceCache } from "./app-environment-resources.js";
import {
  createWebGpuAppSnapshotTransport,
  createWebGpuAppSnapshotTransportStartPayload,
  hasWebGpuAppSharedSnapshotPayload,
  readWebGpuAppSnapshotChangeSet,
  readWebGpuAppSharedSnapshot,
} from "./app-snapshot-transport.js";
import { resolveWebGpuMsaaConfig } from "../gpu/msaa.js";
import { resolveTonemapOperator } from "../output/output-stage-tonemap.js";
import { createWebGpuTonemapPostEffect } from "../post/post-tonemap.js";
import { resolveOutputColorSpace } from "../output/output-stage-color-space.js";
import { initializeWebGpu } from "../gpu/initialize-webgpu.js";
import {
  webGpuAppPickReportToJsonValue,
  webGpuAppRenderReportToJsonValue,
} from "./report.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import { evictWebGpuAppPreparedResourceCaches } from "./prepared-resource-cache-eviction.js";
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { createWebGpuAppResourceCache } from "./resource-cache.js";
import { createWebGpuAppUserPassRegistry } from "./user-pass.js";
import { getOrCreateWebGpuAppPipeline } from "./pipeline-resources.js";
import { QUEUED_BUILT_IN_MATERIAL_ADAPTERS } from "./queued-built-in-adapters.js";
import { pickWebGpuAppEntity } from "./picking-frame.js";
import { renderWebGpuAppFrame } from "./frame-loop.js";
import type {
  CreateWebGpuAppOptions,
  CreateWebGpuAppResult,
  WebGpuApp,
  WebGpuAppCadenceCounterReport,
  WebGpuAppCadenceReport,
  WebGpuAppDiagnosticsOptions,
  WebGpuAppPickReport,
  WebGpuAppPickReportJsonValue,
  WebGpuAppRenderReport,
  WebGpuAppRenderReportJsonValue,
  WebGpuAppSimulationWorkerSnapshotEvent,
  WebGpuAppWorkerRenderErrorDiagnostic,
} from "./app.js";

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const sourceAssets = options.sourceAssets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const tonemap = resolveTonemapOperator(options.tonemap);
  const outputColorSpace = resolveOutputColorSpace(options.outputColorSpace);
  const msaa = resolveWebGpuMsaaConfig(options.msaa ?? options.msaaSampleCount);
  // Persistent HDR scene buffer (M5-T4): opting into `exposure` renders the lit
  // scene into rgba16float and moves tonemap+exposure+sRGB to a final post
  // stage. Default (no exposure) keeps the byte-identical 8-bit in-material path.
  const hdrSceneBuffer =
    options.exposure !== undefined && Number.isFinite(options.exposure);
  const exposure = hdrSceneBuffer ? (options.exposure as number) : 1;
  const sceneRenderFormat = hdrSceneBuffer
    ? "rgba16float"
    : initialization.format;
  const postEffects = [...(options.postEffects ?? [])];

  if (hdrSceneBuffer) {
    // The tonemap stage is the LAST post effect: it samples the rgba16float
    // scene/post output and writes the 8-bit swapchain with exposure applied.
    postEffects.push(
      createWebGpuTonemapPostEffect({
        operator: tonemap,
        exposure,
        outputColorSpace,
      }),
    );
  }
  const resourceCache = createWebGpuAppResourceCache();
  const userPassRegistry = createWebGpuAppUserPassRegistry();
  const snapshotTransport = createWebGpuAppSnapshotTransport({
    ...(options.transport === undefined ? {} : { mode: options.transport }),
    ...(options.sharedSnapshotTransport === undefined
      ? {}
      : { sharedSnapshotTransport: options.sharedSnapshotTransport }),
  });
  const assetDecoderStartOptions = {
    ktx2TextureCompression: createKtx2TextureCompressionSupportFromFeatures(
      initialization.device.features ?? initialization.adapter.features,
    ),
  };
  let running = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let renderQueue: Promise<void> = Promise.resolve();
  let pendingSnapshotEvent: WebGpuAppSimulationWorkerSnapshotEvent | null =
    null;
  let autoRenderScheduled = false;
  let autoRenderInFlight = false;
  let presentationMissedWhileInFlight = false;
  let latestReport: WebGpuAppRenderReport | null = null;
  let latestFullReportJson: WebGpuAppRenderReportJsonValue | null = null;
  let latestFullReportJsonSource: WebGpuAppRenderReport | null = null;
  let latestStatusReportJson: WebGpuAppRenderReportJsonValue | null = null;
  let latestStatusReportJsonSource: WebGpuAppRenderReport | null = null;
  let previousSnapshotForUpdate: RenderSnapshot | null = null;
  let latestPreviousSnapshotForUpdate: RenderSnapshot | null = null;
  let latestPickReport: WebGpuAppPickReport | null = null;
  let latestPickReportJson: WebGpuAppPickReportJsonValue | null = null;
  let latestWorkerError: WebGpuAppWorkerRenderErrorDiagnostic | null = null;
  const cadence = createWebGpuAppCadenceDiagnostics();
  const defaultGpuTimings =
    options.gpuTimings === true || options.timestampQuery === true;

  const requestPresentationFrame =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback): number =>
          setTimeout(() => callback(Date.now()), 0) as unknown as number;

  const renderPendingSnapshot = (): void => {
    if (!running || pendingSnapshotEvent === null || autoRenderInFlight) {
      return;
    }

    const event = pendingSnapshotEvent;
    pendingSnapshotEvent = null;
    autoRenderInFlight = true;
    renderQueue = renderQueue
      .then(async () => {
        const hasSharedSnapshotPayload = hasWebGpuAppSharedSnapshotPayload(
          event.message,
        );
        const sharedSnapshot = readWebGpuAppSharedSnapshot(
          snapshotTransport,
          event.message,
        );
        if (hasSharedSnapshotPayload && sharedSnapshot === null) {
          return;
        }

        const snapshot = sharedSnapshot ?? event.snapshot;
        const snapshotChangeSet = readWebGpuAppSnapshotChangeSet(event.message);

        cadence.recordRenderStarted(snapshot.frame);
        await app.renderSnapshot(snapshot, {
          frame: snapshot.frame,
          ...(snapshotChangeSet === null ? {} : { snapshotChangeSet }),
        });
        cadence.recordRenderCompleted(snapshot.frame);
      })
      .catch((error: unknown) => {
        cadence.recordRenderFailed();
        latestWorkerError = {
          code: "webGpuApp.workerSnapshotRenderFailed",
          reason: "webgpu-app.render-snapshot-failed",
          message:
            error instanceof Error
              ? error.message
              : "Rendering a worker-produced snapshot failed.",
        };
      })
      .finally(() => {
        autoRenderInFlight = false;
        if (pendingSnapshotEvent !== null) {
          if (presentationMissedWhileInFlight) {
            presentationMissedWhileInFlight = false;
            cadence.recordRenderCompletionDrain();
            renderPendingSnapshot();
          } else {
            scheduleAutoRender();
          }
        }
      });
  };

  const scheduleAutoRender = (): void => {
    if (!running || autoRenderScheduled) {
      return;
    }

    autoRenderScheduled = true;
    requestPresentationFrame(() => {
      autoRenderScheduled = false;
      cadence.recordPresentationCallback(null);

      if (!running || pendingSnapshotEvent === null) {
        cadence.recordPresentationCallbackWithoutSnapshot();
        return;
      }

      if (autoRenderInFlight) {
        presentationMissedWhileInFlight = true;
        cadence.recordPresentationCallbackWhileInFlight();
        return;
      }

      renderPendingSnapshot();
    });
  };

  const app: WebGpuApp = {
    canvas: options.canvas,
    initialization,
    renderWorld,
    tonemap,
    outputColorSpace,
    exposure,
    sceneRenderFormat,
    msaa,
    postEffects,
    // AI-25: the single-encoder FrameGraph route is the DEFAULT at parity (the
    // forward graph covers no-post / shadow / transmission-grab / user passes,
    // and the post graph falls back to legacy per-route for anything it does
    // not cover). Pass useFrameGraph: false to force the legacy multi-submit
    // route.
    useFrameGraph: options.useFrameGraph ?? true,
    userPassRegistry,
    addRenderPass(descriptor) {
      userPassRegistry.addRenderPass(descriptor);
    },
    addComputePass(descriptor) {
      userPassRegistry.addComputePass(descriptor);
    },
    removePass(name) {
      return userPassRegistry.removePass(name);
    },
    setPostEffectEnabled(id, enabled) {
      const effectIndex = postEffects.findIndex((effect) => effect.id === id);
      if (effectIndex < 0) return false;
      const effect = postEffects[effectIndex];
      if (effect === undefined) return false;
      postEffects[effectIndex] = { ...effect, enabled };
      return true;
    },
    start(startOptions = {}) {
      if (running) {
        return;
      }

      running = true;
      unsubscribeSnapshot = options.simulationWorker.onSnapshot((event) => {
        cadence.recordSnapshotReceived(event.frame);
        if (pendingSnapshotEvent !== null) {
          cadence.recordPendingSnapshotReplaced();
        }
        pendingSnapshotEvent = event;
        scheduleAutoRender();
      });
      unsubscribeError = options.simulationWorker.onError((event) => {
        latestWorkerError = {
          code: "webGpuApp.workerSnapshotRenderFailed",
          reason: event.reason,
          message: event.message,
        };
      });
      const transportStartPayload =
        createWebGpuAppSnapshotTransportStartPayload(snapshotTransport);

      options.simulationWorker.start(
        mergeWorkerStartOptions(
          assetDecoderStartOptions,
          options.workerStartOptions,
          startOptions,
          transportStartPayload === null
            ? undefined
            : { transport: transportStartPayload },
        ),
      );
    },
    stop() {
      if (!running) {
        return;
      }

      running = false;
      pendingSnapshotEvent = null;
      autoRenderScheduled = false;
      presentationMissedWhileInFlight = false;
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      unsubscribeError?.();
      unsubscribeError = null;
    },
    getDiagnostics(options: WebGpuAppDiagnosticsOptions = {}) {
      return {
        lastFrame: readLatestRenderReportJson(options.detail ?? "status"),
        lastPick: latestPickReportJson,
        lastError: latestWorkerError,
        transport: snapshotTransport.diagnostics,
        cadence: cadence.report({
          pendingSnapshot: pendingSnapshotEvent !== null,
          scheduled: autoRenderScheduled,
          inFlight: autoRenderInFlight,
        }),
      };
    },
    async pick(x, y) {
      const report = await pickWebGpuAppEntity(
        { app, sourceAssets },
        resourceCache,
        latestReport,
        x,
        y,
        {
          adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
          getPipeline: ({ item, reuse }) =>
            getOrCreateWebGpuAppPipeline({
              app,
              cache: resourceCache,
              reuse,
              kind: item.adapter.kind,
              pipelineKey: item.draw.batchKey.pipelineKey,
              batchKey: item.draw.batchKey,
            }),
          getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) =>
            getWebGpuAppPipelineLayouts({
              cache: resourceCache,
              kind: item.adapter.kind,
              pipeline,
              getBindGroupLayout,
            }),
        },
      );

      latestPickReport = report;
      latestPickReportJson = webGpuAppPickReportToJsonValue(report);
      return report.entity;
    },
    async renderSnapshot(snapshot, renderOptions = {}) {
      const previousSnapshotForReport = previousSnapshotForUpdate;
      const report = await renderWebGpuAppFrame(
        { app, sourceAssets },
        resourceCache,
        {
          ...renderOptions,
          gpuTimings: renderOptions.gpuTimings ?? defaultGpuTimings,
          snapshot,
          previousSnapshotForUpdate,
        },
      );

      prepareWebGpuAppSourceAssetFacades({
        registry: sourceAssets,
        snapshot: report.snapshot,
        cache: resourceCache,
        pruneUnreferenced: true,
        resourceReuse: report.resourceReuse,
      });
      if (report.ok) {
        evictWebGpuAppPreparedResourceCaches({
          cache: resourceCache,
          frame: report.frame,
          resourceReuse: report.resourceReuse,
        });
      }

      latestReport = report;
      latestPreviousSnapshotForUpdate = previousSnapshotForReport;
      latestFullReportJson = null;
      latestFullReportJsonSource = null;
      latestStatusReportJson = null;
      latestStatusReportJsonSource = null;
      previousSnapshotForUpdate = report.snapshot;
      latestWorkerError = null;
      return report;
    },
  };

  registerWebGpuAppEnvironmentResourceCache(
    app,
    resourceCache.environmentResources,
  );

  if (options.autoStart === true) {
    app.start(options.workerStartOptions);
  }

  return { ok: true, app, initialization };

  function readLatestRenderReportJson(
    detail: "full" | "status",
  ): WebGpuAppRenderReportJsonValue | null {
    if (latestReport === null) {
      latestFullReportJson = null;
      latestFullReportJsonSource = null;
      latestStatusReportJson = null;
      latestStatusReportJsonSource = null;
      return null;
    }

    if (detail === "full") {
      if (
        latestFullReportJsonSource !== latestReport ||
        latestFullReportJson === null
      ) {
        latestFullReportJson = webGpuAppRenderReportToJsonValue(
          reportWithFullChangeSetKeys(latestReport),
        );
        latestFullReportJsonSource = latestReport;
      }

      return latestFullReportJson;
    }

    if (
      latestStatusReportJsonSource !== latestReport ||
      latestStatusReportJson === null
    ) {
      latestStatusReportJson = webGpuAppRenderReportToJsonValue(latestReport, {
        detail: "status",
      });
      latestStatusReportJsonSource = latestReport;
    }

    return latestStatusReportJson;
  }

  function reportWithFullChangeSetKeys(
    report: WebGpuAppRenderReport,
  ): WebGpuAppRenderReport {
    if (
      report.snapshotChangeSet === undefined ||
      report.snapshotChangeSet.keys !== undefined
    ) {
      return report;
    }

    return {
      ...report,
      snapshotChangeSet: createRenderSnapshotChangeSet(
        latestPreviousSnapshotForUpdate,
        report.snapshot,
      ),
    };
  }
}

interface WebGpuAppCadenceDiagnostics {
  recordSnapshotReceived(frame: number | null): void;
  recordPresentationCallback(frame: number | null): void;
  recordRenderStarted(frame: number | null): void;
  recordRenderCompleted(frame: number | null): void;
  recordRenderFailed(): void;
  recordPendingSnapshotReplaced(): void;
  recordRenderCompletionDrain(): void;
  recordPresentationCallbackWhileInFlight(): void;
  recordPresentationCallbackWithoutSnapshot(): void;
  report(state: {
    readonly pendingSnapshot: boolean;
    readonly scheduled: boolean;
    readonly inFlight: boolean;
  }): WebGpuAppCadenceReport;
}

interface WebGpuAppCadenceCounter {
  total: number;
  latestFrame: number | null;
  lastTimestampMilliseconds: number | null;
  latestIntervalMilliseconds: number | null;
  readonly intervals: number[];
}

function createWebGpuAppCadenceDiagnostics(
  sampleWindow = 120,
): WebGpuAppCadenceDiagnostics {
  const normalizedSampleWindow = Math.max(1, Math.floor(sampleWindow));
  const snapshotsReceived = createCadenceCounter();
  const presentationCallbacks = createCadenceCounter();
  const rendersStarted = createCadenceCounter();
  const rendersCompleted = createCadenceCounter();
  let pendingSnapshotsReplaced = 0;
  let renderCompletionDrains = 0;
  let presentationCallbacksWhileInFlight = 0;
  let presentationCallbacksWithoutSnapshot = 0;
  let renderFailures = 0;

  return {
    recordSnapshotReceived(frame) {
      recordCadenceCounter(snapshotsReceived, normalizedSampleWindow, frame);
    },
    recordPresentationCallback(frame) {
      recordCadenceCounter(
        presentationCallbacks,
        normalizedSampleWindow,
        frame,
      );
    },
    recordRenderStarted(frame) {
      recordCadenceCounter(rendersStarted, normalizedSampleWindow, frame);
    },
    recordRenderCompleted(frame) {
      recordCadenceCounter(rendersCompleted, normalizedSampleWindow, frame);
    },
    recordRenderFailed() {
      renderFailures += 1;
    },
    recordPendingSnapshotReplaced() {
      pendingSnapshotsReplaced += 1;
    },
    recordRenderCompletionDrain() {
      renderCompletionDrains += 1;
    },
    recordPresentationCallbackWhileInFlight() {
      presentationCallbacksWhileInFlight += 1;
    },
    recordPresentationCallbackWithoutSnapshot() {
      presentationCallbacksWithoutSnapshot += 1;
    },
    report(state) {
      return {
        sampleWindow: normalizedSampleWindow,
        snapshotsReceived: cadenceCounterReport(snapshotsReceived),
        presentationCallbacks: cadenceCounterReport(presentationCallbacks),
        rendersStarted: cadenceCounterReport(rendersStarted),
        rendersCompleted: cadenceCounterReport(rendersCompleted),
        pendingSnapshotsReplaced,
        renderCompletionDrains,
        presentationCallbacksWhileInFlight,
        presentationCallbacksWithoutSnapshot,
        renderFailures,
        pendingSnapshot: state.pendingSnapshot,
        scheduled: state.scheduled,
        inFlight: state.inFlight,
      };
    },
  };
}

function createCadenceCounter(): WebGpuAppCadenceCounter {
  return {
    total: 0,
    latestFrame: null,
    lastTimestampMilliseconds: null,
    latestIntervalMilliseconds: null,
    intervals: [],
  };
}

function recordCadenceCounter(
  counter: WebGpuAppCadenceCounter,
  sampleWindow: number,
  frame: number | null,
): void {
  const now = nowMilliseconds();

  if (counter.lastTimestampMilliseconds !== null) {
    const interval = Math.max(0, now - counter.lastTimestampMilliseconds);

    counter.latestIntervalMilliseconds = interval;
    counter.intervals.push(interval);
    while (counter.intervals.length > sampleWindow) {
      counter.intervals.shift();
    }
  }

  counter.total += 1;
  counter.latestFrame = frame;
  counter.lastTimestampMilliseconds = now;
}

function cadenceCounterReport(
  counter: WebGpuAppCadenceCounter,
): WebGpuAppCadenceCounterReport {
  if (counter.intervals.length === 0) {
    return {
      total: counter.total,
      intervalSamples: 0,
      latestIntervalMilliseconds: null,
      averageIntervalMilliseconds: null,
      minimumIntervalMilliseconds: null,
      maximumIntervalMilliseconds: null,
      estimatedHz: null,
      latestFrame: counter.latestFrame,
    };
  }

  let totalMilliseconds = 0;
  let minimumMilliseconds = Number.POSITIVE_INFINITY;
  let maximumMilliseconds = 0;

  for (const interval of counter.intervals) {
    totalMilliseconds += interval;
    minimumMilliseconds = Math.min(minimumMilliseconds, interval);
    maximumMilliseconds = Math.max(maximumMilliseconds, interval);
  }

  const averageMilliseconds = totalMilliseconds / counter.intervals.length;

  return {
    total: counter.total,
    intervalSamples: counter.intervals.length,
    latestIntervalMilliseconds: counter.latestIntervalMilliseconds,
    averageIntervalMilliseconds: averageMilliseconds,
    minimumIntervalMilliseconds: minimumMilliseconds,
    maximumIntervalMilliseconds: maximumMilliseconds,
    estimatedHz: averageMilliseconds > 0 ? 1000 / averageMilliseconds : null,
    latestFrame: counter.latestFrame,
  };
}

function nowMilliseconds(): number {
  const clock = globalThis.performance;

  return clock === undefined ? Date.now() : clock.now();
}

function mergeWorkerStartOptions(
  defaults: Record<string, unknown>,
  ...overrides: readonly (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = { assetDecoders: defaults };

  for (const override of overrides) {
    if (override === undefined) {
      continue;
    }

    const nextAssetDecoders = mergeRecordFields(
      merged.assetDecoders,
      override.assetDecoders,
    );
    Object.assign(merged, override);
    if (nextAssetDecoders !== null) {
      merged.assetDecoders = nextAssetDecoders;
    }
  }

  return merged;
}

function mergeRecordFields(first: unknown, second: unknown): unknown | null {
  if (!isRecord(first) && !isRecord(second)) {
    return null;
  }

  return {
    ...(isRecord(first) ? first : {}),
    ...(isRecord(second) ? second : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
