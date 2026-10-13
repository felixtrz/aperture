let activeScope = null;
export function createApertureDeterminismDiagnostics(options) {
    const mode = options.mode ?? "off";
    const reported = new Set();
    if (mode === "off") {
        return {
            run(_input, callback) {
                return callback();
            },
        };
    }
    return {
        run(input, callback) {
            return runWithNondeterministicGlobalHooks({
                report(api) {
                    const key = `${input.system}:${input.phase}:${api}`;
                    if (reported.has(key)) {
                        return;
                    }
                    reported.add(key);
                    const suggestedApi = api === "Math.random" ? "context.random" : "context.time";
                    const data = {
                        api,
                        phase: input.phase,
                        system: input.system,
                        suggestedApi,
                    };
                    // Carry the human sentence in the diagnostic itself so JSON
                    // consumers see more than the bare code (battletest finding F8).
                    const message = `${input.system} called ${api} during ${input.phase}; use ${suggestedApi} for deterministic replay.`;
                    if (mode === "error") {
                        options.diagnostics.error("aperture.determinism.nondeterministicGlobal", data, message);
                    }
                    else {
                        options.diagnostics.warn("aperture.determinism.nondeterministicGlobal", data, message);
                    }
                },
            }, callback);
        },
    };
}
function runWithNondeterministicGlobalHooks(scope, callback) {
    const previousScope = activeScope;
    const previousMathRandom = Math.random;
    const previousDateNow = Date.now;
    const PreviousDate = Date;
    const previousPerformanceNow = typeof performance === "undefined" ? undefined : performance.now;
    const hasPerformanceNow = previousPerformanceNow !== undefined &&
        typeof previousPerformanceNow === "function";
    activeScope = scope;
    Math.random = function apertureDeterminismMathRandom() {
        activeScope?.report("Math.random");
        return previousMathRandom.call(Math);
    };
    Date.now = function apertureDeterminismDateNow() {
        activeScope?.report("Date.now");
        return previousDateNow.call(PreviousDate);
    };
    const DateWrapper = function apertureDeterminismDate(...args) {
        if (new.target !== undefined) {
            if (args.length === 0) {
                activeScope?.report("new Date");
            }
            return Reflect.construct(PreviousDate, args, new.target);
        }
        return Reflect.apply(PreviousDate, this, args);
    };
    DateWrapper.now = Date.now;
    DateWrapper.parse = PreviousDate.parse;
    DateWrapper.UTC = PreviousDate.UTC;
    DateWrapper.prototype =
        PreviousDate.prototype;
    globalThis.Date = DateWrapper;
    if (hasPerformanceNow) {
        performance.now = function apertureDeterminismPerformanceNow() {
            activeScope?.report("performance.now");
            return previousPerformanceNow.call(performance);
        };
    }
    try {
        return callback();
    }
    finally {
        Math.random = previousMathRandom;
        globalThis.Date = PreviousDate;
        Date.now = previousDateNow;
        if (hasPerformanceNow) {
            performance.now = previousPerformanceNow;
        }
        activeScope = previousScope;
    }
}
//# sourceMappingURL=determinism.js.map