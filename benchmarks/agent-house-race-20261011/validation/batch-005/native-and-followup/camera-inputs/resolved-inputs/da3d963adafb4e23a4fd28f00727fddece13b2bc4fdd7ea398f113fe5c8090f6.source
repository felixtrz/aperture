// Sanctioned sim-time for systems. Reading `context.time` instead of
// `Date.now()`/`performance.now()` keeps stepping deterministic and replayable.
export function createApertureFrameTime() {
    return { delta: 0, elapsed: 0, frame: 0 };
}
export function advanceApertureFrameTime(time, delta, elapsed) {
    const mutable = time;
    mutable.delta = delta;
    mutable.elapsed = elapsed;
    mutable.frame += 1;
}
export function resetApertureFrameTime(time) {
    const mutable = time;
    mutable.delta = 0;
    mutable.elapsed = 0;
    mutable.frame = 0;
}
export function snapshotApertureFrameTime(time) {
    return {
        delta: time.delta,
        elapsed: time.elapsed,
        frame: time.frame,
    };
}
export function restoreApertureFrameTime(time, state) {
    const mutable = time;
    mutable.delta = state.delta;
    mutable.elapsed = state.elapsed;
    mutable.frame = state.frame;
}
//# sourceMappingURL=frame-time.js.map