import { jsonSafeValue } from "../internal/json-safe.js";
const RESERVED_START_OPTION_KEYS = new Set([
    "audioSnapshotMessageRateHz",
    "assetDecoders",
    "entityCapacity",
    "fixedStep",
    "options",
    "physicsInterpolation",
    "sharedSnapshotMessageRateHz",
    "sourceAssetsMessageRateHz",
    "stop",
    "transport",
    "type",
    "workerFullSummaryIntervalMilliseconds",
]);
export function createStartOptionsAccess(options = {}) {
    return new DefaultStartOptionsAccess(filterSystemStartOptions(options));
}
export function filterSystemStartOptions(options) {
    const values = {};
    for (const [key, value] of Object.entries(options)) {
        if (RESERVED_START_OPTION_KEYS.has(key)) {
            continue;
        }
        values[key] = value;
    }
    return Object.freeze(values);
}
class DefaultStartOptionsAccess {
    #values;
    constructor(values) {
        this.#values = values;
    }
    has(name) {
        return Object.hasOwn(this.#values, name);
    }
    get(name) {
        return this.#values[name];
    }
    string(name) {
        const value = this.get(name);
        return typeof value === "string" && value.length > 0 ? value : null;
    }
    number(name) {
        const value = this.get(name);
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    boolean(name) {
        const value = this.get(name);
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            if (value === "true" || value === "1") {
                return true;
            }
            if (value === "false" || value === "0") {
                return false;
            }
        }
        return null;
    }
    summary() {
        return {
            count: Object.keys(this.#values).length,
            values: jsonSafeValue(this.#values),
        };
    }
}
//# sourceMappingURL=start-options.js.map