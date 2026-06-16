import { ApertureConfigError } from "./errors.js";
import type {
  ApertureConfig,
  ApertureAudioAssetDescriptor,
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

  validateAssetDecoderConfig(config.assetDecoders);
  validateAudioConfig(config.audio);
  validatePhysicsConfig(config.physics);
  validateInputActions(config.input?.actions ?? {});
}

function validateAudioConfig(audio: ApertureConfig["audio"]): void {
  if (audio === undefined || typeof audio === "boolean") {
    return;
  }

  if (typeof audio !== "object" || audio === null) {
    throw new ApertureConfigError(
      "aperture.config.invalidAudio",
      "Aperture audio config must be a boolean or an options object.",
      "Use audio: true, audio: false, or audio: { autoUnlock: true }.",
    );
  }

  if (audio.enabled !== undefined && typeof audio.enabled !== "boolean") {
    throw new ApertureConfigError(
      "aperture.config.invalidAudio",
      "Aperture audio.enabled must be a boolean when provided.",
      "Set audio.enabled to true or false.",
    );
  }

  if (audio.autoUnlock !== undefined && typeof audio.autoUnlock !== "boolean") {
    throw new ApertureConfigError(
      "aperture.config.invalidAudio",
      "Aperture audio.autoUnlock must be a boolean when provided.",
      "Set audio.autoUnlock to true or false.",
    );
  }
}

function validatePhysicsConfig(physics: ApertureConfig["physics"]): void {
  if (physics === undefined || typeof physics === "boolean") {
    return;
  }

  if (typeof physics !== "object" || physics === null) {
    throw new ApertureConfigError(
      "aperture.config.invalidPhysics",
      "Aperture physics config must be a boolean or an options object.",
      "Use physics: true, or physics: { gravity: [0, -9.81, 0] }.",
    );
  }

  if (physics.enabled !== undefined && typeof physics.enabled !== "boolean") {
    throw new ApertureConfigError(
      "aperture.config.invalidPhysics",
      "Aperture physics.enabled must be a boolean when provided.",
      "Set physics.enabled to true or false.",
    );
  }

  if (physics.backend !== undefined && physics.backend !== "rapier") {
    throw new ApertureConfigError(
      "aperture.config.invalidPhysics",
      `Unsupported physics backend '${String(physics.backend)}'.`,
      "Only the 'rapier' backend is available; omit backend to use the default.",
    );
  }

  if (physics.gravity !== undefined) {
    const g: unknown = physics.gravity;
    if (
      !Array.isArray(g) ||
      g.length !== 3 ||
      g.some((n) => typeof n !== "number" || !Number.isFinite(n))
    ) {
      throw new ApertureConfigError(
        "aperture.config.invalidPhysics",
        "Aperture physics.gravity must be a tuple of three finite numbers.",
        "Use physics: { gravity: [0, -9.81, 0] }.",
      );
    }
  }
}

export function isPreloadPolicy(value: unknown): value is AssetPreloadPolicy {
  return value === "blocking" || value === "background" || value === "manual";
}

function validateAssetDecoderConfig(
  assetDecoders: ApertureConfig["assetDecoders"] | undefined,
): void {
  if (assetDecoders?.baseUrl !== undefined) {
    if (assetDecoders.baseUrl.trim().length > 0) {
      return;
    }

    throw new ApertureConfigError(
      "aperture.config.emptyAssetDecoderBaseUrl",
      "Asset decoder baseUrl must be non-empty when provided.",
      "Use a URL such as '/assets/' or omit assetDecoders.baseUrl to use the default.",
    );
  }
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
    descriptor.kind !== "hdr" &&
    descriptor.kind !== "shader" &&
    descriptor.kind !== "audio"
  ) {
    throw new ApertureConfigError(
      "aperture.config.invalidAssetKind",
      `Asset '${id}' has unsupported kind '${String(descriptor.kind)}'.`,
      "Declare assets through asset.gltf(), asset.texture(), asset.hdr(), asset.shader(), or asset.audio().",
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

  if (descriptor.kind === "audio") {
    validateAudioAssetDescriptor(
      id,
      descriptor as ApertureAudioAssetDescriptor,
    );
  }
}

function validateAudioAssetDescriptor(
  id: string,
  descriptor: ApertureAudioAssetDescriptor,
): void {
  if (
    descriptor.streaming !== undefined &&
    typeof descriptor.streaming !== "boolean"
  ) {
    throw invalidAudioAsset(
      id,
      "streaming",
      "Audio asset streaming must be a boolean when provided.",
    );
  }

  if (
    descriptor.durationHint !== undefined &&
    !(Number.isFinite(descriptor.durationHint) && descriptor.durationHint >= 0)
  ) {
    throw invalidAudioAsset(
      id,
      "durationHint",
      "Audio asset durationHint must be a finite non-negative number.",
    );
  }

  if (
    descriptor.channels !== undefined &&
    !(Number.isInteger(descriptor.channels) && descriptor.channels > 0)
  ) {
    throw invalidAudioAsset(
      id,
      "channels",
      "Audio asset channels must be a positive integer when provided.",
    );
  }

  if (
    descriptor.captionTrackId !== undefined &&
    descriptor.captionTrackId.trim().length === 0
  ) {
    throw invalidAudioAsset(
      id,
      "captionTrackId",
      "Audio asset captionTrackId must be non-empty when provided.",
    );
  }
}

function invalidAudioAsset(
  id: string,
  field: string,
  message: string,
): ApertureConfigError {
  return new ApertureConfigError(
    "aperture.config.invalidAudioAsset",
    `Asset '${id}' has invalid audio ${field}. ${message}`,
    "Use asset.audio('/assets/clip.ogg', { durationHint: 1.2 }) with finite plain-data options.",
  );
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
  if (pointer === "primary") {
    return;
  }

  // 'secondary' and 'middle' type-check but are dead at runtime: the browser
  // forwarder emits only the primary pointer and the input state models only
  // `pointer.primary`, so such a binding would silently never fire. Reject it
  // loudly at config time instead of accepting a no-op. Lift this once
  // per-button/multi-pointer forwarding lands (see AI-44/AI-48).
  if (pointer === "secondary" || pointer === "middle") {
    throw invalidBinding(
      actionName,
      `Pointer binding '${pointer}' is not delivered yet: only the primary pointer is forwarded and modeled, so a '${pointer}' binding would never fire. Use 'primary' until multi-button pointer input is supported.`,
    );
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
