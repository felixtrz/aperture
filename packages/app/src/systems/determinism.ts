import type { SystemDiagnostics } from "./diagnostics.js";

export type ApertureDeterminismDiagnosticsMode = "off" | "warn" | "error";

export interface ApertureDeterminismDiagnosticsOptions {
  readonly globals?: ApertureDeterminismDiagnosticsMode;
}

export type ApertureDeterminismRunPhase =
  | "init"
  | "update"
  | "fixedUpdate"
  | "effect:input"
  | "effect:update"
  | "effect:postUpdate";

export interface ApertureDeterminismRunInput {
  readonly system: string;
  readonly phase: ApertureDeterminismRunPhase;
}

export interface ApertureDeterminismDiagnostics {
  run<T>(input: ApertureDeterminismRunInput, callback: () => T): T;
}

type NondeterministicGlobalApi =
  | "Math.random"
  | "Date.now"
  | "new Date"
  | "performance.now";

interface ActiveScope {
  readonly report: (api: NondeterministicGlobalApi) => void;
}

let activeScope: ActiveScope | null = null;

export function createApertureDeterminismDiagnostics(options: {
  readonly diagnostics: SystemDiagnostics;
  readonly mode?: ApertureDeterminismDiagnosticsMode;
}): ApertureDeterminismDiagnostics {
  const mode = options.mode ?? "off";
  const reported = new Set<string>();

  if (mode === "off") {
    return {
      run(_input, callback) {
        return callback();
      },
    };
  }

  return {
    run(input, callback) {
      return runWithNondeterministicGlobalHooks(
        {
          report(api) {
            const key = `${input.system}:${input.phase}:${api}`;
            if (reported.has(key)) {
              return;
            }
            reported.add(key);
            const data = {
              api,
              phase: input.phase,
              system: input.system,
              suggestedApi:
                api === "Math.random" ? "context.random" : "context.time",
            };

            if (mode === "error") {
              options.diagnostics.error(
                "aperture.determinism.nondeterministicGlobal",
                data,
              );
            } else {
              options.diagnostics.warn(
                "aperture.determinism.nondeterministicGlobal",
                data,
              );
            }
          },
        },
        callback,
      );
    },
  };
}

function runWithNondeterministicGlobalHooks<T>(
  scope: ActiveScope,
  callback: () => T,
): T {
  const previousScope = activeScope;
  const previousMathRandom = Math.random;
  const previousDateNow = Date.now;
  const PreviousDate = Date;
  const previousPerformanceNow =
    typeof performance === "undefined" ? undefined : performance.now;
  const hasPerformanceNow =
    previousPerformanceNow !== undefined &&
    typeof previousPerformanceNow === "function";

  activeScope = scope;
  Math.random = function apertureDeterminismMathRandom(): number {
    activeScope?.report("Math.random");
    return previousMathRandom.call(Math);
  };
  Date.now = function apertureDeterminismDateNow(): number {
    activeScope?.report("Date.now");
    return previousDateNow.call(PreviousDate);
  };

  const DateWrapper = function apertureDeterminismDate(
    this: Date | undefined,
    ...args: unknown[]
  ): Date | string {
    if (new.target !== undefined) {
      if (args.length === 0) {
        activeScope?.report("new Date");
      }
      return Reflect.construct(PreviousDate, args, new.target);
    }
    return Reflect.apply(PreviousDate, this, args) as string;
  } as unknown as DateConstructor;
  DateWrapper.now = Date.now;
  DateWrapper.parse = PreviousDate.parse;
  DateWrapper.UTC = PreviousDate.UTC;
  (DateWrapper as unknown as { prototype: Date }).prototype =
    PreviousDate.prototype;
  globalThis.Date = DateWrapper;

  if (hasPerformanceNow) {
    performance.now = function apertureDeterminismPerformanceNow(): number {
      activeScope?.report("performance.now");
      return previousPerformanceNow.call(performance);
    };
  }

  try {
    return callback();
  } finally {
    Math.random = previousMathRandom;
    globalThis.Date = PreviousDate;
    Date.now = previousDateNow;
    if (hasPerformanceNow) {
      performance.now = previousPerformanceNow;
    }
    activeScope = previousScope;
  }
}
