import {
  SIMULATION_WORKER_PROTOCOL,
  createSharedSnapshotTransportViews,
  renderSnapshotTransferList,
  type SimulationMessagePort,
  type SharedSnapshotTransport,
  type SharedSnapshotTransportBuffers,
} from "@aperture-engine/runtime";
import {
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  type RenderSnapshot,
  type SnapshotPacketEncodingRegistry,
} from "@aperture-engine/render";
import {
  commitSerializedSourceAssets,
  serializeSourceAssetRegistry,
  type SerializedSourceAssetRegistry,
  type SourceAssetSerializationState,
} from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import {
  advanceGeneratedInputFrame,
  createInputSummary,
  drainGeneratedInputEventMessagesForFrame,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { createSignalSummary } from "../systems.js";
import type { ApertureApp } from "../advanced.js";
import { createAssetSummary } from "./assets.js";
import type { GeneratedEntityToolBridge } from "./devtools/entities.js";

export interface GeneratedWorkerSnapshotPublishReport {
  readonly nextFrame: number;
  readonly step: ReturnType<ApertureApp["step"]>;
  readonly timing: GeneratedWorkerSnapshotPublishTiming;
}

export interface GeneratedWorkerSnapshotPublishTiming {
  readonly frame: number;
  readonly transport: "shared-array-buffer" | "transferable";
  readonly postedMessage: GeneratedWorkerPostMessageKind;
  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
  readonly totalMilliseconds: number;
  readonly inputMilliseconds: number;
  readonly stepMilliseconds: number;
  readonly extractMilliseconds: number;
  readonly sourceAssetsMilliseconds: number;
  readonly summaryMilliseconds: number;
  readonly transportMilliseconds: number;
  readonly postMessageMilliseconds: number;
  readonly commitMilliseconds: number;
  readonly stepTiming: ReturnType<ApertureApp["step"]>["timing"];
}

export type GeneratedWorkerPostMessageKind =
  | "snapshot"
  | "audioSnapshot"
  | "sourceAssets"
  | "none"
  | "transferableSnapshot";

export type GeneratedWorkerPostMessageReason =
  | "sharedInitial"
  | "sharedRegistryChanged"
  | "sourceAssetsChanged"
  | "snapshotDiagnostics"
  | "fullSummary"
  | "sharedHeartbeat"
  | "sharedAudio"
  | "transferableSnapshot";

export interface GeneratedWorkerPostMessageDecision {
  readonly frame: number;
  readonly postedMessage: GeneratedWorkerPostMessageKind;
  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
  readonly sourceAssetChanges?: {
    readonly count: number;
    readonly samples: readonly {
      readonly kind: string;
      readonly id: string;
      readonly label: string;
      readonly status: string;
      readonly version: number;
    }[];
  };
}

interface GeneratedWorkerSummaryOptions {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly frame: number;
  readonly time: number;
  readonly summaryCadence?: GeneratedWorkerSummaryCadence;
  readonly previousPublishTiming?: GeneratedWorkerSnapshotPublishTiming | null;
}

export type GeneratedWorkerSnapshotTransport =
  | {
      readonly mode: "transferable";
    }
  | {
      readonly mode: "shared-array-buffer";
      readonly shared: SharedSnapshotTransport;
      readonly registry: SnapshotPacketEncodingRegistry;
      readonly sharedSnapshotMessageIntervalMilliseconds: number | null;
      readonly audioSnapshotMessageIntervalMilliseconds: number | null;
      readonly sourceAssetsMessageIntervalMilliseconds: number | null;
      lastPostedMessageTimeMilliseconds: number | null;
      lastPostedAudioMessageTimeMilliseconds: number | null;
      lastPostedSourceAssetsMessageTimeMilliseconds: number | null;
      lastPostedRegistryHandles: number;
      lastPostedRegistryStrings: number;
    };

export interface GeneratedWorkerSummaryCadence {
  readonly intervalMilliseconds: number;
  shouldPublishFull(frame: number, timeSeconds: number): boolean;
}

export interface GeneratedWorkerSummaryCadenceOptions {
  readonly intervalMilliseconds?: number;
}

export const DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 500;
export const DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ = 30;
export const DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ = 60;
export const DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ = 15;
const MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 16;
const MAX_GENERATED_WORKER_SIDE_BAND_MESSAGE_RATE_HZ = 240;

export function createGeneratedWorkerSummaryCadence(
  options: GeneratedWorkerSummaryCadenceOptions = {},
): GeneratedWorkerSummaryCadence {
  const intervalMilliseconds =
    normalizeGeneratedWorkerFullSummaryIntervalMilliseconds(
      options.intervalMilliseconds,
    );
  let lastFullSummaryTimeMilliseconds: number | null = null;

  return {
    intervalMilliseconds,
    shouldPublishFull(frame, timeSeconds) {
      const timeMilliseconds = Math.max(0, timeSeconds * 1000);

      if (
        frame === 0 ||
        lastFullSummaryTimeMilliseconds === null ||
        timeMilliseconds < lastFullSummaryTimeMilliseconds ||
        timeMilliseconds - lastFullSummaryTimeMilliseconds >=
          intervalMilliseconds
      ) {
        lastFullSummaryTimeMilliseconds = timeMilliseconds;
        return true;
      }

      return false;
    },
  };
}

export function createGeneratedWorkerSnapshotTransport(
  start: Record<string, unknown>,
): GeneratedWorkerSnapshotTransport {
  const transport = readSharedSnapshotTransportBuffers(start["transport"]);

  if (transport === null) {
    return { mode: "transferable" };
  }

  return {
    mode: "shared-array-buffer",
    shared: createSharedSnapshotTransportViews(transport),
    registry: createSnapshotPacketRegistry(),
    sharedSnapshotMessageIntervalMilliseconds:
      readGeneratedWorkerMessageIntervalMilliseconds(
        start["sharedSnapshotMessageRateHz"],
        DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ,
      ),
    audioSnapshotMessageIntervalMilliseconds:
      readGeneratedWorkerMessageIntervalMilliseconds(
        start["audioSnapshotMessageRateHz"],
        DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ,
      ),
    sourceAssetsMessageIntervalMilliseconds:
      readGeneratedWorkerMessageIntervalMilliseconds(
        start["sourceAssetsMessageRateHz"],
        DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ,
      ),
    lastPostedMessageTimeMilliseconds: null,
    lastPostedAudioMessageTimeMilliseconds: null,
    lastPostedSourceAssetsMessageTimeMilliseconds: null,
    lastPostedRegistryHandles: 0,
    lastPostedRegistryStrings: 0,
  };
}

export function publishGeneratedWorkerSnapshot(options: {
  readonly app: ApertureApp;
  readonly config: ApertureConfig;
  readonly port: SimulationMessagePort;
  readonly transport: GeneratedWorkerSnapshotTransport;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
  readonly immediateInputEvents?: readonly ApertureGeneratedInputEvent[];
  readonly sourceAssetState: SourceAssetSerializationState;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly summaryCadence?: GeneratedWorkerSummaryCadence;
  readonly delta: number;
  readonly time: number;
  readonly frame: number;
  readonly previousPublishTiming?: GeneratedWorkerSnapshotPublishTiming | null;
}): GeneratedWorkerSnapshotPublishReport {
  const timingStartedAt = nowMilliseconds();
  let timingCursor = timingStartedAt;
  const markTiming = (): number => {
    const now = nowMilliseconds();
    const milliseconds = Math.max(0, now - timingCursor);

    timingCursor = now;
    return milliseconds;
  };

  // Deterministic per-frame drain (AI-56 frame-stamping half): unstamped live
  // events apply now; frame-stamped events apply at exactly their frame, so a
  // recorded sequence replays identically.
  const drainedInputEvents = drainGeneratedInputEventMessagesForFrame(
    options.pendingInput,
    options.frame,
  );
  const inputEvents =
    options.immediateInputEvents === undefined ||
    options.immediateInputEvents.length === 0
      ? drainedInputEvents
      : [...drainedInputEvents, ...options.immediateInputEvents];

  advanceGeneratedInputFrame({
    signals: options.app.context.input,
    config: options.config,
    events: inputEvents,
  });
  const inputMilliseconds = markTiming();
  const step = options.app.step(options.delta, options.time);
  const stepMilliseconds = markTiming();
  const snapshot = options.app.extract(options.frame);
  const extractMilliseconds = markTiming();
  const sourceAssets = serializeSourceAssetRegistry(
    options.app.lowLevel.assets,
    {
      state: options.sourceAssetState,
    },
  );
  const sourceAssetsMilliseconds = markTiming();
  // The source-asset registry is version-gated, so steady-state frames produce
  // zero entries. Only attach the field when something actually changed —
  // mirrorSourceAssetRegistryFromMessage treats an absent field as a no-op, so
  // this drops a per-frame postMessage payload on both transport paths (AI-70).
  const sourceAssetsMessage =
    sourceAssets.entries.length > 0 ? { sourceAssets } : {};
  const workerSummary = createGeneratedWorkerSummary(options);
  const summaryMilliseconds = markTiming();
  const sharedSnapshot = createSharedSnapshotMessage(
    options.transport,
    snapshot,
  );
  const transportMilliseconds = markTiming();
  const transportMode =
    sharedSnapshot === null ? "transferable" : "shared-array-buffer";
  const sourceAssetsChanged = sourceAssets.entries.length > 0;

  const sharedSnapshotPostReasons =
    sharedSnapshot === null
      ? []
      : collectSharedSnapshotPostReasons({
          transport: options.transport,
          sharedSnapshot,
          workerSummary,
          snapshot,
          nowMilliseconds: timingStartedAt,
        });
  const shouldPostSharedAudioSnapshot =
    sharedSnapshot !== null &&
    sharedSnapshotPostReasons.length === 0 &&
    shouldPostSharedAudioSnapshotMessage({
      transport: options.transport,
      snapshot,
      nowMilliseconds: timingStartedAt,
    });
  const shouldPostSourceAssetsSideband =
    sharedSnapshot !== null &&
    sharedSnapshotPostReasons.length === 0 &&
    sourceAssetsChanged &&
    !shouldPostSharedAudioSnapshot;
  const shouldPostSourceAssetsMessage =
    shouldPostSourceAssetsSideband &&
    shouldPostSharedSourceAssetsMessage({
      transport: options.transport,
      snapshot,
      nowMilliseconds: timingStartedAt,
    });
  const postMessageDecision = createGeneratedWorkerPostMessageDecision({
    frame: options.frame,
    sharedSnapshot,
    sharedSnapshotPostReasons,
    sourceAssetEntries: sourceAssets.entries,
    shouldPostSharedAudioSnapshot,
    shouldPostSourceAssetsSideband: shouldPostSourceAssetsMessage,
  });
  const workerSummaryMessage = {
    ...workerSummary,
    postMessageDecision,
  };

  if (sharedSnapshot !== null && sharedSnapshotPostReasons.length > 0) {
    const placeholder = createSharedSnapshotPlaceholder(snapshot);
    const transfer =
      placeholder.transforms.byteLength === 0
        ? []
        : [placeholder.transforms.buffer as ArrayBuffer];

    options.port.postMessage(
      {
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot: placeholder,
        ...sourceAssetsMessage,
        workerSummary: workerSummaryMessage,
        frame: options.frame,
        transport: sharedSnapshot.message,
      },
      transfer,
    );
    markSharedSnapshotMessagePosted(
      options.transport,
      sharedSnapshot,
      timingStartedAt,
    );
    markSharedSnapshotAudioMessagePosted(
      options.transport,
      snapshot,
      timingStartedAt,
    );
    markSharedSnapshotSourceAssetsMessagePosted(
      options.transport,
      sourceAssetsChanged,
      timingStartedAt,
    );
  } else if (sharedSnapshot !== null && shouldPostSharedAudioSnapshot) {
    const placeholder = createSharedSnapshotPlaceholder(snapshot);
    const transfer =
      placeholder.transforms.byteLength === 0
        ? []
        : [placeholder.transforms.buffer as ArrayBuffer];

    options.port.postMessage(
      {
        type: SIMULATION_WORKER_PROTOCOL.audioSnapshot,
        snapshot: placeholder,
        ...sourceAssetsMessage,
        workerSummary: workerSummaryMessage,
        frame: options.frame,
      },
      transfer,
    );
    markSharedSnapshotAudioMessagePosted(
      options.transport,
      snapshot,
      timingStartedAt,
    );
    markSharedSnapshotSourceAssetsMessagePosted(
      options.transport,
      sourceAssetsChanged,
      timingStartedAt,
    );
  } else if (shouldPostSourceAssetsMessage) {
    options.port.postMessage({
      type: SIMULATION_WORKER_PROTOCOL.sourceAssets,
      ...sourceAssetsMessage,
      postMessageDecision,
      frame: options.frame,
    });
    markSharedSnapshotSourceAssetsMessagePosted(
      options.transport,
      sourceAssetsChanged,
      timingStartedAt,
    );
  } else if (sharedSnapshot === null) {
    options.port.postMessage(
      {
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot,
        ...sourceAssetsMessage,
        workerSummary: workerSummaryMessage,
        frame: options.frame,
      },
      renderSnapshotTransferList(snapshot),
    );
  }
  const postMessageMilliseconds = markTiming();

  // Commit only after postMessage returned: if posting threw (for example a
  // structured-clone failure on an asset payload), the uncommitted versions
  // stay eligible and the entries are re-sent with the next snapshot.
  if (
    !sourceAssetsChanged ||
    postMessageDecision.postMessageReasons.includes("sourceAssetsChanged")
  ) {
    commitSerializedSourceAssets(options.sourceAssetState, sourceAssets);
  }
  const commitMilliseconds = markTiming();
  const timing: GeneratedWorkerSnapshotPublishTiming = {
    frame: options.frame,
    transport: transportMode,
    postedMessage: postMessageDecision.postedMessage,
    postMessageReasons: postMessageDecision.postMessageReasons,
    totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
    inputMilliseconds,
    stepMilliseconds,
    extractMilliseconds,
    sourceAssetsMilliseconds,
    summaryMilliseconds,
    transportMilliseconds,
    postMessageMilliseconds,
    commitMilliseconds,
    stepTiming: step.timing,
  };

  return {
    nextFrame: options.frame + 1,
    step,
    timing,
  };
}

function createGeneratedWorkerSummary(options: GeneratedWorkerSummaryOptions) {
  const full =
    options.summaryCadence?.shouldPublishFull(options.frame, options.time) ??
    options.frame === 0;
  const summary = {
    signals: createSignalSummary(options.app.context.signals),
    input: createInputSummary(options.app.context.input),
    commands: options.app.context.commands.summary(),
    diagnostics: options.app.context.diagnostics.list(),
    particles: options.app.context.particles.summary(),
    ...(options.previousPublishTiming === undefined ||
    options.previousPublishTiming === null
      ? {}
      : { previousPublishTiming: options.previousPublishTiming }),
    summaryCadence: {
      frame: options.frame,
      full,
      fullSummaryIntervalMilliseconds:
        options.summaryCadence?.intervalMilliseconds ??
        DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS,
      entitySummary: "on-demand",
    },
  };

  if (!full) {
    return summary;
  }

  return {
    ...summary,
    resources: options.app.context.resources.summary(),
    startOptions: options.app.context.startOptions.summary(),
    assets: createAssetSummary(options.app.context.assets.list()),
    physics: options.app.context.physics.summary(),
    entityTools: options.entityTools.summary(),
  };
}

function normalizeGeneratedWorkerFullSummaryIntervalMilliseconds(
  value: unknown,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS;
  }

  return Math.max(
    MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS,
    Math.floor(value),
  );
}

