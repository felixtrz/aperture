import type { ReadonlySignal, Signal } from "@preact/signals-core";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import { ApertureSystemError } from "./errors.js";

export type ApertureEffectPhase = "input" | "update" | "postUpdate";

export interface ApertureEffectOptions {
  readonly phase?: ApertureEffectPhase;
  readonly priority?: number;
}

export interface ApertureEffectHandle {
  dispose(): void;
}

export interface ApertureEffects {
  watch<TValue>(
    watched: ReadonlySignal<TValue> | Signal<TValue>,
    callback: (value: TValue) => void,
    options?: ApertureEffectOptions,
  ): ApertureEffectHandle;
  onQueryEnter(
    query: ApertureQuery,
    callback: (entity: Entity) => void,
    options?: ApertureEffectOptions,
  ): ApertureEffectHandle;
  /** Runs pending effect callbacks; returns how many values were flushed. */
  flush(phase?: ApertureEffectPhase): number;
  dispose(): void;
}

export interface ApertureQuery {
  readonly entities: Set<Entity>;
  subscribe?(
    type: "qualify" | "disqualify",
    callback: (entity: Entity) => void,
    immediate?: boolean,
  ): () => void;
}

export type ScheduledEffects = ApertureEffects;

export interface ScheduledEffectsOptions {
  readonly runCallback?: (input: {
    readonly phase: ApertureEffectPhase;
    readonly callback: () => void;
  }) => void;
}

const APERTURE_EFFECTS = Symbol("aperture.effects");

export function flushApertureSystemEffects(
  world: EcsWorld,
  phase: ApertureEffectPhase = "update",
): number {
  let flushed = 0;

  for (const system of world.getSystems()) {
    const effects = readRegisteredEffects(system);
    flushed += effects?.flush(phase) ?? 0;
  }

  return flushed;
}

export function createScheduledEffects(
  options: ScheduledEffectsOptions = {},
): ScheduledEffects {
  const runCallback =
    options.runCallback ??
    ((input: { readonly callback: () => void }) => {
      input.callback();
    });
  const entries = new Set<{
    readonly phase: ApertureEffectPhase;
    readonly priority: number;
    readonly dispose: () => void;
    readonly pending: unknown[];
    readonly callback: (value: never) => void;
  }>();

  return {
    watch(watched, callback, options = {}) {
      const entry = {
        phase: options.phase ?? "input",
        priority: options.priority ?? 0,
        dispose: () => undefined,
        pending: [] as unknown[],
        callback: callback as (value: never) => void,
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
        throw new ApertureSystemError(
          "aperture.effects.querySubscribeMissing",
          "Query enter effects require an EliCS query with subscribe().",
          "Pass an app system query from this.queries.",
        );
      }

      const entry = {
        phase: options.phase ?? "update",
        priority: options.priority ?? 0,
        dispose: () => undefined,
        pending: [] as unknown[],
        callback: callback as (value: never) => void,
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
          runCallback({
            phase,
            callback: () => {
              entry.callback(value as never);
            },
          });
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

export function registerSystemEffects(
  system: object,
  effects: ScheduledEffects,
): void {
  Object.defineProperty(system, APERTURE_EFFECTS, {
    value: effects,
    configurable: false,
  });
}

function readRegisteredEffects(system: unknown): ScheduledEffects | null {
  if (typeof system !== "object" || system === null) {
    return null;
  }

  const value = (system as Record<PropertyKey, unknown>)[APERTURE_EFFECTS];
  return isEffects(value) ? value : null;
}

function isEffects(value: unknown): value is ScheduledEffects {
  return (
    typeof value === "object" &&
    value !== null &&
    "flush" in value &&
    "dispose" in value
  );
}
