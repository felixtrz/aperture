import { signal as createSignal, type Signal } from "@preact/signals-core";
import type {
  ApertureConfig,
  GamepadButtonName,
  InputActionBinding,
  InputActionConfigEntry,
  InputActionDescriptor,
  InputGamepadAxisBinding,
  InputGamepadButtonBinding,
  InputGamepadStickBinding,
  InputKeyboard1dBinding,
  InputKeyboard2dBinding,
  KeyboardBinding,
  PointerBinding,
} from "./config.js";
import type {
  ApertureGeneratedInputEvent,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  ApertureInputSummary,
  InputAction,
  InputResourceBase,
  InputVec2Like,
  StatefulKeyboardState,
} from "./input-state-types.js";
import {
  beginActionFrame,
  createInputActions,
  setAxis1dActionValue,
  setAxis2dActionValue,
  setButtonActionPressed,
} from "./input-state-actions.js";
import {
  DEFAULT_GAMEPAD_DEADZONE,
  applyGamepadDeadzone,
  createStatefulGamepadsState,
} from "./input-state-gamepads.js";
import { createStatefulKeyboardState } from "./input-state-keyboard.js";
export type {
  ApertureGeneratedGamepadInputEvent,
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputBatchEvent,
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
} from "./input-state-types.js";

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

