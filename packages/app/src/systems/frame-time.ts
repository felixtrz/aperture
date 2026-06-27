// Sanctioned sim-time for systems. Reading `context.time` instead of
// `Date.now()`/`performance.now()` keeps stepping deterministic and replayable.

export interface ApertureFrameTime {
  /** Seconds advanced by the current step. */
  readonly delta: number;
  /** Caller-supplied simulation time (seconds) at the current step. */
  readonly elapsed: number;
  /** Number of steps taken (increments by 1 per step). */
  readonly frame: number;
}

interface MutableFrameTime {
  delta: number;
  elapsed: number;
  frame: number;
}

export function createApertureFrameTime(): ApertureFrameTime {
  return { delta: 0, elapsed: 0, frame: 0 };
}

export function advanceApertureFrameTime(
  time: ApertureFrameTime,
  delta: number,
  elapsed: number,
): void {
  const mutable = time as MutableFrameTime;
  mutable.delta = delta;
  mutable.elapsed = elapsed;
  mutable.frame += 1;
}

export function resetApertureFrameTime(time: ApertureFrameTime): void {
  const mutable = time as MutableFrameTime;
  mutable.delta = 0;
  mutable.elapsed = 0;
  mutable.frame = 0;
}
