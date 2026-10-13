import type { ReadonlySignal, Signal } from "@preact/signals-core";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
export type ApertureEffectPhase = "input" | "update" | "postUpdate";
export interface ApertureEffectOptions {
    readonly phase?: ApertureEffectPhase;
    readonly priority?: number;
}
export interface ApertureEffectHandle {
    dispose(): void;
}
export interface ApertureEffects {
    watch<TValue>(watched: ReadonlySignal<TValue> | Signal<TValue>, callback: (value: TValue) => void, options?: ApertureEffectOptions): ApertureEffectHandle;
    onQueryEnter(query: ApertureQuery, callback: (entity: Entity) => void, options?: ApertureEffectOptions): ApertureEffectHandle;
    /** Runs pending effect callbacks; returns how many values were flushed. */
    flush(phase?: ApertureEffectPhase): number;
    dispose(): void;
}
export interface ApertureQuery {
    readonly entities: Set<Entity>;
    subscribe?(type: "qualify" | "disqualify", callback: (entity: Entity) => void, immediate?: boolean): () => void;
}
export type ScheduledEffects = ApertureEffects;
export interface ScheduledEffectsOptions {
    readonly runCallback?: (input: {
        readonly phase: ApertureEffectPhase;
        readonly callback: () => void;
    }) => void;
}
export declare function flushApertureSystemEffects(world: EcsWorld, phase?: ApertureEffectPhase): number;
export declare function createScheduledEffects(options?: ScheduledEffectsOptions): ScheduledEffects;
export declare function registerSystemEffects(system: object, effects: ScheduledEffects): void;
//# sourceMappingURL=effects.d.ts.map