import type { SimulationMessagePort } from "@aperture-engine/runtime";
import type { ApertureApp } from "../../advanced.js";
import { type ApertureDevtoolsRequest } from "../../commands.js";
import type { ApertureGeneratedInputEvent } from "../../input.js";
import { type GeneratedEntityToolBridge } from "../../devtools/entities.js";
export interface GeneratedDevtoolsBridge {
    handle(request: ApertureDevtoolsRequest): void;
}
export interface GeneratedDevtoolsStepInput {
    readonly delta: number;
    readonly time?: number;
    readonly requestId?: string;
    readonly sourceAssetVersions?: readonly (readonly [string, number])[];
}
export declare function createGeneratedDevtoolsBridge(options: {
    readonly app: ApertureApp;
    readonly entityTools: GeneratedEntityToolBridge;
    readonly port: SimulationMessagePort;
    readonly enqueueInputEvent: (event: ApertureGeneratedInputEvent) => void;
    readonly setPaused: (paused: boolean) => void;
    readonly step: (input: GeneratedDevtoolsStepInput) => Readonly<Record<string, unknown>>;
    readonly getSimulationState: () => Readonly<Record<string, unknown>>;
}): GeneratedDevtoolsBridge;
//# sourceMappingURL=bridge.d.ts.map