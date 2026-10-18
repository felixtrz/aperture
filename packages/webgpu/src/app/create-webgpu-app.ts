import { GpuResources } from "@aperture-engine/gpu/internal/resources.js";
import { createPlanarReflectionRenderer } from "./planar-reflection.js";
import { resolvePlanarReflectionOptions } from "./planar-reflection-view.js";
import { registerUserPassResources } from "./user-pass-resources.js";
import { webGpuDeviceLost } from "../gpu/initialize-webgpu.js";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  analyzeLightingHealth,
  lightingHealthInputFingerprint,
  createRenderSnapshotChangeSet,
  createKtx2TextureCompressionSupportFromFeatures,
  RenderWorld,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { registerWebGpuAppEnvironmentResourceCache } from "./app-environment-resources.js";
import { createWebGpuAppEnvironmentFramePreparer } from "./app-environment-frame.js";
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
import {
  initializeWebGpu,
  type WebGpuRendererInitializationSuccess,
} from "../gpu/initialize-webgpu.js";
import {
  createWebGpuCanvasOutput,
  createWebGpuFrameOutput,
} from "../gpu/output-target.js";
import { createWebGpuResourceScope } from "../gpu/resource-scope.js";
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
import type { StandardFrameIblResources } from "../materials/standard/standard-frame-resources.js";
import type {
  CreateWebGpuAppOptions,
  CreateWebGpuAppResult,
  WebGpuApp,
  WebGpuAppCadenceCounterReport,
  WebGpuAppCadenceReport,
  WebGpuAppCadenceValueReport,
  WebGpuAppDiagnosticsOptions,
  WebGpuAppPickReportJsonValue,
  WebGpuAppRenderReport,
  WebGpuAppRenderReportJsonValue,
  WebGpuAppSimulationWorkerSnapshotEvent,
  WebGpuAppWorkerRenderErrorDiagnostic,
} from "./app.js";

