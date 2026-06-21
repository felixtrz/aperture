import { signal as createSignal } from "@preact/signals-core";
export function createStatefulKeyboardState() {
    return new StatefulKeyboardStateImpl();
}
class StatefulKeyboardStateImpl {
    #pressed = new Set();
    #down = new Set();
    #up = new Set();
    #signals = new Map();
    applyKey(code, pressed) {
        const signal = this.signal(code);
        if (pressed) {
            if (!this.#pressed.has(code)) {
                this.#down.add(code);
            }
            this.#pressed.add(code);
            signal.value = true;
            return;
        }
        if (this.#pressed.has(code)) {
            this.#up.add(code);
        }
        this.#pressed.delete(code);
        signal.value = false;
    }
    advanceFrame() {
        this.#down.clear();
        this.#up.clear();
    }
    releaseAll() {
        for (const code of this.#pressed) {
            this.#up.add(code);
            this.signal(code).value = false;
        }
        this.#pressed.clear();
    }
    pressed(code) {
        return this.#pressed.has(code);
    }
    down(code) {
        return this.#down.has(code);
    }
    up(code) {
        return this.#up.has(code);
    }
    signal(code) {
        let signal = this.#signals.get(code);
        if (signal !== undefined) {
            return signal;
        }
        signal = createSignal(false);
        this.#signals.set(code, signal);
        Object.defineProperty(this, code, {
            configurable: true,
            enumerable: true,
            value: signal,
            writable: false,
        });
        return signal;
    }
    pressedCodes() {
        return [...this.#pressed].sort();
    }
    summary() {
        return {
            pressed: [...this.#pressed].sort(),
            down: [...this.#down].sort(),
            up: [...this.#up].sort(),
        };
    }
}
//# sourceMappingURL=keyboard.js.map