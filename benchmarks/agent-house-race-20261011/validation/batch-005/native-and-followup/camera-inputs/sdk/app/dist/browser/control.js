import { decodeTypedArrayTree, encodeTypedArrayTree, inspectRenderSnapshot, } from "@aperture-engine/render";
import { webGpuAppRenderReportToJsonValue, } from "@aperture-engine/webgpu";
import { ApertureBrowserControlError, } from "./request.js";
export function createGeneratedBrowserFrameControl(input) {
    let disposed = false;
    let tail = Promise.resolve();
    let queued = 0;
    let lastReport = null;
    const completed = new Map();
    let active = null;
    const settle = () => {
        if (active?.expectedFrame === null || active === null)
            return;
        const report = completed.get(active.expectedFrame);
        if (report === undefined)
            return;
        completed.delete(active.expectedFrame);
        if (report.ok)
            active.resolve({
                snapshotFrame: active.expectedFrame,
                report: decodeTypedArrayTree(encodeTypedArrayTree(webGpuAppRenderReportToJsonValue(report))),
            });
        else
            active.reject(new ApertureBrowserControlError("Aperture failed to render the requested frame.", report.diagnostics));
    };
    return {
        renderFrame(options = {}) {
            if (!input.manual)
                return Promise.reject(new ApertureBrowserControlError('renderFrame requires render.cadence: "manual".'));
            if (disposed)
                return Promise.reject(new ApertureBrowserControlError("Aperture browser app was disposed."));
            const delta = options.deltaSeconds ?? 0;
            const time = options.timeSeconds;
            const timeoutMilliseconds = options.timeoutMilliseconds ?? 10_000;
            if (!Number.isFinite(delta) ||
                delta < 0 ||
                (time !== undefined && (!Number.isFinite(time) || time < 0)) ||
                !Number.isFinite(timeoutMilliseconds) ||
                timeoutMilliseconds <= 0) {
                return Promise.reject(new ApertureBrowserControlError("Frame delta/time must be finite and non-negative, and timeout must be positive."));
            }
            if (queued >= 16)
                return Promise.reject(new ApertureBrowserControlError("Aperture has reached its limit of 16 queued frames."));
            queued += 1;
            const next = tail
                .then(async () => {
                if (disposed)
                    throw new ApertureBrowserControlError("Aperture browser app was disposed.");
                if (options.signal?.aborted === true)
                    throw new ApertureBrowserControlError("Aperture frame was aborted.");
                await input.requests.ready;
                let resolve;
                let reject;
                const presented = new Promise((yes, no) => {
                    resolve = yes;
                    reject = no;
                });
                // A worker may fail before its step response arrives. Attach a handler
                // immediately while retaining the rejection for the caller below.
                void presented.catch(() => { });
                active = {
                    requestId: null,
                    receivedFrame: null,
                    expectedFrame: null,
                    resolve,
                    reject,
                };
                const abort = () => reject(new ApertureBrowserControlError("Aperture frame was aborted."));
                const timeout = setTimeout(() => reject(new ApertureBrowserControlError("Aperture frame presentation timed out.")), timeoutMilliseconds);
                options.signal?.addEventListener("abort", abort, { once: true });
                try {
                    const response = await input.requests.requestRaw("ecs_step", {
                        delta,
                        ...(time === undefined ? {} : { time }),
                        ...(input.getSourceAssetVersions === undefined
                            ? {}
                            : {
                                sourceAssetVersions: input.getSourceAssetVersions(),
                            }),
                    }, options);
                    if (!response.ok)
                        throw new ApertureBrowserControlError("Aperture could not step the requested frame.", response.diagnostics);
                    const frame = response.result?.snapshotFrame;
                    if (typeof frame !== "number" ||
                        !Number.isInteger(frame) ||
                        frame < 0)
                        throw new ApertureBrowserControlError("Aperture step did not identify its published snapshot frame.");
                    active.expectedFrame = frame;
                    if (active.receivedFrame !== null && active.receivedFrame !== frame)
                        throw new ApertureBrowserControlError("Step response and published snapshot frame differ.");
                    settle();
                    return await presented;
                }
                finally {
                    active = null;
                    clearTimeout(timeout);
                    options.signal?.removeEventListener("abort", abort);
                }
            })
                .finally(() => {
                queued -= 1;
            });
            tail = next.then(() => { }, () => { });
            return next;
        },
        requested(requestId) {
            if (active !== null)
                active.requestId = requestId;
        },
        acceptSnapshot(frame, message) {
            if (!input.manual)
                return true;
            const id = typeof message === "object" && message !== null
                ? message
                    .controlledFrameRequestId
                : undefined;
            if (active === null ||
                active.requestId === null ||
                id !== active.requestId ||
                active.receivedFrame !== null)
                return false;
            if (active.expectedFrame !== null && active.expectedFrame !== frame) {
                active.reject(new ApertureBrowserControlError("Step response and published snapshot frame differ."));
                return false;
            }
            active.receivedFrame = frame;
            return true;
        },
        presented(report) {
            if (disposed)
                return;
            lastReport = report;
            completed.set(report.snapshot.frame, report);
            while (completed.size > 2)
                completed.delete(completed.keys().next().value);
            settle();
        },
        failed(error) {
            active?.reject(error);
        },
        inspectRenderedFrame() {
            if (lastReport === null)
                return null;
            // Export only detached inspection data, never the live asset registry,
            // worker ECS, or SAB-backed transform buffers.
            return decodeTypedArrayTree(encodeTypedArrayTree({
                frame: lastReport.snapshot.frame,
                ...inspectRenderSnapshot(lastReport.snapshot),
            }));
        },
        dispose() {
            disposed = true;
            active?.reject(new ApertureBrowserControlError("Aperture browser app was disposed."));
            completed.clear();
            lastReport = null;
        },
    };
}
//# sourceMappingURL=control.js.map