import { type SimulationMessagePort, type SimulationWorkerStartOptions } from "@aperture-engine/runtime";
import { type ApertureApp } from "../advanced.js";
import type { ApertureConfig } from "../config.js";
import type { ApertureGeneratedInputEventMessage } from "../input.js";
import type { ApertureSystemModule } from "../advanced.js";
import { type GeneratedDevtoolsBridge } from "./devtools/bridge.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";
export declare function runGeneratedWorkerLoop(options: {
    readonly port: SimulationMessagePort;
    readonly config: ApertureConfig;
    readonly systems: readonly ApertureSystemModule[];
    readonly start: SimulationWorkerStartOptions;
    readonly pendingInput: ApertureGeneratedInputEventMessage[];
    readonly createEntityTools: (world: ApertureApp["lowLevel"]["world"]) => GeneratedEntityToolBridge;
    readonly setApp: (app: ApertureApp, entityTools: GeneratedEntityToolBridge, devtools: GeneratedDevtoolsBridge) => void;
}): Promise<void>;
export interface GeneratedWorkerTickScheduler {
    schedule(callback: () => void): void;
    dispose(): void;
}
export interface GeneratedWorkerTickSchedulerOptions {
    readonly tickRateHz?: number;
}
export declare const DEFAULT_GENERATED_WORKER_TICK_RATE_HZ = 240;
export declare function createGeneratedWorkerTickScheduler(options?: GeneratedWorkerTickSchedulerOptions): GeneratedWorkerTickScheduler;
/**
 * Legacy globals key under which raw simulation-worker start options are
 * published on the ECS world. Prefer `this.startOptions` in app systems; this
 * remains for old callers that reached into world globals directly.
 */
export declare const APERTURE_WORKER_START_OPTIONS_KEY = "aperture.workerStartOptions";
//# sourceMappingURL=loop.d.ts.map