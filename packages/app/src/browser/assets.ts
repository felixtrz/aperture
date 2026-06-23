import {
  type SimulationWorker,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import type { AssetRegistry } from "@aperture-engine/simulation";
import { mirrorSourceAssetRegistryFromMessage } from "../asset-mirror.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import type {
  GeneratedBrowserAppStatus,
  GeneratedBrowserWorkerMessageStatus,
  GeneratedBrowserPerformanceStatus,
  GeneratedBrowserPerformanceTimingStats,
} from "./status.js";

export function mirrorSimulationWorkerSourceAssets(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  status: GeneratedBrowserAppStatus,
  options: MirrorSimulationWorkerSourceAssetsOptions = {},
): SimulationWorker {
  const performanceState = createGeneratedBrowserPerformanceState(
    options.performanceStatusIntervalMilliseconds,
  );
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
      return worker.onSnapshot((event: SimulationWorkerSnapshotEvent) => {
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
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastFailure = createApertureGeneratedDiagnosticsStatus({
          status: "failed",
          diagnostics: event.diagnostics ?? [
            {
              code: event.reason,
              severity: "error",
              message: event.message,
              worker: event.source,
              suggestedFix:
                "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
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

export interface MirrorSimulationWorkerSourceAssetsOptions {
  readonly performanceStatusIntervalMilliseconds?: number;
}

interface GeneratedBrowserPerformanceState {
  readonly sampleWindow: number;
  readonly statusIntervalMilliseconds: number;
  latest: GeneratedBrowserPerformanceStatus["latest"];
  lastPublishedStatusMilliseconds: number | null;
  cachedStatus: GeneratedBrowserPerformanceStatus | null;
  readonly publish: Map<string, TimingSampleState>;
  readonly step: Map<string, TimingSampleState>;
  readonly lowLevel: Map<string, TimingSampleState>;
}

interface TimingSampleState {
  readonly values: number[];
  total: number;
  latest: number | null;
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
] as const;

const STEP_TIMING_FIELDS = [
  "totalMilliseconds",
  "preStepResolveSpatialMilliseconds",
  "inputEffectsMilliseconds",
  "lowLevelStepMilliseconds",
  "updateEffectsMilliseconds",
  "postStepSpatialMilliseconds",
  "interactionMilliseconds",
  "postUpdateEffectsMilliseconds",
] as const;

const LOW_LEVEL_TIMING_FIELDS = [
  "totalMilliseconds",
  "worldUpdateMilliseconds",
  "animationMilliseconds",
  "fixedStepMilliseconds",
  "transformMilliseconds",
  "skeletonMilliseconds",
] as const;

function mirrorWorkerMessage(options: {
  readonly message: unknown;
  readonly sourceAssets: AssetRegistry;
  readonly status: GeneratedBrowserAppStatus;
  readonly performanceState: GeneratedBrowserPerformanceState;
  readonly decisionBucket: "snapshot" | "sideband";
}): void {
  const mirror = mirrorSourceAssetRegistryFromMessage(
    options.sourceAssets,
    options.message,
  );
  options.status.mirroredSourceAssets += mirror.mirrored;
  options.status.skippedSourceAssets += mirror.skipped;

  const workerSummary = readWorkerSummary(options.message);
  if (workerSummary !== null) {
    options.status.lastWorkerSummary = mergeWorkerSummary(
      options.status.lastWorkerSummary,
      workerSummary,
    );
  }
  recordWorkerPostMessageDecision(
    options.status.workerMessages,
    readPostMessageDecision(options.message, workerSummary),
    options.decisionBucket,
  );
  const performanceStatus = updateGeneratedBrowserPerformanceStatus(
    options.performanceState,
    workerSummary,
  );
  if (performanceStatus !== undefined) {
    options.status.performance = performanceStatus;
  }
}

function readWorkerSummary(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? ((message as { readonly workerSummary?: unknown }).workerSummary ?? null)
    : null;
}

function readPostMessageDecision(
  message: unknown,
  workerSummary: unknown,
): unknown {
  const messageDecision = readRecord(message)?.["postMessageDecision"];

  return messageDecision ?? readRecord(workerSummary)?.["postMessageDecision"];
}

// Fields that only appear on full-cadence summaries and should NOT be retained
// from a previous full summary once a lite summary arrives without them.
// `resources` and `physics` are intentionally excluded so they stay readable
// every frame (e.g. for a signals/resources-driven HUD); the `summaryCadence.full`
// flag still tells consumers when those values were last refreshed (see GH #29).
const TRANSIENT_FULL_WORKER_SUMMARY_FIELDS = [
  "startOptions",
  "assets",
  "entities",
] as const;

function createGeneratedBrowserPerformanceState(
  intervalMilliseconds: unknown,
): GeneratedBrowserPerformanceState {
  return {
    sampleWindow: PERFORMANCE_SAMPLE_WINDOW,
    statusIntervalMilliseconds:
      normalizePerformanceStatusInterval(intervalMilliseconds),
    latest: null,
    lastPublishedStatusMilliseconds: null,
    cachedStatus: null,
    publish: new Map(),
    step: new Map(),
    lowLevel: new Map(),
  };
}

function updateGeneratedBrowserPerformanceStatus(
  state: GeneratedBrowserPerformanceState,
  workerSummary: unknown,
): GeneratedBrowserPerformanceStatus | undefined {
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
  const preStepWorldChanged =
    stepTiming?.["preStepWorldChanged"] === true ? true : false;

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

function publishPerformanceStatusIfDue(
  state: GeneratedBrowserPerformanceState,
): GeneratedBrowserPerformanceStatus | undefined {
  if (state.latest === null) {
    return undefined;
  }

  const now = nowMilliseconds();
  if (
    state.cachedStatus !== null &&
    state.lastPublishedStatusMilliseconds !== null &&
    now - state.lastPublishedStatusMilliseconds <
      state.statusIntervalMilliseconds
  ) {
    return undefined;
  }

  state.cachedStatus = performanceStatusFromState(state);
  state.lastPublishedStatusMilliseconds = now;
  return state.cachedStatus;
}

function performanceStatusFromState(
  state: GeneratedBrowserPerformanceState,
): GeneratedBrowserPerformanceStatus {
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

function normalizePerformanceStatusInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS;
  }

  return Math.max(
    MIN_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS,
    Math.floor(value),
  );
}

function numericFields(
  record: Readonly<Record<string, unknown>> | null,
  fields: readonly string[],
): Record<string, number> {
  const output: Record<string, number> = {};

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

function recordTimingGroup(
  target: Map<string, TimingSampleState>,
  sampleWindow: number,
  values: Readonly<Record<string, number>>,
): void {
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

function timingSampleStateFor(
  target: Map<string, TimingSampleState>,
  key: string,
): TimingSampleState {
  const existing = target.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const next: TimingSampleState = {
    values: [],
    total: 0,
    latest: null,
  };

  target.set(key, next);
  return next;
}

function timingStatsRecord(
  values: ReadonlyMap<string, TimingSampleState>,
): Record<string, GeneratedBrowserPerformanceTimingStats> {
  const output: Record<string, GeneratedBrowserPerformanceTimingStats> = {};

  for (const [key, state] of values) {
    output[key] = timingStats(state);
  }

  return output;
}

function timingStats(
  state: TimingSampleState,
): GeneratedBrowserPerformanceTimingStats {
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

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) {
    return null;
  }

  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );

  return sorted[index] ?? null;
}

function mergeWorkerSummary(previous: unknown, next: unknown): unknown {
  if (!isRecord(next)) {
    return next;
  }

  if (!isRecord(previous)) {
    return next;
  }

  const merged: Record<string, unknown> = {
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

function recordWorkerPostMessageDecision(
  status: GeneratedBrowserWorkerMessageStatus,
  decision: unknown,
  bucketName: "snapshot" | "sideband",
): void {
  const decisionRecord = readRecord(decision);
  if (decisionRecord === null) {
    return;
  }

  const bucket =
    bucketName === "snapshot"
      ? status.snapshotDecisions
      : status.sidebandDecisions;
  bucket.total += 1;
  bucket.latest = decision;

  const postedMessage =
    typeof decisionRecord["postedMessage"] === "string"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readTransport(
  value: unknown,
): "shared-array-buffer" | "transferable" | null {
  return value === "shared-array-buffer" || value === "transferable"
    ? value
    : null;
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ||
    typeof performance.now !== "function"
    ? Date.now()
    : performance.now();
}
