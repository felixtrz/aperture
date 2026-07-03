import { readFile } from "node:fs/promises";

/**
 * Shared deadline-based wait helpers for the unit suite.
 *
 * Convention (AGENTS.md "Test Reliability Conventions"): waits are DEADLINES,
 * not estimates — generous caps that return as soon as the condition holds.
 * Iteration-count poll budgets (20x5ms and friends) starve under coverage
 * instrumentation on loaded runners; per-file copies of these helpers drifted
 * from 100ms to 4s before they were consolidated here.
 */

export interface WaitOptions {
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
  readonly label?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 10;

/** Poll a predicate until it holds or the deadline expires. */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options: WaitOptions = {},
): Promise<void> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  for (;;) {
    if (await predicate()) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${options.label ?? "predicate"}.`);
    }

    await delay(options.intervalMs ?? DEFAULT_INTERVAL_MS);
  }
}

/**
 * Read a file that another (possibly unawaited, possibly out-of-process)
 * writer produces. Retries while the file is missing OR empty: the repo's
 * writers are atomic (temp + rename), but the empty-read guard keeps this
 * helper safe for any future non-atomic producer.
 */
export async function waitForFile(
  file: string,
  options: WaitOptions = {},
): Promise<string> {
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  let lastError: unknown = new Error(`Timed out waiting for ${file}.`);

  while (Date.now() < deadline) {
    try {
      const contents = await readFile(file, "utf8");

      if (contents.length > 0) {
        return contents;
      }
      lastError = new Error(`File ${file} is still empty.`);
    } catch (error: unknown) {
      lastError = error;
    }
    await delay(options.intervalMs ?? DEFAULT_INTERVAL_MS);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Alias with waitForFile semantics for call sites that read "eventually". */
export async function readEventually(
  file: string,
  options: WaitOptions = {},
): Promise<string> {
  return waitForFile(file, { timeoutMs: 10_000, ...options });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
