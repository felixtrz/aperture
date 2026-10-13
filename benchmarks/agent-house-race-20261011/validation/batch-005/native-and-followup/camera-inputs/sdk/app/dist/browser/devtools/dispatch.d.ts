import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import type { GeneratedBrowserDevtoolsToolResult } from "./types.js";
export declare function callGeneratedBrowserDevtoolsTool(input: {
    readonly tool: string;
    readonly payload: unknown;
    readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
}): Promise<GeneratedBrowserDevtoolsToolResult | null>;
//# sourceMappingURL=dispatch.d.ts.map