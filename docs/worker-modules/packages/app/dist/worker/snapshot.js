import { SIMULATION_WORKER_PROTOCOL, createSharedSnapshotTransportViews, renderSnapshotTransferList, } from "/aperture/worker-modules/packages/runtime/dist/index.js";
import { createSnapshotPacketRegistry, encodeSnapshotPackets, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { commitSerializedSourceAssets, serializeSourceAssetRegistry, } from "../asset-mirror.js";
import { advanceGeneratedInputFrame, createInputSummary, drainGeneratedInputEventMessagesForFrame, } from "../input.js";
import { createSignalSummary } from "../systems.js";
import { createAssetSummary } from "./assets.js";
export const DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 500;
export const DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ = 30;
export const DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ = 60;
export const DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ = 15;
const MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 16;
const MAX_GENERATED_WORKER_SIDE_BAND_MESSAGE_RATE_HZ = 240;
export function createGeneratedWorkerSummaryCadence(options = {}) {
    const intervalMilliseconds = normalizeGeneratedWorkerFullSummaryIntervalMilliseconds(options.intervalMilliseconds);
    let lastFullSummaryTimeMilliseconds = null;
    return {
        intervalMilliseconds,
        shouldPublishFull(frame, timeSeconds) {
            const timeMilliseconds = Math.max(0, timeSeconds * 1000);
            if (frame === 0 ||
                lastFullSummaryTimeMilliseconds === null ||
                timeMilliseconds < lastFullSummaryTimeMilliseconds ||
                timeMilliseconds - lastFullSummaryTimeMilliseconds >=
                    intervalMilliseconds) {
                lastFullSummaryTimeMilliseconds = timeMilliseconds;
                return true;
            }
            return false;
        },
    };
}
export function createGeneratedWorkerSnapshotTransport(start) {
    const transport = readSharedSnapshotTransportBuffers(start["transport"]);
    if (transport === null) {
        return { mode: "transferable" };
    }
    return {
        mode: "shared-array-buffer",
        shared: createSharedSnapshotTransportViews(transport),
        registry: createSnapshotPacketRegistry(),
        sharedSnapshotMessageIntervalMilliseconds: readGeneratedWorkerMessageIntervalMilliseconds(start["sharedSnapshotMessageRateHz"], DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ),
        audioSnapshotMessageIntervalMilliseconds: readGeneratedWorkerMessageIntervalMilliseconds(start["audioSnapshotMessageRateHz"], DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ),
        sourceAssetsMessageIntervalMilliseconds: readGeneratedWorkerMessageIntervalMilliseconds(start["sourceAssetsMessageRateHz"], DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ),
        lastPostedMessageTimeMilliseconds: null,
        lastPostedAudioMessageTimeMilliseconds: null,
        lastPostedSourceAssetsMessageTimeMilliseconds: null,
        lastPostedRegistryHandles: 0,
        lastPostedRegistryStrings: 0,
    };
}
export function publishGeneratedWorkerSnapshot(options) {
    const timingStartedAt = nowMilliseconds();
    let timingCursor = timingStartedAt;
    const markTiming = () => {
        const now = nowMilliseconds();
        const milliseconds = Math.max(0, now - timingCursor);
        timingCursor = now;
        return milliseconds;
    };
    // Deterministic per-frame drain (AI-56 frame-stamping half): unstamped live
    // events apply now; frame-stamped events apply at exactly their frame, so a
    // recorded sequence replays identically.
    const drainedInputEvents = drainGeneratedInputEventMessagesForFrame(options.pendingInput, options.frame);
    const inputEvents = options.immediateInputEvents === undefined ||
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
    const sourceAssets = serializeSourceAssetRegistry(options.app.lowLevel.assets, {
        state: options.sourceAssetState,
    });
    const sourceAssetsMilliseconds = markTiming();
    // The source-asset registry is version-gated, so steady-state frames produce
    // zero entries. Only attach the field when something actually changed —
    // mirrorSourceAssetRegistryFromMessage treats an absent field as a no-op, so
    // this drops a per-frame postMessage payload on both transport paths (AI-70).
    const sourceAssetsMessage = sourceAssets.entries.length > 0 ? { sourceAssets } : {};
    const workerSummary = createGeneratedWorkerSummary(options);
    const summaryMilliseconds = markTiming();
    const sharedSnapshot = createSharedSnapshotMessage(options.transport, snapshot);
    const transportMilliseconds = markTiming();
    const transportMode = sharedSnapshot === null ? "transferable" : "shared-array-buffer";
    const sourceAssetsChanged = sourceAssets.entries.length > 0;
    const sharedSnapshotPostReasons = sharedSnapshot === null
        ? []
        : collectSharedSnapshotPostReasons({
            transport: options.transport,
            sharedSnapshot,
            workerSummary,
            snapshot,
            nowMilliseconds: timingStartedAt,
        });
    const shouldPostSharedAudioSnapshot = sharedSnapshot !== null &&
        sharedSnapshotPostReasons.length === 0 &&
        shouldPostSharedAudioSnapshotMessage({
            transport: options.transport,
            snapshot,
            nowMilliseconds: timingStartedAt,
        });
    const shouldPostSourceAssetsSideband = sharedSnapshot !== null &&
        sharedSnapshotPostReasons.length === 0 &&
        sourceAssetsChanged &&
        !shouldPostSharedAudioSnapshot;
    const shouldPostSourceAssetsMessage = shouldPostSourceAssetsSideband &&
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
        const transfer = placeholder.transforms.byteLength === 0
            ? []
            : [placeholder.transforms.buffer];
        options.port.postMessage({
            type: SIMULATION_WORKER_PROTOCOL.snapshot,
            snapshot: placeholder,
            ...sourceAssetsMessage,
            workerSummary: workerSummaryMessage,
            frame: options.frame,
            transport: sharedSnapshot.message,
        }, transfer);
        markSharedSnapshotMessagePosted(options.transport, sharedSnapshot, timingStartedAt);
        markSharedSnapshotAudioMessagePosted(options.transport, snapshot, timingStartedAt);
        markSharedSnapshotSourceAssetsMessagePosted(options.transport, sourceAssetsChanged, timingStartedAt);
    }
    else if (sharedSnapshot !== null && shouldPostSharedAudioSnapshot) {
        const placeholder = createSharedSnapshotPlaceholder(snapshot);
        const transfer = placeholder.transforms.byteLength === 0
            ? []
            : [placeholder.transforms.buffer];
        options.port.postMessage({
            type: SIMULATION_WORKER_PROTOCOL.audioSnapshot,
            snapshot: placeholder,
            ...sourceAssetsMessage,
            workerSummary: workerSummaryMessage,
            frame: options.frame,
        }, transfer);
        markSharedSnapshotAudioMessagePosted(options.transport, snapshot, timingStartedAt);
        markSharedSnapshotSourceAssetsMessagePosted(options.transport, sourceAssetsChanged, timingStartedAt);
    }
    else if (shouldPostSourceAssetsMessage) {
        options.port.postMessage({
            type: SIMULATION_WORKER_PROTOCOL.sourceAssets,
            ...sourceAssetsMessage,
            postMessageDecision,
            frame: options.frame,
        });
        markSharedSnapshotSourceAssetsMessagePosted(options.transport, sourceAssetsChanged, timingStartedAt);
    }
    else if (sharedSnapshot === null) {
        options.port.postMessage({
            type: SIMULATION_WORKER_PROTOCOL.snapshot,
            snapshot,
            ...sourceAssetsMessage,
            workerSummary: workerSummaryMessage,
            frame: options.frame,
        }, renderSnapshotTransferList(snapshot));
    }
    const postMessageMilliseconds = markTiming();
    // Commit only after postMessage returned: if posting threw (for example a
    // structured-clone failure on an asset payload), the uncommitted versions
    // stay eligible and the entries are re-sent with the next snapshot.
    if (!sourceAssetsChanged ||
        postMessageDecision.postMessageReasons.includes("sourceAssetsChanged")) {
        commitSerializedSourceAssets(options.sourceAssetState, sourceAssets);
    }
    const commitMilliseconds = markTiming();
    const timing = {
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
function createGeneratedWorkerSummary(options) {
    const full = options.summaryCadence?.shouldPublishFull(options.frame, options.time) ??
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
            fullSummaryIntervalMilliseconds: options.summaryCadence?.intervalMilliseconds ??
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
function normalizeGeneratedWorkerFullSummaryIntervalMilliseconds(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS;
    }
    return Math.max(MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS, Math.floor(value));
}
function createSharedSnapshotMessage(transport, snapshot) {
    if (transport.mode !== "shared-array-buffer" ||
        hasUnsupportedSharedSnapshotPayload(snapshot)) {
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
            registryChanged: registry.strings.length !== transport.lastPostedRegistryStrings ||
                registry.handles.length !== transport.lastPostedRegistryHandles,
        };
    }
    catch (error) {
        if (error instanceof RangeError) {
            return null;
        }
        throw error;
    }
}
function collectSharedSnapshotPostReasons(options) {
    if (options.transport.mode !== "shared-array-buffer") {
        return ["transferableSnapshot"];
    }
    const lastPostedMessageTimeMilliseconds = options.transport.lastPostedMessageTimeMilliseconds;
    const reasons = [];
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
    if (lastPostedMessageTimeMilliseconds !== null &&
        options.transport.sharedSnapshotMessageIntervalMilliseconds !== null &&
        reasons.length === 0 &&
        options.nowMilliseconds - lastPostedMessageTimeMilliseconds >=
            options.transport.sharedSnapshotMessageIntervalMilliseconds) {
        reasons.push("sharedHeartbeat");
    }
    return reasons;
}
function createGeneratedWorkerPostMessageDecision(options) {
    const sourceAssetChanges = createSourceAssetChangeDecisionSummary(options.sourceAssetEntries);
    if (options.sharedSnapshot === null) {
        return {
            frame: options.frame,
            postedMessage: "transferableSnapshot",
            postMessageReasons: withSourceAssetReason(["transferableSnapshot"], options.sourceAssetEntries),
            ...sourceAssetChanges,
        };
    }
    if (options.sharedSnapshotPostReasons.length > 0) {
        return {
            frame: options.frame,
            postedMessage: "snapshot",
            postMessageReasons: withSourceAssetReason(options.sharedSnapshotPostReasons, options.sourceAssetEntries),
            ...sourceAssetChanges,
        };
    }
    if (options.shouldPostSharedAudioSnapshot) {
        return {
            frame: options.frame,
            postedMessage: "audioSnapshot",
            postMessageReasons: withSourceAssetReason(["sharedAudio"], options.sourceAssetEntries),
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
function withSourceAssetReason(reasons, sourceAssetEntries) {
    return sourceAssetEntries.length === 0
        ? reasons
        : [...reasons, "sourceAssetsChanged"];
}
function createSourceAssetChangeDecisionSummary(entries) {
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
function shouldPostSharedAudioSnapshotMessage(options) {
    if (options.transport.mode !== "shared-array-buffer" ||
        options.transport.audioSnapshotMessageIntervalMilliseconds === null ||
        !hasSharedSnapshotAudioSideband(options.snapshot)) {
        return false;
    }
    return (options.transport.lastPostedAudioMessageTimeMilliseconds === null ||
        options.nowMilliseconds -
            options.transport.lastPostedAudioMessageTimeMilliseconds >=
            options.transport.audioSnapshotMessageIntervalMilliseconds);
}
function shouldPostSharedSourceAssetsMessage(options) {
    if (options.transport.mode !== "shared-array-buffer" ||
        options.transport.sourceAssetsMessageIntervalMilliseconds === null) {
        return false;
    }
    if (options.transport.audioSnapshotMessageIntervalMilliseconds !== null &&
        hasSharedSnapshotAudioSideband(options.snapshot)) {
        return false;
    }
    return (options.transport.lastPostedSourceAssetsMessageTimeMilliseconds === null ||
        options.nowMilliseconds -
            options.transport.lastPostedSourceAssetsMessageTimeMilliseconds >=
            options.transport.sourceAssetsMessageIntervalMilliseconds);
}
function readGeneratedWorkerMessageIntervalMilliseconds(value, defaultRateHz) {
    const rateHz = readGeneratedWorkerMessageRateHz(value, defaultRateHz);
    return rateHz === null ? null : 1000 / rateHz;
}
function readGeneratedWorkerMessageRateHz(value, defaultRateHz) {
    if (value === undefined || value === null || value === "") {
        return defaultRateHz;
    }
    if (value === false) {
        return null;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "0" ||
            normalized === "false" ||
            normalized === "off" ||
            normalized === "none" ||
            normalized === "disabled") {
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
function normalizeGeneratedWorkerMessageRateHz(value, defaultRateHz) {
    if (!Number.isFinite(value)) {
        return defaultRateHz;
    }
    if (value <= 0) {
        return null;
    }
    return Math.min(MAX_GENERATED_WORKER_SIDE_BAND_MESSAGE_RATE_HZ, Math.max(1, value));
}
function markSharedSnapshotMessagePosted(transport, sharedSnapshot, nowMilliseconds) {
    if (transport.mode !== "shared-array-buffer") {
        return;
    }
    transport.lastPostedMessageTimeMilliseconds = nowMilliseconds;
    transport.lastPostedRegistryStrings =
        sharedSnapshot.message.registry.strings.length;
    transport.lastPostedRegistryHandles =
        sharedSnapshot.message.registry.handles.length;
}
function markSharedSnapshotAudioMessagePosted(transport, snapshot, nowMilliseconds) {
    if (transport.mode !== "shared-array-buffer" ||
        !hasSharedSnapshotAudioSideband(snapshot)) {
        return;
    }
    transport.lastPostedAudioMessageTimeMilliseconds = nowMilliseconds;
}
function markSharedSnapshotSourceAssetsMessagePosted(transport, sourceAssetsChanged, nowMilliseconds) {
    if (transport.mode !== "shared-array-buffer" || !sourceAssetsChanged) {
        return;
    }
    transport.lastPostedSourceAssetsMessageTimeMilliseconds = nowMilliseconds;
}
function readWorkerSummaryFullFlag(summary) {
    return summary.summaryCadence.full === true;
}
/**
 * True when a snapshot carries packet kinds the SAB packed codec cannot encode
 * (sprites, UI, skyboxes/procedural skies, runtime uniforms,
 * skinning/morph buffers). Such a frame falls back to the transferable path,
 * preserving every packet.
 *
 * Audio packets are part of the SAB packet stream; the placeholder sideband
 * remains as a compatibility/fallback path for callers that still subscribe to
 * worker audio messages directly.
 * Exported for the transport-fallback test (AU-2).
 */
export function hasUnsupportedSharedSnapshotPayload(snapshot) {
    return (hasItems(snapshot.spriteDraws) ||
        hasItems(snapshot.uiNodes) ||
        hasItems(snapshot.uiHitRegions) ||
        hasItems(snapshot.skyboxes) ||
        hasItems(snapshot.proceduralSkies) ||
        hasItems(snapshot.runtimeUniforms) ||
        hasItems(snapshot.instanceAttributePackets) ||
        hasBytes(snapshot.bones) ||
        hasBytes(snapshot.morphTargetWeights) ||
        hasBytes(snapshot.morphTargetDeltas) ||
        hasBytes(snapshot.morphInstanceDescriptors) ||
        hasBytes(snapshot.instanceAttributes));
}
export function createSharedSnapshotPlaceholder(snapshot) {
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
function createSharedSnapshotAudioSideband(snapshot) {
    if (!hasSharedSnapshotAudioSideband(snapshot)) {
        return { transforms: new Float32Array(0) };
    }
    const transforms = [];
    const offsetMap = new Map();
    const copyMatrix = (sourceOffset) => {
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
    const audioListener = snapshot.audioListener === undefined
        ? undefined
        : {
            ...snapshot.audioListener,
            worldTransformOffset: copyMatrix(snapshot.audioListener.worldTransformOffset),
        };
    return {
        transforms: new Float32Array(transforms),
        ...(audioEmitters === undefined ? {} : { audioEmitters }),
        ...(audioListener === undefined ? {} : { audioListener }),
    };
}
function hasSharedSnapshotAudioSideband(snapshot) {
    return (hasItems(snapshot.audioEmitters) || snapshot.audioListener !== undefined);
}
function readSharedSnapshotTransportBuffers(value) {
    if (!isRecord(value) || value["mode"] !== "shared-array-buffer") {
        return null;
    }
    return value;
}
function hasItems(value) {
    return value !== undefined && value.length > 0;
}
function hasBytes(value) {
    return value !== undefined && value.byteLength > 0;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function nowMilliseconds() {
    const clock = globalThis.performance;
    return clock === undefined ? Date.now() : clock.now();
}
//# sourceMappingURL=snapshot.js.map