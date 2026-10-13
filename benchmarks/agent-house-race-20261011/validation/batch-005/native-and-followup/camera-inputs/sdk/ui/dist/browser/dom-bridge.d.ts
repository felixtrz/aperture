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
export declare function createHiddenInputBridge(element: HiddenInputElementLike, onChange: (state: InputState) => void): HiddenInputBridge;
/**
 * Create and attach an off-screen DOM input element suitable for the bridge.
 * Positioned far off-screen (not `display:none`, which cannot hold focus) per
 * the hidden-input-mirror pattern. Requires a DOM (`document`); call on the main
 * thread.
 */
export declare function createHiddenInputElement(doc: Document, options?: {
    multiline?: boolean;
    type?: string;
}): HTMLInputElement | HTMLTextAreaElement;
//# sourceMappingURL=dom-bridge.d.ts.map