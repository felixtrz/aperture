/**
 * Wire a {@link HiddenInputElementLike} to the input model. `onChange` fires with
 * the new state whenever the element's value or selection changes.
 */
export function createHiddenInputBridge(element, onChange) {
    const read = () => {
        const value = element.value;
        const length = value.length;
        const end = clampIndex(element.selectionEnd ?? length, length);
        const start = clampIndex(element.selectionStart ?? end, length);
        // The caret is the focus (moving) end; model it as `caret` with `anchor` at
        // the other end. DOM does not expose direction, so anchor = start.
        return { value, caret: end, anchor: start };
    };
    const emit = () => {
        onChange(read());
    };
    element.addEventListener("input", emit);
    element.addEventListener("keyup", emit);
    element.addEventListener("select", emit);
    element.addEventListener("focus", emit);
    return {
        read,
        sync(state) {
            if (element.value !== state.value) {
                element.value = state.value;
            }
            const start = Math.min(state.caret, state.anchor);
            const end = Math.max(state.caret, state.anchor);
            element.setSelectionRange(start, end);
        },
        focus(caret, anchor) {
            element.focus();
            if (caret !== undefined) {
                const a = anchor ?? caret;
                element.setSelectionRange(Math.min(a, caret), Math.max(a, caret));
            }
        },
        blur() {
            element.blur();
        },
        dispose() {
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
export function createHiddenInputElement(doc, options = {}) {
    const element = doc.createElement(options.multiline ? "textarea" : "input");
    if (!options.multiline && options.type !== undefined) {
        element.type = options.type;
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
function clampIndex(value, length) {
    return Math.min(length, Math.max(0, value));
}
//# sourceMappingURL=dom-bridge.js.map