import { EcsType, defineComponent, } from "@aperture-engine/simulation";
/**
 * Visual box styling for a UI node: rounded corners and borders, rendered by the
 * SDF panel shader. Layered on top of `UiPanel`/`UiImage` fill. Corner radii are
 * `[topLeft, topRight, bottomRight, bottomLeft]`; border widths are
 * `[top, right, bottom, left]`; both in pixels.
 */
export const UiBox = defineComponent("aperture.ui.box", {
    borderRadius: {
        type: EcsType.Vec4,
        default: [0, 0, 0, 0],
    },
    borderWidth: {
        type: EcsType.Vec4,
        default: [0, 0, 0, 0],
    },
    borderColor: {
        type: EcsType.Color,
        default: [0, 0, 0, 1],
    },
}, "Rounded-corner + border styling for a UI node, rendered by the SDF panel shader.");
function toVec4(value) {
    if (value === undefined) {
        return [0, 0, 0, 0];
    }
    if (typeof value === "number") {
        return [value, value, value, value];
    }
    return [value[0], value[1], value[2], value[3]];
}
/** Build initial {@link UiBox} data, expanding uniform shorthands. */
export function createUiBox(input = {}) {
    return {
        borderRadius: toVec4(input.borderRadius),
        borderWidth: toVec4(input.borderWidth),
        borderColor: (input.borderColor ?? [0, 0, 0, 1]),
    };
}
/** Spawn initializer that attaches a {@link UiBox} component. */
export function withUiBox(input = {}) {
    return (entity, context) => {
        context.world.registerComponent(UiBox);
        entity.addComponent(UiBox, createUiBox(input));
    };
}
//# sourceMappingURL=ui-box.js.map