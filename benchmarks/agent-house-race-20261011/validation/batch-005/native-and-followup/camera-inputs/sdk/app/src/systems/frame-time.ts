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

export interface ApertureFrameTimeState {
  readonly delta: number;
  readonly elapsed: number;
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

export function snapshotApertureFrameTime(
  time: ApertureFrameTime,
): ApertureFrameTimeState {
  return {
    delta: time.delta,
    elapsed: time.elapsed,
    frame: time.frame,
  };
}

export function restoreApertureFrameTime(
  time: ApertureFrameTime,
  state: ApertureFrameTimeState,
): void {
  const mutable = time as MutableFrameTime;
  mutable.delta = state.delta;
  mutable.elapsed = state.elapsed;
  mutable.frame = state.frame;
}
