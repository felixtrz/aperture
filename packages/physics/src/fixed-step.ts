export interface FixedStepClockOptions {
  readonly fixedDelta?: number;
  readonly maxSubsteps?: number;
  readonly maxAccumulatedTime?: number;
}

export interface FixedStepClock {
  readonly fixedDelta: number;
  readonly maxSubsteps: number;
  readonly maxAccumulatedTime: number;
  accumulator: number;
  fixedStepIndex: number;
  overstepAlpha: number;
  droppedTime: number;
}

export interface FixedStepClockState {
  readonly fixedDelta: number;
  readonly maxSubsteps: number;
  readonly maxAccumulatedTime: number;
  readonly accumulator: number;
  readonly fixedStepIndex: number;
  readonly overstepAlpha: number;
  readonly droppedTime: number;
}

export interface FixedStepAdvanceResult {
  readonly substeps: number;
  readonly fixedDelta: number;
  readonly fixedStepStart: number;
  readonly fixedStepEnd: number;
  readonly overstepAlpha: number;
  readonly consumedTime: number;
  readonly droppedTime: number;
  readonly clamped: boolean;
}

const DEFAULT_FIXED_DELTA = 1 / 60;
const DEFAULT_MAX_SUBSTEPS = 4;

export function createFixedStepClock(
  options: FixedStepClockOptions = {},
): FixedStepClock {
  const fixedDelta = options.fixedDelta ?? DEFAULT_FIXED_DELTA;
  const maxSubsteps = options.maxSubsteps ?? DEFAULT_MAX_SUBSTEPS;
  const maxAccumulatedTime =
    options.maxAccumulatedTime ?? fixedDelta * maxSubsteps;

  assertPositiveFinite("fixedDelta", fixedDelta);
  assertPositiveInteger("maxSubsteps", maxSubsteps);
  assertPositiveFinite("maxAccumulatedTime", maxAccumulatedTime);
  if (maxAccumulatedTime + Number.EPSILON < fixedDelta) {
    throw new RangeError("maxAccumulatedTime must be at least fixedDelta.");
  }
  if (maxAccumulatedTime - Number.EPSILON > fixedDelta * maxSubsteps) {
    throw new RangeError(
      "maxAccumulatedTime must not exceed fixedDelta * maxSubsteps.",
    );
  }

  return {
    fixedDelta,
    maxSubsteps,
    maxAccumulatedTime,
    accumulator: 0,
    fixedStepIndex: 0,
    overstepAlpha: 0,
    droppedTime: 0,
  };
}

export function advanceFixedStepClock(
  clock: FixedStepClock,
  delta: number,
): FixedStepAdvanceResult {
  if (!Number.isFinite(delta) || delta < 0) {
    throw new RangeError(
      "Fixed-step delta must be a finite non-negative number.",
    );
  }

  const fixedStepStart = clock.fixedStepIndex;
  const beforeClamp = clock.accumulator + delta;
  const clampedAccumulator = Math.min(beforeClamp, clock.maxAccumulatedTime);
  const droppedTime = beforeClamp - clampedAccumulator;
  let accumulator = clampedAccumulator;
  let substeps = 0;

  while (
    accumulator + Number.EPSILON >= clock.fixedDelta &&
    substeps < clock.maxSubsteps
  ) {
    accumulator -= clock.fixedDelta;
    substeps += 1;
  }

  const consumedTime = substeps * clock.fixedDelta;
  clock.accumulator = accumulator;
  clock.fixedStepIndex += substeps;
  clock.overstepAlpha = accumulator / clock.fixedDelta;
  clock.droppedTime = droppedTime;

  return {
    substeps,
    fixedDelta: clock.fixedDelta,
    fixedStepStart,
    fixedStepEnd: clock.fixedStepIndex,
    overstepAlpha: clock.overstepAlpha,
    consumedTime,
    droppedTime,
    clamped: droppedTime > 0,
  };
}

export function resetFixedStepClock(clock: FixedStepClock): void {
  clock.accumulator = 0;
  clock.fixedStepIndex = 0;
  clock.overstepAlpha = 0;
  clock.droppedTime = 0;
}

export function snapshotFixedStepClock(
  clock: FixedStepClock,
): FixedStepClockState {
  return {
    fixedDelta: clock.fixedDelta,
    maxSubsteps: clock.maxSubsteps,
    maxAccumulatedTime: clock.maxAccumulatedTime,
    accumulator: clock.accumulator,
    fixedStepIndex: clock.fixedStepIndex,
    overstepAlpha: clock.overstepAlpha,
    droppedTime: clock.droppedTime,
  };
}

export function restoreFixedStepClock(
  clock: FixedStepClock,
  state: FixedStepClockState,
): void {
  assertPositiveFinite("fixedDelta", state.fixedDelta);
  assertPositiveInteger("maxSubsteps", state.maxSubsteps);
  assertPositiveFinite("maxAccumulatedTime", state.maxAccumulatedTime);
  assertNonNegativeFinite("accumulator", state.accumulator);
  assertNonNegativeFinite("overstepAlpha", state.overstepAlpha);
  assertNonNegativeFinite("droppedTime", state.droppedTime);

  if (!Number.isInteger(state.fixedStepIndex) || state.fixedStepIndex < 0) {
    throw new RangeError("fixedStepIndex must be a non-negative integer.");
  }

  if (
    state.fixedDelta !== clock.fixedDelta ||
    state.maxSubsteps !== clock.maxSubsteps ||
    state.maxAccumulatedTime !== clock.maxAccumulatedTime
  ) {
    throw new RangeError(
      "Fixed-step clock snapshot options do not match the target clock.",
    );
  }

  if (state.accumulator - Number.EPSILON > clock.maxAccumulatedTime) {
    throw new RangeError("accumulator must not exceed maxAccumulatedTime.");
  }

  clock.accumulator = state.accumulator;
  clock.fixedStepIndex = state.fixedStepIndex;
  clock.overstepAlpha = state.overstepAlpha;
  clock.droppedTime = state.droppedTime;
}

function assertPositiveFinite(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive finite number.`);
  }
}

function assertPositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer.`);
  }
}

function assertNonNegativeFinite(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a finite non-negative number.`);
  }
}
