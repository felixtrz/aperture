export const WEBGPU_APP_RENDER_PHASES = [
  "extract",
  "collect",
  "prepare",
  "queue",
  "sort",
  "submit",
] as const;

export type WebGpuAppRenderPhaseName =
  (typeof WEBGPU_APP_RENDER_PHASES)[number];

export const WEBGPU_APP_RENDER_PHASE_DETAILS = [
  "prepareMain",
  "prepareMainMotionVectors",
  "prepareMainViews",
  "prepareMainTransforms",
  "prepareMainPreviousTransforms",
  "prepareMainInstanceTints",
  "prepareMainAreaLights",
  "prepareMainTransmission",
  "prepareMainAutoShadow",
  "prepareMainResources",
  "prepareOverlays",
  "prepareOverlaySprites",
  "prepareOverlayText",
  "prepareOverlayParticles",
  "prepareOverlayUi",
] as const;

export type WebGpuAppRenderPhaseDetailName =
  (typeof WEBGPU_APP_RENDER_PHASE_DETAILS)[number];

export type WebGpuAppRenderPhaseTimingSamples = Partial<
  Record<WebGpuAppRenderPhaseName, number>
>;

export interface WebGpuAppRenderPhaseTimingHistoryEntry {
  readonly phase: WebGpuAppRenderPhaseName;
  readonly latestMilliseconds: number;
  readonly averageMilliseconds: number;
  readonly minimumMilliseconds: number;
  readonly maximumMilliseconds: number;
  readonly sampleCount: number;
}

export interface WebGpuAppRenderPhaseTimingDetailEntry {
  readonly detail: WebGpuAppRenderPhaseDetailName;
  readonly latestMilliseconds: number;
  readonly averageMilliseconds: number;
  readonly minimumMilliseconds: number;
  readonly maximumMilliseconds: number;
  readonly sampleCount: number;
}

export interface WebGpuAppRenderPhaseTimingReport {
  readonly ready: boolean;
  readonly frame: number;
  readonly sampleWindow: number;
  readonly totalMilliseconds: number;
  readonly phases: readonly WebGpuAppRenderPhaseTimingHistoryEntry[];
  readonly details: readonly WebGpuAppRenderPhaseTimingDetailEntry[];
}

export interface WebGpuAppRenderPhaseTimingHistory {
  readonly sampleWindow: number;
  readonly samplesByPhase: ReadonlyMap<WebGpuAppRenderPhaseName, number[]>;
  readonly samplesByDetail: ReadonlyMap<
    WebGpuAppRenderPhaseDetailName,
    number[]
  >;
}

interface MutableWebGpuAppRenderPhaseTimingHistory extends WebGpuAppRenderPhaseTimingHistory {
  readonly samplesByPhase: Map<WebGpuAppRenderPhaseName, number[]>;
  readonly samplesByDetail: Map<WebGpuAppRenderPhaseDetailName, number[]>;
}

export interface WebGpuAppRenderPhaseTimer {
  add(phase: WebGpuAppRenderPhaseName, milliseconds: number): void;
  start(phase: WebGpuAppRenderPhaseName): void;
  finish(phase: WebGpuAppRenderPhaseName): void;
  addDetail(detail: WebGpuAppRenderPhaseDetailName, milliseconds: number): void;
  startDetail(detail: WebGpuAppRenderPhaseDetailName): void;
  finishDetail(detail: WebGpuAppRenderPhaseDetailName): void;
  report(
    history: WebGpuAppRenderPhaseTimingHistory,
    frame: number,
  ): WebGpuAppRenderPhaseTimingReport;
}

export function createWebGpuAppRenderPhaseTimingHistory(
  sampleWindow = 60,
): WebGpuAppRenderPhaseTimingHistory {
  const samplesByPhase = new Map<WebGpuAppRenderPhaseName, number[]>();
  const samplesByDetail = new Map<WebGpuAppRenderPhaseDetailName, number[]>();

  for (const phase of WEBGPU_APP_RENDER_PHASES) {
    samplesByPhase.set(phase, []);
  }

  for (const detail of WEBGPU_APP_RENDER_PHASE_DETAILS) {
    samplesByDetail.set(detail, []);
  }

  return {
    sampleWindow: Math.max(1, Math.floor(sampleWindow)),
    samplesByPhase,
    samplesByDetail,
  };
}

