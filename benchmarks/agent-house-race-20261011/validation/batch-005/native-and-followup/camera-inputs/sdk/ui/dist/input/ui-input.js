import { EcsType, defineComponent, } from "@aperture-engine/simulation";
export const UiInputType = {
    Text: "text",
    Password: "password",
};
/**
 * Editable text input state. Holds the value, caret/selection, focus, and type.
 * The caret/anchor are character indices. A main-thread hidden-DOM input mirror
 * (for IME / mobile keyboards) feeds edits in through this component; the
 * extractor renders the value (masked for password), caret, and selection.
 */
export const UiInput = defineComponent("aperture.ui.input", {
    value: { type: EcsType.String, default: "" },
    placeholder: { type: EcsType.String, default: "" },
    type: { type: EcsType.Enum, enum: UiInputType, default: UiInputType.Text },
    caret: { type: EcsType.Int32, default: 0 },
    anchor: { type: EcsType.Int32, default: 0 },
    focused: { type: EcsType.Boolean, default: false },
    editable: { type: EcsType.Boolean, default: true },
    maxLength: { type: EcsType.Int32, default: -1 },
}, "Editable text input state (value, caret, selection, focus).");
export function createUiInput(input = {}) {
    const value = input.value ?? "";
    const caret = input.caret ?? value.length;
    return {
        value,
        placeholder: input.placeholder ?? "",
        type: input.type ?? UiInputType.Text,
        caret,
        anchor: input.anchor ?? caret,
        focused: input.focused ?? false,
        editable: input.editable ?? true,
        maxLength: input.maxLength ?? -1,
    };
}
export function withUiInput(input = {}) {
    return (entity, context) => {
        context.world.registerComponent(UiInput);
        entity.addComponent(UiInput, createUiInput(input));
    };
}
//# sourceMappingURL=ui-input.js.map