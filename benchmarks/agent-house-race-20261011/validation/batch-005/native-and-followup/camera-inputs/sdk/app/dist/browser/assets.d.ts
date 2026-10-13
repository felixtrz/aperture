import { type SimulationWorker } from "@aperture-engine/runtime";
import type { AssetRegistry } from "@aperture-engine/simulation";
import type { GeneratedBrowserAppStatus } from "./status.js";
export declare function mirrorSimulationWorkerSourceAssets(worker: SimulationWorker, sourceAssets: AssetRegistry, status: GeneratedBrowserAppStatus, options?: MirrorSimulationWorkerSourceAssetsOptions): SimulationWorker;
export interface MirrorSimulationWorkerSourceAssetsOptions {
    readonly performanceStatusIntervalMilliseconds?: number;
    /** Controlled manual frames deliver assets with their own accepted snapshot. */
    readonly sidebandAssets?: boolean;
}
export declare const DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS = 250;
//# sourceMappingURL=assets.d.ts.map