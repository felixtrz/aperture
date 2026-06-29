import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

/**
 * Marks an entity's subtree as layout-frozen: while enabled, the layout pass
 * does not re-apply its style/children and the engine skips it during
 * `calculate`, preserving the last computed layout. A game-oriented optimization
 * for static UI (HUDs, menus) that lets the world churn without paying for UI
 * relayout. Toggle `enabled` (or remove the component) to resume layout.
 */
export const UiFreezeLayout = defineComponent(
  "aperture.ui.freezeLayout",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Freezes a UI subtree's layout: the engine preserves its last computed rects until unfrozen.",
);

/** Input for {@link createUiFreezeLayout} / {@link withUiFreezeLayout}. */
export interface UiFreezeLayoutInput {
  readonly enabled?: boolean;
}

/** Build initial {@link UiFreezeLayout} data. */
export function createUiFreezeLayout(
  input: UiFreezeLayoutInput = {},
): ComponentInitialData<typeof UiFreezeLayout> {
  return { enabled: input.enabled ?? true };
}

/** Whether `entity` is currently frozen. */
export function isUiLayoutFrozen(entity: Entity): boolean {
  return (
    entity.hasComponent(UiFreezeLayout) &&
    entity.getValue(UiFreezeLayout, "enabled") !== false
  );
}

/** Spawn initializer that attaches a {@link UiFreezeLayout} component. */
export function withUiFreezeLayout(
  input: UiFreezeLayoutInput = {},
): (entity: Entity, context: { readonly world: EcsWorld }) => void {
  return (entity, context) => {
    context.world.registerComponent(UiFreezeLayout);
    entity.addComponent(UiFreezeLayout, createUiFreezeLayout(input));
  };
}
