import { mirrorSourceAssetRegistryFromMessage } from "../asset-mirror.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
export function mirrorSimulationWorkerSourceAssets(worker, sourceAssets, status, options = {}) {
    const performanceState = createGeneratedBrowserPerformanceState(options.performanceStatusIntervalMilliseconds);
    const unsubscribeSidebandAssets = worker.onMessage((message) => {
        mirrorWorkerMessage({
            message,
            sourceAssets,
            status,
            performanceState,
            decisionBucket: "sideband",
        });
    });
    return {
        ...worker,
        onSnapshot(callback) {
            return worker.onSnapshot((event) => {
                mirrorWorkerMessage({
                    message: event.message,
                    sourceAssets,
                    status,
                    performanceState,
                    decisionBucket: "snapshot",
                });
                status.snapshots += 1;
                status.lastFrame = event.frame;
                callback(event);
            });
        },
        onError(callback) {
            return worker.onError((event) => {
                status.status = "worker-error";
                status.lastFailure = createApertureGeneratedDiagnosticsStatus({
                    status: "failed",
                    diagnostics: event.diagnostics ?? [
                        {
                            code: event.reason,
                            severity: "error",
                            message: event.message,
                            worker: event.source,
                            suggestedFix: "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
                        },
                    ],
                });
                status.lastError = status.lastFailure;
                callback(event);
            });
        },
        terminate() {
            unsubscribeSidebandAssets();
            worker.terminate();
        },
    };
}
const PERFORMANCE_SAMPLE_WINDOW = 240;
export const DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS = 250;
const MIN_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS = 16;
const PUBLISH_TIMING_FIELDS = [
    "totalMilliseconds",
    "inputMilliseconds",
    "stepMilliseconds",
    "extractMilliseconds",
    "sourceAssetsMilliseconds",
    "summaryMilliseconds",
    "transportMilliseconds",
    "postMessageMilliseconds",
    "commitMilliseconds",
];
const STEP_TIMING_FIELDS = [
    "totalMilliseconds",
    "preStepResolveSpatialMilliseconds",
    "inputEffectsMilliseconds",
    "lowLevelStepMilliseconds",
    "postStepSpatialMilliseconds",
    "interactionMilliseconds",
    "postUpdateEffectsMilliseconds",
];
const LOW_LEVEL_TIMING_FIELDS = [
    "totalMilliseconds",
    "worldUpdateMilliseconds",
    "animationMilliseconds",
    "fixedStepMilliseconds",
    "transformMilliseconds",
    "skeletonMilliseconds",
];
function mirrorWorkerMessage(options) {
    const mirror = mirrorSourceAssetRegistryFromMessage(options.sourceAssets, options.message);
    options.status.mirroredSourceAssets += mirror.mirrored;
    options.status.skippedSourceAssets += mirror.skipped;
    const workerSummary = readWorkerSummary(options.message);
    if (workerSummary !== null) {
        options.status.lastWorkerSummary = mergeWorkerSummary(options.status.lastWorkerSummary, workerSummary);
    }
    recordWorkerPostMessageDecision(options.status.workerMessages, readPostMessageDecision(options.message, workerSummary), options.decisionBucket);
    const performanceStatus = updateGeneratedBrowserPerformanceStatus(options.performanceState, workerSummary);
    if (performanceStatus !== undefined) {
        options.status.performance = performanceStatus;
    }
}
function readWorkerSummary(message) {
    return typeof message === "object" && message !== null
        ? (message.workerSummary ?? null)
        : null;
}
function readPostMessageDecision(message, workerSummary) {
    const messageDecision = readRecord(message)?.["postMessageDecision"];
    return messageDecision ?? readRecord(workerSummary)?.["postMessageDecision"];
}
const TRANSIENT_FULL_WORKER_SUMMARY_FIELDS = [
    "resources",
    "startOptions",
    "assets",
    "physics",
    "entities",
];
function createGeneratedBrowserPerformanceState(intervalMilliseconds) {
    return {
        sampleWindow: PERFORMANCE_SAMPLE_WINDOW,
        statusIntervalMilliseconds: normalizePerformanceStatusInterval(intervalMilliseconds),
        latest: null,
        lastPublishedStatusMilliseconds: null,
        cachedStatus: null,
        publish: new Map(),
        step: new Map(),
        lowLevel: new Map(),
    };
}
function updateGeneratedBrowserPerformanceStatus(state, workerSummary) {
    const timing = readRecord(workerSummary)?.["previousPublishTiming"];
    const timingRecord = readRecord(timing);
    if (timingRecord === null) {
        return undefined;
    }
    const stepTiming = readRecord(timingRecord["stepTiming"]);
    const lowLevelTiming = readRecord(stepTiming?.["lowLevel"]);
    const publish = numericFields(timingRecord, PUBLISH_TIMING_FIELDS);
    const step = numericFields(stepTiming, STEP_TIMING_FIELDS);
    const lowLevel = numericFields(lowLevelTiming, LOW_LEVEL_TIMING_FIELDS);
    const frame = readFiniteNumber(timingRecord["frame"]);
    const transport = readTransport(timingRecord["transport"]);
    const preStepWorldChanged = stepTiming?.["preStepWorldChanged"] === true ? true : false;
    if (frame !== null && transport !== null) {
        state.latest = {
            frame,
            transport,
            preStepWorldChanged,
            publish,
            step,
            lowLevel,
        };
    }
    recordTimingGroup(state.publish, state.sampleWindow, publish);
    recordTimingGroup(state.step, state.sampleWindow, step);
    recordTimingGroup(state.lowLevel, state.sampleWindow, lowLevel);
    return publishPerformanceStatusIfDue(state);
}
function publishPerformanceStatusIfDue(state) {
    if (state.latest === null) {
        return undefined;
    }
    const now = nowMilliseconds();
    if (state.cachedStatus !== null &&
        state.lastPublishedStatusMilliseconds !== null &&
        now - state.lastPublishedStatusMilliseconds <
            state.statusIntervalMilliseconds) {
        return undefined;
    }
    state.cachedStatus = performanceStatusFromState(state);
    state.lastPublishedStatusMilliseconds = now;
    return state.cachedStatus;
}
function performanceStatusFromState(state) {
    if (state.latest === null) {
        return {
            sampleWindow: state.sampleWindow,
            latest: null,
            rolling: {
                publish: {},
                step: {},
                lowLevel: {},
            },
        };
    }
    return {
        sampleWindow: state.sampleWindow,
        latest: state.latest,
        rolling: {
            publish: timingStatsRecord(state.publish),
            step: timingStatsRecord(state.step),
            lowLevel: timingStatsRecord(state.lowLevel),
        },
    };
}
function normalizePerformanceStatusInterval(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS;
    }
    return Math.max(MIN_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS, Math.floor(value));
}
function numericFields(record, fields) {
    const output = {};
    if (record === null) {
        return output;
    }
    for (const field of fields) {
        const value = readFiniteNumber(record[field]);
        if (value !== null) {
            output[field] = value;
        }
    }
    return output;
}
function recordTimingGroup(target, sampleWindow, values) {
    for (const [key, value] of Object.entries(values)) {
        const state = timingSampleStateFor(target, key);
        state.latest = value;
        state.total += 1;
        state.values.push(value);
        while (state.values.length > sampleWindow) {
            state.values.shift();
        }
    }
}
function timingSampleStateFor(target, key) {
    const existing = target.get(key);
    if (existing !== undefined) {
        return existing;
    }
    const next = {
        values: [],
        total: 0,
        latest: null,
    };
    target.set(key, next);
    return next;
}
function timingStatsRecord(values) {
    const output = {};
    for (const [key, state] of values) {
        output[key] = timingStats(state);
    }
    return output;
}
function timingStats(state) {
    if (state.values.length === 0) {
        return {
            count: state.total,
            latest: state.latest,
            average: null,
            min: null,
            p50: null,
            p95: null,
            p99: null,
            max: null,
        };
    }
    const sorted = [...state.values].sort((a, b) => a - b);
    const sum = sorted.reduce((total, value) => total + value, 0);
    return {
        count: state.total,
        latest: state.latest,
        average: sum / sorted.length,
        min: sorted[0] ?? null,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1] ?? null,
    };
}
function percentile(sorted, p) {
    if (sorted.length === 0) {
        return null;
    }
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index] ?? null;
}
function mergeWorkerSummary(previous, next) {
    if (!isRecord(next)) {
        return next;
    }
    if (!isRecord(previous)) {
        return next;
    }
    const merged = {
        ...previous,
        ...next,
        ...(next["entityTools"] === undefined &&
            previous["entityTools"] !== undefined
            ? { entityTools: previous["entityTools"] }
            : {}),
    };
    for (const field of TRANSIENT_FULL_WORKER_SUMMARY_FIELDS) {
        if (next[field] === undefined) {
            delete merged[field];
        }
    }
    return merged;
}
function recordWorkerPostMessageDecision(status, decision, bucketName) {
    const decisionRecord = readRecord(decision);
    if (decisionRecord === null) {
        return;
    }
    const bucket = bucketName === "snapshot"
        ? status.snapshotDecisions
        : status.sidebandDecisions;
    bucket.total += 1;
    bucket.latest = decision;
    const postedMessage = typeof decisionRecord["postedMessage"] === "string"
        ? decisionRecord["postedMessage"]
        : "unknown";
    bucket.postedMessages[postedMessage] =
        (bucket.postedMessages[postedMessage] ?? 0) + 1;
    const reasons = Array.isArray(decisionRecord["postMessageReasons"])
        ? decisionRecord["postMessageReasons"]
        : [];
    if (reasons.length === 0) {
        bucket.postMessageReasons.none = (bucket.postMessageReasons.none ?? 0) + 1;
        return;
    }
    for (const reason of reasons) {
        const key = typeof reason === "string" ? reason : "unknown";
        bucket.postMessageReasons[key] = (bucket.postMessageReasons[key] ?? 0) + 1;
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function readRecord(value) {
    return isRecord(value) ? value : null;
}
function readFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function readTransport(value) {
    return value === "shared-array-buffer" || value === "transferable"
        ? value
        : null;
}
function nowMilliseconds() {
    return typeof performance === "undefined" ||
        typeof performance.now !== "function"
        ? Date.now()
        : performance.now();
}
//# sourceMappingURL=assets.js.map