interface PendingSnapshotEventRecord {
  readonly event: WebGpuAppSimulationWorkerSnapshotEvent;
  readonly receivedAtMilliseconds: number;
}

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  // Validate portable options before adopting/allocating GPU resources.
  const reflectionOptions =
    options.planarReflection === undefined || options.planarReflection === false
      ? undefined
      : resolvePlanarReflectionOptions(options.planarReflection);
  if (options.deviceContext !== undefined && options.output === undefined) {
    return {
      ok: false,
      reason: "context-unavailable",
      message: "An adopted device requires an explicit output target.",
    };
  }
  const providedDevice = options.deviceContext?.device;
  const unscoped =
    providedDevice === undefined
      ? await initializeWebGpu(options)
      : {
          ok: true as const,
          gpu: null,
          adapter: options.deviceContext?.adapter ?? null,
          device: providedDevice,
          context: null,
          format: options.output!.format,
          displayColorSpace: options.output!.colorSpace,
          deviceLost: webGpuDeviceLost(providedDevice),
        };

  if (!unscoped.ok) {
    return unscoped;
  }
  const resourceScope = createWebGpuResourceScope(unscoped.device);
  const initialization: WebGpuRendererInitializationSuccess = {
    ...unscoped,
    device: resourceScope.device,
  };
  const frameOutput = createWebGpuFrameOutput(
    options.output ??
      createWebGpuCanvasOutput({
        ...(options.canvas === undefined ? {} : { canvas: options.canvas }),
        context: unscoped.context!,
        format: unscoped.format,
        ...(options.alphaMode === undefined
          ? {}
          : { alphaMode: options.alphaMode }),
      }),
  );
  let disposed = false;
  let disposePromise: Promise<void> | null = null;
  let renderInFlight: Promise<WebGpuAppRenderReport> | null = null;
  let captureActive = false;
  let cancelCapture: (() => void) | null = null;

  const sourceAssets = options.sourceAssets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const tonemap = resolveTonemapOperator(options.tonemap);
  const outputColorSpace = resolveOutputColorSpace(options.outputColorSpace);
  const msaa = resolveWebGpuMsaaConfig(options.msaa ?? options.msaaSampleCount);
  // Persistent HDR scene buffer (M5-T4): opting into `exposure` renders the lit
  // scene into rgba16float and moves tonemap+exposure+sRGB to a final post
  // stage. Default (no exposure) keeps the byte-identical 8-bit in-material path.
  const hdrSceneBuffer =
    reflectionOptions !== undefined ||
    (options.exposure !== undefined && Number.isFinite(options.exposure));
  const exposure =
    options.exposure !== undefined && Number.isFinite(options.exposure)
      ? options.exposure
      : 1;
  const sceneRenderFormat = hdrSceneBuffer
    ? "rgba16float"
    : initialization.format;
  const planarReflection =
    reflectionOptions === undefined
      ? undefined
      : createPlanarReflectionRenderer({
          options: reflectionOptions,
          device: unscoped.device as GPUDevice,
          sourceAssets,
          createApp: createWebGpuApp,
        });
  const postEffects = [
    ...(planarReflection === undefined ? [] : [planarReflection.effect]),
    ...(options.postEffects ?? []),
  ];

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
  const userPassResources = new GpuResources(
    initialization.device as unknown as GPUDevice,
    frameOutput.output.width,
    frameOutput.output.height,
  );
  registerUserPassResources(userPassRegistry, userPassResources);
  const snapshotTransport = createWebGpuAppSnapshotTransport({
    ...(options.transport === undefined ? {} : { mode: options.transport }),
    ...(options.sharedSnapshotTransport === undefined
      ? {}
      : { sharedSnapshotTransport: options.sharedSnapshotTransport }),
  });
  const assetDecoderStartOptions = {
    ktx2TextureCompression: createKtx2TextureCompressionSupportFromFeatures(
      initialization.device.features ?? initialization.adapter?.features,
    ),
  };
  let running = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let pendingSnapshotEvent: PendingSnapshotEventRecord | null = null;
  let latestSharedSnapshotEvent: PendingSnapshotEventRecord | null = null;
  let latestRenderedSharedSnapshotFrame: number | null = null;
  let autoRenderScheduled = false;
  let autoRenderInFlight = false;
  let historyResetInFlight: Promise<void> | null = null;
  let presentationMissedWhileInFlight = false;
  let latestReport: WebGpuAppRenderReport | null = null;
  let latestFullReportJson: WebGpuAppRenderReportJsonValue | null = null;
  let latestFullReportJsonSource: WebGpuAppRenderReport | null = null;
  let latestStatusReportJson: WebGpuAppRenderReportJsonValue | null = null;
  let latestStatusReportJsonSource: WebGpuAppRenderReport | null = null;
  let previousSnapshotForUpdate: RenderSnapshot | null = null;
  let latestPreviousSnapshotForUpdate: RenderSnapshot | null = null;
  let latestPickReportJson: WebGpuAppPickReportJsonValue | null = null;
  let latestWorkerError: WebGpuAppWorkerRenderErrorDiagnostic | null = null;
  let latestLightingHealthFingerprint: number | null = null;
  let latestLightingHealth: ReturnType<typeof analyzeLightingHealth> | null =
    null;
  let preparedResourceLifetimeFrame = 0;
  const cadence = createWebGpuAppCadenceDiagnostics();
  const defaultGpuTimings =
    options.gpuTimings === true || options.timestampQuery === true;
  const continuousPresentation =
    (options.presentationCadence ?? "continuous") === "continuous";

  const hasNativePresentationFrame =
    typeof requestAnimationFrame === "function";
  const requestPresentationFrame = hasNativePresentationFrame
    ? requestAnimationFrame
    : (callback: FrameRequestCallback): number =>
        setTimeout(() => callback(Date.now()), 0) as unknown as number;
  const cancelPresentationFrame =
    hasNativePresentationFrame && typeof cancelAnimationFrame === "function"
      ? cancelAnimationFrame
      : (handle: number): void => {
          clearTimeout(handle);
        };
  let autoRenderRequest: number | null = null;

  const renderPendingSnapshot = (): void => {
    const pending = nextRenderableSnapshotEvent();

    if (
      !running ||
      captureActive ||
      pending === null ||
      autoRenderInFlight ||
      historyResetInFlight !== null
    ) {
      return;
    }

    if (pendingSnapshotEvent === pending) {
      pendingSnapshotEvent = null;
    }
    autoRenderInFlight = true;
    void renderSnapshotEvent(pending);
  };

  const renderSnapshotEvent = async (
    pending: PendingSnapshotEventRecord,
  ): Promise<void> => {
    try {
      const event = pending.event;
      const hasSharedSnapshotPayload = hasWebGpuAppSharedSnapshotPayload(
        event.message,
      );
      const sharedSnapshot = readWebGpuAppSharedSnapshot(
        snapshotTransport,
        event.message,
        {
          requireMessageFrame:
            !hasNativePresentationFrame || !continuousPresentation,
        },
      );
      if (hasSharedSnapshotPayload && sharedSnapshot === null) {
        cadence.recordSharedSnapshotUnavailable();
        if (hasNativePresentationFrame && pendingSnapshotEvent === null) {
          pendingSnapshotEvent = pending;
        }
        return;
      }

      const snapshot = sharedSnapshot ?? event.snapshot;
      if (
        hasSharedSnapshotPayload &&
        snapshot.frame === latestRenderedSharedSnapshotFrame
      ) {
        return;
      }

      const snapshotChangeSet = readWebGpuAppSnapshotChangeSet(event.message);
      const snapshotQueueAgeMilliseconds = Math.max(
        0,
        nowMilliseconds() - pending.receivedAtMilliseconds,
      );

      cadence.recordRenderStarted(snapshot.frame, {
        snapshotQueueAgeMilliseconds,
      });
      options.onPresentationSnapshot?.(snapshot);
      await app.renderSnapshot(snapshot, {
        frame: snapshot.frame,
        ...(snapshotChangeSet === null ? {} : { snapshotChangeSet }),
      });
      if (hasSharedSnapshotPayload) {
        latestRenderedSharedSnapshotFrame = snapshot.frame;
      }
      cadence.recordRenderCompleted(snapshot.frame);
    } catch (error: unknown) {
      cadence.recordRenderFailed();
      latestWorkerError = {
        code: "webGpuApp.workerSnapshotRenderFailed",
        reason: "webgpu-app.render-snapshot-failed",
        message:
          error instanceof Error
            ? error.message
            : "Rendering a worker-produced snapshot failed.",
      };
    } finally {
      autoRenderInFlight = false;
      if (
        nextRenderableSnapshotEvent() !== null &&
        !hasNativePresentationFrame
      ) {
        if (presentationMissedWhileInFlight) {
          presentationMissedWhileInFlight = false;
          cadence.recordRenderCompletionDrain();
          renderPendingSnapshot();
        } else {
          scheduleAutoRender();
        }
      }
      if (
        nextRenderableSnapshotEvent() !== null &&
        hasNativePresentationFrame &&
        !continuousPresentation
      ) {
        cadence.recordRenderCompletionDrain();
        scheduleAutoRender();
      }
    }
  };

  const scheduleAutoRender = (): void => {
    if (!running || captureActive || autoRenderScheduled) {
      return;
    }

    autoRenderScheduled = true;
    autoRenderRequest = requestPresentationFrame(() => {
      autoRenderScheduled = false;
      autoRenderRequest = null;
      cadence.recordPresentationCallback(null);

      if (!running || captureActive) {
        return;
      }

      if (autoRenderInFlight) {
        presentationMissedWhileInFlight = true;
        cadence.recordPresentationCallbackWhileInFlight();
        if (hasNativePresentationFrame) {
          scheduleAutoRender();
        }
        return;
      }

      if (nextRenderableSnapshotEvent() === null) {
        cadence.recordPresentationCallbackWithoutSnapshot();
        if (hasNativePresentationFrame && continuousPresentation) {
          scheduleAutoRender();
        }
        return;
      }

      presentationMissedWhileInFlight = false;
      renderPendingSnapshot();
      if (hasNativePresentationFrame && continuousPresentation) {
        scheduleAutoRender();
      }
    });
  };

  const app: WebGpuApp = {
    ...(options.canvas === undefined ? {} : { canvas: options.canvas }),
    output: frameOutput.output,
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
    resetGpuHistory() {
      if (
        disposed ||
        captureActive ||
        renderInFlight !== null ||
        historyResetInFlight !== null
      )
        return Promise.reject(
          new Error("Reset GPU history while the app is idle."),
        );
      historyResetInFlight = (initialization.device as GPUDevice).queue
        .onSubmittedWorkDone()
        .then(() => userPassResources.resetHistory())
        .finally(() => {
          historyResetInFlight = null;
        });
      return historyResetInFlight;
    },
    addGpuResource(source) {
      if (
        disposed ||
        captureActive ||
        renderInFlight !== null ||
        historyResetInFlight !== null
      )
        throw new Error("Add GPU resources while the app is idle.");
      userPassResources.create(source);
    },
    importGpuBuffer(options) {
      if (
        disposed ||
        captureActive ||
        renderInFlight !== null ||
        historyResetInFlight !== null
      )
        throw new Error("Import GPU resources while the app is idle.");
      if (
        options.device !== unscoped.device &&
        options.device !== initialization.device
      )
        throw new Error("Imported resources must belong to this app's device.");
      userPassResources.importBuffer({
        ...options,
        device: userPassResources.device,
      });
    },
    importGpuTexture(options) {
      if (
        disposed ||
        captureActive ||
        renderInFlight !== null ||
        historyResetInFlight !== null
      )
        throw new Error("Import GPU resources while the app is idle.");
      if (
        options.device !== unscoped.device &&
        options.device !== initialization.device
      )
        throw new Error("Imported resources must belong to this app's device.");
      userPassResources.importTexture({
        ...options,
        device: userPassResources.device,
      });
    },
    addRenderPass(descriptor) {
      userPassRegistry.addRenderPass(descriptor);
    },
    addComputePass(descriptor) {
      userPassRegistry.addComputePass(descriptor);
    },
    removePass(name) {
      return userPassRegistry.removePass(name);
    },
    registerFeatureRealizer(realizer) {
      return resourceCache.featureRealizers.register(
        realizer as Parameters<
          typeof resourceCache.featureRealizers.register
        >[0],
      );
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
      if (disposed) throw new Error("WebGPU app is disposed.");
      const simulationWorker = options.simulationWorker;
      if (simulationWorker === undefined)
        throw new Error(
          "Automatic rendering requires a simulation worker; use renderSnapshot for manual rendering.",
        );
      if (running) {
        return;
      }

      running = true;
      if (hasNativePresentationFrame && continuousPresentation) {
        scheduleAutoRender();
      }
      unsubscribeSnapshot = simulationWorker.onSnapshot((event) => {
        const receivedAtMilliseconds = nowMilliseconds();
        const pending = { event, receivedAtMilliseconds };
        const hasSharedSnapshotPayload = hasWebGpuAppSharedSnapshotPayload(
          event.message,
        );
        cadence.recordSnapshotReceived(event.frame);
        if (pendingSnapshotEvent !== null) {
          cadence.recordPendingSnapshotReplaced();
        }
        if (hasSharedSnapshotPayload) {
          latestSharedSnapshotEvent = pending;
        }
        pendingSnapshotEvent = pending;
        scheduleAutoRender();
      });
      unsubscribeError = simulationWorker.onError((event) => {
        latestWorkerError = {
          code: "webGpuApp.workerSnapshotRenderFailed",
          reason: event.reason,
          message: event.message,
        };
      });
      const transportStartPayload =
        createWebGpuAppSnapshotTransportStartPayload(snapshotTransport);

      simulationWorker.start(
        mergeWorkerStartOptions(
          assetDecoderStartOptions,
          createPresentationSnapshotStartOptions({
            hasNativePresentationFrame,
            sharedSnapshotActive:
              snapshotTransport.mode === "shared-array-buffer",
          }),
          options.workerStartOptions,
          startOptions,
          transportStartPayload === null
            ? undefined
            : { transport: transportStartPayload },
        ),
      );
    },
    dispose() {
      if (disposePromise !== null) return disposePromise;
      disposed = true;
      cancelCapture?.();
      app.stop();
      disposePromise = (async () => {
        try {
          await renderInFlight?.catch(() => undefined);
          await historyResetInFlight?.catch(() => undefined);
          await planarReflection?.dispose();
          await resourceCache.featureRealizers.dispose();
        } finally {
          try {
            userPassResources.dispose();
            resourceScope.dispose();
          } finally {
            frameOutput.release();
            if (providedDevice === undefined)
              (unscoped.device as { destroy?: () => void }).destroy?.();
          }
        }
      })();
      return disposePromise;
    },
    stop() {
      if (!running) {
        return;
      }

      running = false;
      pendingSnapshotEvent = null;
      latestSharedSnapshotEvent = null;
      latestRenderedSharedSnapshotFrame = null;
      if (autoRenderRequest !== null) {
        cancelPresentationFrame(autoRenderRequest);
        autoRenderRequest = null;
      }
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
          pendingSnapshotReceivedAtMilliseconds:
            pendingSnapshotEvent?.receivedAtMilliseconds ?? null,
          scheduled: autoRenderScheduled,
          inFlight: autoRenderInFlight,
        }),
      };
    },
    async pick(x, y) {
      if (captureActive)
        throw new Error("Release the captured frame before picking.");
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
              material: item.material,
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
          resourceLifetimeFrame: nextPreparedResourceLifetimeFrame(),
        },
      );

      latestPickReportJson = webGpuAppPickReportToJsonValue(report);
      return report.entity;
    },
    async captureSnapshot(snapshot, renderOptions = {}) {
      if (disposed) throw new Error("WebGPU app is disposed.");
      if (captureActive) throw new Error("A captured frame is already held.");
      captureActive = true;
      if (autoRenderRequest !== null)
        cancelPresentationFrame(autoRenderRequest);
      autoRenderRequest = null;
      autoRenderScheduled = false;
      const started = nowMilliseconds();
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        captureActive = false;
        cancelCapture = null;
        if (!disposed && running) scheduleAutoRender();
      };
      const aborted = new Promise<never>((_resolve, reject) => {
        cancelCapture = () => {
          reject(new Error("WebGPU app disposed during capture."));
          release();
        };
      });
      try {
        const [selected] = await Promise.race([
          Promise.all([snapshot, renderInFlight, historyResetInFlight]),
          aborted,
        ]);
        const selectedAt = nowMilliseconds();
        const report = await submitSnapshot(selected, renderOptions, true);
        if (!report.ok)
          throw new Error(
            `Capture frame ${selected.frame} failed: ${JSON.stringify(report.diagnostics)}`,
          );
        const submittedAt = nowMilliseconds();
        const queue = (
          initialization.device as {
            queue?: { onSubmittedWorkDone?: () => Promise<void> };
          }
        ).queue;
        if (queue?.onSubmittedWorkDone === undefined)
          throw new Error("Frame capture requires GPU completion support.");
        await Promise.race([queue.onSubmittedWorkDone(), aborted]);
        const finished = nowMilliseconds();
        return {
          frame: report.snapshot.frame,
          report,
          release,
          timings: {
            selectionAndIdleMs: selectedAt - started,
            renderCpuMs: submittedAt - selectedAt,
            gpuCompletionMs: finished - submittedAt,
            totalMs: finished - started,
          },
        };
      } catch (error) {
        release();
        throw error;
      }
    },
    async renderSnapshot(snapshot, renderOptions = {}) {
      const previousSnapshotForReport = previousSnapshotForUpdate;
      const resourceLifetimeFrame = nextPreparedResourceLifetimeFrame();
      // Auto-wire IBL: when the caller does not hand in prepared environment
      // resources (harnesses/examples that call
      // prepareWebGpuAppEnvironmentAssets themselves still win), resolve the
      // snapshot's active environment against ready environment-map assets in
      // the source registry. Memoized per asset version — steady-state frames
      // do not re-run the preparation compute chain.
      const standardMaterialIblResources =
        renderOptions.standardMaterialIblResources ??
        environmentFramePreparer.resolve(snapshot);
      await planarReflection?.render(
        snapshot,
        frameOutput.output.width,
        frameOutput.output.height,
        {
          ...(standardMaterialIblResources === undefined
            ? {}
            : { standardMaterialIblResources }),
        },
      );
      const renderedReport = await renderWebGpuAppFrame(
        { app, sourceAssets },
        resourceCache,
        {
          ...renderOptions,
          ...(standardMaterialIblResources === undefined
            ? {}
            : { standardMaterialIblResources }),
          gpuTimings: renderOptions.gpuTimings ?? defaultGpuTimings,
          snapshot,
          previousSnapshotForUpdate,
          resourceLifetimeFrame,
        },
      );

      // Analyze the IBL the frame actually rendered with, including the
      // auto-wired fallback — not just what the caller passed in.
      const iblResources = standardMaterialIblResources;
      const lightingHealthFingerprint =
        (lightingHealthInputFingerprint(renderedReport.snapshot, sourceAssets) ^
          (iblResources === undefined ? 0 : 1) ^
          (iblResources?.diffuseTextureResource?.ready === true ? 2 : 0) ^
          (iblResources?.specularTextureResource?.ready === true ? 4 : 0) ^
          (iblResources?.bindGroupResource.ready === true ? 8 : 0)) >>>
        0;
      if (
        latestLightingHealth === null ||
        latestLightingHealthFingerprint !== lightingHealthFingerprint
      ) {
        latestLightingHealth = analyzeLightingHealth({
          snapshot: renderedReport.snapshot,
          assets: sourceAssets,
          output: {
            tonemap: app.tonemap,
            exposure: app.exposure,
            hdr: app.sceneRenderFormat === "rgba16float",
            colorSpace: app.outputColorSpace,
          },
          ...(renderedReport.snapshot.environments.length === 0
            ? {}
            : {
                ibl: lightingHealthIblReadiness(iblResources),
              }),
        });
        latestLightingHealthFingerprint = lightingHealthFingerprint;
      }
      const lightingHealth = latestLightingHealth;
      const report: WebGpuAppRenderReport = {
        ...renderedReport,
        diagnostics: [
          ...renderedReport.diagnostics,
          ...lightingHealth.warnings,
        ],
        lightingHealth,
      };

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
          frame: resourceLifetimeFrame,
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
      // A failed report must not erase the worker-error signal: an ok:false
      // frame is exactly when callers need the last failure to stay visible.
      if (report.ok) {
        latestWorkerError = null;
      }
      return report;
    },
  };

  const renderSnapshot = app.renderSnapshot.bind(app);
  app.renderSnapshot = (snapshot, renderOptions) =>
    submitSnapshot(snapshot, renderOptions);
  function submitSnapshot(
    snapshot: RenderSnapshot,
    renderOptions?: Parameters<WebGpuApp["renderSnapshot"]>[1],
    forCapture = false,
  ): Promise<WebGpuAppRenderReport> {
    if (disposed) return Promise.reject(new Error("WebGPU app is disposed."));
    if (captureActive && !forCapture)
      return Promise.reject(
        new Error("Release the captured frame before rendering another."),
      );
    if (renderInFlight !== null || historyResetInFlight !== null)
      return Promise.reject(
        new Error(
          "A frame is already rendering; await it before rendering another.",
        ),
      );
    userPassResources.resize(
      frameOutput.output.width,
      frameOutput.output.height,
    );
    renderInFlight = userPassResources
      .synchronize()
      .then(() => renderSnapshot(snapshot, renderOptions))
      .then((report) => {
        if (report.ok) userPassResources.flipHistory();
        return report;
      })
      .finally(() => {
        frameOutput.release();
        renderInFlight = null;
      });
    return renderInFlight;
  }

  // Declared after the app literal (it captures `app` for the per-app
  // resource cache); renderSnapshot only reads it at call time.
  const environmentFramePreparer = createWebGpuAppEnvironmentFramePreparer({
    app,
    registry: sourceAssets,
  });
  registerWebGpuAppEnvironmentResourceCache(
    app,
    resourceCache.environmentResources,
  );

  if (options.autoStart === true) {
    app.start(options.workerStartOptions);
  }

  return { ok: true, app, initialization };

  function nextPreparedResourceLifetimeFrame(): number {
    preparedResourceLifetimeFrame += 1;
    return preparedResourceLifetimeFrame;
  }

  function nextRenderableSnapshotEvent(): PendingSnapshotEventRecord | null {
    return (
      pendingSnapshotEvent ??
      // Snapshot cadence waits for the matching message, which also delivers
      // source assets. Sampling newer SAB frames here can render stale assets
      // before their sideband message arrives, then suppress the corrected frame.
      (hasNativePresentationFrame && continuousPresentation
        ? latestSharedSnapshotEvent
        : null)
    );
  }

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

