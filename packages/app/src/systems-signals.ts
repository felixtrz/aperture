import { signal as createSignal, type Signal } from "@preact/signals-core";
import type { ApertureSignalDescriptor } from "./config.js";
import { jsonSafeValue } from "./systems-json.js";

export type SignalStore = Record<string, Signal<unknown>>;
export type SignalSummary = Readonly<Record<string, unknown>>;

export function createSignalSummary(signals: SignalStore): SignalSummary {
  const summary: Record<string, unknown> = {};

  for (const [key, signal] of Object.entries(signals)) {
    summary[key] = jsonSafeValue(signal.value);
  }

  return summary;
}

export function createSignalStore(
  descriptors: Readonly<Record<string, ApertureSignalDescriptor>>,
): SignalStore {
  const output: SignalStore = {};

  for (const [key, descriptor] of Object.entries(descriptors)) {
    output[key] = createSignal(descriptor.initial);
  }

  return output;
}
