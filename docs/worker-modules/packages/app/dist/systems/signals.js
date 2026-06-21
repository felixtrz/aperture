import { signal as createSignal } from "/aperture/worker-modules/node_modules/@preact/signals-core/dist/signals-core.mjs";
import { jsonSafeValue } from "./json.js";
export function createSignalSummary(signals) {
    const summary = {};
    for (const [key, signal] of Object.entries(signals)) {
        summary[key] = jsonSafeValue(signal.value);
    }
    return summary;
}
export function createSignalStore(descriptors) {
    const output = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
        output[key] = createSignal(descriptor.initial);
    }
    return output;
}
//# sourceMappingURL=signals.js.map