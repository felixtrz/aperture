const cleanupFailures: unknown[] = [];

/** A failed disposer cannot prove that old timers/callbacks have stopped. */
export function recordApertureCleanupFailures(
  errors: readonly unknown[],
): void {
  cleanupFailures.push(...errors);
}

export function getApertureCleanupFailures(): readonly unknown[] {
  return cleanupFailures.slice();
}

export function assertApertureBootstrapAllowed(): void {
  if (cleanupFailures.length === 0) return;
  const error = new Error(
    "A previous Aperture cleanup failed; starting another ECS world in this process is unsafe. Restart the process before starting or resetting a session.",
    {
      cause: new AggregateError(cleanupFailures, "Previous cleanup failures."),
    },
  );
  Object.assign(error, { code: "aperture.app.cleanupBlocked" });
  throw error;
}
