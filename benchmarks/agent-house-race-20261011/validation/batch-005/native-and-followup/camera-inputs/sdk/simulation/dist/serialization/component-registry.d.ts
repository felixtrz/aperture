import type { AnyEcsComponent, EcsWorld } from "../ecs/index.js";
export interface ComponentRegistry {
    get(id: string): AnyEcsComponent | undefined;
    has(id: string): boolean;
    entityRefStringFields(id: string): readonly string[];
    readonly ids: readonly string[];
}
export interface ComponentRegistryOptions {
    /**
     * String fields that should be treated as serialized `index:generation`
     * entity-reference tokens during scene/prefab load. This keeps the generic
     * codec independent of domain packages whose public authoring still stores
     * refs as backend-friendly strings.
     */
    readonly entityRefStringFields?: Readonly<Record<string, readonly string[]>>;
}
export declare function createComponentRegistry(components: Iterable<AnyEcsComponent>, options?: ComponentRegistryOptions): ComponentRegistry;
/**
 * Build a registry from every component registered in `world` (scanned via the
 * public getComponentByTypeId, typeIds are sequential). Convenient for
 * instantiating documents into the SAME world that authored them — e.g. prefab
 * instantiation — where every needed component is already registered.
 */
export declare function componentRegistryFromWorld(world: EcsWorld, options?: ComponentRegistryOptions): ComponentRegistry;
//# sourceMappingURL=component-registry.d.ts.map