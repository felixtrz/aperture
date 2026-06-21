import { createSimulationWorker, } from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import { createApertureDevtoolsRequest } from "../commands.js";
import { createWebGpuApp, createWebGpuBloomPostEffect, } from "@aperture-engine/webgpu";
import { defineApertureConfig } from "../config.js";
import { mirrorSimulationWorkerSourceAssets } from "./assets.js";
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import { installGeneratedCommandForwarding } from "./commands.js";
import { syncGeneratedDiagnostics } from "./diagnostics.js";
import { installGeneratedDevtoolsRuntime } from "./devtools/index.js";
import { resolveUseFrameGraph } from "./frame-graph-route.js";
import { resolveGpuTimings } from "./gpu-timings-route.js";
import { installGeneratedInputForwarding } from "./input.js";
import { readGeneratedRenderProfileEnvironment, resolveGeneratedEffectiveRenderDefaults, resolveGeneratedRenderSettings, } from "./render.js";
import { installGeneratedRenderDiagnosticsAccessor, installGeneratedStatus, } from "./status.js";
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
    installGeneratedInputForwarding(canvas, worker, status, config);
    installGeneratedCommandForwarding(worker, status, {
        ...(scheduleDemandStep === null
            ? {}
            : { afterForward: scheduleDemandStep }),
    });
    if (options.devtools?.enabled === true) {
        installGeneratedDevtoolsRuntime({
            worker,
            getWebGpuResult: () => webgpuResult,
        });
    }
    installCanvasResizeSync(canvas, worker, status, render, {
        renderProfile: renderProfile.profile,
        ...(scheduleDemandStep === null ? {} : { afterResize: scheduleDemandStep }),
    });
    const mirroredWorker = mirrorSimulationWorkerSourceAssets(worker, sourceAssets, status);
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
    // Bloom needs the HDR scene-buffer path; opting into bloom implies exposure.
    const bloomEnabled = postEffects.length > 0;
    const exposure = render?.exposure ?? (bloomEnabled ? 1 : undefined);
    const audioOptions = resolveGeneratedAudioOptions(config, options.audio);
    const workerStartOptions = createGeneratedWorkerStartOptions({
        workerStartOptions: options.workerStartOptions,
        audioOptions,
        demandDriven,
        renderProfile: renderProfile.profile,
    });
    let applyAudioSnapshot = null;
    const webgpu = await createWebGpuApp({
        canvas: canvas,
        simulationWorker: mirroredWorker,
        sourceAssets,
        autoStart: false,
        msaaSampleCount: status.render.requestedSampleCount,
        useFrameGraph,
        presentationCadence: demandDriven ? "snapshot" : "continuous",
        onPresentationSnapshot(snapshot) {
            applyAudioSnapshot?.(snapshot);
        },
        ...(gpuTimings === undefined ? {} : { gpuTimings }),
        ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
        ...(render?.tonemap === undefined ? {} : { tonemap: render.tonemap }),
        ...(exposure === undefined ? {} : { exposure }),
        ...(postEffects.length === 0 ? {} : { postEffects }),
    });
    webgpuResult = webgpu;
    status.webgpuOk = webgpu.ok;
    status.status = webgpu.ok ? "running" : "webgpu-failed";
    status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
    if (webgpu.ok) {
        installGeneratedRenderDiagnosticsAccessor(status, {
            getDiagnostics: webgpu.app.getDiagnostics,
        });
        syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
    }
    // Audio is a sibling derived view: it subscribes to the same worker snapshots.
    // The renderer's asset-mirroring subscription is registered first (createWebGpuApp
    // autoStart, above), so by the time this raw-worker subscription fires each
    // frame, `sourceAssets` already holds the mirrored audio-clip bytes. The audio
    // module is imported dynamically only when enabled, so a non-audio app never
    // loads @aperture-engine/audio.
    let audio = null;
    if (audioOptions !== undefined && audioOptions !== false) {
        const { installGeneratedAudio } = await import("./audio.js");
        audio = installGeneratedAudio(worker, sourceAssets, audioOptions === true
            ? { snapshotSource: "manual" }
            : { ...audioOptions, snapshotSource: "manual" });
        applyAudioSnapshot = audio?.applySnapshot ?? null;
    }
    if (webgpu.ok) {
        webgpu.app.start();
        scheduleDemandStep?.();
    }
    return {
        worker,
        webgpu,
        audio,
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
    };
}
function createGeneratedDemandStepScheduler(worker) {
    let scheduled = false;
    let nextRequestId = 0;
    return () => {
        if (scheduled) {
            return;
        }
        scheduled = true;
        const step = () => {
            scheduled = false;
            nextRequestId += 1;
            worker.postMessage(createApertureDevtoolsRequest({
                requestId: `generated-demand-${Date.now()}-${nextRequestId}`,
                tool: "ecs_step",
                payload: { delta: 1 / 60 },
            }));
        };
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(step);
            return;
        }
        setTimeout(step, 0);
    };
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
function resolveGeneratedPostEffects(render) {
    const bloom = render?.bloom;
    if (bloom === undefined || bloom === false) {
        return [];
    }
    const options = bloom === true ? {} : bloom;
    return [
        createWebGpuBloomPostEffect({
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
        }),
    ];
}
//# sourceMappingURL=app.js.map