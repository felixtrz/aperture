import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type {
  RenderedGeometryInspection,
  RenderedGeometryInspectionOptions,
} from "@aperture-engine/webgpu";
import { createApertureDevtoolsRequest } from "../commands.js";
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  createWebGpuSsaoPostEffect,
  type CreateWebGpuAppResult,
  type WebGpuAppComputePassDescriptor,
  type WebGpuAppRenderPassDescriptor,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { defineApertureConfig, type ApertureConfig } from "../config.js";
// Type-only: the audio module is imported DYNAMICALLY below, only when audio is
// enabled, so a non-audio app (and every example whose import map omits
// @aperture-engine/audio) never loads it.
import type { GeneratedAudio, GeneratedAudioOptions } from "./audio.js";
import { mirrorSimulationWorkerSourceAssets } from "./assets.js";
import { readMirroredSourceAssetVersions } from "../asset-mirror.js";
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import {
  createGeneratedBrowserFrameControl,
  type GeneratedBrowserFrameOptions,
  type GeneratedBrowserRenderedFrame,
  type GeneratedBrowserFrameInspection,
  type GeneratedBrowserToolContracts,
} from "./control.js";
import {
  ApertureBrowserControlError,
  createGeneratedBrowserRequestClient,
  type GeneratedBrowserRequestOptions,
} from "./request.js";
import type { ApertureDevtoolsResponse } from "../commands.js";
import { installGeneratedCommandForwarding } from "./commands.js";
import { syncGeneratedDiagnostics } from "./diagnostics.js";
import { installGeneratedDevtoolsRuntime } from "./devtools/index.js";
import { resolveUseFrameGraph } from "./frame-graph-route.js";
import { resolveGpuTimings } from "./gpu-timings-route.js";
import { installGeneratedInputForwarding } from "./input.js";
import {
  readGeneratedRenderProfileEnvironment,
  resolveGeneratedEffectiveRenderDefaults,
  resolveGeneratedRenderSettings,
  resolveGeneratedTonemapAndExposure,
} from "./render.js";
import {
  installGeneratedRenderDiagnosticsAccessor,
  installGeneratedStatus,
  type GeneratedBrowserSystemManifestEntry,
} from "./status.js";

