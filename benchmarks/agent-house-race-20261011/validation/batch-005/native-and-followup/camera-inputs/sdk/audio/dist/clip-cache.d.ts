import type { AudioBackend } from "./audio-backend.js";
/**
 * What the engine needs to realize a clip, resolved from the (main-thread
 * mirror of the) source asset registry by `assetHandleKey`. Encoded bytes only —
 * the decoded `AudioBuffer` lives here, never in the registry.
 */
export interface ResolvedClip {
    readonly bytes?: ArrayBuffer;
    readonly url?: string;
    readonly streaming: boolean;
    readonly durationHint: number;
    /** Optional caption/subtitle track key surfaced on clip start/end events. */
    readonly captionTrackId?: string;
}
export type ClipResolver = (clipId: string) => ResolvedClip | undefined;
/**
 * Decode-once cache keyed by `(clipId, clipVersion)`. A single immutable
 * `AudioBuffer` is fanned out to many single-use source nodes — automatic by
 * handle, where three.js requires manual buffer reuse. A bumped version decodes
 * under a fresh key; in-flight voices keep playing the old buffer.
 */
export interface ClipCache {
    /**
     * The decoded buffer if ready; otherwise `undefined` while a one-time decode
     * runs (or for streamed / url-only clips, which are not buffer-decoded here).
     */
    acquire(clipId: string, version: number): AudioBuffer | undefined;
    /** The streaming URL for a `streaming:true` clip, else undefined. */
    streamingUrl(clipId: string): string | undefined;
    /** Subscribe to decode-completion (the engine flushes deferred starts). */
    onDecoded(listener: () => void): () => void;
    /** Total `decodeAudioData` calls issued — one per `(clipId, version)`. */
    readonly decodeCount: number;
    dispose(): void;
}
export declare function createClipCache(backend: AudioBackend, resolve: ClipResolver): ClipCache;
//# sourceMappingURL=clip-cache.d.ts.map