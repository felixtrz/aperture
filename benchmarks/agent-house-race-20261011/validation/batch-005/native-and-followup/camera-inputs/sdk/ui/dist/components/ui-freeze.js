import { EcsType, defineComponent, } from "@aperture-engine/simulation";
/**
 * Marks an entity's subtree as layout-frozen: while enabled, the layout pass
 * does not re-apply its style/children and the engine skips it during
 * `calculate`, preserving the last computed layout. A game-oriented optimization
 * for static UI (HUDs, menus) that lets the world churn without paying for UI
 * relayout. Toggle `enabled` (or remove the component) to resume layout.
 */
export const UiFreezeLayout = defineComponent("aperture.ui.freezeLayout", {
    enabled: { type: EcsType.Boolean, default: true },
}, "Freezes a UI subtree's layout: the engine preserves its last computed rects until unfrozen.");
/** Build initial {@link UiFreezeLayout} data. */
export function createUiFreezeLayout(input = {}) {
    return { enabled: input.enabled ?? true };
}
/** Whether `entity` is currently frozen. */
export function isUiLayoutFrozen(entity) {
    return (entity.hasComponent(UiFreezeLayout) &&
        entity.getValue(UiFreezeLayout, "enabled") !== false);
}
/** Spawn initializer that attaches a {@link UiFreezeLayout} component. */
export function withUiFreezeLayout(input = {}) {
    return (entity, context) => {
        context.world.registerComponent(UiFreezeLayout);
        entity.addComponent(UiFreezeLayout, createUiFreezeLayout(input));
    };
}
//# sourceMappingURL=ui-freeze.js.map