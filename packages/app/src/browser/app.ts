import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
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
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import { installGeneratedCommandForwarding } from "./commands.js";
import { syncGeneratedDiagnostics } from "./diagnostics.js";
import { installGeneratedDevtoolsRuntime } from "./devtools/index.js";
import { resolveUseFrameGraph } from "./frame-graph-route.js";
import { resolveGpuTimings } from "./gpu-timings-route.js";
import { installGeneratedInputForwarding } from "./input.js";
import { resolveGeneratedRenderSettings } from "./render.js";
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
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  status.render = resolveGeneratedRenderSettings(config.render);
  status.systems = options.systemManifest ?? [];
  let webgpuResult: CreateWebGpuAppResult | null = null;
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });

  installGeneratedInputForwarding(canvas, worker, status, config);
  installGeneratedCommandForwarding(worker, status);
  if (options.devtools?.enabled === true) {
    installGeneratedDevtoolsRuntime({
      worker,
      getWebGpuResult: () => webgpuResult,
    });
  }
  installCanvasResizeSync(canvas, worker, status, config.render);

  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    worker,
    sourceAssets,
    status,
  );
  // M3-T4 / AI-25: the single-encoder FrameGraph route is the DEFAULT at
  // parity. render.frameGraph: false (or the ?graph=0 per-load override)
  // forces the legacy multi-submit route; the flag is passed explicitly so
  // `false` really forces legacy instead of deferring to the renderer default.
  const browserSearch =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const useFrameGraph = resolveUseFrameGraph(config.render, browserSearch);
  const gpuTimings = resolveGpuTimings(browserSearch);
  const postEffects = resolveGeneratedPostEffects(config.render);
  // Bloom needs the HDR scene-buffer path; opting into bloom implies exposure.
  const bloomEnabled = postEffects.length > 0;
  const exposure = config.render?.exposure ?? (bloomEnabled ? 1 : undefined);
  const audioOptions = resolveGeneratedAudioOptions(config, options.audio);
  const workerStartOptions = createGeneratedWorkerStartOptions({
    workerStartOptions: options.workerStartOptions,
    audioOptions,
  });
  let applyAudioSnapshot: ((snapshot: RenderSnapshot) => void) | null = null;
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: false,
    msaaSampleCount: status.render.requestedSampleCount,
    useFrameGraph,
    onPresentationSnapshot(snapshot) {
      applyAudioSnapshot?.(snapshot);
    },
    ...(gpuTimings === undefined ? {} : { gpuTimings }),
    ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
    ...(config.render?.tonemap === undefined
      ? {}
      : { tonemap: config.render.tonemap }),
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
  let audio: GeneratedAudio | null = null;
  if (audioOptions !== undefined && audioOptions !== false) {
    const { installGeneratedAudio } = await import("./audio.js");
    audio = installGeneratedAudio(
      worker,
      sourceAssets,
      audioOptions === true
        ? { snapshotSource: "manual" }
        : { ...audioOptions, snapshotSource: "manual" },
    );
    applyAudioSnapshot = audio?.applySnapshot ?? null;
  }

  if (webgpu.ok) {
    webgpu.app.start();
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

function createGeneratedWorkerStartOptions(options: {
  readonly workerStartOptions: Record<string, unknown> | undefined;
  readonly audioOptions: boolean | GeneratedAudioOptions | false | undefined;
}): Record<string, unknown> | undefined {
  if (options.audioOptions === undefined || options.audioOptions === false) {
    return options.workerStartOptions;
  }

  return {
    audioSnapshotMessageRateHz: 0,
    ...(options.workerStartOptions ?? {}),
  };
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

function resolveGeneratedPostEffects(
  render: ApertureConfig["render"],
): ReturnType<typeof createWebGpuBloomPostEffect>[] {
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
