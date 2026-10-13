import { type Signal } from "@preact/signals-core";
import type { ApertureSignalDescriptor } from "../config.js";
export interface ApertureGeneratedSignalMap {
}
export type SignalStore = ApertureGeneratedSignalMap & Record<string, Signal<unknown>>;
export type SignalSummary = Readonly<Record<string, unknown>>;
export type { Signal };
export declare function createSignalSummary(signals: SignalStore): SignalSummary;
export declare function createSignalStore(descriptors: Readonly<Record<string, ApertureSignalDescriptor>>): SignalStore;
//# sourceMappingURL=signals.d.ts.map