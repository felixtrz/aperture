import { createSimulationWorker, } from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import { createApertureDevtoolsRequest } from "../commands.js";
import { createWebGpuApp, createWebGpuBloomPostEffect, createWebGpuSsaoPostEffect, } from "@aperture-engine/webgpu";
import { defineApertureConfig } from "../config.js";
import { mirrorSimulationWorkerSourceAssets } from "./assets.js";
import { readMirroredSourceAssetVersions } from "../asset-mirror.js";
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import { createGeneratedBrowserFrameControl, } from "./control.js";
import { ApertureBrowserControlError, createGeneratedBrowserRequestClient, } from "./request.js";
import { installGeneratedCommandForwarding } from "./commands.js";
import { syncGeneratedDiagnostics } from "./diagnostics.js";
import { installGeneratedDevtoolsRuntime } from "./devtools/index.js";
import { resolveUseFrameGraph } from "./frame-graph-route.js";
import { resolveGpuTimings } from "./gpu-timings-route.js";
import { installGeneratedInputForwarding } from "./input.js";
import { readGeneratedRenderProfileEnvironment, resolveGeneratedEffectiveRenderDefaults, resolveGeneratedRenderSettings, resolveGeneratedTonemapAndExposure, } from "./render.js";
import { installGeneratedRenderDiagnosticsAccessor, installGeneratedStatus, } from "./status.js";
/**
 * Await the returned app Promise before reading `ready` or calling `request`.
 * Then await `app.ready` for GPU and worker initialization.
 * JavaScript embeddings can enable `// @ts-check` to catch a missing await.
 */
