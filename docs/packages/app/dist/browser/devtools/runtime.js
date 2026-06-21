import { APERTURE_DEVTOOLS_PROTOCOL_VERSION, createApertureDevtoolsRequest, createApertureDevtoolsResponse, isApertureDevtoolsResponse, } from "../../commands.js";
import { callGeneratedBrowserDevtoolsTool } from "./dispatch.js";
export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
export function installGeneratedDevtoolsRuntime(input) {
    const scope = globalThis;
    if (scope[APERTURE_MCP_MANAGED_GLOBAL] !== true) {
        return;
    }
    let nextRequestId = 0;
    const pending = new Map();
    input.worker.onMessage((message) => {
        if (!isApertureDevtoolsResponse(message)) {
            return;
        }
        const request = pending.get(message.requestId);
        if (request === undefined) {
            return;
        }
        clearTimeout(request.timeout);
        pending.delete(message.requestId);
        request.resolve(message);
    });
    const runtime = {
        version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
        async callTool(tool, payload) {
            nextRequestId += 1;
            const requestId = `browser-${Date.now()}-${nextRequestId}`;
            const browserResult = await callGeneratedBrowserDevtoolsTool({
                tool,
                payload,
                getWebGpuResult: input.getWebGpuResult,
            });
            if (browserResult !== null) {
                return createApertureDevtoolsResponse({
                    requestId,
                    ok: browserResult.ok,
                    ...(Object.prototype.hasOwnProperty.call(browserResult, "result")
                        ? { result: browserResult.result }
                        : {}),
                    ...(browserResult.diagnostics === undefined
                        ? {}
                        : { diagnostics: browserResult.diagnostics }),
                });
            }
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    pending.delete(requestId);
                    reject(new Error(`Aperture devtools request '${tool}' timed out.`));
                }, 10_000);
                pending.set(requestId, {
                    resolve,
                    reject,
                    timeout,
                });
                input.worker.postMessage(createApertureDevtoolsRequest({
                    requestId,
                    tool,
                    payload,
                }));
            });
        },
    };
    scope[APERTURE_MCP_RUNTIME_GLOBAL] = runtime;
}
//# sourceMappingURL=runtime.js.map