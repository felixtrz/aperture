import { signal as createSignal, type Signal } from "@preact/signals-core";
import type {
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./input-state-types.js";

export function createStatefulKeyboardState(): StatefulKeyboardState {
  return new StatefulKeyboardStateImpl() as unknown as StatefulKeyboardState;
}

class StatefulKeyboardStateImpl {
  readonly #pressed = new Set<string>();
  readonly #down = new Set<string>();
  readonly #up = new Set<string>();
  readonly #signals = new Map<string, Signal<boolean>>();

  applyKey(code: string, pressed: boolean): void {
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

  advanceFrame(): void {
    this.#down.clear();
    this.#up.clear();
  }

  releaseAll(): void {
    for (const code of this.#pressed) {
      this.#up.add(code);
      this.signal(code).value = false;
    }
    this.#pressed.clear();
  }

  pressed(code: string): boolean {
    return this.#pressed.has(code);
  }

  down(code: string): boolean {
    return this.#down.has(code);
  }

  up(code: string): boolean {
    return this.#up.has(code);
  }

  signal(code: string): Signal<boolean> {
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

  pressedCodes(): readonly string[] {
    return [...this.#pressed].sort();
  }

  summary(): StatefulKeyboardSummary {
    return {
      pressed: [...this.#pressed].sort(),
      down: [...this.#down].sort(),
      up: [...this.#up].sort(),
    };
  }
}