function createSharedSnapshotMessage(
  transport: GeneratedWorkerSnapshotTransport,
  snapshot: RenderSnapshot,
): {
  readonly message: {
    readonly mode: "shared-array-buffer";
    readonly registry: ReturnType<SnapshotPacketEncodingRegistry["snapshot"]>;
    readonly diagnostics: RenderSnapshot["diagnostics"];
  };
  readonly registryChanged: boolean;
} | null {
  if (
    transport.mode !== "shared-array-buffer" ||
    hasUnsupportedSharedSnapshotPayload(snapshot)
  ) {
    return null;
  }

  try {
    const encoded = encodeSnapshotPackets(snapshot, {
      registry: transport.registry,
    });

    transport.shared.writer.writeFrame({
      frame: snapshot.frame,
      ...(snapshot.time === undefined ? {} : { time: snapshot.time }),
      transforms: snapshot.transforms,
      ...(snapshot.instanceTints === undefined
        ? {}
        : { instanceTints: snapshot.instanceTints }),
      viewMatrices: snapshot.viewMatrices,
      ...(snapshot.quads === undefined
        ? {}
        : {
            quadInstanceFloats: snapshot.quads.instanceFloats,
            quadInstanceWords: snapshot.quads.instanceWords,
          }),
      packetWords: encoded.words,
    });

    const registry = transport.registry.snapshot();

    return {
      message: {
        mode: "shared-array-buffer",
        registry,
        diagnostics: snapshot.diagnostics,
      },
      registryChanged:
        registry.strings.length !== transport.lastPostedRegistryStrings ||
        registry.handles.length !== transport.lastPostedRegistryHandles,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

function collectSharedSnapshotPostReasons(options: {
  readonly transport: GeneratedWorkerSnapshotTransport;
  readonly sharedSnapshot: NonNullable<
    ReturnType<typeof createSharedSnapshotMessage>
  >;
  readonly workerSummary: ReturnType<typeof createGeneratedWorkerSummary>;
  readonly snapshot: RenderSnapshot;
  readonly nowMilliseconds: number;
}): readonly GeneratedWorkerPostMessageReason[] {
  if (options.transport.mode !== "shared-array-buffer") {
    return ["transferableSnapshot"];
  }

  const lastPostedMessageTimeMilliseconds =
    options.transport.lastPostedMessageTimeMilliseconds;
  const reasons: GeneratedWorkerPostMessageReason[] = [];
  if (lastPostedMessageTimeMilliseconds === null) {
    reasons.push("sharedInitial");
  }
  if (options.sharedSnapshot.registryChanged) {
    reasons.push("sharedRegistryChanged");
  }
  if (options.snapshot.diagnostics.length > 0) {
    reasons.push("snapshotDiagnostics");
  }
  if (readWorkerSummaryFullFlag(options.workerSummary)) {
    reasons.push("fullSummary");
  }

  if (
    lastPostedMessageTimeMilliseconds !== null &&
    options.transport.sharedSnapshotMessageIntervalMilliseconds !== null &&
    reasons.length === 0 &&
    options.nowMilliseconds - lastPostedMessageTimeMilliseconds >=
      options.transport.sharedSnapshotMessageIntervalMilliseconds
  ) {
    reasons.push("sharedHeartbeat");
  }

  return reasons;
}

function createGeneratedWorkerPostMessageDecision(options: {
  readonly frame: number;
  readonly sharedSnapshot: ReturnType<typeof createSharedSnapshotMessage>;
  readonly sharedSnapshotPostReasons: readonly GeneratedWorkerPostMessageReason[];
  readonly sourceAssetEntries: SerializedSourceAssetRegistry["entries"];
  readonly shouldPostSharedAudioSnapshot: boolean;
  readonly shouldPostSourceAssetsSideband: boolean;
}): GeneratedWorkerPostMessageDecision {
  const sourceAssetChanges = createSourceAssetChangeDecisionSummary(
    options.sourceAssetEntries,
  );

  if (options.sharedSnapshot === null) {
    return {
      frame: options.frame,
      postedMessage: "transferableSnapshot",
      postMessageReasons: withSourceAssetReason(
        ["transferableSnapshot"],
        options.sourceAssetEntries,
      ),
      ...sourceAssetChanges,
    };
  }

  if (options.sharedSnapshotPostReasons.length > 0) {
    return {
      frame: options.frame,
      postedMessage: "snapshot",
      postMessageReasons: withSourceAssetReason(
        options.sharedSnapshotPostReasons,
        options.sourceAssetEntries,
      ),
      ...sourceAssetChanges,
    };
  }

  if (options.shouldPostSharedAudioSnapshot) {
    return {
      frame: options.frame,
      postedMessage: "audioSnapshot",
      postMessageReasons: withSourceAssetReason(
        ["sharedAudio"],
        options.sourceAssetEntries,
      ),
      ...sourceAssetChanges,
    };
  }

  if (options.shouldPostSourceAssetsSideband) {
    return {
      frame: options.frame,
      postedMessage: "sourceAssets",
      postMessageReasons: ["sourceAssetsChanged"],
      ...sourceAssetChanges,
    };
  }

  return {
    frame: options.frame,
    postedMessage: "none",
    postMessageReasons: [],
    ...sourceAssetChanges,
  };
}

function withSourceAssetReason(
  reasons: readonly GeneratedWorkerPostMessageReason[],
  sourceAssetEntries: SerializedSourceAssetRegistry["entries"],
): readonly GeneratedWorkerPostMessageReason[] {
  return sourceAssetEntries.length === 0
    ? reasons
    : [...reasons, "sourceAssetsChanged"];
}

function createSourceAssetChangeDecisionSummary(
  entries: SerializedSourceAssetRegistry["entries"],
): Pick<GeneratedWorkerPostMessageDecision, "sourceAssetChanges"> {
  if (entries.length === 0) {
    return {};
  }

  return {
    sourceAssetChanges: {
      count: entries.length,
      samples: entries.slice(0, 12).map((entry) => ({
        kind: entry.handle.kind,
        id: entry.handle.id,
        label: entry.label,
        status: entry.status,
        version: entry.version,
      })),
    },
  };
}

function shouldPostSharedAudioSnapshotMessage(options: {
  readonly transport: GeneratedWorkerSnapshotTransport;
  readonly snapshot: RenderSnapshot;
  readonly nowMilliseconds: number;
}): boolean {
  if (
    options.transport.mode !== "shared-array-buffer" ||
    options.transport.audioSnapshotMessageIntervalMilliseconds === null ||
    !hasSharedSnapshotAudioSideband(options.snapshot)
  ) {
    return false;
  }

  return (
    options.transport.lastPostedAudioMessageTimeMilliseconds === null ||
    options.nowMilliseconds -
      options.transport.lastPostedAudioMessageTimeMilliseconds >=
      options.transport.audioSnapshotMessageIntervalMilliseconds
  );
}

function shouldPostSharedSourceAssetsMessage(options: {
  readonly transport: GeneratedWorkerSnapshotTransport;
  readonly snapshot: RenderSnapshot;
  readonly nowMilliseconds: number;
}): boolean {
  if (
    options.transport.mode !== "shared-array-buffer" ||
    options.transport.sourceAssetsMessageIntervalMilliseconds === null
  ) {
    return false;
  }

  if (
    options.transport.audioSnapshotMessageIntervalMilliseconds !== null &&
    hasSharedSnapshotAudioSideband(options.snapshot)
  ) {
    return false;
  }

  return (
    options.transport.lastPostedSourceAssetsMessageTimeMilliseconds === null ||
    options.nowMilliseconds -
      options.transport.lastPostedSourceAssetsMessageTimeMilliseconds >=
      options.transport.sourceAssetsMessageIntervalMilliseconds
  );
}

function readGeneratedWorkerMessageIntervalMilliseconds(
  value: unknown,
  defaultRateHz: number,
): number | null {
  const rateHz = readGeneratedWorkerMessageRateHz(value, defaultRateHz);

  return rateHz === null ? null : 1000 / rateHz;
}

function readGeneratedWorkerMessageRateHz(
  value: unknown,
  defaultRateHz: number,
): number | null {
  if (value === undefined || value === null || value === "") {
    return defaultRateHz;
  }

  if (value === false) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "0" ||
      normalized === "false" ||
      normalized === "off" ||
      normalized === "none" ||
      normalized === "disabled"
    ) {
      return null;
    }

    const parsed = Number(normalized);

    return Number.isFinite(parsed)
      ? normalizeGeneratedWorkerMessageRateHz(parsed, defaultRateHz)
      : defaultRateHz;
  }

  if (typeof value === "number") {
    return normalizeGeneratedWorkerMessageRateHz(value, defaultRateHz);
  }

  return defaultRateHz;
}

function normalizeGeneratedWorkerMessageRateHz(
  value: number,
  defaultRateHz: number,
): number | null {
  if (!Number.isFinite(value)) {
    return defaultRateHz;
  }

  if (value <= 0) {
    return null;
  }

  return Math.min(
    MAX_GENERATED_WORKER_SIDE_BAND_MESSAGE_RATE_HZ,
    Math.max(1, value),
  );
}

function markSharedSnapshotMessagePosted(
  transport: GeneratedWorkerSnapshotTransport,
  sharedSnapshot: NonNullable<ReturnType<typeof createSharedSnapshotMessage>>,
  nowMilliseconds: number,
): void {
  if (transport.mode !== "shared-array-buffer") {
    return;
  }

  transport.lastPostedMessageTimeMilliseconds = nowMilliseconds;
  transport.lastPostedRegistryStrings =
    sharedSnapshot.message.registry.strings.length;
  transport.lastPostedRegistryHandles =
    sharedSnapshot.message.registry.handles.length;
}

function markSharedSnapshotAudioMessagePosted(
  transport: GeneratedWorkerSnapshotTransport,
  snapshot: RenderSnapshot,
  nowMilliseconds: number,
): void {
  if (
    transport.mode !== "shared-array-buffer" ||
    !hasSharedSnapshotAudioSideband(snapshot)
  ) {
    return;
  }

  transport.lastPostedAudioMessageTimeMilliseconds = nowMilliseconds;
}

function markSharedSnapshotSourceAssetsMessagePosted(
  transport: GeneratedWorkerSnapshotTransport,
  sourceAssetsChanged: boolean,
  nowMilliseconds: number,
): void {
  if (transport.mode !== "shared-array-buffer" || !sourceAssetsChanged) {
    return;
  }

  transport.lastPostedSourceAssetsMessageTimeMilliseconds = nowMilliseconds;
}

function readWorkerSummaryFullFlag(
  summary: ReturnType<typeof createGeneratedWorkerSummary>,
): boolean {
  return summary.summaryCadence.full === true;
}

/**
 * True when a snapshot carries packet kinds the SAB packed codec cannot encode
 * (sprites, UI, skyboxes, skinning/morph buffers). Such a frame falls back to
 * the transferable path, preserving every packet.
 *
 * Audio packets are part of the SAB packet stream; the placeholder sideband
 * remains as a compatibility/fallback path for callers that still subscribe to
 * worker audio messages directly.
 * Exported for the transport-fallback test (AU-2).
 */
export function hasUnsupportedSharedSnapshotPayload(
  snapshot: RenderSnapshot,
): boolean {
  return (
    hasItems(snapshot.spriteDraws) ||
    hasItems(snapshot.uiNodes) ||
    hasItems(snapshot.uiHitRegions) ||
    hasItems(snapshot.skyboxes) ||
    hasItems(snapshot.instanceAttributePackets) ||
    hasBytes(snapshot.bones) ||
    hasBytes(snapshot.morphTargetWeights) ||
    hasBytes(snapshot.morphTargetDeltas) ||
    hasBytes(snapshot.morphInstanceDescriptors) ||
    hasBytes(snapshot.instanceAttributes)
  );
}

export function createSharedSnapshotPlaceholder(
  snapshot: RenderSnapshot,
): RenderSnapshot {
  const audio = createSharedSnapshotAudioSideband(snapshot);

  return {
    frame: snapshot.frame,
    ...(snapshot.time === undefined ? {} : { time: snapshot.time }),
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: audio.transforms,
    viewMatrices: new Float32Array(0),
    diagnostics: snapshot.diagnostics,
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: snapshot.diagnostics.length,
      ...(audio.audioEmitters === undefined
        ? {}
        : { audioEmitters: audio.audioEmitters.length }),
    },
    ...(audio.audioEmitters === undefined
      ? {}
      : { audioEmitters: audio.audioEmitters }),
    ...(audio.audioListener === undefined
      ? {}
      : { audioListener: audio.audioListener }),
  };
}

