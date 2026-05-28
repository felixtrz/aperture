import { ApertureConfigError } from "./errors.js";
import type {
  ApertureConfig,
  ApertureConfigAssetDescriptor,
  AssetPreloadPolicy,
  GamepadButtonName,
  GamepadStickName,
  InputActionBinding,
  InputActionConfigEntry,
  InputActionDescriptor,
  PointerBinding,
} from "./index.js";

export function validateApertureConfig(config: ApertureConfig): void {
  if (config.mode !== "browser" && config.mode !== "headless") {
    throw new ApertureConfigError(
      "aperture.config.invalidMode",
      `Aperture config mode must be 'browser' or 'headless', received '${String(
        config.mode,
      )}'.`,
      "Set mode to 'browser' for Vite/WebGPU presentation or 'headless' for Node-safe simulation.",
    );
  }

  if (
    config.mode === "browser" &&
    (config.canvas === undefined || config.canvas.trim().length === 0)
  ) {
    throw new ApertureConfigError(
      "aperture.config.missingCanvas",
      "Browser Aperture apps require a non-empty canvas selector.",
      "Add canvas: '#aperture' to aperture.config.ts.",
    );
  }

  for (const [id, descriptor] of Object.entries(config.assets ?? {})) {
    validateAssetId(id);
    validateAssetDescriptor(id, descriptor);
  }

  for (const pattern of config.systems ?? []) {
    if (pattern.trim().length === 0) {
      throw new ApertureConfigError(
        "aperture.config.emptySystemGlob",
        "System glob entries must be non-empty strings.",
        "Remove empty strings from the systems array.",
      );
    }
  }

  validateInputActions(config.input?.actions ?? {});
}

export function isPreloadPolicy(value: unknown): value is AssetPreloadPolicy {
  return value === "blocking" || value === "background" || value === "manual";
}

function validateAssetId(id: string): void {
  if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) {
    return;
  }

  throw new ApertureConfigError(
    "aperture.config.invalidAssetId",
    `Asset id '${id}' is not a valid Aperture asset key.`,
    "Use an identifier-like key such as robot, floorColor, or level.crate.",
  );
}

function validateAssetDescriptor(
  id: string,
  descriptor: ApertureConfigAssetDescriptor,
): void {
  if (
    descriptor.kind !== "gltf" &&
    descriptor.kind !== "texture" &&
    descriptor.kind !== "hdr"
  ) {
    throw new ApertureConfigError(
      "aperture.config.invalidAssetKind",
      `Asset '${id}' has unsupported kind '${String(descriptor.kind)}'.`,
      "Declare assets through asset.gltf(), asset.texture(), or asset.hdr().",
    );
  }

  if (descriptor.url.trim().length === 0) {
    throw new ApertureConfigError(
      "aperture.config.emptyAssetUrl",
      `Asset '${id}' has an empty URL.`,
      "Provide a URL such as '/assets/robot.glb'.",
    );
  }

  if (!isPreloadPolicy(descriptor.preload)) {
    throw new ApertureConfigError(
      "aperture.config.invalidPreloadPolicy",
      `Asset '${id}' has unsupported preload policy '${String(
        descriptor.preload,
      )}'.`,
      "Use 'blocking', 'background', or 'manual'.",
    );
  }
}

function validateInputActions(
  actions: Readonly<Record<string, InputActionConfigEntry>>,
): void {
  for (const [name, descriptor] of Object.entries(actions)) {
    validateActionName(name);
    const normalized = normalizeActionDescriptorForValidation(name, descriptor);

    if (normalized.bindings.length === 0) {
      throw new ApertureConfigError(
        "aperture.config.emptyInputAction",
        `Input action '${name}' must declare at least one binding.`,
        "Add one or more bindings, such as input.key('Space') or input.gamepadButton('south').",
      );
    }

    for (const binding of normalized.bindings) {
      validateInputBinding(name, binding);
    }
  }
}

function validateActionName(name: string): void {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return;
  }

  throw new ApertureConfigError(
    "aperture.config.invalidInputActionName",
    `Input action '${name}' is not a valid action key.`,
    "Use an identifier-like action key such as jump, reset, move, or throttle.",
  );
}

function normalizeActionDescriptorForValidation(
  name: string,
  descriptor: InputActionConfigEntry,
): InputActionDescriptor {
  if (isInputActionBindingArray(descriptor)) {
    return { kind: "button", bindings: descriptor };
  }

  if (
    descriptor.kind === "button" ||
    descriptor.kind === "axis1d" ||
    descriptor.kind === "axis2d"
  ) {
    return descriptor;
  }

  throw new ApertureConfigError(
    "aperture.config.invalidInputActionKind",
    `Input action '${name}' has unsupported kind '${String(
      (descriptor as { readonly kind?: unknown }).kind,
    )}'.`,
    "Declare actions with input.button(...), input.axis1d(...), or input.axis2d(...).",
  );
}

function isInputActionBindingArray(
  value: InputActionConfigEntry,
): value is readonly InputActionBinding[] {
  return Array.isArray(value);
}

