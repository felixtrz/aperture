import type {
  GamepadButtonName,
  InputActionBinding,
  InputGamepadAxisBinding,
  InputGamepadButtonBinding,
  InputGamepadStickBinding,
  InputKeyboard1dBinding,
  InputKeyboard2dBinding,
  KeyboardBinding,
  PointerBinding,
} from "../config.js";
import { DEFAULT_GAMEPAD_DEADZONE, applyGamepadDeadzone } from "./gamepads.js";
import type {
  InputVec2Like,
  StatefulGamepadsState,
  StatefulKeyboardState,
  StatefulPointerState,
} from "./types.js";

export interface InputBindingResource {
  readonly keyboard: StatefulKeyboardState;
  readonly gamepads: StatefulGamepadsState;
  readonly pointer: StatefulPointerState;
}

export function bindingPressed(
  binding: InputActionBinding,
  resource: InputBindingResource,
): boolean {
  if (bindingHasKind(binding, "key")) {
    return (
      resource.keyboard.pressed(binding.code) ||
      resource.keyboard.down(binding.code)
    );
  }

  if (bindingHasKind(binding, "pointer")) {
    return pointerPressed(resource.pointer, binding.pointer);
  }

  if (bindingHasKind(binding, "gamepad-button")) {
    return gamepadButtonPressed(resource, binding.button, binding.gamepadIndex);
  }

  if (isLegacyKeyboardBinding(binding)) {
    return (
      resource.keyboard.pressed(binding.keyboard) ||
      resource.keyboard.down(binding.keyboard)
    );
  }

  if (isLegacyPointerBinding(binding)) {
    return pointerPressed(resource.pointer, binding.pointer);
  }

  if (isLegacyGamepadBinding(binding)) {
    return gamepadButtonPressed(resource, binding.gamepad as GamepadButtonName);
  }

  return false;
}

export function bindingAxis1d(
  binding: InputActionBinding,
  resource: InputBindingResource,
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

export function bindingAxis2d(
  binding: InputActionBinding,
  resource: InputBindingResource,
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
  resource: InputBindingResource,
  button: GamepadButtonName,
  index?: number,
): boolean {
  const device =
    index === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(index);

  return device?.pressed(button) === true || device?.down(button) === true;
}

function pointerPressed(
  pointer: StatefulPointerState,
  name: PointerBinding["pointer"],
): boolean {
  return pointer[name].pressed.value || pointer[name].pressedThisFrame.value;
}

function gamepadButtonValue(
  resource: InputBindingResource,
  binding: InputGamepadButtonBinding,
): number {
  const device =
    binding.gamepadIndex === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(binding.gamepadIndex);

  return device?.button(binding.button).value ?? 0;
}

function gamepadStickValue(
  resource: InputBindingResource,
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
  resource: InputBindingResource,
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
