import { readGeneratedBrowserAppStatus } from "./status.js";

export type GeneratedSignalSummary = Readonly<Record<string, unknown>>;

export type GeneratedSignalsListener = (
  signals: GeneratedSignalSummary,
) => void;

export interface GeneratedSignalsSubscriptionOptions {
  readonly scope?: object;
  readonly immediate?: boolean;
}

export function readGeneratedSignals(
  scope: object = globalThis,
): GeneratedSignalSummary | null {
  const status = readGeneratedBrowserAppStatus(scope);
  return readSignalRecord(status?.lastWorkerSummary);
}

export function readGeneratedSignal<T = unknown>(
  name: string,
  fallback: T,
  scope: object = globalThis,
): T {
  const signals = readGeneratedSignals(scope);
  const value = signals?.[name];
  return value === undefined ? fallback : (value as T);
}

export function subscribeGeneratedSignals(
  listener: GeneratedSignalsListener,
  options: GeneratedSignalsSubscriptionOptions = {},
): () => void {
  const scope = options.scope ?? globalThis;
  let disposed = false;
  let previous: GeneratedSignalSummary | null = null;

  const frame = () => {
    if (disposed) return;

    const next = readGeneratedSignals(scope);
    if (next !== null && next !== previous) {
      previous = next;
      listener(next);
    }

    schedule(frame);
  };

  if (options.immediate !== false) {
    const initial = readGeneratedSignals(scope);
    if (initial !== null) {
      previous = initial;
      listener(initial);
    }
  }

  schedule(frame);

  return () => {
    disposed = true;
  };
}

function readSignalRecord(value: unknown): GeneratedSignalSummary | null {
  const summary =
    typeof value === "object" && value !== null
      ? (value as { readonly signals?: unknown }).signals
      : null;

  return typeof summary === "object" && summary !== null
    ? (summary as GeneratedSignalSummary)
    : null;
}

function schedule(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 16);
}