export interface StartGeneratedBrowserAppOptions {
  readonly config: ApertureConfig;
  readonly workerEntry: SimulationWorkerEntry;
  readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
  readonly devtools?: {
    readonly enabled?: boolean;
  };
  readonly workerFactory?: (
    entry: string | URL,
    options?: WorkerOptions,
  ) => Worker;
  /**
   * Extra fields forwarded verbatim to the simulation worker's start options
   * (SimulationWorkerStartOptions). The page URL only exists on the main thread,
   * so the generated browser bootstrap reads e.g. `?map=` from location.search
   * and threads the value here; app systems read filtered app-level fields
   * through `this.startOptions`. Merged into the worker `start` message.
   */
  readonly workerStartOptions?: Record<string, unknown>;
  /**
   * Opt into main-thread audio. `true` wires the engine with defaults; an
   * options object configures buses/ducking/clip resolution. Omitted ⇒ no audio
   * engine is created (zero cost). Audio is a sibling derived view of the same
   * worker snapshot the renderer consumes.
   */
  readonly audio?: boolean | GeneratedAudioOptions;
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
  /** The wired audio engine + teardown, or null when audio was not enabled. */
  readonly audio: GeneratedAudio | null;
  /** GPU and worker initialization; assets may still load asynchronously. */
  readonly ready: Promise<void>;
  request<Key extends keyof GeneratedBrowserToolContracts>(
    tool: Key,
    ...args: undefined extends GeneratedBrowserToolContracts[Key]["payload"]
      ? [
          payload?: GeneratedBrowserToolContracts[Key]["payload"],
          options?: GeneratedBrowserRequestOptions,
        ]
      : [
          payload: GeneratedBrowserToolContracts[Key]["payload"],
          options?: GeneratedBrowserRequestOptions,
        ]
  ): Promise<GeneratedBrowserToolContracts[Key]["result"]>;
  requestRaw(
    tool: string,
    payload?: unknown,
    options?: GeneratedBrowserRequestOptions,
  ): Promise<ApertureDevtoolsResponse>;
  /** One worker step/extraction and matching native submission; manual cadence only. No GPU fence. */
  renderFrame(
    options?: GeneratedBrowserFrameOptions,
  ): Promise<GeneratedBrowserRenderedFrame>;
  inspectRenderedFrame(): GeneratedBrowserFrameInspection | null;
  /** Detached static mesh arrays and all submitted instance WORLD matrices. */
  inspectRenderedGeometry(
    options?: RenderedGeometryInspectionOptions,
  ): RenderedGeometryInspection;
  dispose(): Promise<void>;
  // M3-T7: surface the user-pass insertion API through the generated app so a
  // developer can register custom render/compute passes without reaching into
  // `.webgpu.app`. No-ops (with a console warning) if WebGPU failed to start.
  addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
  addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
  removePass(name: string): boolean;
}

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const renderProfile = resolveGeneratedEffectiveRenderDefaults(
    config.render,
    readGeneratedRenderProfileEnvironment(canvas),
  );
  const render = renderProfile.render;
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  status.render = resolveGeneratedRenderSettings(
    render,
    undefined,
    renderProfile.profile,
  );
  status.systems = options.systemManifest ?? [];
  const demandDriven = render?.cadence === "demand";
  const manual = render?.cadence === "manual";
  let webgpuResult: CreateWebGpuAppResult | null = null;
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
  const teardown: (() => void)[] = [];
  if (scheduleDemandStep !== null) teardown.push(scheduleDemandStep.dispose);
  let frames: ReturnType<typeof createGeneratedBrowserFrameControl> | null =
    null;
  const requests = createGeneratedBrowserRequestClient({
    worker,
    getWebGpuResult: () => webgpuResult,
    onRequestPosted(tool, requestId) {
      if (tool === "ecs_step") frames?.requested(requestId);
    },
    onFailure(error) {
      frames?.failed(error);
    },
  });
  const requestRaw = async (
    tool: string,
    payload?: unknown,
    requestOptions?: GeneratedBrowserRequestOptions,
  ): Promise<ApertureDevtoolsResponse> => {
    if (
      manual &&
      (tool === "ecs_step" ||
        tool === "ecs_step_and_diff" ||
        tool === "ecs_resume")
    ) {
      throw new ApertureBrowserControlError(
        "Manual frame control owns the worker clock; use renderFrame instead of step/resume tools.",
      );
    }
    return requests.requestRaw(tool, payload, requestOptions);
  };

  installGeneratedInputForwarding(canvas, worker, status, config, {
    signal: lifetime.signal,
    pollGamepads: !manual,
  });
  teardown.push(
    installGeneratedCommandForwarding(worker, status, {
      ...(scheduleDemandStep === null
        ? {}
        : { afterForward: scheduleDemandStep }),
    }),
  );
  if (options.devtools?.enabled === true) {
    teardown.push(
      installGeneratedDevtoolsRuntime({
        worker,
        getWebGpuResult: () => webgpuResult,
        requests: { ...requests, requestRaw },
      }),
    );
  }
  teardown.push(
    installCanvasResizeSync(canvas, worker, status, render, {
      renderProfile: renderProfile.profile,
      ...(scheduleDemandStep === null
        ? {}
        : { afterResize: scheduleDemandStep }),
    }),
  );

  const renderWorker: SimulationWorker = manual
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
  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    renderWorker,
    sourceAssets,
    status,
    { sidebandAssets: !manual },
  );
  let audio: GeneratedAudio | null = null;
  let stopped = false;
  const stopBrowser = (): unknown[] => {
    if (stopped) return [];
    stopped = true;
    const errors: unknown[] = [];
    for (const stop of [
      () => requests.dispose(),
      () => lifetime.abort(),
      ...teardown.reverse(),
      () => audio?.dispose(),
      () => mirroredWorker.terminate(),
    ]) {
      try {
        stop();
      } catch (error: unknown) {
        errors.push(error);
      }
    }
    return errors;
  };
  // M3-T4 / AI-25: the single-encoder FrameGraph route is the DEFAULT at
  // parity. render.frameGraph: false (or the ?graph=0 per-load override)
  // forces the legacy multi-submit route; the flag is passed explicitly so
  // `false` really forces legacy instead of deferring to the renderer default.
  const browserSearch =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const useFrameGraph = resolveUseFrameGraph(render, browserSearch);
  const gpuTimings = resolveGpuTimings(browserSearch);
  const postEffects = resolveGeneratedPostEffects(render);
  // Generated apps tonemap with ACES through the HDR path by default; post
  // effects (bloom/SSAO) always imply the HDR path. An explicit tonemap
  // "none" without them keeps the legacy byte-identical 8-bit path.
  const { tonemap, exposure } = resolveGeneratedTonemapAndExposure(
    render,
    postEffects.length > 0,
  );
  const audioOptions = resolveGeneratedAudioOptions(config, options.audio);
  const workerStartOptions = createGeneratedWorkerStartOptions({
    workerStartOptions: options.workerStartOptions,
    audioOptions,
    demandDriven: demandDriven || manual,
    manualFrameControl: manual,
    renderProfile: renderProfile.profile,
  });
  let applyAudioSnapshot: ((snapshot: RenderSnapshot) => void) | null = null;
  let webgpu: CreateWebGpuAppResult;
  try {
    webgpu = await createWebGpuApp({
      canvas: canvas as unknown as WebGpuCanvasLike,
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
        frames?.failed(
          new ApertureBrowserControlError(diagnostic.message, [diagnostic]),
        );
      },
      ...(gpuTimings === undefined ? {} : { gpuTimings }),
      ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
      tonemap,
      ...(exposure === undefined ? {} : { exposure }),
      ...(postEffects.length === 0 ? {} : { postEffects }),
    });
  } catch (error: unknown) {
    stopBrowser();
    throw error;
  }
  webgpuResult = webgpu;
  const ready = webgpu.ok
    ? requests.ready
    : Promise.reject(
        new ApertureBrowserControlError(
          "Aperture WebGPU initialization failed.",
          [webgpu],
        ),
      );
  void ready.catch(() => {});
  if (!webgpu.ok) stopBrowser();
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
      audio = installGeneratedAudio(
        worker,
        sourceAssets,
        audioOptions === true
          ? { snapshotSource: "manual" }
          : { ...audioOptions, snapshotSource: "manual" },
      );
      applyAudioSnapshot = audio?.applySnapshot ?? null;
    } catch (error: unknown) {
      stopBrowser();
      if (webgpu.ok) await webgpu.app.dispose();
      throw error;
    }
  }

  if (webgpu.ok) {
    webgpu.app.start();
    scheduleDemandStep?.();
  }
  const controls = frames;
  let disposal: Promise<void> | null = null;

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
        throw new ApertureBrowserControlError(
          `Aperture request '${tool}' failed.`,
          response.diagnostics,
        );
      return response.result as GeneratedBrowserToolContracts[typeof tool]["result"];
    },
    async requestRaw(tool, payload, requestOptions) {
      await ready;
      return requestRaw(tool, payload, requestOptions);
    },
    renderFrame: controls.renderFrame,
    inspectRenderedFrame: controls.inspectRenderedFrame,
    inspectRenderedGeometry(options) {
      if (!webgpu.ok)
        throw new ApertureBrowserControlError(
          "Aperture WebGPU initialization failed.",
          [webgpu],
        );
      return webgpu.app.inspectRenderedGeometry(options);
    },
    dispose() {
      if (disposal !== null) return disposal;
      controls.dispose();
      const errors = stopBrowser();
      disposal = (async () => {
        if (webgpu.ok) {
          try {
            await webgpu.app.dispose();
          } catch (error: unknown) {
            errors.push(error);
          }
        }
        if (errors.length > 0)
          throw new AggregateError(
            errors,
            "Aperture browser app disposal failed.",
          );
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

function createGeneratedWorkerStartOptions(options: {
  readonly workerStartOptions: Record<string, unknown> | undefined;
  readonly audioOptions: boolean | GeneratedAudioOptions | false | undefined;
  readonly demandDriven?: boolean;
  readonly manualFrameControl?: boolean;
  readonly renderProfile?: string | null;
}): Record<string, unknown> | undefined {
  const base =
    options.audioOptions === undefined || options.audioOptions === false
      ? options.workerStartOptions
      : {
          audioSnapshotMessageRateHz: 0,
          ...(options.workerStartOptions ?? {}),
        };

  const withRenderProfile =
    options.renderProfile === null || options.renderProfile === undefined
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

function createGeneratedDemandStepScheduler(
  worker: SimulationWorker,
): (() => void) & { dispose(): void } {
  let disposed = false;
  let scheduled = false;
  let nextRequestId = 0;
  let cancelScheduled: (() => void) | null = null;

  const schedule = () => {
    if (disposed || scheduled) {
      return;
    }

    scheduled = true;
    const step = () => {
      cancelScheduled = null;
      scheduled = false;
      if (disposed) return;
      nextRequestId += 1;
      worker.postMessage(
        createApertureDevtoolsRequest({
          requestId: `generated-demand-${Date.now()}-${nextRequestId}`,
          tool: "ecs_step",
          payload: { delta: 1 / 60 },
        }),
      );
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

function resolveGeneratedAudioOptions(
  config: ApertureConfig,
  override: StartGeneratedBrowserAppOptions["audio"],
): boolean | GeneratedAudioOptions | false | undefined {
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

export function resolveGeneratedPostEffects(
  render: ApertureConfig["render"],
): ReturnType<typeof createWebGpuBloomPostEffect>[] {
  const effects: ReturnType<typeof createWebGpuBloomPostEffect>[] = [];
  const ssao = render?.ssao;

  // SSAO runs before bloom: AO attenuates indirect light in the lit scene,
  // then bloom blooms the occluded result.
  if (ssao !== undefined && ssao !== false) {
    const options = ssao === true ? {} : ssao;
    effects.push(
      createWebGpuSsaoPostEffect({
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
      }),
    );
  }

  const bloom = render?.bloom;
  if (bloom !== undefined && bloom !== false) {
    const options = bloom === true ? {} : bloom;
    effects.push(
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
    );
  }

  return effects;
}