function validateInputBinding(
  actionName: string,
  binding: InputActionBinding,
): void {
  if ("keyboard" in binding) {
    validateInputCode(actionName, binding.keyboard);
    return;
  }

  if ("pointer" in binding && !("kind" in binding)) {
    validatePointerName(actionName, binding.pointer);
    return;
  }

  if ("gamepad" in binding) {
    if (binding.gamepad.trim().length === 0) {
      throw invalidBinding(
        actionName,
        "Legacy gamepad bindings require a name.",
      );
    }
    return;
  }

  switch (binding.kind) {
    case "key":
      validateInputCode(actionName, binding.code);
      return;
    case "pointer":
      validatePointerName(actionName, binding.pointer);
      return;
    case "keyboard1d":
      validateInputCodes(actionName, binding.negative ?? []);
      validateInputCodes(actionName, binding.positive ?? []);
      return;
    case "keyboard2d":
      validateInputCodes(actionName, binding.negativeX ?? []);
      validateInputCodes(actionName, binding.positiveX ?? []);
      validateInputCodes(actionName, binding.negativeY ?? []);
      validateInputCodes(actionName, binding.positiveY ?? []);
      return;
    case "gamepad-button":
      validateGamepadButton(actionName, binding.button);
      validateOptionalGamepadIndex(actionName, binding.gamepadIndex);
      return;
    case "gamepad-stick":
      validateGamepadStick(actionName, binding.stick);
      validateOptionalGamepadIndex(actionName, binding.gamepadIndex);
      validateDeadzone(actionName, binding.deadzone);
      return;
    case "gamepad-axis":
      validateGamepadStick(actionName, binding.stick);
      if (binding.component !== "x" && binding.component !== "y") {
        throw invalidBinding(
          actionName,
          `Unsupported gamepad axis component '${String(binding.component)}'.`,
        );
      }
      validateOptionalGamepadIndex(actionName, binding.gamepadIndex);
      validateDeadzone(actionName, binding.deadzone);
      if (binding.scale !== undefined && !Number.isFinite(binding.scale)) {
        throw invalidBinding(actionName, "Gamepad axis scale must be finite.");
      }
      return;
    default:
      throw invalidBinding(actionName, "Unsupported input binding.");
  }
}

function validateInputCodes(
  actionName: string,
  codes: readonly string[],
): void {
  for (const code of codes) {
    validateInputCode(actionName, code);
  }
}

function validateInputCode(actionName: string, code: string): void {
  if (code.trim().length === 0) {
    throw invalidBinding(
      actionName,
      "Keyboard bindings require a non-empty KeyboardEvent.code value.",
    );
  }
}

function validatePointerName(
  actionName: string,
  pointer: PointerBinding["pointer"],
): void {
  if (
    pointer === "primary" ||
    pointer === "secondary" ||
    pointer === "middle"
  ) {
    return;
  }

  throw invalidBinding(actionName, `Unsupported pointer binding '${pointer}'.`);
}

function validateGamepadButton(
  actionName: string,
  button: GamepadButtonName,
): void {
  if (
    button === "south" ||
    button === "east" ||
    button === "west" ||
    button === "north" ||
    button === "leftBumper" ||
    button === "rightBumper" ||
    button === "leftTrigger" ||
    button === "rightTrigger" ||
    button === "select" ||
    button === "start" ||
    button === "leftStick" ||
    button === "rightStick" ||
    button === "dpadUp" ||
    button === "dpadDown" ||
    button === "dpadLeft" ||
    button === "dpadRight" ||
    button === "home"
  ) {
    return;
  }

  throw invalidBinding(
    actionName,
    `Unsupported standard gamepad button '${String(button)}'.`,
  );
}

function validateGamepadStick(
  actionName: string,
  stick: GamepadStickName,
): void {
  if (stick === "left" || stick === "right") {
    return;
  }

  throw invalidBinding(
    actionName,
    `Unsupported standard gamepad stick '${String(stick)}'.`,
  );
}

function validateOptionalGamepadIndex(
  actionName: string,
  index: number | undefined,
): void {
  if (index === undefined || (Number.isInteger(index) && index >= 0)) {
    return;
  }

  throw invalidBinding(
    actionName,
    "Gamepad index must be a non-negative integer.",
  );
}

function validateDeadzone(
  actionName: string,
  deadzone: number | undefined,
): void {
  if (
    deadzone === undefined ||
    (Number.isFinite(deadzone) && deadzone >= 0 && deadzone < 1)
  ) {
    return;
  }

  throw invalidBinding(
    actionName,
    "Gamepad deadzone must be in the range [0, 1).",
  );
}

function invalidBinding(
  actionName: string,
  message: string,
): ApertureConfigError {
  return new ApertureConfigError(
    "aperture.config.invalidInputBinding",
    `Input action '${actionName}' has an invalid binding. ${message}`,
    "Use bindings from the exported input helpers in @aperture-engine/app/config.",
  );
}