export function createInputResourceSummary(
  input: InputResourceBase,
): ApertureInputSummary {
  const actions: ApertureInputSummary["actions"] = {};

  for (const [name, action] of Object.entries(input.actions)) {
    if (action.kind === "button") {
      actions[name] = {
        kind: "button",
        pressed: action.pressed.value,
        value: action.value.value,
        down: action.down(),
        up: action.up(),
      };
      continue;
    }

    if (action.kind === "axis1d") {
      actions[name] = {
        kind: "axis1d",
        value: action.value.value,
        previous: action.previous(),
      };
      continue;
    }

    const previous = { x: 0, y: 0 };
    action.previous(previous);
    actions[name] = {
      kind: "axis2d",
      x: action.x.value,
      y: action.y.value,
      previous: [previous.x, previous.y],
    };
  }

  return {
    actions,
    pointer: {
      primary: {
        position: input.pointer.primary.position.value,
        pressed: input.pointer.primary.pressed.value,
      },
    },
    keyboard: input.keyboard.summary(),
    gamepads: input.gamepads.summary(),
    diagnostics: input.diagnostics(),
  };
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

function bindingPressed(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): boolean {
  if (bindingHasKind(binding, "key")) {
    return resource.keyboard.pressed(binding.code);
  }

  if (bindingHasKind(binding, "pointer")) {
    return (
      binding.pointer === "primary" && resource.pointer.primary.pressed.value
    );
  }

  if (bindingHasKind(binding, "gamepad-button")) {
    return gamepadButtonPressed(resource, binding.button, binding.gamepadIndex);
  }

  if (isLegacyKeyboardBinding(binding)) {
    return resource.keyboard.pressed(binding.keyboard);
  }

  if (isLegacyPointerBinding(binding)) {
    return (
      binding.pointer === "primary" && resource.pointer.primary.pressed.value
    );
  }

  if (isLegacyGamepadBinding(binding)) {
    return gamepadButtonPressed(resource, binding.gamepad as GamepadButtonName);
  }

  return false;
}

function bindingAxis1d(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): number {
  if (isLegacyKeyboardBinding(binding)) {
    return resource.keyboard.pressed(binding.keyboard) ? 1 : 0;
  }

  if (bindingHasKind(binding, "key")) {
    return resource.keyboard.pressed(binding.code) ? 1 : 0;
  }

  if (bindingHasKind(binding, "keyboard1d")) {
    return keyboard1dValue(resource.keyboard, binding);
  }

  if (bindingHasKind(binding, "gamepad-axis")) {
    return gamepadAxisValue(resource, binding);
  }

  if (bindingHasKind(binding, "gamepad-button")) {
    return gamepadButtonValue(resource, binding);
  }

  return 0;
}

function bindingAxis2d(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): InputVec2Like {
  if (bindingHasKind(binding, "keyboard2d")) {
    return keyboard2dValue(resource.keyboard, binding);
  }

  if (bindingHasKind(binding, "gamepad-stick")) {
    return gamepadStickValue(resource, binding);
  }

  if (bindingHasKind(binding, "gamepad-axis")) {
    const value = gamepadAxisValue(resource, binding);
    return binding.component === "x" ? { x: value, y: 0 } : { x: 0, y: value };
  }

  return { x: 0, y: 0 };
}

function keyboard1dValue(
  keyboard: StatefulKeyboardState,
  binding: InputKeyboard1dBinding,
): number {
  return (
    anyPressed(keyboard, binding.positive ?? []) -
    anyPressed(keyboard, binding.negative ?? [])
  );
}

function keyboard2dValue(
  keyboard: StatefulKeyboardState,
  binding: InputKeyboard2dBinding,
): InputVec2Like {
  return {
    x:
      anyPressed(keyboard, binding.positiveX ?? []) -
      anyPressed(keyboard, binding.negativeX ?? []),
    y:
      anyPressed(keyboard, binding.positiveY ?? []) -
      anyPressed(keyboard, binding.negativeY ?? []),
  };
}

function anyPressed(
  keyboard: StatefulKeyboardState,
  codes: readonly string[],
): number {
  return codes.some((code) => keyboard.pressed(code)) ? 1 : 0;
}

function gamepadButtonPressed(
  resource: InputResourceImpl,
  button: GamepadButtonName,
  index?: number,
): boolean {
  const device =
    index === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(index);

  return device?.pressed(button) === true;
}

function gamepadButtonValue(
  resource: InputResourceImpl,
  binding: InputGamepadButtonBinding,
): number {
  const device =
    binding.gamepadIndex === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(binding.gamepadIndex);

  return device?.button(binding.button).value ?? 0;
}

function gamepadStickValue(
  resource: InputResourceImpl,
  binding: InputGamepadStickBinding,
): InputVec2Like {
  const device =
    binding.gamepadIndex === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(binding.gamepadIndex);
  const stick =
    binding.stick === "left" ? device?.leftStick : device?.rightStick;

  if (stick === undefined) {
    return { x: 0, y: 0 };
  }

  const value = { x: 0, y: 0 };
  stick.read(value);
  return {
    x: applyGamepadDeadzone(
      value.x,
      binding.deadzone ?? DEFAULT_GAMEPAD_DEADZONE,
    ),
    y: applyGamepadDeadzone(
      value.y,
      binding.deadzone ?? DEFAULT_GAMEPAD_DEADZONE,
    ),
  };
}

function gamepadAxisValue(
  resource: InputResourceImpl,
  binding: InputGamepadAxisBinding,
): number {
  const stick = gamepadStickValue(resource, {
    kind: "gamepad-stick",
    stick: binding.stick,
    ...(binding.gamepadIndex === undefined
      ? {}
      : { gamepadIndex: binding.gamepadIndex }),
    ...(binding.deadzone === undefined ? {} : { deadzone: binding.deadzone }),
  });
  const raw = binding.component === "x" ? stick.x : stick.y;

  return raw * (binding.scale ?? 1);
}

function isLegacyKeyboardBinding(
  binding: InputActionBinding,
): binding is KeyboardBinding {
  return "keyboard" in binding;
}

function isLegacyPointerBinding(
  binding: InputActionBinding,
): binding is PointerBinding {
  return "pointer" in binding && !("kind" in binding);
}

function isLegacyGamepadBinding(
  binding: InputActionBinding,
): binding is { readonly gamepad: string } {
  return "gamepad" in binding;
}

type ModernInputActionBinding = Extract<
  InputActionBinding,
  { readonly kind: string }
>;

function bindingHasKind<TKind extends ModernInputActionBinding["kind"]>(
  binding: InputActionBinding,
  kind: TKind,
): binding is Extract<ModernInputActionBinding, { readonly kind: TKind }> {
  return "kind" in binding && binding.kind === kind;
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
