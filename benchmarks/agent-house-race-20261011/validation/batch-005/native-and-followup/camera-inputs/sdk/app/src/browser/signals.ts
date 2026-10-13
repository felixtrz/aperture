import { readGeneratedBrowserAppStatus } from "./status.js";

export type GeneratedSignalSummary = Readonly<Record<string, unknown>>;

export type GeneratedSignalsListener = (
  signals: GeneratedSignalSummary,
) => void;

export interface GeneratedSignalsSubscriptionOptions {
  readonly scope?: object;
  readonly immediate?: boolean;
  readonly intervalMilliseconds?: number;
}

export const DEFAULT_GENERATED_SIGNAL_SUBSCRIPTION_INTERVAL_MS = 16;

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
  const intervalMilliseconds = normalizeSignalSubscriptionInterval(
    options.intervalMilliseconds,
  );
  let disposed = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let previous: GeneratedSignalSummary | null = null;

  const frame = () => {
    if (disposed) return;

    const next = readGeneratedSignals(scope);
    if (next !== null && next !== previous) {
      previous = next;
      listener(next);
    }

    pendingTimer = setTimeout(frame, intervalMilliseconds);
  };

  if (options.immediate !== false) {
    const initial = readGeneratedSignals(scope);
    if (initial !== null) {
      previous = initial;
      listener(initial);
    }
  }

  pendingTimer = setTimeout(frame, intervalMilliseconds);

  return () => {
    disposed = true;
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
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

function normalizeSignalSubscriptionInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GENERATED_SIGNAL_SUBSCRIPTION_INTERVAL_MS;
  }

  return Math.max(1, Math.floor(value));
}
