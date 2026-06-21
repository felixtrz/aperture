import { jsonSafeValue } from "./json.js";
export function createCommandAccess(assets) {
    const queues = new Map();
    const assetRequests = new Map();
    let enqueued = 0;
    let drained = 0;
    let lastQueued = null;
    let lastDrained = null;
    return {
        async requestAsset(idOrHandle) {
            const id = typeof idOrHandle === "string" ? idOrHandle : idOrHandle.id;
            assetRequests.set(id, {
                id,
                status: "pending",
                ready: readinessValue(assets, id),
            });
            try {
                await assets.request(idOrHandle);
                assetRequests.set(id, {
                    id,
                    status: "ready",
                    ready: readinessValue(assets, id),
                });
            }
            catch (error) {
                assetRequests.set(id, {
                    id,
                    status: "error",
                    ready: readinessValue(assets, id),
                    message: error instanceof Error ? error.message : String(error),
                    ...errorCode(error),
                });
                throw error;
            }
        },
        queue(channel, payload) {
            const current = queues.get(channel) ?? [];
            current.push(payload);
            queues.set(channel, current);
            enqueued += 1;
            lastQueued = {
                channel,
                payload: jsonSafeValue(payload),
            };
        },
        drain(channel) {
            const current = queues.get(channel) ?? [];
            queues.set(channel, []);
            drained += current.length;
            if (current.length > 0) {
                lastDrained = {
                    channel,
                    payload: jsonSafeValue(current[current.length - 1]),
                };
            }
            return current;
        },
        summary() {
            return {
                enqueued,
                drained,
                queuedByChannel: Object.fromEntries([...queues.entries()].map(([channel, values]) => [
                    channel,
                    values.length,
                ])),
                lastQueued,
                lastDrained,
                requestedAssets: [...assetRequests.values()],
            };
        },
    };
}
function readinessValue(assets, id) {
    try {
        return assets.readiness(id).value;
    }
    catch {
        return false;
    }
}
function errorCode(error) {
    return typeof error === "object" &&
        error !== null &&
        typeof error.code === "string"
        ? { errorCode: error.code }
        : {};
}
//# sourceMappingURL=commands.js.map