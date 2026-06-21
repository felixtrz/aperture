import { ApertureSystemError } from "./errors.js";
const APERTURE_EFFECTS = Symbol("aperture.effects");
export function flushApertureSystemEffects(world, phase = "update") {
    let flushed = 0;
    for (const system of world.getSystems()) {
        const effects = readRegisteredEffects(system);
        flushed += effects?.flush(phase) ?? 0;
    }
    return flushed;
}
export function createScheduledEffects() {
    const entries = new Set();
    return {
        watch(watched, callback, options = {}) {
            const entry = {
                phase: options.phase ?? "input",
                priority: options.priority ?? 0,
                dispose: () => undefined,
                pending: [],
                callback: callback,
            };
            let initialized = false;
            const unsubscribe = watched.subscribe((value) => {
                if (!initialized) {
                    initialized = true;
                    return;
                }
                entry.pending.push(value);
            });
            const disposable = { ...entry, dispose: unsubscribe };
            entries.add(disposable);
            return {
                dispose() {
                    unsubscribe();
                    entries.delete(disposable);
                },
            };
        },
        onQueryEnter(query, callback, options = {}) {
            if (query.subscribe === undefined) {
                throw new ApertureSystemError("aperture.effects.querySubscribeMissing", "Query enter effects require an EliCS query with subscribe().", "Pass an app system query from this.queries.");
            }
            const entry = {
                phase: options.phase ?? "update",
                priority: options.priority ?? 0,
                dispose: () => undefined,
                pending: [],
                callback: callback,
            };
            const unsubscribe = query.subscribe("qualify", (entity) => {
                entry.pending.push(entity);
            });
            const disposable = { ...entry, dispose: unsubscribe };
            entries.add(disposable);
            return {
                dispose() {
                    unsubscribe();
                    entries.delete(disposable);
                },
            };
        },
        flush(phase = "update") {
            const ready = [...entries]
                .filter((entry) => entry.phase === phase && entry.pending.length > 0)
                .sort((a, b) => a.priority - b.priority);
            let flushed = 0;
            for (const entry of ready) {
                const pending = entry.pending.splice(0);
                flushed += pending.length;
                for (const value of pending) {
                    entry.callback(value);
                }
            }
            return flushed;
        },
        dispose() {
            for (const entry of entries) {
                entry.dispose();
            }
            entries.clear();
        },
    };
}
export function registerSystemEffects(system, effects) {
    Object.defineProperty(system, APERTURE_EFFECTS, {
        value: effects,
        configurable: false,
    });
}
function readRegisteredEffects(system) {
    if (typeof system !== "object" || system === null) {
        return null;
    }
    const value = system[APERTURE_EFFECTS];
    return isEffects(value) ? value : null;
}
function isEffects(value) {
    return (typeof value === "object" &&
        value !== null &&
        "flush" in value &&
        "dispose" in value);
}
//# sourceMappingURL=effects.js.map