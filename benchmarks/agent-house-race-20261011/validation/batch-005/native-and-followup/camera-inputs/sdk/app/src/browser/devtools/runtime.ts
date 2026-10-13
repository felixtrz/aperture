import type { SimulationWorker } from "@aperture-engine/runtime";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import {
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  type ApertureDevtoolsResponse,
} from "../../commands.js";
import {
  createGeneratedBrowserRequestClient,
  type GeneratedBrowserRequestClient,
} from "../request.js";

export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";

export interface ApertureMcpRuntime {
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  callTool(tool: string, payload?: unknown): Promise<ApertureDevtoolsResponse>;
}

export function installGeneratedDevtoolsRuntime(input: {
  readonly worker: SimulationWorker;
  readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
  readonly requests?: GeneratedBrowserRequestClient;
}): () => void {
  const scope = globalThis as Record<string, unknown>;

  if (scope[APERTURE_MCP_MANAGED_GLOBAL] !== true) {
    return () => {};
  }

  const requests =
    input.requests ??
    createGeneratedBrowserRequestClient({ ...input, waitForReady: false });
  const runtime: ApertureMcpRuntime = {
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    callTool: requests.requestRaw,
  };

  scope[APERTURE_MCP_RUNTIME_GLOBAL] = runtime;
  return () => {
    if (scope[APERTURE_MCP_RUNTIME_GLOBAL] === runtime)
      delete scope[APERTURE_MCP_RUNTIME_GLOBAL];
    if (input.requests === undefined) requests.dispose();
  };
}
