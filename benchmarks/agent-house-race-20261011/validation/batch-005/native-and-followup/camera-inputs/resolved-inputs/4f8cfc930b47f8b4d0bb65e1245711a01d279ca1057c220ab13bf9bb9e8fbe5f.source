import { AssetRegistry } from "@aperture-engine/simulation";
import { createRenderedGeometryInspector } from "./rendered-geometry-inspector.js";
import { analyzeLightingHealth, lightingHealthInputFingerprint, createRenderSnapshotChangeSet, createKtx2TextureCompressionSupportFromFeatures, RenderWorld, } from "@aperture-engine/render";
import { registerWebGpuAppEnvironmentResourceCache } from "./app-environment-resources.js";
import { createWebGpuAppEnvironmentFramePreparer } from "./app-environment-frame.js";
import { createWebGpuAppSnapshotTransport, createWebGpuAppSnapshotTransportStartPayload, hasWebGpuAppSharedSnapshotPayload, readWebGpuAppSnapshotChangeSet, readWebGpuAppSharedSnapshot, } from "./app-snapshot-transport.js";
import { resolveWebGpuMsaaConfig } from "../gpu/msaa.js";
import { resolveTonemapOperator } from "../output/output-stage-tonemap.js";
import { createWebGpuTonemapPostEffect } from "../post/post-tonemap.js";
import { resolveOutputColorSpace } from "../output/output-stage-color-space.js";
import { initializeWebGpu } from "../gpu/initialize-webgpu.js";
import { webGpuAppPickReportToJsonValue, webGpuAppRenderReportToJsonValue, } from "./report.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import { evictWebGpuAppPreparedResourceCaches } from "./prepared-resource-cache-eviction.js";
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { createWebGpuAppResourceCache, clearWebGpuAppResourceCache, } from "./resource-cache.js";
import { createWebGpuAppOwnedResources, registerWebGpuAppOwnedDevice, releaseWebGpuAppOwnedDevice, } from "./owned-resources.js";
import { createEmptyRenderSnapshot } from "./snapshot.js";
import { createWebGpuAppUserPassRegistry } from "./user-pass.js";
import { getOrCreateWebGpuAppPipeline } from "./pipeline-resources.js";
import { QUEUED_BUILT_IN_MATERIAL_ADAPTERS } from "./queued-built-in-adapters.js";
import { pickWebGpuAppEntity } from "./picking-frame.js";
import { renderWebGpuAppFrame } from "./frame-loop.js";
export async function createWebGpuApp(options) {
    // Validate before allocating a device; disabled capture retains no mesh bytes.
    const geometryInspection = createRenderedGeometryInspector(options.geometryInspection === true
        ? {}
        : (options.geometryInspection ?? false));
    const initialization = await initializeWebGpu(options);
    if (!initialization.ok) {
        return initialization;
    }
    const sourceAssets = options.sourceAssets ?? new AssetRegistry();
    const ownedResources = createWebGpuAppOwnedResources(initialization.device, geometryInspection.enabled ? geometryInspection.deviceObserver : undefined);
    let disposed = false;
    let disposal = null;
    const inFlightOperations = new Set();
    const assertActive = () => {
        if (disposed)
            throw new Error("Aperture WebGPU app was disposed.");
    };
    const trackOperation = (operation) => {
        if (disposed)
            return Promise.reject(new Error("Aperture WebGPU app was disposed."));
        // Register accepted work before invoking any user realizer/post callback:
        // such callbacks may synchronously initiate disposal of this same app.
        const work = Promise.resolve().then(operation);
        inFlightOperations.add(work);
        const finished = () => inFlightOperations.delete(work);
        void work.then(finished, finished);
        return work;
    };
    const renderWorld = new RenderWorld();
    const tonemap = resolveTonemapOperator(options.tonemap);
    const outputColorSpace = resolveOutputColorSpace(options.outputColorSpace);
    const msaa = resolveWebGpuMsaaConfig(options.msaa ?? options.msaaSampleCount);
    // Persistent HDR scene buffer (M5-T4): opting into `exposure` renders the lit
    // scene into rgba16float and moves tonemap+exposure+sRGB to a final post
    // stage. Default (no exposure) keeps the byte-identical 8-bit in-material path.
    const hdrSceneBuffer = options.exposure !== undefined && Number.isFinite(options.exposure);
    const exposure = hdrSceneBuffer ? options.exposure : 1;
    const sceneRenderFormat = hdrSceneBuffer
        ? "rgba16float"
        : initialization.format;
    const postEffects = [...(options.postEffects ?? [])];
    if (hdrSceneBuffer) {
        // The tonemap stage is the LAST post effect: it samples the rgba16float
        // scene/post output and writes the 8-bit swapchain with exposure applied.
        postEffects.push(createWebGpuTonemapPostEffect({
            operator: tonemap,
            exposure,
            outputColorSpace,
        }));
    }
    const resourceCache = createWebGpuAppResourceCache(true, geometryInspection);
    const userPassRegistry = createWebGpuAppUserPassRegistry();
    let snapshotTransport = createWebGpuAppSnapshotTransport({
        ...(options.transport === undefined ? {} : { mode: options.transport }),
        ...(options.sharedSnapshotTransport === undefined
            ? {}
            : { sharedSnapshotTransport: options.sharedSnapshotTransport }),
    });
    const assetDecoderStartOptions = {
        ktx2TextureCompression: createKtx2TextureCompressionSupportFromFeatures(initialization.device.features ?? initialization.adapter.features),
    };
    let running = false;
    let unsubscribeSnapshot = null;
    let unsubscribeError = null;
    let pendingSnapshotEvent = null;
    let latestSharedSnapshotEvent = null;
    let latestRenderedSharedSnapshotFrame = null;
    let autoRenderScheduled = false;
    let autoRenderInFlight = false;
    let inFlightPresentation = null;
    let presentationMissedWhileInFlight = false;
    let latestReport = null;
    let latestFullReportJson = null;
    let latestFullReportJsonSource = null;
    let latestStatusReportJson = null;
    let latestStatusReportJsonSource = null;
    let previousSnapshotForUpdate = null;
    let latestPreviousSnapshotForUpdate = null;
    let latestPickReportJson = null;
    let latestWorkerError = null;
    let latestLightingHealthFingerprint = null;
    let latestLightingHealth = null;
    let preparedResourceLifetimeFrame = 0;
    const cadence = createWebGpuAppCadenceDiagnostics();
    const defaultGpuTimings = options.gpuTimings === true || options.timestampQuery === true;
    const continuousPresentation = (options.presentationCadence ?? "continuous") === "continuous";
    const immediatePresentation = options.presentationCadence === "immediate";
    const hasNativePresentationFrame = typeof requestAnimationFrame === "function";
    const requestPresentationFrame = hasNativePresentationFrame
        ? requestAnimationFrame
        : (callback) => setTimeout(() => callback(Date.now()), 0);
    const cancelPresentationFrame = hasNativePresentationFrame && typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : (handle) => {
            clearTimeout(handle);
        };
    let autoRenderRequest = null;
    const renderPendingSnapshot = () => {
        const pending = nextRenderableSnapshotEvent();
        if (!running || pending === null || autoRenderInFlight) {
            return;
        }
        if (pendingSnapshotEvent === pending) {
            pendingSnapshotEvent = null;
        }
        autoRenderInFlight = true;
        const rendering = renderSnapshotEvent(pending);
        inFlightPresentation = rendering;
        const clearInFlight = () => {
            if (inFlightPresentation === rendering)
                inFlightPresentation = null;
        };
        void rendering.then(clearInFlight, clearInFlight);
    };
    const renderSnapshotEvent = async (pending) => {
        try {
            const event = pending.event;
            const hasSharedSnapshotPayload = hasWebGpuAppSharedSnapshotPayload(event.message);
            const sharedSnapshot = readWebGpuAppSharedSnapshot(snapshotTransport, event.message, {
                requireMessageFrame: !hasNativePresentationFrame || !continuousPresentation,
                requireMessageSequence: immediatePresentation,
            });
            if (hasSharedSnapshotPayload && sharedSnapshot === null) {
                cadence.recordSharedSnapshotUnavailable();
                if (immediatePresentation) {
                    latestWorkerError = {
                        code: "webGpuApp.workerSnapshotUnavailable",
                        reason: "webgpu-app.controlled-snapshot-unavailable",
                        message: "The exact worker snapshot is unavailable: it was superseded or its registry data is missing.",
                    };
                    options.onPresentationError?.(latestWorkerError);
                    return;
                }
                if (hasNativePresentationFrame && pendingSnapshotEvent === null) {
                    pendingSnapshotEvent = pending;
                }
                return;
            }
            const snapshot = sharedSnapshot ?? event.snapshot;
            if (hasSharedSnapshotPayload &&
                snapshot.frame === latestRenderedSharedSnapshotFrame) {
                return;
            }
            const snapshotChangeSet = readWebGpuAppSnapshotChangeSet(event.message);
            const snapshotQueueAgeMilliseconds = Math.max(0, nowMilliseconds() - pending.receivedAtMilliseconds);
            cadence.recordRenderStarted(snapshot.frame, {
                snapshotQueueAgeMilliseconds,
            });
            options.onPresentationSnapshot?.(snapshot);
            const report = await app.renderSnapshot(snapshot, {
                frame: snapshot.frame,
                ...(snapshotChangeSet === null ? {} : { snapshotChangeSet }),
            });
            if (hasSharedSnapshotPayload) {
                latestRenderedSharedSnapshotFrame = snapshot.frame;
            }
            cadence.recordRenderCompleted(snapshot.frame);
            options.onPresentationComplete?.(report);
        }
        catch (error) {
            cadence.recordRenderFailed();
            latestWorkerError = {
                code: "webGpuApp.workerSnapshotRenderFailed",
                reason: "webgpu-app.render-snapshot-failed",
                message: error instanceof Error
                    ? error.message
                    : "Rendering a worker-produced snapshot failed.",
            };
            options.onPresentationError?.(latestWorkerError);
        }
        finally {
            autoRenderInFlight = false;
            if (immediatePresentation) {
                if (nextRenderableSnapshotEvent() !== null)
                    scheduleAutoRender();
            }
            if (!immediatePresentation &&
                nextRenderableSnapshotEvent() !== null &&
                !hasNativePresentationFrame) {
                if (presentationMissedWhileInFlight) {
                    presentationMissedWhileInFlight = false;
                    cadence.recordRenderCompletionDrain();
                    renderPendingSnapshot();
                }
                else {
                    scheduleAutoRender();
                }
            }
            if (!immediatePresentation &&
                nextRenderableSnapshotEvent() !== null &&
                hasNativePresentationFrame &&
                !continuousPresentation) {
                cadence.recordRenderCompletionDrain();
                scheduleAutoRender();
            }
        }
    };
    const scheduleAutoRender = () => {
        if (!running || autoRenderScheduled) {
            return;
        }
        autoRenderScheduled = true;
        if (immediatePresentation) {
            queueMicrotask(() => {
                autoRenderScheduled = false;
                if (running && !autoRenderInFlight)
                    renderPendingSnapshot();
            });
            return;
        }
        autoRenderRequest = requestPresentationFrame(() => {
            autoRenderScheduled = false;
            autoRenderRequest = null;
            cadence.recordPresentationCallback(null);
            if (!running) {
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
    const app = {
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
        userPassRegistry: {
            ...userPassRegistry,
            get size() {
                return userPassRegistry.size;
            },
            addRenderPass(descriptor) {
                assertActive();
                userPassRegistry.addRenderPass(descriptor);
            },
            addComputePass(descriptor) {
                assertActive();
                userPassRegistry.addComputePass(descriptor);
            },
            removePass(name) {
                assertActive();
                return userPassRegistry.removePass(name);
            },
        },
        addRenderPass(descriptor) {
            assertActive();
            userPassRegistry.addRenderPass(descriptor);
        },
        addComputePass(descriptor) {
            assertActive();
            userPassRegistry.addComputePass(descriptor);
        },
        removePass(name) {
            assertActive();
            return userPassRegistry.removePass(name);
        },
        registerFeatureRealizer(realizer) {
            assertActive();
            return resourceCache.featureRealizers.register(realizer);
        },
        setPostEffectEnabled(id, enabled) {
            assertActive();
            const effectIndex = postEffects.findIndex((effect) => effect.id === id);
            if (effectIndex < 0)
                return false;
            const effect = postEffects[effectIndex];
            if (effect === undefined)
                return false;
            postEffects[effectIndex] = { ...effect, enabled };
            return true;
        },
        start(startOptions = {}) {
            assertActive();
            if (running) {
                return;
            }
            running = true;
            if (hasNativePresentationFrame && continuousPresentation) {
                scheduleAutoRender();
            }
            unsubscribeSnapshot = options.simulationWorker.onSnapshot((event) => {
                const receivedAtMilliseconds = nowMilliseconds();
                const pending = { event, receivedAtMilliseconds };
                const hasSharedSnapshotPayload = hasWebGpuAppSharedSnapshotPayload(event.message);
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
            unsubscribeError = options.simulationWorker.onError((event) => {
                latestWorkerError = {
                    code: "webGpuApp.workerSnapshotRenderFailed",
                    reason: event.reason,
                    message: event.message,
                };
            });
            const transportStartPayload = createWebGpuAppSnapshotTransportStartPayload(snapshotTransport);
            options.simulationWorker.start(mergeWorkerStartOptions(assetDecoderStartOptions, createPresentationSnapshotStartOptions({
                hasNativePresentationFrame,
                sharedSnapshotActive: snapshotTransport.mode === "shared-array-buffer",
            }), options.workerStartOptions, startOptions, transportStartPayload === null
                ? undefined
                : { transport: transportStartPayload }));
        },
        dispose() {
            if (disposal !== null)
                return disposal;
            disposed = true;
            const errors = [];
            try {
                app.stop();
            }
            catch (error) {
                errors.push(error);
            }
            disposal = (async () => {
                await Promise.allSettled([
                    ...inFlightOperations,
                    ...(inFlightPresentation === null ? [] : [inFlightPresentation]),
                ]);
                for (const cleanup of [
                    () => resourceCache.featureRealizers.dispose(),
                    () => ownedResources.dispose(),
                    () => releaseWebGpuAppOwnedDevice(app),
                    () => clearWebGpuAppResourceCache(resourceCache),
                    () => geometryInspection.dispose(),
                    () => environmentFramePreparer.dispose(),
                    () => renderWorld.applySnapshot(createEmptyRenderSnapshot(0)),
                    () => {
                        for (const pass of userPassRegistry.list())
                            userPassRegistry.removePass(pass.name);
                    },
                ]) {
                    try {
                        await cleanup();
                    }
                    catch (error) {
                        errors.push(error);
                    }
                }
                postEffects.length = 0;
                latestReport = null;
                latestFullReportJson = null;
                latestFullReportJsonSource = null;
                latestStatusReportJson = null;
                latestStatusReportJsonSource = null;
                previousSnapshotForUpdate = null;
                latestPreviousSnapshotForUpdate = null;
                latestPickReportJson = null;
                latestLightingHealth = null;
                snapshotTransport = {
                    mode: "transferable",
                    diagnostics: snapshotTransport.diagnostics,
                };
                if (errors.length)
                    throw new AggregateError(errors, "Aperture WebGPU app disposal failed.");
            })();
            return disposal;
        },
        stop() {
            if (!running) {
                return;
            }
            running = false;
            pendingSnapshotEvent = null;
            latestSharedSnapshotEvent = null;
            latestRenderedSharedSnapshotFrame = null;
            const errors = [];
            const pendingRequest = autoRenderRequest;
            autoRenderRequest = null;
            autoRenderScheduled = false;
            presentationMissedWhileInFlight = false;
            const stopSnapshot = unsubscribeSnapshot, stopError = unsubscribeError;
            unsubscribeSnapshot = null;
            unsubscribeError = null;
            for (const cleanup of [
                () => {
                    if (pendingRequest !== null)
                        cancelPresentationFrame(pendingRequest);
                },
                () => stopSnapshot?.(),
                () => stopError?.(),
            ]) {
                try {
                    cleanup();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length)
                throw new AggregateError(errors, "Stopping Aperture WebGPU presentation failed.");
        },
        inspectRenderedGeometry(options) {
            assertActive();
            return geometryInspection.inspect(options);
        },
        getDiagnostics(options = {}) {
            return {
                lastFrame: readLatestRenderReportJson(options.detail ?? "status"),
                lastPick: latestPickReportJson,
                lastError: latestWorkerError,
                transport: snapshotTransport.diagnostics,
                cadence: cadence.report({
                    pendingSnapshot: pendingSnapshotEvent !== null,
                    pendingSnapshotReceivedAtMilliseconds: pendingSnapshotEvent?.receivedAtMilliseconds ?? null,
                    scheduled: autoRenderScheduled,
                    inFlight: autoRenderInFlight,
                }),
            };
        },
        async pick(x, y) {
            const report = await pickWebGpuAppEntity({ app, sourceAssets }, resourceCache, latestReport, x, y, {
                adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
                getPipeline: ({ item, reuse }) => getOrCreateWebGpuAppPipeline({
                    app,
                    cache: resourceCache,
                    reuse,
                    kind: item.adapter.kind,
                    pipelineKey: item.draw.batchKey.pipelineKey,
                    batchKey: item.draw.batchKey,
                }),
                getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) => getWebGpuAppPipelineLayouts({
                    cache: resourceCache,
                    kind: item.adapter.kind,
                    pipeline,
                    getBindGroupLayout,
                }),
                resourceLifetimeFrame: nextPreparedResourceLifetimeFrame(),
            });
            latestPickReportJson = webGpuAppPickReportToJsonValue(report);
            return report.entity;
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
            const standardMaterialIblResources = renderOptions.standardMaterialIblResources ??
                environmentFramePreparer.resolve(snapshot);
            const geometryFrame = geometryInspection.beginFrame(snapshot.frame);
            let renderedReport;
            try {
                renderedReport = await renderWebGpuAppFrame({ app, sourceAssets }, resourceCache, {
                    ...renderOptions,
                    ...(standardMaterialIblResources === undefined
                        ? {}
                        : { standardMaterialIblResources }),
                    gpuTimings: renderOptions.gpuTimings ?? defaultGpuTimings,
                    snapshot,
                    previousSnapshotForUpdate,
                    resourceLifetimeFrame,
                    geometryFrame: geometryFrame ?? undefined,
                });
            }
            finally {
                geometryFrame?.close();
            }
            // Analyze the IBL the frame actually rendered with, including the
            // auto-wired fallback — not just what the caller passed in.
            const iblResources = standardMaterialIblResources;
            const lightingHealthFingerprint = (lightingHealthInputFingerprint(renderedReport.snapshot, sourceAssets) ^
                (iblResources === undefined ? 0 : 1) ^
                (iblResources?.diffuseTextureResource?.ready === true ? 2 : 0) ^
                (iblResources?.specularTextureResource?.ready === true ? 4 : 0) ^
                (iblResources?.bindGroupResource.ready === true ? 8 : 0)) >>>
                0;
            if (latestLightingHealth === null ||
                latestLightingHealthFingerprint !== lightingHealthFingerprint) {
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
            const report = {
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
    registerWebGpuAppOwnedDevice(app, ownedResources.device);
    const render = app.renderSnapshot;
    app.renderSnapshot = (snapshot, renderOptions) => trackOperation(() => render(snapshot, renderOptions));
    const pick = app.pick;
    app.pick = (x, y) => trackOperation(() => pick(x, y));
    // Declared after the app literal (it captures `app` for the per-app
    // resource cache); renderSnapshot only reads it at call time.
    const environmentFramePreparer = createWebGpuAppEnvironmentFramePreparer({
        app,
        registry: sourceAssets,
    });
    registerWebGpuAppEnvironmentResourceCache(app, resourceCache.environmentResources);
    if (options.autoStart === true) {
        app.start(options.workerStartOptions);
    }
    return { ok: true, app, initialization };
    function nextPreparedResourceLifetimeFrame() {
        preparedResourceLifetimeFrame += 1;
        return preparedResourceLifetimeFrame;
    }
    function nextRenderableSnapshotEvent() {
        return (pendingSnapshotEvent ??
            // Snapshot cadence waits for the matching message, which also delivers
            // source assets. Sampling newer SAB frames here can render stale assets
            // before their sideband message arrives, then suppress the corrected frame.
            (hasNativePresentationFrame && continuousPresentation
                ? latestSharedSnapshotEvent
                : null));
    }
    function readLatestRenderReportJson(detail) {
        if (latestReport === null) {
            latestFullReportJson = null;
            latestFullReportJsonSource = null;
            latestStatusReportJson = null;
            latestStatusReportJsonSource = null;
            return null;
        }
        if (detail === "full") {
            if (latestFullReportJsonSource !== latestReport ||
                latestFullReportJson === null) {
                latestFullReportJson = webGpuAppRenderReportToJsonValue(reportWithFullChangeSetKeys(latestReport));
                latestFullReportJsonSource = latestReport;
            }
            return latestFullReportJson;
        }
        if (latestStatusReportJsonSource !== latestReport ||
            latestStatusReportJson === null) {
            latestStatusReportJson = webGpuAppRenderReportToJsonValue(latestReport, {
                detail: "status",
            });
            latestStatusReportJsonSource = latestReport;
        }
        return latestStatusReportJson;
    }
    function reportWithFullChangeSetKeys(report) {
        if (report.snapshotChangeSet === undefined ||
            report.snapshotChangeSet.keys !== undefined) {
            return report;
        }
        return {
            ...report,
            snapshotChangeSet: createRenderSnapshotChangeSet(latestPreviousSnapshotForUpdate, report.snapshot),
        };
    }
}
function lightingHealthIblReadiness(resources) {
    if (resources === undefined) {
        return {
            diffuseReady: false,
            specularReady: false,
            preparationStatus: "source-missing",
        };
    }
    const bindGroupReady = resources.bindGroupResource.ready;
    const diffuseReady = resources.diffuseTextureResource?.ready === true && bindGroupReady;
    const specularReady = resources.specularTextureResource?.ready === true && bindGroupReady;
    return {
        diffuseReady,
        specularReady,
        preparationStatus: diffuseReady && specularReady
            ? "diffuse-specular-ready"
            : diffuseReady
                ? "diffuse-ready"
                : "preparation-failed",
    };
}
function createWebGpuAppCadenceDiagnostics(sampleWindow = 120) {
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
    let lastRenderedStartedFrame = null;
    return {
        recordSnapshotReceived(frame) {
            recordCadenceCounter(snapshotsReceived, normalizedSampleWindow, frame);
        },
        recordPresentationCallback(frame) {
            recordCadenceCounter(presentationCallbacks, normalizedSampleWindow, frame);
        },
        recordRenderStarted(frame, details = {}) {
            if (details.snapshotQueueAgeMilliseconds !== undefined) {
                recordCadenceValue(snapshotQueueAgeMilliseconds, details.snapshotQueueAgeMilliseconds);
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
                    snapshotQueueAgeMilliseconds: cadenceValueReport(snapshotQueueAgeMilliseconds),
                    pendingSnapshotAgeMilliseconds: state.pendingSnapshotReceivedAtMilliseconds === null
                        ? null
                        : Math.max(0, nowMilliseconds() -
                            state.pendingSnapshotReceivedAtMilliseconds),
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
function createCadenceCounter() {
    return {
        total: 0,
        latestFrame: null,
        lastTimestampMilliseconds: null,
        latestIntervalMilliseconds: null,
        intervals: [],
    };
}
function createCadenceValueCounter() {
    return {
        total: 0,
        latest: null,
        sum: 0,
        minimum: Number.POSITIVE_INFINITY,
        maximum: 0,
    };
}
function recordCadenceValue(counter, value) {
    if (value === null || !Number.isFinite(value)) {
        return;
    }
    counter.total += 1;
    counter.latest = value;
    counter.sum += value;
    counter.minimum = Math.min(counter.minimum, value);
    counter.maximum = Math.max(counter.maximum, value);
}
function cadenceValueReport(counter) {
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
function recordCadenceCounter(counter, sampleWindow, frame) {
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
function cadenceCounterReport(counter) {
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
function nowMilliseconds() {
    const clock = globalThis.performance;
    return clock === undefined ? Date.now() : clock.now();
}
function createPresentationSnapshotStartOptions(options) {
    return options.hasNativePresentationFrame && options.sharedSnapshotActive
        ? {
            sharedSnapshotMessageRateHz: 0,
            sourceAssetsMessageRateHz: 15,
        }
        : undefined;
}
function mergeWorkerStartOptions(defaults, ...overrides) {
    const merged = { assetDecoders: defaults };
    for (const override of overrides) {
        if (override === undefined) {
            continue;
        }
        const nextAssetDecoders = mergeRecordFields(merged.assetDecoders, override.assetDecoders);
        Object.assign(merged, override);
        if (nextAssetDecoders !== null) {
            merged.assetDecoders = nextAssetDecoders;
        }
    }
    return merged;
}
function mergeRecordFields(first, second) {
    if (!isRecord(first) && !isRecord(second)) {
        return null;
    }
    return {
        ...(isRecord(first) ? first : {}),
        ...(isRecord(second) ? second : {}),
    };
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=create-webgpu-app.js.map