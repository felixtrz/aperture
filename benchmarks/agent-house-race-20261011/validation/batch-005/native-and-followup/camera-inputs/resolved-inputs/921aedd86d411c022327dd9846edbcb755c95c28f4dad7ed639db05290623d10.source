import { readGeneratedBrowserAppStatus } from "./status.js";
export const DEFAULT_GENERATED_SIGNAL_SUBSCRIPTION_INTERVAL_MS = 16;
export function readGeneratedSignals(scope = globalThis) {
    const status = readGeneratedBrowserAppStatus(scope);
    return readSignalRecord(status?.lastWorkerSummary);
}
export function readGeneratedSignal(name, fallback, scope = globalThis) {
    const signals = readGeneratedSignals(scope);
    const value = signals?.[name];
    return value === undefined ? fallback : value;
}
export function subscribeGeneratedSignals(listener, options = {}) {
    const scope = options.scope ?? globalThis;
    const intervalMilliseconds = normalizeSignalSubscriptionInterval(options.intervalMilliseconds);
    let disposed = false;
    let pendingTimer = null;
    let previous = null;
    const frame = () => {
        if (disposed)
            return;
        const next = readGeneratedSignals(scope);
        if (next !== null && next !== previous) {
            previous = next;
            listener(next);
        }
        pendingTimer = setTimeout(frame, intervalMilliseconds);
    };
    if (options.immediate !== false) {
        const initial = readGeneratedSignals(scope);
        if (initial !== null) {
            previous = initial;
            listener(initial);
        }
    }
    pendingTimer = setTimeout(frame, intervalMilliseconds);
    return () => {
        disposed = true;
        if (pendingTimer !== null) {
            clearTimeout(pendingTimer);
            pendingTimer = null;
        }
    };
}
function readSignalRecord(value) {
    const summary = typeof value === "object" && value !== null
        ? value.signals
        : null;
    return typeof summary === "object" && summary !== null
        ? summary
        : null;
}
function normalizeSignalSubscriptionInterval(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_GENERATED_SIGNAL_SUBSCRIPTION_INTERVAL_MS;
    }
    return Math.max(1, Math.floor(value));
}
//# sourceMappingURL=signals.js.map