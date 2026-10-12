import { ApertureCliError } from "../errors.js";

/** Per-request bound; longer simulations can issue several deterministic steps. */
export const MAX_TOOL_STEP_FRAMES = 10_000;

export function assertStepArguments(input: {
  readonly frames?: unknown;
  readonly maxFrames?: unknown;
  readonly delta?: unknown;
  readonly time?: unknown;
}): void {
  for (const field of ["frames", "maxFrames"] as const) {
    const value = input[field];
    if (
      value !== undefined &&
      (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > MAX_TOOL_STEP_FRAMES)
    ) {
      throw new ApertureCliError(
        "aperture.headless.invalidStep",
        `${field} must be an integer from 1 through ${MAX_TOOL_STEP_FRAMES}. Split longer runs across multiple ecs_step calls.`,
      );
    }
  }
  for (const field of ["delta", "time"] as const) {
    const value = input[field];
    if (
      value !== undefined &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        (field === "delta" && value < 0))
    ) {
      throw new ApertureCliError(
        "aperture.headless.invalidStep",
        `${field} must be a finite ${field === "delta" ? "non-negative " : ""}number.`,
      );
    }
  }
}
