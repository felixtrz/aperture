import { type SimulationMessagePort, type SharedSnapshotTransport } from "@aperture-engine/runtime";
import { type RenderSnapshot, type SnapshotPacketEncodingRegistry } from "@aperture-engine/render";
import { type SourceAssetSerializationState } from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { type ApertureGeneratedInputEvent, type ApertureGeneratedInputEventMessage } from "../input.js";
import type { ApertureApp } from "../advanced.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";
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
export type GeneratedWorkerPostMessageKind = "snapshot" | "audioSnapshot" | "sourceAssets" | "none" | "transferableSnapshot";
export type GeneratedWorkerPostMessageReason = "sharedInitial" | "sharedRegistryChanged" | "sourceAssetsChanged" | "snapshotDiagnostics" | "fullSummary" | "sharedHeartbeat" | "sharedAudio" | "controlledFrame" | "transferableSnapshot";
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
export type GeneratedWorkerSnapshotTransport = {
    readonly mode: "transferable";
} | {
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
export declare const DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 500;
export declare const DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ = 30;
export declare const DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ = 60;
export declare const DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ = 15;
export declare function createGeneratedWorkerSummaryCadence(options?: GeneratedWorkerSummaryCadenceOptions): GeneratedWorkerSummaryCadence;
export declare function createGeneratedWorkerSnapshotTransport(start: Record<string, unknown>): GeneratedWorkerSnapshotTransport;
export declare function publishGeneratedWorkerSnapshot(options: {
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
    /** Deliver matching snapshot metadata/assets even inside the SAB message throttle interval. */
    readonly forceSnapshotMessage?: boolean;
    /** Controlled consumers acknowledge successfully mirrored producer versions. */
    readonly acceptedSourceAssetVersions?: readonly (readonly [string, number])[];
    readonly controlledFrameRequestId?: string;
}): GeneratedWorkerSnapshotPublishReport;
/**
 * True when a snapshot carries packet kinds the SAB packed codec cannot encode
 * (sprites, UI, skyboxes, runtime uniforms, skinning/morph buffers). Such a
 * frame falls back to the transferable path, preserving every packet.
 *
 * Audio packets are part of the SAB packet stream; the placeholder sideband
 * remains as a compatibility/fallback path for callers that still subscribe to
 * worker audio messages directly.
 * Exported for the transport-fallback test (AU-2).
 */
export declare function hasUnsupportedSharedSnapshotPayload(snapshot: RenderSnapshot): boolean;
export declare function createSharedSnapshotPlaceholder(snapshot: RenderSnapshot): RenderSnapshot;
//# sourceMappingURL=snapshot.d.ts.map