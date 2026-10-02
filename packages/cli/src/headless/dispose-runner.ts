import { disposeApertureApp } from "@aperture-engine/app/advanced";
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
  return disposeApertureApp(runner.app);
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
