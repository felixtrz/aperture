import type { SimulationWorker } from "@aperture-engine/runtime";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import { APERTURE_DEVTOOLS_PROTOCOL_VERSION, type ApertureDevtoolsResponse } from "../../commands.js";
import { type GeneratedBrowserRequestClient } from "../request.js";
export declare const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export declare const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
export interface ApertureMcpRuntime {
    readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
    callTool(tool: string, payload?: unknown): Promise<ApertureDevtoolsResponse>;
}
export declare function installGeneratedDevtoolsRuntime(input: {
    readonly worker: SimulationWorker;
    readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
    readonly requests?: GeneratedBrowserRequestClient;
}): () => void;
//# sourceMappingURL=runtime.d.ts.map