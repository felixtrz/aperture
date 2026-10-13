import { type SimulationMessagePort } from "@aperture-engine/runtime";
import type { ApertureSystemModule } from "../advanced.js";
import type { ApertureConfig } from "../config.js";
export interface StartGeneratedSimulationWorkerOptions {
    readonly config: ApertureConfig;
    readonly systems: readonly ApertureSystemModule[];
    readonly port?: SimulationMessagePort;
}
export declare function startGeneratedSimulationWorker(options: StartGeneratedSimulationWorkerOptions): void;
//# sourceMappingURL=start.d.ts.map