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
  /** Subscribe to decode-completion (the engine flushes deferred starts). */
  onDecoded(listener: () => void): () => void;
  /** Total `decodeAudioData` calls issued — one per `(clipId, version)`. */
  readonly decodeCount: number;
  dispose(): void;
}

interface CacheEntry {
  status: "decoding" | "ready" | "failed";
  buffer: AudioBuffer | null;
}

export function createClipCache(
  backend: AudioBackend,
  resolve: ClipResolver,
): ClipCache {
  const entries = new Map<string, CacheEntry>();
  const listeners = new Set<() => void>();
  let decodeCount = 0;
  let disposed = false;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    get decodeCount(): number {
      return decodeCount;
    },
    acquire(clipId, version) {
      const key = `${clipId}@${version}`;
      const existing = entries.get(key);
      if (existing !== undefined) {
        return existing.buffer ?? undefined;
      }

      const clip = resolve(clipId);
      // Streamed clips (AU-10) and url-only clips (loader's job) are not decoded
      // into a shared buffer here.
      if (clip === undefined || clip.streaming || clip.bytes === undefined) {
        return undefined;
      }

      const entry: CacheEntry = { status: "decoding", buffer: null };
      entries.set(key, entry);
      decodeCount += 1;
      // slice(0): decodeAudioData detaches its input (three.js's AudioLoader fix).
      backend.decode(clip.bytes.slice(0)).then(
        (buffer) => {
          if (disposed) {
            return;
          }
          entry.status = "ready";
          entry.buffer = buffer;
          notify();
        },
        () => {
          if (!disposed) {
            entry.status = "failed";
          }
        },
      );
      return undefined;
    },
    onDecoded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      entries.clear();
    },
  };
}
