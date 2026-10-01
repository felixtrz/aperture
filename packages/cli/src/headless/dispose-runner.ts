import type { ApertureHeadlessRunner } from "@aperture-engine/app/headless";

const pendingDisposals = new WeakMap<
  ApertureHeadlessRunner,
  Promise<readonly unknown[]>
>();

/**
 * Release a CLI-owned runner exactly once, awaiting every system and feature.
 * Return cleanup failures after attempting all owners so the caller can retain
 * a primary command error or report cleanup-only failures in its own channel.
 */
export function disposeHeadlessRunner(
  runner: ApertureHeadlessRunner,
): Promise<readonly unknown[]> {
  let pending = pendingDisposals.get(runner);
  if (pending === undefined) {
    pending = Promise.resolve().then(() => dispose(runner));
    pendingDisposals.set(runner, pending);
  }
  return pending;
}

async function dispose(
  runner: ApertureHeadlessRunner,
): Promise<readonly unknown[]> {
  const errors: unknown[] = [];
  let systems: readonly unknown[] = [];
  try {
    // Snapshot the list: a system can unregister itself while being destroyed.
    systems = [
      ...(runner.app.lowLevel.world.getSystems() as readonly unknown[]),
    ];
  } catch (error: unknown) {
    errors.push(error);
  }
  for (const system of systems) {
    try {
      if (
        typeof system === "object" &&
        system !== null &&
        "destroy" in system &&
        typeof system.destroy === "function"
      ) {
        await system.destroy();
      }
    } catch (error: unknown) {
      errors.push(error);
    }
  }
  try {
    await runner.app.dispose();
  } catch (error: unknown) {
    errors.push(error);
  }
  return errors;
}

export function headlessDisposeFailureMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return [
      error.message,
      ...error.errors.map((nested) =>
        nested instanceof Error ? nested.message : String(nested),
      ),
    ].join(" — ");
  }
  return error instanceof Error
    ? error.message
    : "Disposing the headless runner failed.";
}
