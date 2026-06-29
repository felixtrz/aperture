import { ApertureConfigError } from "./errors.js";
import { validateParticleEffectInput } from "@aperture-engine/render";
import type {
  ApertureConfig,
  ApertureAudioAssetDescriptor,
  ApertureConfigAsset,
  ApertureParticleCompositeEffectAssetDescriptor,
  ApertureParticleEffectAssetDescriptor,
  ApertureTextureAssetDescriptor,
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

  validatePhysicsColliderGeometryConfig(physics.colliderGeometry);
}

function validatePhysicsColliderGeometryConfig(
  colliderGeometry: NonNullable<
    Exclude<ApertureConfig["physics"], boolean>
  >["colliderGeometry"],
): void {
  if (colliderGeometry === undefined) {
    return;
  }

  if (
    typeof colliderGeometry !== "object" ||
    colliderGeometry === null ||
    Array.isArray(colliderGeometry)
  ) {
    throw new ApertureConfigError(
      "aperture.config.invalidPhysics",
      "Aperture physics.colliderGeometry must be an options object.",
      "Use physics: { colliderGeometry: { kind: 'assets' } } or omit colliderGeometry.",
    );
  }

  if (colliderGeometry.kind !== "none" && colliderGeometry.kind !== "assets") {
    throw new ApertureConfigError(
      "aperture.config.invalidPhysics",
      `Unsupported physics.colliderGeometry kind '${String(colliderGeometry.kind)}'.`,
      "Use physics: { colliderGeometry: { kind: 'assets' } } for mesh-backed colliders, or { kind: 'none' }.",
    );
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
  descriptor: ApertureConfigAsset,
): void {
  const kind = (descriptor as { readonly kind?: unknown }).kind;

  if (
    kind !== "gltf" &&
    kind !== "texture" &&
    kind !== "hdr" &&
    kind !== "shader" &&
    kind !== "audio" &&
    kind !== "particle-effect"
  ) {
    throw new ApertureConfigError(
      "aperture.config.invalidAssetKind",
      `Asset '${id}' has unsupported kind '${String(kind)}'.`,
      "Declare assets through asset.gltf(), asset.texture(), asset.hdr(), asset.shader(), asset.audio(), or asset.particleEffect().",
    );
  }

  if (descriptor.kind === "particle-effect") {
    validateParticleEffectAssetDescriptor(id, descriptor);
    return;
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

  if (descriptor.kind === "texture") {
    validateTextureAssetDescriptor(
      id,
      descriptor as ApertureTextureAssetDescriptor,
    );
  }
}

const PARTICLE_BLEND_MODES = new Set([
  "opaque",
  "alpha",
  "additive",
  "multiply",
]);

function validateParticleEffectAssetDescriptor(
  id: string,
  descriptor: ApertureParticleEffectAssetDescriptor,
): void {
  if (descriptor.type === "composite") {
    validateParticleCompositeEffectAssetDescriptor(id, descriptor);
    return;
  }

  validateAssetReference(id, "texture", descriptor.renderer?.texture);
  validateAssetReference(id, "sampler", descriptor.renderer?.sampler);

  if (
    descriptor.renderer?.blendMode !== undefined &&
    !PARTICLE_BLEND_MODES.has(descriptor.renderer.blendMode)
  ) {
    throw invalidParticleEffectAsset(
      id,
      "renderer.blendMode",
      `Unsupported particle blendMode '${String(descriptor.renderer.blendMode)}'.`,
    );
  }

  const report = validateParticleEffectInput({
    ...descriptor,
    renderer:
      descriptor.renderer === undefined
        ? undefined
        : {
            ...descriptor.renderer,
            ...(descriptor.renderer.texture === null ? { texture: null } : {}),
            ...(descriptor.renderer.sampler === null ? { sampler: null } : {}),
          },
  });

  if (report.valid) {
    return;
  }

  const diagnostic = report.diagnostics[0];
  throw invalidParticleEffectAsset(
    id,
    diagnostic?.field ?? "effect",
    diagnostic?.message ?? "Particle effect options are invalid.",
  );
}

function validateParticleCompositeEffectAssetDescriptor(
  id: string,
  descriptor: ApertureParticleCompositeEffectAssetDescriptor,
): void {
  const emitters = descriptor.emitters;

  if (!Array.isArray(emitters) || emitters.length === 0) {
    throw invalidParticleEffectAsset(
      id,
      "emitters",
      "A composite particle effect must declare at least one child emitter.",
    );
  }

  for (let index = 0; index < emitters.length; index += 1) {
    const emitter = emitters[index];
    const field = `emitters.${index}.effect`;

    if (
      typeof emitter?.effect !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(emitter.effect)
    ) {
      throw invalidParticleEffectAsset(
        id,
        field,
        `child effect reference '${String(emitter?.effect)}' is not a valid config asset id.`,
      );
    }
  }

  const report = validateParticleEffectInput(descriptor);

  if (report.valid) {
    return;
  }

  const diagnostic = report.diagnostics[0];
  throw invalidParticleEffectAsset(
    id,
    diagnostic?.field ?? "emitters",
    diagnostic?.message ?? "Particle composite effect options are invalid.",
  );
}

function validateAssetReference(
  id: string,
  field: "texture" | "sampler",
  value: string | null | undefined,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)) {
    throw invalidParticleEffectAsset(
      id,
      field,
      `${field} reference '${value}' is not a valid config asset id.`,
    );
  }
}

