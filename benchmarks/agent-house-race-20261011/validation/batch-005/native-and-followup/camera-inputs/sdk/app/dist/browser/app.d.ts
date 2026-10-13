import { type SimulationWorker, type SimulationWorkerEntry } from "@aperture-engine/runtime";
import type { RenderedGeometryInspection, RenderedGeometryInspectionOptions } from "@aperture-engine/webgpu";
import { createWebGpuBloomPostEffect, type CreateWebGpuAppResult, type WebGpuAppComputePassDescriptor, type WebGpuAppRenderPassDescriptor } from "@aperture-engine/webgpu";
import { type ApertureConfig } from "../config.js";
import type { GeneratedAudio, GeneratedAudioOptions } from "./audio.js";
import { type GeneratedBrowserFrameOptions, type GeneratedBrowserRenderedFrame, type GeneratedBrowserFrameInspection, type GeneratedBrowserToolContracts } from "./control.js";
import { type GeneratedBrowserRequestOptions } from "./request.js";
import type { ApertureDevtoolsResponse } from "../commands.js";
import { type GeneratedBrowserSystemManifestEntry } from "./status.js";
export interface StartGeneratedBrowserAppOptions {
    readonly config: ApertureConfig;
    readonly workerEntry: SimulationWorkerEntry;
    readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
    readonly devtools?: {
        readonly enabled?: boolean;
    };
    readonly workerFactory?: (entry: string | URL, options?: WorkerOptions) => Worker;
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
    request<Key extends keyof GeneratedBrowserToolContracts>(tool: Key, ...args: undefined extends GeneratedBrowserToolContracts[Key]["payload"] ? [
        payload?: GeneratedBrowserToolContracts[Key]["payload"],
        options?: GeneratedBrowserRequestOptions
    ] : [
        payload: GeneratedBrowserToolContracts[Key]["payload"],
        options?: GeneratedBrowserRequestOptions
    ]): Promise<GeneratedBrowserToolContracts[Key]["result"]>;
    requestRaw(tool: string, payload?: unknown, options?: GeneratedBrowserRequestOptions): Promise<ApertureDevtoolsResponse>;
    /** One worker step/extraction and matching native submission; manual cadence only. No GPU fence. */
    renderFrame(options?: GeneratedBrowserFrameOptions): Promise<GeneratedBrowserRenderedFrame>;
    inspectRenderedFrame(): GeneratedBrowserFrameInspection | null;
    /** Detached static mesh arrays and all submitted instance WORLD matrices. */
    inspectRenderedGeometry(options?: RenderedGeometryInspectionOptions): RenderedGeometryInspection;
    dispose(): Promise<void>;
    addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
    addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
    removePass(name: string): boolean;
}
/**
 * Await the returned app Promise before reading `ready` or calling `request`.
 * Then await `app.ready` for GPU and worker initialization.
 * JavaScript embeddings can enable `// @ts-check` to catch a missing await.
 */
export declare function startGeneratedBrowserApp(options: StartGeneratedBrowserAppOptions): Promise<GeneratedBrowserApp>;
export declare function resolveGeneratedPostEffects(render: ApertureConfig["render"]): ReturnType<typeof createWebGpuBloomPostEffect>[];
//# sourceMappingURL=app.d.ts.map