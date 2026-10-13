import type { SimulationWorker } from "@aperture-engine/runtime";
import type { ApertureConfig, ApertureRenderDefaults } from "../config.js";
import type { GeneratedBrowserAppStatus } from "./status.js";
export declare function resolveCanvas(config: ApertureConfig): HTMLCanvasElement;
export declare function installCanvasResizeSync(canvas: HTMLCanvasElement, worker: SimulationWorker, status: GeneratedBrowserAppStatus, render: ApertureRenderDefaults | undefined, options?: {
    readonly afterResize?: () => void;
    readonly renderProfile?: string | null;
}): () => void;
//# sourceMappingURL=canvas.d.ts.map