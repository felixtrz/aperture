export const APERTURE_GENERATED_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
export const APERTURE_GENERATED_RENDER_DIAGNOSTICS_PROPERTY = "__apertureRenderDiagnostics";
export function readGeneratedBrowserAppStatus(scope = globalThis) {
    const value = scope[APERTURE_GENERATED_STATUS_GLOBAL];
    return isGeneratedBrowserAppStatus(value) ? value : null;
}
export function subscribeGeneratedBrowserAppStatus(listener, options = {}) {
    const scope = options.scope ?? globalThis;
    let disposed = false;
    let previousStamp = null;
    const frame = () => {
        if (disposed)
            return;
        const status = readGeneratedBrowserAppStatus(scope);
        if (status !== null) {
            const stamp = generatedStatusStamp(status);
            if (stamp !== previousStamp) {
                previousStamp = stamp;
                listener(status);
            }
        }
        schedule(frame);
    };
    if (options.immediate !== false) {
        const initial = readGeneratedBrowserAppStatus(scope);
        if (initial !== null) {
            previousStamp = generatedStatusStamp(initial);
            listener(initial);
        }
    }
    schedule(frame);
    return () => {
        disposed = true;
    };
}
export function installGeneratedStatus() {
    const status = {
        status: "starting",
        webgpuOk: null,
        snapshots: 0,
        mirroredSourceAssets: 0,
        skippedSourceAssets: 0,
        forwardedInputEvents: 0,
        forwardedInputFrames: 0,
        connectedGamepads: 0,
        lastInputReset: null,
        lastInputEvent: null,
        forwardedCommandEvents: 0,
        lastCommandEvent: null,
        lastFrame: null,
        lastError: null,
        lastFailure: null,
        lastWorkerSummary: null,
        workerMessages: {
            snapshotDecisions: emptyWorkerMessageDecisionCounters(),
            sidebandDecisions: emptyWorkerMessageDecisionCounters(),
        },
        performance: null,
        diagnostics: null,
        render: null,
        canvas: null,
        systems: [],
    };
    globalThis[APERTURE_GENERATED_STATUS_GLOBAL] =
        status;
    return status;
}
export function installGeneratedRenderDiagnosticsAccessor(status, accessor) {
    Object.defineProperty(status, APERTURE_GENERATED_RENDER_DIAGNOSTICS_PROPERTY, {
        value: accessor,
        enumerable: false,
        configurable: true,
    });
}
function emptyWorkerMessageDecisionCounters() {
    return {
        total: 0,
        latest: null,
        postedMessages: {},
        postMessageReasons: {},
    };
}
function generatedStatusStamp(status) {
    const diagnostics = status.diagnostics;
    const lastFailure = status.lastFailure;
    return [
        status.status,
        String(status.webgpuOk),
        status.snapshots,
        status.lastFrame ?? "",
        diagnostics?.lastFrame?.frame ?? "",
        String(diagnostics?.lastFrame?.ok ?? ""),
        errorStamp(status.lastError ?? diagnostics?.lastError),
        errorStamp(lastFailure),
    ].join("|");
}
function errorStamp(value) {
    if (value === null || value === undefined)
        return "";
    if (typeof value !== "object")
        return String(value);
    const error = value;
    return [
        error.name ?? "",
        error.code ?? "",
        error.status ?? "",
        error.message ?? String(value),
    ].join(":");
}
function isGeneratedBrowserAppStatus(value) {
    return (typeof value === "object" &&
        value !== null &&
        typeof value.status === "string" &&
        "snapshots" in value);
}
function schedule(callback) {
    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(callback);
        return;
    }
    setTimeout(callback, 16);
}
//# sourceMappingURL=status.js.map