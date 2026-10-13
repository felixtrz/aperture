import { World } from "elics";
import type { AnyComponent, Component, DataType, Entity, TypedSchema, WorldOptions } from "elics";
export { Types as EcsType, createComponent as defineComponent, createSystem, } from "elics";
export type { ComponentInitialData, DataType, Entity, TypedSchema, WorldOptions, } from "elics";
export type EcsEntity = Entity;
export type AnyEcsComponent = AnyComponent;
export type EcsComponent<Schema extends TypedSchema<DataType> = TypedSchema<DataType>> = Component<Schema>;
export interface EntityVersionTracking {
    entityVersion(entity: Entity): number;
    markEntityChanged(entity: Entity): number;
    /**
     * Number of entity keys currently retained by change tracking. Diagnostic:
     * under correct bookkeeping this stays proportional to the live entity set,
     * not to the total number of entities ever created.
     */
    entityVersionTrackingSize(): number;
    /**
     * Monotonic counter bumped on every tracked world mutation (entity create/
     * destroy, component add/remove, setValue, vector-view set). Consumers can
     * compare it across phases to skip work when nothing changed (AI-60).
     * Indexed vector-view writes (view[i] = x) are NOT tracked (AI-62).
     */
    worldChangeVersion(): number;
    /**
     * Transform-only change counter (AI-67): bumped for LocalTransform /
     * WorldTransform value writes and by transform resolution, separately from
     * the structural entityVersion, so consumers (render extraction) can take a
     * matrix-only fast path without rebuilding cached packets.
     */
    entityTransformVersion(entity: Entity): number;
    markEntityTransformChanged(entity: Entity): number;
}
export type VersionedEcsWorld = World & EntityVersionTracking;
export type EcsWorld = VersionedEcsWorld;
/**
 * elics allocates each component's storage as a dense array sized to
 * `entityCapacity` ONCE (no growth), and throws a cryptic "offset is out of
 * bounds" when an entity row exceeds it. elics' own default is only 1000, which
 * any non-trivial 3D scene blows past (a single glTF expands to several entities;
 * a decorated track is ~1000+). Default to a generous capacity so apps don't hit
 * that wall, while still allowing an explicit override (threaded from app config
 * via worldOptions.entityCapacity). See showcase/racing/docs/PORT_PROGRESS.md.
 */
export declare const DEFAULT_ENTITY_CAPACITY = 16384;
export declare function createWorld(options?: Partial<WorldOptions>): EcsWorld;
/**
 * Look up a component by id in elics' process-global component registry
 * (populated by every `defineComponent` call). Used to pre-register app
 * components declared in a snapshot manifest before a scene decode.
 */
export declare function findDefinedComponent(id: string): AnyEcsComponent | undefined;
//# sourceMappingURL=index.d.ts.map