export async function startGeneratedBrowserApp(options) {
    const config = defineApertureConfig(options.config);
    const canvas = resolveCanvas(config);
    const renderProfile = resolveGeneratedEffectiveRenderDefaults(config.render, readGeneratedRenderProfileEnvironment(canvas));
    const render = renderProfile.render;
    const sourceAssets = new AssetRegistry();
    const status = installGeneratedStatus();
    status.render = resolveGeneratedRenderSettings(render, undefined, renderProfile.profile);
    status.systems = options.systemManifest ?? [];
    const demandDriven = render?.cadence === "demand";
    const manual = render?.cadence === "manual";
    let webgpuResult = null;
    const worker = createSimulationWorker(options.workerEntry, {
        workerOptions: { type: "module" },
        ...(options.workerFactory === undefined
            ? {}
            : { workerFactory: options.workerFactory }),
    });
    const scheduleDemandStep = demandDriven
        ? createGeneratedDemandStepScheduler(worker)
        : null;
    const lifetime = new AbortController();
    const teardown = [];
    if (scheduleDemandStep !== null)
        teardown.push(scheduleDemandStep.dispose);
    let frames = null;
    const requests = createGeneratedBrowserRequestClient({
        worker,
        getWebGpuResult: () => webgpuResult,
        onRequestPosted(tool, requestId) {
            if (tool === "ecs_step")
                frames?.requested(requestId);
        },
        onFailure(error) {
            frames?.failed(error);
        },
    });
    const requestRaw = async (tool, payload, requestOptions) => {
        if (manual &&
            (tool === "ecs_step" ||
                tool === "ecs_step_and_diff" ||
                tool === "ecs_resume")) {
            throw new ApertureBrowserControlError("Manual frame control owns the worker clock; use renderFrame instead of step/resume tools.");
        }
        return requests.requestRaw(tool, payload, requestOptions);
    };
    installGeneratedInputForwarding(canvas, worker, status, config, {
        signal: lifetime.signal,
        pollGamepads: !manual,
    });
    teardown.push(installGeneratedCommandForwarding(worker, status, {
        ...(scheduleDemandStep === null
            ? {}
            : { afterForward: scheduleDemandStep }),
    }));
    if (options.devtools?.enabled === true) {
        teardown.push(installGeneratedDevtoolsRuntime({
            worker,
            getWebGpuResult: () => webgpuResult,
            requests: { ...requests, requestRaw },
        }));
    }
    teardown.push(installCanvasResizeSync(canvas, worker, status, render, {
        renderProfile: renderProfile.profile,
        ...(scheduleDemandStep === null
            ? {}
            : { afterResize: scheduleDemandStep }),
    }));
    const renderWorker = manual
        ? {
            ...worker,
            onSnapshot(callback) {
                return worker.onSnapshot((event) => {
                    if (frames?.acceptSnapshot(event.frame, event.message) === true)
                        callback(event);
                });
            },
        }
        : worker;
    const mirroredWorker = mirrorSimulationWorkerSourceAssets(renderWorker, sourceAssets, status, { sidebandAssets: !manual });
    let audio = null;
    let stopped = false;
    const stopBrowser = () => {
        if (stopped)
            return [];
        stopped = true;
        const errors = [];
        for (const stop of [
            () => requests.dispose(),
            () => lifetime.abort(),
            ...teardown.reverse(),
            () => audio?.dispose(),
            () => mirroredWorker.terminate(),
        ]) {
            try {
                stop();
            }
            catch (error) {
                errors.push(error);
            }
        }
        return errors;
    };
    // M3-T4 / AI-25: the single-encoder FrameGraph route is the DEFAULT at
    // parity. render.frameGraph: false (or the ?graph=0 per-load override)
    // forces the legacy multi-submit route; the flag is passed explicitly so
    // `false` really forces legacy instead of deferring to the renderer default.
    const browserSearch = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const useFrameGraph = resolveUseFrameGraph(render, browserSearch);
    const gpuTimings = resolveGpuTimings(browserSearch);
    const postEffects = resolveGeneratedPostEffects(render);
    // Generated apps tonemap with ACES through the HDR path by default; post
    // effects (bloom/SSAO) always imply the HDR path. An explicit tonemap
    // "none" without them keeps the legacy byte-identical 8-bit path.
    const { tonemap, exposure } = resolveGeneratedTonemapAndExposure(render, postEffects.length > 0);
    const audioOptions = resolveGeneratedAudioOptions(config, options.audio);
    const workerStartOptions = createGeneratedWorkerStartOptions({
        workerStartOptions: options.workerStartOptions,
        audioOptions,
        demandDriven: demandDriven || manual,
        manualFrameControl: manual,
        renderProfile: renderProfile.profile,
    });
    let applyAudioSnapshot = null;
    let webgpu;
    try {
        webgpu = await createWebGpuApp({
            canvas: canvas,
            simulationWorker: mirroredWorker,
            sourceAssets,
            geometryInspection: render?.geometryInspection ?? false,
            autoStart: false,
            msaaSampleCount: status.render.requestedSampleCount,
            useFrameGraph,
            presentationCadence: manual
                ? "immediate"
                : demandDriven
                    ? "snapshot"
                    : "continuous",
            onPresentationSnapshot(snapshot) {
                applyAudioSnapshot?.(snapshot);
            },
            onPresentationComplete(report) {
                frames?.presented(report);
            },
            onPresentationError(diagnostic) {
                frames?.failed(new ApertureBrowserControlError(diagnostic.message, [diagnostic]));
            },
            ...(gpuTimings === undefined ? {} : { gpuTimings }),
            ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
            tonemap,
            ...(exposure === undefined ? {} : { exposure }),
            ...(postEffects.length === 0 ? {} : { postEffects }),
        });
    }
    catch (error) {
        stopBrowser();
        throw error;
    }
    webgpuResult = webgpu;
    const ready = webgpu.ok
        ? requests.ready
        : Promise.reject(new ApertureBrowserControlError("Aperture WebGPU initialization failed.", [webgpu]));
    void ready.catch(() => { });
    if (!webgpu.ok)
        stopBrowser();
    frames = createGeneratedBrowserFrameControl({
        requests: { ...requests, ready },
        manual,
        getSourceAssetVersions: () => readMirroredSourceAssetVersions(sourceAssets),
    });
    status.webgpuOk = webgpu.ok;
    status.status = webgpu.ok ? "running" : "webgpu-failed";
    status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
    if (webgpu.ok) {
        installGeneratedRenderDiagnosticsAccessor(status, {
            getDiagnostics: webgpu.app.getDiagnostics,
        });
        teardown.push(syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status));
    }
    // Audio is a sibling derived view: it subscribes to the same worker snapshots.
    // The renderer's asset-mirroring subscription is registered first (createWebGpuApp
    // autoStart, above), so by the time this raw-worker subscription fires each
    // frame, `sourceAssets` already holds the mirrored audio-clip bytes. The audio
    // module is imported dynamically only when enabled, so a non-audio app never
    // loads @aperture-engine/audio.
    if (webgpu.ok && audioOptions !== undefined && audioOptions !== false) {
        try {
            const { installGeneratedAudio } = await import("./audio.js");
            audio = installGeneratedAudio(worker, sourceAssets, audioOptions === true
                ? { snapshotSource: "manual" }
                : { ...audioOptions, snapshotSource: "manual" });
            applyAudioSnapshot = audio?.applySnapshot ?? null;
        }
        catch (error) {
            stopBrowser();
            if (webgpu.ok)
                await webgpu.app.dispose();
            throw error;
        }
    }
    if (webgpu.ok) {
        webgpu.app.start();
        scheduleDemandStep?.();
    }
    const controls = frames;
    let disposal = null;
    return {
        worker,
        webgpu,
        audio,
        ready,
        async request(tool, ...args) {
            const [payload, requestOptions] = args;
            await ready;
            const response = await requestRaw(tool, payload, requestOptions);
            if (!response.ok)
                throw new ApertureBrowserControlError(`Aperture request '${tool}' failed.`, response.diagnostics);
            return response.result;
        },
        async requestRaw(tool, payload, requestOptions) {
            await ready;
            return requestRaw(tool, payload, requestOptions);
        },
        renderFrame: controls.renderFrame,
        inspectRenderedFrame: controls.inspectRenderedFrame,
        inspectRenderedGeometry(options) {
            if (!webgpu.ok)
                throw new ApertureBrowserControlError("Aperture WebGPU initialization failed.", [webgpu]);
            return webgpu.app.inspectRenderedGeometry(options);
        },
        dispose() {
            if (disposal !== null)
                return disposal;
            controls.dispose();
            const errors = stopBrowser();
            disposal = (async () => {
                if (webgpu.ok) {
                    try {
                        await webgpu.app.dispose();
                    }
                    catch (error) {
                        errors.push(error);
                    }
                }
                if (errors.length > 0)
                    throw new AggregateError(errors, "Aperture browser app disposal failed.");
            })();
            return disposal;
        },
        addRenderPass(descriptor) {
            if (webgpu.ok) {
                webgpu.app.addRenderPass(descriptor);
            }
        },
        addComputePass(descriptor) {
            if (webgpu.ok) {
                webgpu.app.addComputePass(descriptor);
            }
        },
        removePass(name) {
            return webgpu.ok ? webgpu.app.removePass(name) : false;
        },
    };
}
function createGeneratedWorkerStartOptions(options) {
    const base = options.audioOptions === undefined || options.audioOptions === false
        ? options.workerStartOptions
        : {
            audioSnapshotMessageRateHz: 0,
            ...(options.workerStartOptions ?? {}),
        };
    const withRenderProfile = options.renderProfile === null || options.renderProfile === undefined
        ? base
        : {
            ...(base ?? {}),
            apertureRenderProfile: options.renderProfile,
        };
    if (options.demandDriven !== true) {
        return withRenderProfile;
    }
    return {
        ...(withRenderProfile ?? {}),
        simulationPaused: true,
        ...(options.manualFrameControl === true
            ? { apertureManualFrameControl: true }
            : {}),
    };
}
function createGeneratedDemandStepScheduler(worker) {
    let disposed = false;
    let scheduled = false;
    let nextRequestId = 0;
    let cancelScheduled = null;
    const schedule = () => {
        if (disposed || scheduled) {
            return;
        }
        scheduled = true;
        const step = () => {
            cancelScheduled = null;
            scheduled = false;
            if (disposed)
                return;
            nextRequestId += 1;
            worker.postMessage(createApertureDevtoolsRequest({
                requestId: `generated-demand-${Date.now()}-${nextRequestId}`,
                tool: "ecs_step",
                payload: { delta: 1 / 60 },
            }));
        };
        if (typeof requestAnimationFrame === "function") {
            const handle = requestAnimationFrame(step);
            cancelScheduled = () => {
                if (typeof cancelAnimationFrame === "function")
                    cancelAnimationFrame(handle);
            };
            return;
        }
        const handle = setTimeout(step, 0);
        cancelScheduled = () => clearTimeout(handle);
    };
    return Object.assign(schedule, {
        dispose() {
            disposed = true;
            cancelScheduled?.();
            cancelScheduled = null;
            scheduled = false;
        },
    });
}
function resolveGeneratedAudioOptions(config, override) {
    if (override !== undefined) {
        return override;
    }
    const audio = config.audio;
    if (audio === undefined || audio === false) {
        return undefined;
    }
    if (audio === true) {
        return true;
    }
    if (audio.enabled === false) {
        return false;
    }
    return {
        ...(audio.autoUnlock === undefined ? {} : { autoUnlock: audio.autoUnlock }),
    };
}
export function resolveGeneratedPostEffects(render) {
    const effects = [];
    const ssao = render?.ssao;
    // SSAO runs before bloom: AO attenuates indirect light in the lit scene,
    // then bloom blooms the occluded result.
    if (ssao !== undefined && ssao !== false) {
        const options = ssao === true ? {} : ssao;
        effects.push(createWebGpuSsaoPostEffect({
            ...(options.radiusPixels === undefined
                ? {}
                : { radiusPixels: options.radiusPixels }),
            ...(options.intensity === undefined
                ? {}
                : { intensity: options.intensity }),
            ...(options.power === undefined ? {} : { power: options.power }),
            ...(options.sampleCount === undefined
                ? {}
                : { sampleCount: options.sampleCount }),
        }));
    }
    const bloom = render?.bloom;
    if (bloom !== undefined && bloom !== false) {
        const options = bloom === true ? {} : bloom;
        effects.push(createWebGpuBloomPostEffect({
            ...(options.threshold === undefined
                ? {}
                : { threshold: options.threshold }),
            ...(options.intensity === undefined
                ? {}
                : { intensity: options.intensity }),
            ...(options.radius === undefined ? {} : { radius: options.radius }),
            ...(options.radiusPixels === undefined
                ? {}
                : { radiusPixels: options.radiusPixels }),
            ...(options.levels === undefined ? {} : { levels: options.levels }),
        }));
    }
    return effects;
}
//# sourceMappingURL=app.js.map