function invalidParticleEffectAsset(
  id: string,
  field: string,
  message: string,
): ApertureConfigError {
  return new ApertureConfigError(
    "aperture.config.invalidParticleEffectAsset",
    `Asset '${id}' has invalid particle effect ${field}. ${message}`,
    "Use asset.particleEffect({ main: { maxParticles: 1280 }, renderer: { texture: 'smoke' } }) with finite plain-data options.",
  );
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

const TEXTURE_COLOR_SPACES = new Set(["srgb", "linear", "data"]);
const TEXTURE_SEMANTICS = new Set([
  "base-color",
  "emissive",
  "clearcoat-roughness",
  "sheen-color",
  "sheen-roughness",
  "iridescence",
  "iridescence-thickness",
  "metallic-roughness",
  "normal",
  "occlusion",
  "data",
]);

function validateTextureAssetDescriptor(
  id: string,
  descriptor: ApertureTextureAssetDescriptor,
): void {
  if (
    descriptor.colorSpace !== undefined &&
    !TEXTURE_COLOR_SPACES.has(descriptor.colorSpace)
  ) {
    throw invalidTextureAsset(
      id,
      "colorSpace",
      `Unsupported texture colorSpace '${String(descriptor.colorSpace)}'.`,
    );
  }

  if (
    descriptor.semantic !== undefined &&
    !TEXTURE_SEMANTICS.has(descriptor.semantic)
  ) {
    throw invalidTextureAsset(
      id,
      "semantic",
      `Unsupported texture semantic '${String(descriptor.semantic)}'.`,
    );
  }

  if (
    descriptor.mimeType !== undefined &&
    descriptor.mimeType.trim().length === 0
  ) {
    throw invalidTextureAsset(
      id,
      "mimeType",
      "Texture asset mimeType must be non-empty when provided.",
    );
  }

  const colorSpace = descriptor.colorSpace ?? "srgb";
  const semantic = descriptor.semantic ?? "base-color";
  if (
    colorSpace === "srgb" &&
    semantic !== "base-color" &&
    semantic !== "emissive"
  ) {
    throw invalidTextureAsset(
      id,
      "colorSpace",
      `${semantic} textures must use linear or data color space, not srgb.`,
    );
  }
}

function invalidTextureAsset(
  id: string,
  field: string,
  message: string,
): ApertureConfigError {
  return new ApertureConfigError(
    "aperture.config.invalidTextureAsset",
    `Asset '${id}' has invalid texture ${field}. ${message}`,
    "Use asset.texture('/assets/sprite.png', { colorSpace: 'srgb', semantic: 'base-color' }) with plain-data options.",
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
    case "virtual":
      return;
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
