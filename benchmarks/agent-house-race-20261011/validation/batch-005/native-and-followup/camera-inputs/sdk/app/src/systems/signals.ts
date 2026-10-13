import { signal as createSignal, type Signal } from "@preact/signals-core";
import type { ApertureSignalDescriptor } from "../config.js";
import { jsonSafeValue } from "./json.js";

// Intentionally empty so generated app-local declarations
// (.aperture/generated/aperture-env.d.ts) can augment it with per-signal
// properties — the signal analogue of ApertureGeneratedActionMap (#76). With
// the augmentation in place `this.signals.score.value` is a number without
// `?? 0` guards, even under noUncheckedIndexedAccess.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApertureGeneratedSignalMap {}

export type SignalStore = ApertureGeneratedSignalMap &
  Record<string, Signal<unknown>>;
export type SignalSummary = Readonly<Record<string, unknown>>;
export type { Signal };

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
