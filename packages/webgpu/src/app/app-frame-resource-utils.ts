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
