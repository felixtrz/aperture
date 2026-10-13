import type { AudioClipHandle, Vec3Like } from "@aperture-engine/simulation";
import type { AudioEmitterPacket, RenderDiagnostic } from "./snapshot.js";
/**
 * A fire-and-forget one-shot request (no long-lived entity). Authored worker-side
 * (e.g. from a `playOneShot` command), drained each frame into transient
 * `AudioEmitterPacket`s with disjoint `{kind:"oneshot", seq}` voice keys.
 */
export interface OneShotRequest {
    readonly clip: AudioClipHandle;
    readonly busId?: string;
    readonly gain?: number;
    readonly timeScale?: number;
    readonly seed?: number;
    readonly worldPos?: Vec3Like;
    /** Spatialize through a PannerNode (default true when a worldPos is given). */
    readonly spatial?: boolean;
}
export interface OneShotEmitterQueueOptions {
    /** Max simultaneous transient emitters; enqueue beyond this is dropped. */
    readonly maxActive?: number;
    /** Max transient emitters promoted from the pending queue per frame. */
    readonly maxPerFrame?: number;
    /** Frames a transient emitter is re-emitted so its voice can start + play. */
    readonly ttlFrames?: number;
}
export interface OneShotEmitterQueue {
    /** Queue a one-shot; returns false (and counts a drop) when at capacity. */
    enqueue(request: OneShotRequest): boolean;
    /** Drain into this frame's transient packets, pushing matrices + diagnostics. */
    drain(transforms: number[], diagnostics: RenderDiagnostic[]): AudioEmitterPacket[];
    /** Total one-shots dropped due to overflow. */
    readonly droppedCount: number;
    /** Currently-live transient emitters. */
    readonly activeCount: number;
}
export declare function createOneShotEmitterQueue(options?: OneShotEmitterQueueOptions): OneShotEmitterQueue;
//# sourceMappingURL=audio-one-shot-queue.d.ts.map