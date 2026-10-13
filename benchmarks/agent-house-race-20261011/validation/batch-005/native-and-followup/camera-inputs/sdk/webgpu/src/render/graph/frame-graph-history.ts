// FrameGraph history resources: double-buffered graph handles for temporal
// techniques (M3-T6). A history resource owns exactly TWO physical buffers and
// presents a stable pair of views each frame:
//   - current(): this frame's write target (a node declaring write 'current').
//   - previous(): last frame's written buffer (a node declaring read 'previous').
// At frame end the graph calls swap(), so this frame's write becomes next
// frame's previous — with NO read-write aliasing of the same physical texture in
// any single frame (current() and previous() are always distinct buffers).
//
// The model is simple: exactly one extra buffer carries history across frames,
// and a resize reallocates both and drops the stale frame.

export interface FrameGraphHistoryResource<T> {
  /** This frame's write target (the 'current' view). */
  current(): T;
  /** Last frame's written buffer (the 'previous' view). Distinct from current(). */
  previous(): T;
  /** True once at least one frame has been swapped (previous() carries real data). */
  hasPrevious(): boolean;
  /** Advance one frame: this frame's write becomes next frame's previous. */
  swap(): void;
  /** Number of frames swapped (for resource-stability assertions). */
  readonly swapCount: number;
  /** The two backing buffers, in fixed order (pool size is always 2). */
  readonly buffers: readonly [T, T];
}

export function createFrameGraphHistoryResource<T>(
  bufferA: T,
  bufferB: T,
): FrameGraphHistoryResource<T> {
  const buffers: [T, T] = [bufferA, bufferB];
  let currentIndex = 0;
  let swapCount = 0;

  return {
    buffers,
    current() {
      return buffers[currentIndex]!;
    },
    previous() {
      return buffers[currentIndex === 0 ? 1 : 0]!;
    },
    hasPrevious() {
      return swapCount > 0;
    },
    swap() {
      currentIndex = currentIndex === 0 ? 1 : 0;
      swapCount += 1;
    },
    get swapCount() {
      return swapCount;
    },
  };
}
