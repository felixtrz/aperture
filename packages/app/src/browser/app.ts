import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
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
import { installGeneratedInputForwarding } from "./input.js";
import { resolveGeneratedRenderSettings } from "./render.js";
import {
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
   * and threads the value here; the worker loop republishes these on the ECS
   * world globals for systems to read. Merged into the worker `start` message.
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
  const useFrameGraph = resolveUseFrameGraph(
    config.render,
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null,
  );
  const postEffects = resolveGeneratedPostEffects(config.render);
  // Bloom needs the HDR scene-buffer path; opting into bloom implies exposure.
  const bloomEnabled = postEffects.length > 0;
  const exposure =
    config.render?.exposure ?? (bloomEnabled ? 1 : undefined);
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: true,
    msaaSampleCount: status.render.requestedSampleCount,
    useFrameGraph,
    ...(options.workerStartOptions === undefined
      ? {}
      : { workerStartOptions: options.workerStartOptions }),
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
    syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
  }

  // Audio is a sibling derived view: it subscribes to the same worker snapshots.
  // The renderer's asset-mirroring subscription is registered first (createWebGpuApp
  // autoStart, above), so by the time this raw-worker subscription fires each
  // frame, `sourceAssets` already holds the mirrored audio-clip bytes. The audio
  // module is imported dynamically only when enabled, so a non-audio app never
  // loads @aperture-engine/audio.
  let audio: GeneratedAudio | null = null;
  if (options.audio !== undefined && options.audio !== false) {
    const { installGeneratedAudio } = await import("./audio.js");
    audio = installGeneratedAudio(
      worker,
      sourceAssets,
      options.audio === true ? {} : options.audio,
    );
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
      ...(options.threshold === undefined ? {} : { threshold: options.threshold }),
      ...(options.intensity === undefined ? {} : { intensity: options.intensity }),
      ...(options.radius === undefined ? {} : { radius: options.radius }),
      ...(options.radiusPixels === undefined
        ? {}
        : { radiusPixels: options.radiusPixels }),
      ...(options.levels === undefined ? {} : { levels: options.levels }),
    }),
  ];
}
