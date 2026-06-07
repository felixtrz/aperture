import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createWebGpuApp,
  type CreateWebGpuAppResult,
  type WebGpuAppComputePassDescriptor,
  type WebGpuAppRenderPassDescriptor,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { defineApertureConfig, type ApertureConfig } from "../config.js";
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
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
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
  // M3-T4 / AI-25: the single-encoder FrameGraph forward route (default OFF) is
  // opted into via render.frameGraph config or the legacy ?graph=1 URL override.
  const useFrameGraph = resolveUseFrameGraph(
    config.render,
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null,
  );
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: true,
    msaaSampleCount: status.render.requestedSampleCount,
    ...(useFrameGraph ? { useFrameGraph: true } : {}),
  });
  webgpuResult = webgpu;

  status.webgpuOk = webgpu.ok;
  status.status = webgpu.ok ? "running" : "webgpu-failed";
  status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
  if (webgpu.ok) {
    syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
  }

  return {
    worker,
    webgpu,
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
