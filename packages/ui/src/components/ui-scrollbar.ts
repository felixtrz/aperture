import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

/**
 * Styling for a scroll node's rendered scrollbar. Attach to an entity that also
 * has `UiScroll`; the extractor synthesizes a vertical thumb panel sized from
 * the content/viewport ratio when the content overflows. Without this component,
 * a scroll node still renders a default-styled thumb.
 */
export const UiScrollbar = defineComponent(
  "aperture.ui.scrollbar",
  {
    enabled: { type: EcsType.Boolean, default: true },
    width: { type: EcsType.Float32, default: 6 },
    minThumb: { type: EcsType.Float32, default: 16 },
    color: {
      type: EcsType.Color,
      default: [1, 1, 1, 0.35] as [number, number, number, number],
    },
  },
  "Scrollbar thumb styling for a UI scroll node.",
);

export interface UiScrollbarInput {
  readonly enabled?: boolean;
  readonly width?: number;
  readonly minThumb?: number;
  readonly color?: readonly [number, number, number, number];
}

export function createUiScrollbar(
  input: UiScrollbarInput = {},
): ComponentInitialData<typeof UiScrollbar> {
  return {
    enabled: input.enabled ?? true,
    width: input.width ?? 6,
    minThumb: input.minThumb ?? 16,
    color: (input.color ?? [1, 1, 1, 0.35]) as [number, number, number, number],
  };
}

export function withUiScrollbar(
  input: UiScrollbarInput = {},
): (entity: Entity, context: { readonly world: EcsWorld }) => void {
  return (entity, context) => {
    context.world.registerComponent(UiScrollbar);
    entity.addComponent(UiScrollbar, createUiScrollbar(input));
  };
}
