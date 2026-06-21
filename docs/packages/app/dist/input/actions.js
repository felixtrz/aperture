import { signal as createSignal } from "@preact/signals-core";
export function createInputActions(descriptors) {
    const output = {};
    for (const [name, descriptor] of Object.entries(descriptors)) {
        output[name] =
            descriptor.kind === "button"
                ? new InputButtonActionImpl()
                : descriptor.kind === "axis1d"
                    ? new InputAxis1dActionImpl()
                    : new InputAxis2dActionImpl();
    }
    return output;
}
export function beginActionFrame(action) {
    if (action.kind === "button") {
        action.beginFrame();
    }
    else if (action.kind === "axis1d") {
        action.beginFrame();
    }
    else {
        action.beginFrame();
    }
}
export function setButtonActionPressed(action, pressed) {
    action.setPressed(pressed);
}
export function setAxis1dActionValue(action, value) {
    action.setValue(value);
}
export function setAxis2dActionValue(action, x, y) {
    action.setValue(x, y);
}
class InputButtonActionImpl {
    kind = "button";
    value = createSignal(false);
    pressed = createCallableSignal(this.value);
    #previous = false;
    #down = false;
    #up = false;
    beginFrame() {
        this.#previous = this.value.value;
        this.#down = false;
        this.#up = false;
    }
    setPressed(pressed) {
        this.value.value = pressed;
        this.#down = !this.#previous && pressed;
        this.#up = this.#previous && !pressed;
    }
    down() {
        return this.#down;
    }
    up() {
        return this.#up;
    }
}
function createCallableSignal(source) {
    const callable = (() => source.value);
    Object.defineProperty(callable, "value", {
        get() {
            return source.value;
        },
        set(value) {
            source.value = value;
        },
    });
    callable.subscribe = source.subscribe.bind(source);
    callable.peek = source.peek.bind(source);
    callable.valueOf = source.valueOf.bind(source);
    callable.toString = source.toString.bind(source);
    callable.toJSON = source.toJSON.bind(source);
    callable.brand = source.brand;
    return callable;
}
class InputAxis1dActionImpl {
    kind = "axis1d";
    value = createSignal(0);
    #previous = 0;
    beginFrame() {
        this.#previous = this.value.value;
    }
    setValue(value) {
        this.value.value = value;
    }
    previous() {
        return this.#previous;
    }
    read() {
        return this.value.value;
    }
}
class InputAxis2dActionImpl {
    kind = "axis2d";
    x = createSignal(0);
    y = createSignal(0);
    #previousX = 0;
    #previousY = 0;
    beginFrame() {
        this.#previousX = this.x.value;
        this.#previousY = this.y.value;
    }
    setValue(x, y) {
        this.x.value = x;
        this.y.value = y;
    }
    previous(out) {
        out.x = this.#previousX;
        out.y = this.#previousY;
        return out;
    }
    read(out) {
        out.x = this.x.value;
        out.y = this.y.value;
        return out;
    }
}
//# sourceMappingURL=actions.js.map