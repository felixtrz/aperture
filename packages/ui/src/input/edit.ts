/**
 * Pure, deterministic text-editing model. This is the worker-safe core that
 * drives a `UiInput`: a hidden-DOM input mirror (for IME / mobile keyboards) or
 * direct key handling feeds {@link InputAction}s through {@link editText}, and
 * the resulting caret/selection is rendered as quads. No DOM dependency here, so
 * it stays deterministic and replay-safe.
 */

export interface InputState {
  /** The full text value. */
  readonly value: string;
  /** Caret index in `[0, value.length]` (the moving end of a selection). */
  readonly caret: number;
  /** Selection anchor (fixed end). Equal to `caret` when there is no selection. */
  readonly anchor: number;
}

export type InputAction =
  | { readonly type: "insert"; readonly text: string }
  | { readonly type: "deleteBackward" }
  | { readonly type: "deleteForward" }
  | { readonly type: "moveLeft"; readonly select?: boolean }
  | { readonly type: "moveRight"; readonly select?: boolean }
  | { readonly type: "home"; readonly select?: boolean }
  | { readonly type: "end"; readonly select?: boolean }
  | { readonly type: "selectAll" }
  | {
      readonly type: "setValue";
      readonly value: string;
      readonly caret?: number;
    }
  | {
      readonly type: "setCaret";
      readonly caret: number;
      readonly anchor?: number;
    };

/** Create an input state, optionally placing the caret at the end. */
export function createInputState(value = ""): InputState {
  return { value, caret: value.length, anchor: value.length };
}

/** The normalized `[start, end]` selection range (start ≤ end). */
export function selectionRange(state: InputState): {
  start: number;
  end: number;
} {
  return {
    start: Math.min(state.caret, state.anchor),
    end: Math.max(state.caret, state.anchor),
  };
}

/** Whether any characters are selected. */
export function hasSelection(state: InputState): boolean {
  return state.caret !== state.anchor;
}

/** The currently selected substring (empty when there is no selection). */
export function selectedText(state: InputState): string {
  const { start, end } = selectionRange(state);
  return state.value.slice(start, end);
}

/** Apply an editing action, returning a new (clamped, valid) state. */
export function editText(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case "insert":
      return replaceSelection(state, action.text);
    case "deleteBackward":
      return deleteBackward(state);
    case "deleteForward":
      return deleteForward(state);
    case "moveLeft":
      return moveCaret(state, caretLeft(state), action.select === true);
    case "moveRight":
      return moveCaret(state, caretRight(state), action.select === true);
    case "home":
      return moveCaret(state, 0, action.select === true);
    case "end":
      return moveCaret(state, state.value.length, action.select === true);
    case "selectAll":
      return { value: state.value, anchor: 0, caret: state.value.length };
    case "setValue": {
      const value = action.value;
      const caret = clamp(action.caret ?? value.length, 0, value.length);
      return { value, caret, anchor: caret };
    }
    case "setCaret": {
      const caret = clamp(action.caret, 0, state.value.length);
      const anchor = clamp(action.anchor ?? caret, 0, state.value.length);
      return { value: state.value, caret, anchor };
    }
  }
}

function replaceSelection(state: InputState, text: string): InputState {
  const { start, end } = selectionRange(state);
  const value = state.value.slice(0, start) + text + state.value.slice(end);
  const caret = start + text.length;
  return { value, caret, anchor: caret };
}

function deleteBackward(state: InputState): InputState {
  if (hasSelection(state)) {
    return replaceSelection(state, "");
  }
  if (state.caret === 0) {
    return state;
  }
  const value =
    state.value.slice(0, state.caret - 1) + state.value.slice(state.caret);
  const caret = state.caret - 1;
  return { value, caret, anchor: caret };
}

function deleteForward(state: InputState): InputState {
  if (hasSelection(state)) {
    return replaceSelection(state, "");
  }
  if (state.caret >= state.value.length) {
    return state;
  }
  const value =
    state.value.slice(0, state.caret) + state.value.slice(state.caret + 1);
  return { value, caret: state.caret, anchor: state.caret };
}

function caretLeft(state: InputState): number {
  // Collapsing a selection moves to its start.
  if (hasSelection(state)) {
    return selectionRange(state).start;
  }
  return Math.max(0, state.caret - 1);
}

function caretRight(state: InputState): number {
  if (hasSelection(state)) {
    return selectionRange(state).end;
  }
  return Math.min(state.value.length, state.caret + 1);
}

function moveCaret(state: InputState, to: number, select: boolean): InputState {
  const caret = clamp(to, 0, state.value.length);
  if (select) {
    return { value: state.value, caret, anchor: state.anchor };
  }
  // A non-selecting arrow on a selection collapses without re-moving.
  const target =
    !select && hasSelection(state) ? caret : clamp(to, 0, state.value.length);
  return { value: state.value, caret: target, anchor: target };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mask a value for password display (e.g. `"abc"` → `"•••"`). */
export function maskValue(value: string, maskChar = "•"): string {
  return maskChar.repeat([...value].length);
}
