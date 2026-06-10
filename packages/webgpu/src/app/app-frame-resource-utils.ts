import type { PackedSnapshotTransforms } from "@aperture-engine/render";

const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT;

export type WorldTransformUploadOutcome = "full" | "sub-range" | "skipped";

/**
 * AI-64: version-gated world-transform upload. The packed transforms carry a
 * monotonic contentVersion plus the dirty window that produced it; the cached
 * GPU buffer remembers which version it last received:
 *
 * - same version            → nothing to upload (zero GPU bytes),
 * - exactly one behind with a non-full dirty window → one writeBufferSubData
 *   of that window,
 * - anything else (stale route, full-fallback window, no version history)
 *   → one whole-buffer write.
 *
 * Returns the outcome taken, or `false` when the device write failed so the
 * caller's reuse chain falls through to resource recreation. The version
 * stamp only advances after a successful write — a failed upload never
 * records content the GPU does not have.
 */
export function writeWorldTransformBufferVersioned(
  device: unknown,
  buffer: unknown,
  source: ArrayBufferView,
  packed: Pick<PackedSnapshotTransforms, "contentVersion" | "dirtyRange">,
  target: { worldTransformContentVersion?: number | undefined },
): WorldTransformUploadOutcome | false {
  const version = packed.contentVersion;

  if (version === undefined) {
    return writeBufferData(device, buffer, source) ? "full" : false;
  }

  if (target.worldTransformContentVersion === version) {
    return "skipped";
  }

  const range = packed.dirtyRange;

  if (
    range !== null &&
    range !== undefined &&
    !range.full &&
    target.worldTransformContentVersion === version - 1
  ) {
    const written = writeBufferSubData(device, buffer, source, {
      bufferByteOffset: range.floatOffset * FLOAT32_BYTES,
      dataByteOffset: range.floatOffset * FLOAT32_BYTES,
      byteLength: range.floatCount * FLOAT32_BYTES,
    });

    if (!written) {
      return false;
    }

    target.worldTransformContentVersion = version;
    return "sub-range";
  }

  if (!writeBufferData(device, buffer, source)) {
    return false;
  }

  target.worldTransformContentVersion = version;
  return "full";
}

export function sameStringList(
  first: readonly string[],
  second: readonly string[],
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }

  return true;
}

export function writeBufferData(
  device: unknown,
  buffer: unknown,
  data: ArrayBufferView,
): boolean {
  const queue = (device as QueueWriteBufferDeviceLike).queue;

  if (queue?.writeBuffer === undefined) {
    return false;
  }

  queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return true;
}

/**
 * Dirty-range upload primitive (AI-66): writes `byteLength` bytes from
 * `data` starting at `dataByteOffset` (relative to the view) into the GPU
 * buffer at `bufferByteOffset`, in a single queue.writeBuffer call.
 * Mirrors Bevy's BufferVec::write_buffer_range. A zero-length range is a
 * successful no-op (no GPU traffic); a range outside the source view is
 * rejected loudly with `false` rather than silently clamped into corruption.
 * Consumed by the dirty-range transform/view/material uploads (AI-64/AI-65).
 */
export function writeBufferSubData(
  device: unknown,
  buffer: unknown,
  data: ArrayBufferView,
  range: {
    readonly bufferByteOffset: number;
    readonly dataByteOffset?: number;
    readonly byteLength: number;
  },
): boolean {
  const queue = (device as QueueWriteBufferDeviceLike).queue;

  if (queue?.writeBuffer === undefined) {
    return false;
  }

  const dataByteOffset = range.dataByteOffset ?? 0;

  if (
    !Number.isInteger(range.bufferByteOffset) ||
    range.bufferByteOffset < 0 ||
    !Number.isInteger(dataByteOffset) ||
    dataByteOffset < 0 ||
    !Number.isInteger(range.byteLength) ||
    range.byteLength < 0 ||
    dataByteOffset + range.byteLength > data.byteLength
  ) {
    return false;
  }

  if (range.byteLength === 0) {
    return true;
  }

  queue.writeBuffer(
    buffer,
    range.bufferByteOffset,
    data.buffer,
    data.byteOffset + dataByteOffset,
    range.byteLength,
  );
  return true;
}

interface QueueWriteBufferDeviceLike {
  readonly queue?: {
    writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
}
