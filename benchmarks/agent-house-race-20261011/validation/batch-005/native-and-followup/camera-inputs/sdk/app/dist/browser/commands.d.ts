import type { SimulationWorker } from "@aperture-engine/runtime";
import type { GeneratedBrowserAppStatus } from "./status.js";
export declare function installGeneratedCommandForwarding(worker: SimulationWorker, status: GeneratedBrowserAppStatus, options?: {
    readonly afterForward?: () => void;
}): () => void;
//# sourceMappingURL=commands.d.ts.map