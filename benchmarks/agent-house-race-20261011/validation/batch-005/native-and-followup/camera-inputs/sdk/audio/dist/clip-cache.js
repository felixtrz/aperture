/** Bound on decode retries before a clip is treated as permanently failed. */
const MAX_DECODE_ATTEMPTS = 3;
export function createClipCache(backend, resolve) {
    const entries = new Map();
    const listeners = new Set();
    // Latest decoded version per clip id, so a bumped version evicts the
    // superseded buffer instead of leaking it (the asset hot-swap case).
    const decodedVersion = new Map();
    // Decode attempts per key, so a transient decodeAudioData failure is retried a
    // bounded number of times rather than cached as a permanent silence.
    const attempts = new Map();
    let decodeCount = 0;
    let disposed = false;
    function notify() {
        for (const listener of listeners) {
            listener();
        }
    }
    return {
        get decodeCount() {
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
            // Evict the superseded version's buffer when this clip's version bumped —
            // already-playing sources hold their AudioBuffer directly, so dropping the
            // old cache entry only releases memory and never cuts a live voice.
            const priorVersion = decodedVersion.get(clipId);
            if (priorVersion !== undefined && priorVersion !== version) {
                entries.delete(`${clipId}@${priorVersion}`);
                attempts.delete(`${clipId}@${priorVersion}`);
            }
            decodedVersion.set(clipId, version);
            const entry = { status: "decoding", buffer: null };
            entries.set(key, entry);
            decodeCount += 1;
            // slice(0): decodeAudioData detaches its input (three.js's AudioLoader fix).
            backend.decode(clip.bytes.slice(0)).then((buffer) => {
                if (disposed) {
                    return;
                }
                entry.status = "ready";
                entry.buffer = buffer;
                attempts.delete(key);
                notify();
            }, () => {
                if (disposed) {
                    return;
                }
                const tries = (attempts.get(key) ?? 0) + 1;
                attempts.set(key, tries);
                if (tries < MAX_DECODE_ATTEMPTS) {
                    // Transient failure: drop the entry so a later acquire re-decodes,
                    // and wake deferred starts to retry.
                    entries.delete(key);
                    notify();
                }
                else {
                    entry.status = "failed";
                }
            });
            return undefined;
        },
        streamingUrl(clipId) {
            const clip = resolve(clipId);
            return clip !== undefined && clip.streaming && clip.url !== undefined
                ? clip.url
                : undefined;
        },
        onDecoded(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            disposed = true;
            listeners.clear();
            entries.clear();
            decodedVersion.clear();
            attempts.clear();
        },
    };
}
//# sourceMappingURL=clip-cache.js.map