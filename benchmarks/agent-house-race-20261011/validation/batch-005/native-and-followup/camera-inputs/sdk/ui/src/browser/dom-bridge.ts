import { type InputState } from "../input/edit.js";

/**
 * The subset of a DOM `<input>`/`<textarea>` the bridge needs. Modeled as an
 * interface so the mirror logic is unit-testable without a real DOM and so a
 * non-browser host can supply its own implementation.
 */
export interface HiddenInputElementLike {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  type: string;
  disabled: boolean;
  focus(): void;
  blur(): void;
  setSelectionRange(start: number, end: number): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Bridges a hidden DOM input element (the source of real keyboard/IME/clipboard
 * input on the main thread) to the worker-safe {@link InputState} model. The
 * host forwards resulting states to the worker (which updates the `UiInput`
 * component); when the model changes elsewhere, the host calls {@link
 * HiddenInputBridge.sync} to push it back into the element.
 */
export interface HiddenInputBridge {
  /** Read the element's current value + selection as an {@link InputState}. */
  read(): InputState;
  /** Write a model state into the element (value + selection). */
  sync(state: InputState): void;
  /** Focus the element and optionally place the selection. */
  focus(caret?: number, anchor?: number): void;
  /** Blur the element. */
  blur(): void;
  /** Remove listeners. */
  dispose(): void;
}

/**
 * Wire a {@link HiddenInputElementLike} to the input model. `onChange` fires with
 * the new state whenever the element's value or selection changes.
 */
export function createHiddenInputBridge(
  element: HiddenInputElementLike,
  onChange: (state: InputState) => void,
): HiddenInputBridge {
  const read = (): InputState => {
    const value = element.value;
    const length = value.length;
    const end = clampIndex(element.selectionEnd ?? length, length);
    const start = clampIndex(element.selectionStart ?? end, length);
    // The caret is the focus (moving) end; model it as `caret` with `anchor` at
    // the other end. DOM does not expose direction, so anchor = start.
    return { value, caret: end, anchor: start };
  };

  const emit = (): void => {
    onChange(read());
  };

  element.addEventListener("input", emit);
  element.addEventListener("keyup", emit);
  element.addEventListener("select", emit);
  element.addEventListener("focus", emit);

  return {
    read,
    sync(state: InputState): void {
      if (element.value !== state.value) {
        element.value = state.value;
      }
      const start = Math.min(state.caret, state.anchor);
      const end = Math.max(state.caret, state.anchor);
      element.setSelectionRange(start, end);
    },
    focus(caret?: number, anchor?: number): void {
      element.focus();
      if (caret !== undefined) {
        const a = anchor ?? caret;
        element.setSelectionRange(Math.min(a, caret), Math.max(a, caret));
      }
    },
    blur(): void {
      element.blur();
    },
    dispose(): void {
      element.removeEventListener("input", emit);
      element.removeEventListener("keyup", emit);
      element.removeEventListener("select", emit);
      element.removeEventListener("focus", emit);
    },
  };
}

/**
 * Create and attach an off-screen DOM input element suitable for the bridge.
 * Positioned far off-screen (not `display:none`, which cannot hold focus) per
 * the hidden-input-mirror pattern. Requires a DOM (`document`); call on the main
 * thread.
 */
export function createHiddenInputElement(
  doc: Document,
  options: { multiline?: boolean; type?: string } = {},
): HTMLInputElement | HTMLTextAreaElement {
  const element = doc.createElement(options.multiline ? "textarea" : "input");
  if (!options.multiline && options.type !== undefined) {
    (element as HTMLInputElement).type = options.type;
  }
  Object.assign(element.style, {
    position: "absolute",
    left: "-1000vw",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  doc.body.appendChild(element);
  return element;
}

function clampIndex(value: number, length: number): number {
  return Math.min(length, Math.max(0, value));
}
