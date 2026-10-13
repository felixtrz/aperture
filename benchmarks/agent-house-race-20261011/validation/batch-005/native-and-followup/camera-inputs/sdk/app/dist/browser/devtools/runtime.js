import { APERTURE_DEVTOOLS_PROTOCOL_VERSION, } from "../../commands.js";
import { createGeneratedBrowserRequestClient, } from "../request.js";
export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
export function installGeneratedDevtoolsRuntime(input) {
    const scope = globalThis;
    if (scope[APERTURE_MCP_MANAGED_GLOBAL] !== true) {
        return () => { };
    }
    const requests = input.requests ??
        createGeneratedBrowserRequestClient({ ...input, waitForReady: false });
    const runtime = {
        version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
        callTool: requests.requestRaw,
    };
    scope[APERTURE_MCP_RUNTIME_GLOBAL] = runtime;
    return () => {
        if (scope[APERTURE_MCP_RUNTIME_GLOBAL] === runtime)
            delete scope[APERTURE_MCP_RUNTIME_GLOBAL];
        if (input.requests === undefined)
            requests.dispose();
    };
}
//# sourceMappingURL=runtime.js.map