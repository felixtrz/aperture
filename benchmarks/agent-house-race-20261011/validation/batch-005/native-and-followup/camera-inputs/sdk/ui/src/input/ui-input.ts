import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

export const UiInputType = {
  Text: "text",
  Password: "password",
} as const;
export type UiInputType = (typeof UiInputType)[keyof typeof UiInputType];

/**
 * Editable text input state. Holds the value, caret/selection, focus, and type.
 * The caret/anchor are character indices. A main-thread hidden-DOM input mirror
 * (for IME / mobile keyboards) feeds edits in through this component; the
 * extractor renders the value (masked for password), caret, and selection.
 */
export const UiInput = defineComponent(
  "aperture.ui.input",
  {
    value: { type: EcsType.String, default: "" },
    placeholder: { type: EcsType.String, default: "" },
    type: { type: EcsType.Enum, enum: UiInputType, default: UiInputType.Text },
    caret: { type: EcsType.Int32, default: 0 },
    anchor: { type: EcsType.Int32, default: 0 },
    focused: { type: EcsType.Boolean, default: false },
    editable: { type: EcsType.Boolean, default: true },
    maxLength: { type: EcsType.Int32, default: -1 },
  },
  "Editable text input state (value, caret, selection, focus).",
);

export interface UiInputInput {
  readonly value?: string;
  readonly placeholder?: string;
  readonly type?: UiInputType;
  readonly caret?: number;
  readonly anchor?: number;
  readonly focused?: boolean;
  readonly editable?: boolean;
  readonly maxLength?: number;
}

export function createUiInput(
  input: UiInputInput = {},
): ComponentInitialData<typeof UiInput> {
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

export function withUiInput(
  input: UiInputInput = {},
): (entity: Entity, context: { readonly world: EcsWorld }) => void {
  return (entity, context) => {
    context.world.registerComponent(UiInput);
    entity.addComponent(UiInput, createUiInput(input));
  };
}