function lightingHealthIblReadiness(
  resources: StandardFrameIblResources | undefined,
) {
  if (resources === undefined) {
    return {
      diffuseReady: false,
      specularReady: false,
      preparationStatus: "source-missing" as const,
    };
  }

  const bindGroupReady = resources.bindGroupResource.ready;
  const diffuseReady =
    resources.diffuseTextureResource?.ready === true && bindGroupReady;
  const specularReady =
    resources.specularTextureResource?.ready === true && bindGroupReady;
  return {
    diffuseReady,
    specularReady,
    preparationStatus:
      diffuseReady && specularReady
        ? ("diffuse-specular-ready" as const)
        : diffuseReady
          ? ("diffuse-ready" as const)
          : ("preparation-failed" as const),
  };
}

interface WebGpuAppCadenceDiagnostics {
  recordSnapshotReceived(frame: number | null): void;
  recordPresentationCallback(frame: number | null): void;
  recordRenderStarted(
    frame: number | null,
    details?: { readonly snapshotQueueAgeMilliseconds?: number | null },
  ): void;
  recordRenderCompleted(frame: number | null): void;
  recordRenderFailed(): void;
  recordPendingSnapshotReplaced(): void;
  recordRenderCompletionDrain(): void;
  recordPresentationCallbackWhileInFlight(): void;
  recordPresentationCallbackWithoutSnapshot(): void;
  recordSharedSnapshotUnavailable(): void;
  report(state: {
    readonly pendingSnapshot: boolean;
    readonly pendingSnapshotReceivedAtMilliseconds: number | null;
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

interface WebGpuAppCadenceValueCounter {
  total: number;
  latest: number | null;
  sum: number;
  minimum: number;
  maximum: number;
}

function createWebGpuAppCadenceDiagnostics(
  sampleWindow = 120,
): WebGpuAppCadenceDiagnostics {
  const normalizedSampleWindow = Math.max(1, Math.floor(sampleWindow));
  const snapshotsReceived = createCadenceCounter();
  const presentationCallbacks = createCadenceCounter();
  const rendersStarted = createCadenceCounter();
  const rendersCompleted = createCadenceCounter();
  const snapshotQueueAgeMilliseconds = createCadenceValueCounter();
  const renderedFrameGap = createCadenceValueCounter();
  let pendingSnapshotsReplaced = 0;
  let renderCompletionDrains = 0;
  let presentationCallbacksWhileInFlight = 0;
  let presentationCallbacksWithoutSnapshot = 0;
  let sharedSnapshotUnavailable = 0;
  let renderFailures = 0;
  let skippedSnapshotFrames = 0;
  let lastRenderedStartedFrame: number | null = null;

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
    recordRenderStarted(frame, details = {}) {
      if (details.snapshotQueueAgeMilliseconds !== undefined) {
        recordCadenceValue(
          snapshotQueueAgeMilliseconds,
          details.snapshotQueueAgeMilliseconds,
        );
      }

      if (frame !== null && lastRenderedStartedFrame !== null) {
        const gap = frame - lastRenderedStartedFrame;

        recordCadenceValue(renderedFrameGap, gap);
        if (gap > 1) {
          skippedSnapshotFrames += gap - 1;
        }
      }

      lastRenderedStartedFrame = frame;
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
    recordSharedSnapshotUnavailable() {
      sharedSnapshotUnavailable += 1;
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
        sharedSnapshotUnavailable,
        renderFailures,
        pacing: {
          snapshotQueueAgeMilliseconds: cadenceValueReport(
            snapshotQueueAgeMilliseconds,
          ),
          pendingSnapshotAgeMilliseconds:
            state.pendingSnapshotReceivedAtMilliseconds === null
              ? null
              : Math.max(
                  0,
                  nowMilliseconds() -
                    state.pendingSnapshotReceivedAtMilliseconds,
                ),
          renderedFrameGap: cadenceValueReport(renderedFrameGap),
          skippedSnapshotFrames,
        },
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

function createCadenceValueCounter(): WebGpuAppCadenceValueCounter {
  return {
    total: 0,
    latest: null,
    sum: 0,
    minimum: Number.POSITIVE_INFINITY,
    maximum: 0,
  };
}

function recordCadenceValue(
  counter: WebGpuAppCadenceValueCounter,
  value: number | null,
): void {
  if (value === null || !Number.isFinite(value)) {
    return;
  }

  counter.total += 1;
  counter.latest = value;
  counter.sum += value;
  counter.minimum = Math.min(counter.minimum, value);
  counter.maximum = Math.max(counter.maximum, value);
}

function cadenceValueReport(
  counter: WebGpuAppCadenceValueCounter,
): WebGpuAppCadenceValueReport {
  if (counter.total === 0) {
    return {
      count: 0,
      latest: null,
      average: null,
      minimum: null,
      maximum: null,
    };
  }

  return {
    count: counter.total,
    latest: counter.latest,
    average: counter.sum / counter.total,
    minimum: counter.minimum,
    maximum: counter.maximum,
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

function createPresentationSnapshotStartOptions(options: {
  readonly hasNativePresentationFrame: boolean;
  readonly sharedSnapshotActive: boolean;
}): Record<string, unknown> | undefined {
  return options.hasNativePresentationFrame && options.sharedSnapshotActive
    ? {
        sharedSnapshotMessageRateHz: 0,
        sourceAssetsMessageRateHz: 15,
      }
    : undefined;
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
