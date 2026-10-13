import { EcsType, defineComponent, } from "@aperture-engine/simulation";
/**
 * Styling for a scroll node's rendered scrollbar. Attach to an entity that also
 * has `UiScroll`; the extractor synthesizes a vertical thumb panel sized from
 * the content/viewport ratio when the content overflows. Without this component,
 * a scroll node still renders a default-styled thumb.
 */
export const UiScrollbar = defineComponent("aperture.ui.scrollbar", {
    enabled: { type: EcsType.Boolean, default: true },
    width: { type: EcsType.Float32, default: 6 },
    minThumb: { type: EcsType.Float32, default: 16 },
    color: {
        type: EcsType.Color,
        default: [1, 1, 1, 0.35],
    },
}, "Scrollbar thumb styling for a UI scroll node.");
export function createUiScrollbar(input = {}) {
    return {
        enabled: input.enabled ?? true,
        width: input.width ?? 6,
        minThumb: input.minThumb ?? 16,
        color: (input.color ?? [1, 1, 1, 0.35]),
    };
}
export function withUiScrollbar(input = {}) {
    return (entity, context) => {
        context.world.registerComponent(UiScrollbar);
        entity.addComponent(UiScrollbar, createUiScrollbar(input));
    };
}
//# sourceMappingURL=ui-scrollbar.js.map