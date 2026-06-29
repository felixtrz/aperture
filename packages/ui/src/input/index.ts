export {
  createInputState,
  editText,
  hasSelection,
  maskValue,
  selectedText,
  selectionRange,
  type InputAction,
  type InputState,
} from "./edit.js";
export {
  caretGeometry,
  caretOffset,
  monospaceAdvance,
  selectionRect,
  type AdvanceFn,
  type CaretGeometry,
  type SelectionRect,
} from "./caret.js";
export {
  UiInput,
  UiInputType,
  createUiInput,
  withUiInput,
  type UiInputInput,
} from "./ui-input.js";
export {
  createHiddenInputBridge,
  createHiddenInputElement,
  type HiddenInputBridge,
  type HiddenInputElementLike,
} from "./dom-bridge.js";
