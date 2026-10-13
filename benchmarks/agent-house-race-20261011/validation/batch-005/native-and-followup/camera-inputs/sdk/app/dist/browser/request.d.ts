import type { SimulationWorker } from "@aperture-engine/runtime";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import { type ApertureDevtoolsResponse } from "../commands.js";
export interface GeneratedBrowserRequestOptions {
    readonly timeoutMilliseconds?: number;
    readonly signal?: AbortSignal;
}
export declare class ApertureBrowserControlError extends Error {
    readonly diagnostics: readonly unknown[];
    constructor(message: string, diagnostics?: readonly unknown[]);
}
export interface GeneratedBrowserRequestClient {
    readonly ready: Promise<void>;
    requestRaw(tool: string, payload?: unknown, options?: GeneratedBrowserRequestOptions): Promise<ApertureDevtoolsResponse>;
    dispose(): void;
}
export declare function createGeneratedBrowserRequestClient(input: {
    readonly worker: SimulationWorker;
    readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
    readonly waitForReady?: boolean;
    readonly onRequestPosted?: (tool: string, requestId: string) => void;
    readonly onFailure?: (error: Error) => void;
}): GeneratedBrowserRequestClient;
//# sourceMappingURL=request.d.ts.map