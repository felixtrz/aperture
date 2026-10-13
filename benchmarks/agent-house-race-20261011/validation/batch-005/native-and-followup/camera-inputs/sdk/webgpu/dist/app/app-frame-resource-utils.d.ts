import type { PackedTransformDirtyRange } from "@aperture-engine/render";
export type DirtyUploadOutcome = "full" | "sub-range" | "skipped";
/** Mutable per-buffer stamp of the last successfully uploaded contentVersion. */
export interface VersionedUploadStamp {
    version?: number | undefined;
}
interface DirtyUploadContent {
    readonly contentVersion?: number | undefined;
    readonly dirtyRange?: PackedTransformDirtyRange | null | undefined;
    readonly dirtyRanges?: readonly PackedTransformDirtyRange[] | null | undefined;
}
/**
 * AI-64/AI-65: version-gated dynamic-buffer upload shared by the transform and
 * view uniform paths. The packed content carries a monotonic contentVersion
 * plus the dirty window that produced it; the cached GPU buffer remembers
 * which version it last received:
 *
 * - same version            → nothing to upload (zero GPU bytes),
 * - exactly one behind with a non-full dirty window → one writeBufferSubData
 *   of that window,
 * - anything else (stale route, full-fallback window, no version history)
 *   → one whole-buffer write.
 *
 * Returns the outcome taken, or `false` when the device write failed so the
 * caller's reuse chain falls through to resource recreation. The stamp only
 * advances after a successful write — a failed upload never records content
 * the GPU does not have.
 */
export declare function writeVersionedBufferData(device: unknown, buffer: unknown, source: ArrayBufferView, content: DirtyUploadContent, stamp: VersionedUploadStamp): DirtyUploadOutcome | false;
/**
 * AI-65: dirty-range upload for buffers whose dirty window pairs 1:1 with one
 * GPU buffer (per-route light packing): `null` means byte-identical content
 * (zero GPU bytes), a non-full window writes just that 4-byte-element span,
 * anything else writes the whole source. Returns `false` on device failure.
 */
export declare function writeBufferDataDirtyRange(device: unknown, buffer: unknown, source: ArrayBufferView, range: PackedTransformDirtyRange | null | undefined): DirtyUploadOutcome | false;
export declare function sameStringList(first: readonly string[], second: readonly string[]): boolean;
export declare function writeBufferData(device: unknown, buffer: unknown, data: ArrayBufferView): boolean;
/**
 * Dirty-range upload primitive (AI-66): writes `byteLength` bytes from
 * `data` starting at `dataByteOffset` (relative to the view) into the GPU
 * buffer at `bufferByteOffset`, in a single queue.writeBuffer call.
 * Mirrors Bevy's BufferVec::write_buffer_range. A zero-length range is a
 * successful no-op (no GPU traffic); a range outside the source view is
 * rejected loudly with `false` rather than silently clamped into corruption.
 * Consumed by the dirty-range transform/view/material uploads (AI-64/AI-65).
 */
export declare function writeBufferSubData(device: unknown, buffer: unknown, data: ArrayBufferView, range: {
    readonly bufferByteOffset: number;
    readonly dataByteOffset?: number;
    readonly byteLength: number;
}): boolean;
export {};
//# sourceMappingURL=app-frame-resource-utils.d.ts.map