function createSharedSnapshotAudioSideband(snapshot: RenderSnapshot): {
  readonly transforms: Float32Array;
  readonly audioEmitters?: RenderSnapshot["audioEmitters"];
  readonly audioListener?: RenderSnapshot["audioListener"];
} {
  if (!hasSharedSnapshotAudioSideband(snapshot)) {
    return { transforms: new Float32Array(0) };
  }

  const transforms: number[] = [];
  const offsetMap = new Map<number, number>();
  const copyMatrix = (sourceOffset: number): number => {
    const existing = offsetMap.get(sourceOffset);

    if (existing !== undefined) {
      return existing;
    }

    const targetOffset = transforms.length;
    offsetMap.set(sourceOffset, targetOffset);

    for (let index = 0; index < 16; index += 1) {
      transforms.push(snapshot.transforms[sourceOffset + index] ?? 0);
    }

    return targetOffset;
  };

  const audioEmitters = snapshot.audioEmitters?.map((packet) => ({
    ...packet,
    worldTransformOffset: copyMatrix(packet.worldTransformOffset),
  }));
  const audioListener =
    snapshot.audioListener === undefined
      ? undefined
      : {
          ...snapshot.audioListener,
          worldTransformOffset: copyMatrix(
            snapshot.audioListener.worldTransformOffset,
          ),
        };

  return {
    transforms: new Float32Array(transforms),
    ...(audioEmitters === undefined ? {} : { audioEmitters }),
    ...(audioListener === undefined ? {} : { audioListener }),
  };
}

function hasSharedSnapshotAudioSideband(snapshot: RenderSnapshot): boolean {
  return (
    hasItems(snapshot.audioEmitters) || snapshot.audioListener !== undefined
  );
}

function readSharedSnapshotTransportBuffers(
  value: unknown,
):
  | (SharedSnapshotTransportBuffers & { readonly mode: "shared-array-buffer" })
  | null {
  if (!isRecord(value) || value["mode"] !== "shared-array-buffer") {
    return null;
  }

  return value as unknown as SharedSnapshotTransportBuffers & {
    readonly mode: "shared-array-buffer";
  };
}

function hasItems(value: readonly unknown[] | undefined): boolean {
  return value !== undefined && value.length > 0;
}

function hasBytes(value: ArrayBufferView | undefined): boolean {
  return value !== undefined && value.byteLength > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowMilliseconds(): number {
  const clock = globalThis.performance;

  return clock === undefined ? Date.now() : clock.now();
}
