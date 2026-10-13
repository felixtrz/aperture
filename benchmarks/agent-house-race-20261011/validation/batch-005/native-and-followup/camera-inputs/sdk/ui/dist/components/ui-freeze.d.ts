import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "@aperture-engine/simulation";
/**
 * Marks an entity's subtree as layout-frozen: while enabled, the layout pass
 * does not re-apply its style/children and the engine skips it during
 * `calculate`, preserving the last computed layout. A game-oriented optimization
 * for static UI (HUDs, menus) that lets the world churn without paying for UI
 * relayout. Toggle `enabled` (or remove the component) to resume layout.
 */
export declare const UiFreezeLayout: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
/** Input for {@link createUiFreezeLayout} / {@link withUiFreezeLayout}. */
export interface UiFreezeLayoutInput {
    readonly enabled?: boolean;
}
/** Build initial {@link UiFreezeLayout} data. */
export declare function createUiFreezeLayout(input?: UiFreezeLayoutInput): ComponentInitialData<typeof UiFreezeLayout>;
/** Whether `entity` is currently frozen. */
export declare function isUiLayoutFrozen(entity: Entity): boolean;
/** Spawn initializer that attaches a {@link UiFreezeLayout} component. */
export declare function withUiFreezeLayout(input?: UiFreezeLayoutInput): (entity: Entity, context: {
    readonly world: EcsWorld;
}) => void;
//# sourceMappingURL=ui-freeze.d.ts.map