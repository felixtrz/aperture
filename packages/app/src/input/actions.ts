import { signal as createSignal, type Signal } from "@preact/signals-core";
import type { InputActionDescriptor } from "../config.js";
import type {
  InputAction,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
  InputButtonPressedSignal,
  InputVec2Like,
} from "./types.js";

export function createInputActions(
  descriptors: Record<string, InputActionDescriptor>,
): Record<string, InputAction> {
  const output: Record<string, InputAction> = {};

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

export function beginActionFrame(action: InputAction): void {
  if (action.kind === "button") {
    (action as InputButtonActionImpl).beginFrame();
  } else if (action.kind === "axis1d") {
    (action as InputAxis1dActionImpl).beginFrame();
  } else {
    (action as InputAxis2dActionImpl).beginFrame();
  }
}

export function setButtonActionPressed(
  action: InputButtonAction,
  pressed: boolean,
): void {
  (action as InputButtonActionImpl).setPressed(pressed);
}

export function setAxis1dActionValue(
  action: InputAxis1dAction,
  value: number,
): void {
  (action as InputAxis1dActionImpl).setValue(value);
}

export function setAxis2dActionValue(
  action: InputAxis2dAction,
  x: number,
  y: number,
): void {
  (action as InputAxis2dActionImpl).setValue(x, y);
}

class InputButtonActionImpl implements InputButtonAction {
  readonly kind = "button";
  readonly value = createSignal(false);
  readonly pressed = createCallableSignal(this.value);
  #previous = false;
  #down = false;
  #up = false;

  beginFrame(): void {
    this.#previous = this.value.value;
    this.#down = false;
    this.#up = false;
  }

  setPressed(pressed: boolean): void {
    this.value.value = pressed;
    this.#down = !this.#previous && pressed;
    this.#up = this.#previous && !pressed;
  }

  down(): boolean {
    return this.#down;
  }

  up(): boolean {
    return this.#up;
  }
}

function createCallableSignal(
  source: Signal<boolean>,
): InputButtonPressedSignal {
  const callable = (() => source.value) as InputButtonPressedSignal;

  Object.defineProperty(callable, "value", {
    get() {
      return source.value;
    },
    set(value: boolean) {
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

class InputAxis1dActionImpl implements InputAxis1dAction {
  readonly kind = "axis1d";
  readonly value = createSignal(0);
  #previous = 0;

  beginFrame(): void {
    this.#previous = this.value.value;
  }

  setValue(value: number): void {
    this.value.value = value;
  }

  previous(): number {
    return this.#previous;
  }

  read(): number {
    return this.value.value;
  }
}

class InputAxis2dActionImpl implements InputAxis2dAction {
  readonly kind = "axis2d";
  readonly x = createSignal(0);
  readonly y = createSignal(0);
  #previousX = 0;
  #previousY = 0;

  beginFrame(): void {
    this.#previousX = this.x.value;
    this.#previousY = this.y.value;
  }

  setValue(x: number, y: number): void {
    this.x.value = x;
    this.y.value = y;
  }

  previous(out: InputVec2Like): InputVec2Like {
    out.x = this.#previousX;
    out.y = this.#previousY;
    return out;
  }

  read(out: InputVec2Like): InputVec2Like {
    out.x = this.x.value;
    out.y = this.y.value;
    return out;
  }
}
