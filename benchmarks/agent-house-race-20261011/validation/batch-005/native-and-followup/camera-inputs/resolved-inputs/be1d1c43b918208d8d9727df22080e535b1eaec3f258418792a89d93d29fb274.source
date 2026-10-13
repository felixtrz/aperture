import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import { createApertureDevtoolsRequest, createApertureDevtoolsResponse, isApertureDevtoolsResponse, } from "../commands.js";
import { callGeneratedBrowserDevtoolsTool } from "./devtools/dispatch.js";
export class ApertureBrowserControlError extends Error {
    diagnostics;
    constructor(message, diagnostics = []) {
        super(message);
        this.diagnostics = diagnostics;
        this.name = "ApertureBrowserControlError";
    }
}
export function createGeneratedBrowserRequestClient(input) {
    let sequence = 0;
    let failure = null;
    const pending = new Map();
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    // Generated apps are also started for their side effects. Keep readiness
    // failures observable to awaiters without an unhandled rejection for those apps.
    void ready.catch(() => { });
    const readyTimeout = input.waitForReady === false
        ? null
        : setTimeout(() => fail(new ApertureBrowserControlError("Aperture worker initialization timed out.")), 30_000);
    if (input.waitForReady === false)
        resolveReady();
    const unsubscribeMessage = input.worker.onMessage((message) => {
        if (typeof message === "object" &&
            message !== null &&
            message.type === SIMULATION_WORKER_PROTOCOL.ready) {
            if (readyTimeout !== null)
                clearTimeout(readyTimeout);
            resolveReady();
            return;
        }
        if (!isApertureDevtoolsResponse(message))
            return;
        const request = pending.get(message.requestId);
        if (request === undefined)
            return;
        pending.delete(message.requestId);
        request.cleanup();
        request.resolve(message);
    });
    const unsubscribeError = input.worker.onError?.((event) => {
        fail(new ApertureBrowserControlError(event.message, event.diagnostics));
    });
    function fail(error) {
        failure = error;
        input.onFailure?.(error);
        if (readyTimeout !== null)
            clearTimeout(readyTimeout);
        rejectReady(error);
        for (const request of pending.values()) {
            request.cleanup();
            request.reject(error);
        }
        pending.clear();
    }
    return {
        ready,
        requestRaw(tool, payload, options = {}) {
            if (failure !== null)
                return Promise.reject(failure);
            if (typeof tool !== "string" || tool.trim().length === 0) {
                return Promise.reject(new ApertureBrowserControlError("Aperture request requires a non-empty tool name."));
            }
            const timeoutMilliseconds = options.timeoutMilliseconds ?? 10_000;
            if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
                return Promise.reject(new ApertureBrowserControlError("Aperture request timeout must be finite and positive."));
            }
            if (options.signal?.aborted === true)
                return Promise.reject(new ApertureBrowserControlError("Aperture request was aborted."));
            if (pending.size >= 128)
                return Promise.reject(new ApertureBrowserControlError("Aperture has reached its limit of 128 pending requests."));
            sequence += 1;
            const requestId = `browser-${Date.now()}-${sequence}`;
            return new Promise((resolve, reject) => {
                const rejectRequest = (error) => {
                    const request = pending.get(requestId);
                    if (request === undefined)
                        return;
                    pending.delete(requestId);
                    request.cleanup();
                    reject(error);
                };
                const abort = () => rejectRequest(new ApertureBrowserControlError(`Aperture request '${tool}' was aborted.`));
                const timeout = setTimeout(() => rejectRequest(new ApertureBrowserControlError(`Aperture devtools request '${tool}' timed out.`)), timeoutMilliseconds);
                pending.set(requestId, {
                    resolve,
                    reject,
                    cleanup() {
                        clearTimeout(timeout);
                        options.signal?.removeEventListener("abort", abort);
                    },
                });
                options.signal?.addEventListener("abort", abort, { once: true });
                void (async () => {
                    const local = await callGeneratedBrowserDevtoolsTool({
                        tool,
                        payload,
                        getWebGpuResult: input.getWebGpuResult,
                    });
                    if (!pending.has(requestId))
                        return;
                    if (local !== null) {
                        const request = pending.get(requestId);
                        pending.delete(requestId);
                        request.cleanup();
                        resolve(createApertureDevtoolsResponse({ requestId, ...local }));
                        return;
                    }
                    input.onRequestPosted?.(tool, requestId);
                    input.worker.postMessage(createApertureDevtoolsRequest({ requestId, tool, payload }));
                })().catch((error) => rejectRequest(error instanceof Error
                    ? error
                    : new ApertureBrowserControlError(String(error))));
            });
        },
        dispose() {
            if (failure === null)
                fail(new ApertureBrowserControlError("Aperture browser app was disposed."));
            unsubscribeMessage();
            unsubscribeError?.();
        },
    };
}
//# sourceMappingURL=request.js.map