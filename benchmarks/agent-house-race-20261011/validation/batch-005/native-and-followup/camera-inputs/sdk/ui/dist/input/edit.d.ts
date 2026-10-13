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
export type InputAction = {
    readonly type: "insert";
    readonly text: string;
} | {
    readonly type: "deleteBackward";
} | {
    readonly type: "deleteForward";
} | {
    readonly type: "moveLeft";
    readonly select?: boolean;
} | {
    readonly type: "moveRight";
    readonly select?: boolean;
} | {
    readonly type: "home";
    readonly select?: boolean;
} | {
    readonly type: "end";
    readonly select?: boolean;
} | {
    readonly type: "selectAll";
} | {
    readonly type: "setValue";
    readonly value: string;
    readonly caret?: number;
} | {
    readonly type: "setCaret";
    readonly caret: number;
    readonly anchor?: number;
};
/** Create an input state, optionally placing the caret at the end. */
export declare function createInputState(value?: string): InputState;
/** The normalized `[start, end]` selection range (start ≤ end). */
export declare function selectionRange(state: InputState): {
    start: number;
    end: number;
};
/** Whether any characters are selected. */
export declare function hasSelection(state: InputState): boolean;
/** The currently selected substring (empty when there is no selection). */
export declare function selectedText(state: InputState): string;
/** Apply an editing action, returning a new (clamped, valid) state. */
export declare function editText(state: InputState, action: InputAction): InputState;
/** Mask a value for password display (e.g. `"abc"` → `"•••"`). */
export declare function maskValue(value: string, maskChar?: string): string;
//# sourceMappingURL=edit.d.ts.map