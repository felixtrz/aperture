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
    };

export interface GeneratedWorkerSummaryCadence {
  readonly intervalMilliseconds: number;
  shouldPublishFull(frame: number, timeSeconds: number): boolean;
}

export interface GeneratedWorkerSummaryCadenceOptions {
  readonly intervalMilliseconds?: number;
}

export const DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 500;
const MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 16;

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

  if (sharedSnapshot !== null) {
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
        workerSummary,
        frame: options.frame,
        transport: sharedSnapshot,
      },
      transfer,
    );
  } else {
    options.port.postMessage(
      {
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot,
        ...sourceAssetsMessage,
        workerSummary,
        frame: options.frame,
      },
      renderSnapshotTransferList(snapshot),
    );
  }
  const postMessageMilliseconds = markTiming();

  // Commit only after postMessage returned: if posting threw (for example a
  // structured-clone failure on an asset payload), the uncommitted versions
  // stay eligible and the entries are re-sent with the next snapshot.
  commitSerializedSourceAssets(options.sourceAssetState, sourceAssets);
  const commitMilliseconds = markTiming();
  const timing: GeneratedWorkerSnapshotPublishTiming = {
    frame: options.frame,
    transport: transportMode,
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
  readonly mode: "shared-array-buffer";
  readonly registry: ReturnType<SnapshotPacketEncodingRegistry["snapshot"]>;
  readonly diagnostics: RenderSnapshot["diagnostics"];
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

    return {
      mode: "shared-array-buffer",
      registry: transport.registry.snapshot(),
      diagnostics: snapshot.diagnostics,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

/**
 * True when a snapshot carries packet kinds the SAB packed codec cannot encode
 * (sprites, UI, skyboxes, skinning/morph buffers). Such a frame falls back to
 * the transferable path, preserving every packet.
 *
 * Audio packets are not render packets; they ride the placeholder snapshot sent
 * alongside a shared render frame so main-thread audio subscribers keep their
 * existing RenderSnapshot contract without forcing render data off SAB.
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
  if (
    !hasItems(snapshot.audioEmitters) &&
    snapshot.audioListener === undefined
  ) {
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
