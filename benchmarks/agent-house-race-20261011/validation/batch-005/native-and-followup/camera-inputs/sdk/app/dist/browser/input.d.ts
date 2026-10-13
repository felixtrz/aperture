import type { SimulationWorker } from "@aperture-engine/runtime";
import type { ApertureConfig } from "../config.js";
import type { GeneratedBrowserAppStatus } from "./status.js";
export declare const APERTURE_GENERATED_VIRTUAL_INPUT_EVENT: "aperture.generated.virtualAction";
export interface ApertureVirtualActionInput {
    readonly source?: string;
    readonly pressed?: boolean;
    readonly value?: boolean | number;
    readonly x?: number;
    readonly y?: number;
}
export declare function dispatchApertureInputAction(action: string, input?: boolean | number | ApertureVirtualActionInput, scope?: EventTarget): void;
export declare function installGeneratedInputForwarding(canvas: HTMLCanvasElement, worker: SimulationWorker, status: GeneratedBrowserAppStatus, config: ApertureConfig, options?: {
    readonly signal?: AbortSignal;
    readonly pollGamepads?: boolean;
}): void;
//# sourceMappingURL=input.d.ts.map