export function createWebGpuAppRenderPhaseTimer(
  externalSamples: WebGpuAppRenderPhaseTimingSamples | undefined,
): WebGpuAppRenderPhaseTimer {
  const samples = new Map<WebGpuAppRenderPhaseName, number>();
  const details = new Map<WebGpuAppRenderPhaseDetailName, number>();
  let activePhase: WebGpuAppRenderPhaseName | null = null;
  let activeStartedAt = 0;
  let activeDetail: WebGpuAppRenderPhaseDetailName | null = null;
  let activeDetailStartedAt = 0;

  for (const phase of WEBGPU_APP_RENDER_PHASES) {
    const sample = externalSamples?.[phase];

    if (isFinitePhaseDuration(sample)) {
      samples.set(phase, sample);
    }
  }

  if (!samples.has("extract")) {
    samples.set("extract", 0);
  }

  return {
    add(phase, milliseconds) {
      if (!isFinitePhaseDuration(milliseconds)) {
        return;
      }

      samples.set(phase, (samples.get(phase) ?? 0) + milliseconds);
    },
    start(phase) {
      activePhase = phase;
      activeStartedAt = nowMilliseconds();
    },
    finish(phase) {
      if (activePhase !== phase) {
        samples.set(phase, samples.get(phase) ?? 0);
        return;
      }

      const elapsed = Math.max(0, nowMilliseconds() - activeStartedAt);

      activePhase = null;
      activeStartedAt = 0;
      samples.set(phase, (samples.get(phase) ?? 0) + elapsed);
    },
    addDetail(detail, milliseconds) {
      if (!isFinitePhaseDuration(milliseconds)) {
        return;
      }

      details.set(detail, (details.get(detail) ?? 0) + milliseconds);
    },
    startDetail(detail) {
      activeDetail = detail;
      activeDetailStartedAt = nowMilliseconds();
    },
    finishDetail(detail) {
      if (activeDetail !== detail) {
        details.set(detail, details.get(detail) ?? 0);
        return;
      }

      const elapsed = Math.max(0, nowMilliseconds() - activeDetailStartedAt);

      activeDetail = null;
      activeDetailStartedAt = 0;
      details.set(detail, (details.get(detail) ?? 0) + elapsed);
    },
    report(history, frame) {
      if (activePhase !== null) {
        const elapsed = Math.max(0, nowMilliseconds() - activeStartedAt);

        samples.set(activePhase, (samples.get(activePhase) ?? 0) + elapsed);
        activePhase = null;
        activeStartedAt = 0;
      }

      if (activeDetail !== null) {
        const elapsed = Math.max(0, nowMilliseconds() - activeDetailStartedAt);

        details.set(activeDetail, (details.get(activeDetail) ?? 0) + elapsed);
        activeDetail = null;
        activeDetailStartedAt = 0;
      }

      for (const phase of WEBGPU_APP_RENDER_PHASES) {
        samples.set(phase, samples.get(phase) ?? 0);
      }

      for (const detail of WEBGPU_APP_RENDER_PHASE_DETAILS) {
        details.set(detail, details.get(detail) ?? 0);
      }

      return recordWebGpuAppRenderPhaseTimingHistory(
        history,
        frame,
        samples,
        details,
      );
    },
  };
}

function recordWebGpuAppRenderPhaseTimingHistory(
  history: WebGpuAppRenderPhaseTimingHistory,
  frame: number,
  samples: ReadonlyMap<WebGpuAppRenderPhaseName, number>,
  details: ReadonlyMap<WebGpuAppRenderPhaseDetailName, number>,
): WebGpuAppRenderPhaseTimingReport {
  const mutableHistory = history as MutableWebGpuAppRenderPhaseTimingHistory;
  const phases: WebGpuAppRenderPhaseTimingHistoryEntry[] = [];
  const detailEntries: WebGpuAppRenderPhaseTimingDetailEntry[] = [];
  let totalMilliseconds = 0;

  for (const phase of WEBGPU_APP_RENDER_PHASES) {
    const latest = samples.get(phase) ?? 0;
    let historySamples = mutableHistory.samplesByPhase.get(phase);

    if (historySamples === undefined) {
      historySamples = [];
      mutableHistory.samplesByPhase.set(phase, historySamples);
    }

    historySamples.push(latest);

    while (historySamples.length > history.sampleWindow) {
      historySamples.shift();
    }

    totalMilliseconds += latest;
    phases.push(createPhaseHistoryEntry(phase, historySamples));
  }

  for (const detail of WEBGPU_APP_RENDER_PHASE_DETAILS) {
    const latest = details.get(detail) ?? 0;
    let historySamples = mutableHistory.samplesByDetail.get(detail);

    if (historySamples === undefined) {
      historySamples = [];
      mutableHistory.samplesByDetail.set(detail, historySamples);
    }

    historySamples.push(latest);

    while (historySamples.length > history.sampleWindow) {
      historySamples.shift();
    }

    detailEntries.push(createDetailHistoryEntry(detail, historySamples));
  }

  return {
    ready: phases.every((phase) => phase.sampleCount > 0),
    frame,
    sampleWindow: history.sampleWindow,
    totalMilliseconds,
    phases,
    details: detailEntries,
  };
}

function createPhaseHistoryEntry(
  phase: WebGpuAppRenderPhaseName,
  samples: readonly number[],
): WebGpuAppRenderPhaseTimingHistoryEntry {
  const latest = samples[samples.length - 1] ?? 0;
  let total = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = 0;

  for (const sample of samples) {
    total += sample;
    minimum = Math.min(minimum, sample);
    maximum = Math.max(maximum, sample);
  }

  return {
    phase,
    latestMilliseconds: latest,
    averageMilliseconds: samples.length === 0 ? 0 : total / samples.length,
    minimumMilliseconds: samples.length === 0 ? 0 : minimum,
    maximumMilliseconds: maximum,
    sampleCount: samples.length,
  };
}

function createDetailHistoryEntry(
  detail: WebGpuAppRenderPhaseDetailName,
  samples: readonly number[],
): WebGpuAppRenderPhaseTimingDetailEntry {
  const entry = createPhaseHistoryEntry("prepare", samples);

  return {
    detail,
    latestMilliseconds: entry.latestMilliseconds,
    averageMilliseconds: entry.averageMilliseconds,
    minimumMilliseconds: entry.minimumMilliseconds,
    maximumMilliseconds: entry.maximumMilliseconds,
    sampleCount: entry.sampleCount,
  };
}

function isFinitePhaseDuration(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nowMilliseconds(): number {
  const clock = globalThis.performance;

  return clock === undefined ? Date.now() : clock.now();
}
