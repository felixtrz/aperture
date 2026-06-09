import { signal as createSignal, type Signal } from "@preact/signals-core";
import type {
  ApertureConfig,
  InputActionBinding,
  InputActionConfigEntry,
  InputActionDescriptor,
} from "../config.js";
import type {
  ApertureGeneratedInputEvent,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  InputAction,
  InputResourceBase,
} from "./types.js";
import {
  beginActionFrame,
  createInputActions,
  setAxis1dActionValue,
  setAxis2dActionValue,
  setButtonActionPressed,
} from "./actions.js";
import { bindingAxis1d, bindingAxis2d, bindingPressed } from "./bindings.js";
import { createStatefulGamepadsState } from "./gamepads.js";
import { createStatefulKeyboardState } from "./keyboard.js";
export { createInputResourceSummary } from "./summary.js";
export type {
  ApertureGeneratedGamepadInputEvent,
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputResetEvent,
  ApertureGeneratedKeyboardInputEvent,
  ApertureGeneratedPointerInputEvent,
  ApertureGeneratedPointerName,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  ApertureInputSummary,
  GamepadButtonState,
  InputAction,
  InputActionKind,
  InputActionSignals,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
  InputButtonPressedSignal,
  InputResourceBase,
  InputVec2Like,
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadStickState,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./types.js";

export function createInputResource(
  config: ApertureConfig | undefined,
): InputResourceBase {
  return new InputResourceImpl(config);
}

export function advanceInputResource(
  input: InputResourceBase,
  events: readonly ApertureGeneratedInputEvent[] = [],
): void {
  input.advanceFrame(events);
}

class InputResourceImpl implements InputResourceBase {
  readonly actions: Record<string, InputAction>;
  readonly pointer = {
    primary: {
      position: createSignal<readonly [number, number]>([0, 0]),
      pressed: createSignal(false),
    },
  };
  readonly keyboard = createStatefulKeyboardState();
  readonly gamepads = createStatefulGamepadsState();
  readonly gamepad: Record<string, Signal<number>> = {};
  readonly xr = {
    active: createSignal(false),
  };
  readonly #descriptors: Record<string, InputActionDescriptor>;
  readonly #virtualActions = new Map<string, VirtualActionState>();
  #diagnostics: readonly ApertureInputDiagnostic[] = [];

  constructor(config: ApertureConfig | undefined) {
    this.#descriptors = normalizeActionDescriptors(
      config?.input?.actions ?? {},
    );
    this.actions = createInputActions(this.#descriptors);
  }

  advanceFrame(events: readonly ApertureGeneratedInputEvent[] = []): void {
    this.keyboard.advanceFrame();
    this.gamepads.advanceFrame();
    this.#diagnostics = [];

    for (const action of Object.values(this.actions)) {
      beginActionFrame(action);
    }

    for (const event of events) {
      this.#applyEvent(event);
    }

    this.#resolveActions();
    this.#diagnostics = [...this.#diagnostics, ...this.gamepads.diagnostics()];
  }

  diagnostics(): readonly ApertureInputDiagnostic[] {
    return this.#diagnostics;
  }

  #applyEvent(event: ApertureGeneratedInputEvent): void {
    if (event.kind === "batch") {
      for (const nested of event.events) {
        this.#applyEvent(nested);
      }
      return;
    }

    if (event.kind === "pointer") {
      if (event.pointer !== "primary") {
        return;
      }

      if (event.position !== undefined) {
        this.pointer.primary.position.value = [
          clamp01(event.position[0]),
          clamp01(event.position[1]),
        ];
      }

      if (event.pressed !== undefined) {
        this.pointer.primary.pressed.value = event.pressed;
      }
      return;
    }

    if (event.kind === "keyboard") {
      const code = event.code ?? event.key;
      if (typeof code === "string" && code.length > 0) {
        this.keyboard.applyKey(code, event.pressed);
      }
      return;
    }

    if (event.kind === "gamepad") {
      this.gamepads.updateSnapshots(event.gamepads, {
        replace: event.replace ?? true,
      });
      this.#syncLegacyGamepadSignals();
      return;
    }

    if (event.kind === "virtualAction") {
      this.#applyVirtualAction(event);
      return;
    }

    this.#reset(event.reason ?? "reset");
  }

  #applyVirtualAction(event: ApertureGeneratedVirtualActionInputEvent): void {
    const action = this.actions[event.action];
    if (action === undefined) {
      this.#diagnostics = [
        ...this.#diagnostics,
        {
          code: "aperture.input.unknownAction",
          severity: "error",
          message: `Input action '${event.action}' is not configured.`,
          data: {
            action: event.action,
            available: Object.keys(this.actions),
          },
          suggestedFix:
            "Use one of the configured input action names or add the action to aperture.config.ts.",
        },
      ];
      return;
    }

    const state = this.#virtualActions.get(event.action) ?? {};
    const next: VirtualActionState = { ...state };

    if (action.kind === "button") {
      const pressed =
        event.pressed ??
        (typeof event.value === "boolean"
          ? event.value
          : typeof event.value === "number"
            ? event.value > 0
            : undefined);

      if (pressed !== undefined) {
        next.pressed = pressed;
      }
    } else if (action.kind === "axis1d") {
      const value =
        typeof event.value === "number"
          ? event.value
          : event.pressed === true
            ? 1
            : event.pressed === false
              ? 0
              : undefined;

      if (value !== undefined) {
        next.value = clamp(value, -1, 1);
      }
    } else {
      if (event.x !== undefined) {
        next.x = clamp(event.x, -1, 1);
      }
      if (event.y !== undefined) {
        next.y = clamp(event.y, -1, 1);
      }
    }

    this.#virtualActions.set(event.action, next);
  }

  #reset(_reason: string): void {
    this.keyboard.releaseAll();
    this.gamepads.releaseAll();
    this.pointer.primary.pressed.value = false;
    this.#virtualActions.clear();
  }

  #resolveActions(): void {
    for (const [name, descriptor] of Object.entries(this.#descriptors)) {
      const action = this.actions[name];
      if (action === undefined) {
        continue;
      }

      const virtual = this.#virtualActions.get(name);

      if (descriptor.kind === "button" && action.kind === "button") {
        const pressed =
          descriptor.bindings.some((binding) =>
            bindingPressed(binding, this),
          ) || virtual?.pressed === true;
        setButtonActionPressed(action, pressed);
        continue;
      }

      if (descriptor.kind === "axis1d" && action.kind === "axis1d") {
        const value = clamp(
          descriptor.bindings.reduce(
            (sum, binding) => sum + bindingAxis1d(binding, this),
            virtual?.value ?? 0,
          ),
          -1,
          1,
        );
        setAxis1dActionValue(action, value);
        continue;
      }

      if (descriptor.kind === "axis2d" && action.kind === "axis2d") {
        const value = { x: virtual?.x ?? 0, y: virtual?.y ?? 0 };

        for (const binding of descriptor.bindings) {
          const next = bindingAxis2d(binding, this);
          value.x += next.x;
          value.y += next.y;
        }

        setAxis2dActionValue(
          action,
          clamp(value.x, -1, 1),
          clamp(value.y, -1, 1),
        );
      }
    }
  }

  #syncLegacyGamepadSignals(): void {
    const primary = this.gamepads.primary;
    if (primary === null) {
      return;
    }

    const sticks = [
      ["leftStick.x", primary.leftStick.x],
      ["leftStick.y", primary.leftStick.y],
      ["rightStick.x", primary.rightStick.x],
      ["rightStick.y", primary.rightStick.y],
    ] as const;

    for (const [name, value] of sticks) {
      const signal = this.gamepad[name] ?? createSignal(0);
      this.gamepad[name] = signal;
      signal.value = value;
    }
  }
}

interface VirtualActionState {
  pressed?: boolean;
  value?: number;
  x?: number;
  y?: number;
}

function normalizeActionDescriptors(
  actions: Readonly<Record<string, InputActionConfigEntry>>,
): Record<string, InputActionDescriptor> {
  const output: Record<string, InputActionDescriptor> = {};

  for (const [name, descriptor] of Object.entries(actions)) {
    output[name] = normalizeActionDescriptor(descriptor);
  }

  return output;
}

function normalizeActionDescriptor(
  descriptor: InputActionConfigEntry,
): InputActionDescriptor {
  if (isInputActionBindingArray(descriptor)) {
    return { kind: "button", bindings: descriptor };
  }

  return descriptor;
}

function isInputActionBindingArray(
  value: InputActionConfigEntry,
): value is readonly InputActionBinding[] {
  return Array.isArray(value);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(min, Math.min(max, value));
}
