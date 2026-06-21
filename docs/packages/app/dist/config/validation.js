import { ApertureConfigError } from "./errors.js";
import { createParticleEffectAsset, validateParticleEffectAsset, } from "@aperture-engine/render";
export function validateApertureConfig(config) {
    if (config.mode !== "browser" && config.mode !== "headless") {
        throw new ApertureConfigError("aperture.config.invalidMode", `Aperture config mode must be 'browser' or 'headless', received '${String(config.mode)}'.`, "Set mode to 'browser' for Vite/WebGPU presentation or 'headless' for Node-safe simulation.");
    }
    if (config.mode === "browser" &&
        (config.canvas === undefined || config.canvas.trim().length === 0)) {
        throw new ApertureConfigError("aperture.config.missingCanvas", "Browser Aperture apps require a non-empty canvas selector.", "Add canvas: '#aperture' to aperture.config.ts.");
    }
    for (const [id, descriptor] of Object.entries(config.assets ?? {})) {
        validateAssetId(id);
        validateAssetDescriptor(id, descriptor);
    }
    for (const pattern of config.systems ?? []) {
        if (pattern.trim().length === 0) {
            throw new ApertureConfigError("aperture.config.emptySystemGlob", "System glob entries must be non-empty strings.", "Remove empty strings from the systems array.");
        }
    }
    validateAssetDecoderConfig(config.assetDecoders);
    validateAudioConfig(config.audio);
    validatePhysicsConfig(config.physics);
    validateInputActions(config.input?.actions ?? {});
}
function validateAudioConfig(audio) {
    if (audio === undefined || typeof audio === "boolean") {
        return;
    }
    if (typeof audio !== "object" || audio === null) {
        throw new ApertureConfigError("aperture.config.invalidAudio", "Aperture audio config must be a boolean or an options object.", "Use audio: true, audio: false, or audio: { autoUnlock: true }.");
    }
    if (audio.enabled !== undefined && typeof audio.enabled !== "boolean") {
        throw new ApertureConfigError("aperture.config.invalidAudio", "Aperture audio.enabled must be a boolean when provided.", "Set audio.enabled to true or false.");
    }
    if (audio.autoUnlock !== undefined && typeof audio.autoUnlock !== "boolean") {
        throw new ApertureConfigError("aperture.config.invalidAudio", "Aperture audio.autoUnlock must be a boolean when provided.", "Set audio.autoUnlock to true or false.");
    }
}
function validatePhysicsConfig(physics) {
    if (physics === undefined || typeof physics === "boolean") {
        return;
    }
    if (typeof physics !== "object" || physics === null) {
        throw new ApertureConfigError("aperture.config.invalidPhysics", "Aperture physics config must be a boolean or an options object.", "Use physics: true, or physics: { gravity: [0, -9.81, 0] }.");
    }
    if (physics.enabled !== undefined && typeof physics.enabled !== "boolean") {
        throw new ApertureConfigError("aperture.config.invalidPhysics", "Aperture physics.enabled must be a boolean when provided.", "Set physics.enabled to true or false.");
    }
    if (physics.backend !== undefined && physics.backend !== "rapier") {
        throw new ApertureConfigError("aperture.config.invalidPhysics", `Unsupported physics backend '${String(physics.backend)}'.`, "Only the 'rapier' backend is available; omit backend to use the default.");
    }
    if (physics.gravity !== undefined) {
        const g = physics.gravity;
        if (!Array.isArray(g) ||
            g.length !== 3 ||
            g.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
            throw new ApertureConfigError("aperture.config.invalidPhysics", "Aperture physics.gravity must be a tuple of three finite numbers.", "Use physics: { gravity: [0, -9.81, 0] }.");
        }
    }
    validatePhysicsColliderGeometryConfig(physics.colliderGeometry);
}
function validatePhysicsColliderGeometryConfig(colliderGeometry) {
    if (colliderGeometry === undefined) {
        return;
    }
    if (typeof colliderGeometry !== "object" ||
        colliderGeometry === null ||
        Array.isArray(colliderGeometry)) {
        throw new ApertureConfigError("aperture.config.invalidPhysics", "Aperture physics.colliderGeometry must be an options object.", "Use physics: { colliderGeometry: { kind: 'assets' } } or omit colliderGeometry.");
    }
    if (colliderGeometry.kind !== "none" && colliderGeometry.kind !== "assets") {
        throw new ApertureConfigError("aperture.config.invalidPhysics", `Unsupported physics.colliderGeometry kind '${String(colliderGeometry.kind)}'.`, "Use physics: { colliderGeometry: { kind: 'assets' } } for mesh-backed colliders, or { kind: 'none' }.");
    }
}
export function isPreloadPolicy(value) {
    return value === "blocking" || value === "background" || value === "manual";
}
function validateAssetDecoderConfig(assetDecoders) {
    if (assetDecoders?.baseUrl !== undefined) {
        if (assetDecoders.baseUrl.trim().length > 0) {
            return;
        }
        throw new ApertureConfigError("aperture.config.emptyAssetDecoderBaseUrl", "Asset decoder baseUrl must be non-empty when provided.", "Use a URL such as '/assets/' or omit assetDecoders.baseUrl to use the default.");
    }
}
function validateAssetId(id) {
    if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) {
        return;
    }
    throw new ApertureConfigError("aperture.config.invalidAssetId", `Asset id '${id}' is not a valid Aperture asset key.`, "Use an identifier-like key such as robot, floorColor, or level.crate.");
}
function validateAssetDescriptor(id, descriptor) {
    const kind = descriptor.kind;
    if (kind !== "gltf" &&
        kind !== "texture" &&
        kind !== "hdr" &&
        kind !== "shader" &&
        kind !== "audio" &&
        kind !== "particle-effect") {
        throw new ApertureConfigError("aperture.config.invalidAssetKind", `Asset '${id}' has unsupported kind '${String(kind)}'.`, "Declare assets through asset.gltf(), asset.texture(), asset.hdr(), asset.shader(), asset.audio(), or asset.particleEffect().");
    }
    if (descriptor.kind === "particle-effect") {
        validateParticleEffectAssetDescriptor(id, descriptor);
        return;
    }
    if (descriptor.url.trim().length === 0) {
        throw new ApertureConfigError("aperture.config.emptyAssetUrl", `Asset '${id}' has an empty URL.`, "Provide a URL such as '/assets/robot.glb'.");
    }
    if (!isPreloadPolicy(descriptor.preload)) {
        throw new ApertureConfigError("aperture.config.invalidPreloadPolicy", `Asset '${id}' has unsupported preload policy '${String(descriptor.preload)}'.`, "Use 'blocking', 'background', or 'manual'.");
    }
    if (descriptor.kind === "audio") {
        validateAudioAssetDescriptor(id, descriptor);
    }
    if (descriptor.kind === "texture") {
        validateTextureAssetDescriptor(id, descriptor);
    }
}
const PARTICLE_BLEND_MODES = new Set([
    "opaque",
    "alpha",
    "additive",
    "multiply",
]);
function validateParticleEffectAssetDescriptor(id, descriptor) {
    validateAssetReference(id, "texture", descriptor.texture);
    validateAssetReference(id, "sampler", descriptor.sampler);
    if (descriptor.blendMode !== undefined &&
        !PARTICLE_BLEND_MODES.has(descriptor.blendMode)) {
        throw invalidParticleEffectAsset(id, "blendMode", `Unsupported particle blendMode '${String(descriptor.blendMode)}'.`);
    }
    const report = validateParticleEffectAsset(createParticleEffectAsset({
        ...(descriptor.label === undefined ? {} : { label: descriptor.label }),
        ...(descriptor.capacity === undefined
            ? {}
            : { capacity: descriptor.capacity }),
        ...(descriptor.duration === undefined
            ? {}
            : { duration: descriptor.duration }),
        ...(descriptor.looping === undefined
            ? {}
            : { looping: descriptor.looping }),
        ...(descriptor.prewarm === undefined
            ? {}
            : { prewarm: descriptor.prewarm }),
        ...(descriptor.emissionRate === undefined
            ? {}
            : { emissionRate: descriptor.emissionRate }),
        ...(descriptor.bursts === undefined ? {} : { bursts: descriptor.bursts }),
        ...(descriptor.lifetime === undefined
            ? {}
            : { lifetime: descriptor.lifetime }),
        ...(descriptor.startSpeed === undefined
            ? {}
            : { startSpeed: descriptor.startSpeed }),
        ...(descriptor.startSize === undefined
            ? {}
            : { startSize: descriptor.startSize }),
        ...(descriptor.startColor === undefined
            ? {}
            : { startColor: descriptor.startColor }),
        ...(descriptor.endColor === undefined
            ? {}
            : { endColor: descriptor.endColor }),
        ...(descriptor.gravity === undefined
            ? {}
            : { gravity: descriptor.gravity }),
        ...(descriptor.linearDamping === undefined
            ? {}
            : { linearDamping: descriptor.linearDamping }),
        ...(descriptor.blendMode === undefined
            ? {}
            : { blendMode: descriptor.blendMode }),
        ...(descriptor.texture === null ? { texture: null } : {}),
        ...(descriptor.sampler === null ? { sampler: null } : {}),
        ...(descriptor.atlasFrameCount === undefined
            ? {}
            : { atlasFrameCount: descriptor.atlasFrameCount }),
        ...(descriptor.sizeOverLifetime === undefined
            ? {}
            : { sizeOverLifetime: descriptor.sizeOverLifetime }),
        ...(descriptor.colorOverLifetime === undefined
            ? {}
            : { colorOverLifetime: descriptor.colorOverLifetime }),
        ...(descriptor.curveSampleCount === undefined
            ? {}
            : { curveSampleCount: descriptor.curveSampleCount }),
    }));
    if (report.valid) {
        return;
    }
    const diagnostic = report.diagnostics[0];
    throw invalidParticleEffectAsset(id, diagnostic?.field ?? "effect", diagnostic?.message ?? "Particle effect options are invalid.");
}
function validateAssetReference(id, field, value) {
    if (value === undefined || value === null) {
        return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)) {
        throw invalidParticleEffectAsset(id, field, `${field} reference '${value}' is not a valid config asset id.`);
    }
}
function invalidParticleEffectAsset(id, field, message) {
    return new ApertureConfigError("aperture.config.invalidParticleEffectAsset", `Asset '${id}' has invalid particle effect ${field}. ${message}`, "Use asset.particleEffect({ texture: 'smoke', capacity: 1280 }) with finite plain-data options.");
}
function validateAudioAssetDescriptor(id, descriptor) {
    if (descriptor.streaming !== undefined &&
        typeof descriptor.streaming !== "boolean") {
        throw invalidAudioAsset(id, "streaming", "Audio asset streaming must be a boolean when provided.");
    }
    if (descriptor.durationHint !== undefined &&
        !(Number.isFinite(descriptor.durationHint) && descriptor.durationHint >= 0)) {
        throw invalidAudioAsset(id, "durationHint", "Audio asset durationHint must be a finite non-negative number.");
    }
    if (descriptor.channels !== undefined &&
        !(Number.isInteger(descriptor.channels) && descriptor.channels > 0)) {
        throw invalidAudioAsset(id, "channels", "Audio asset channels must be a positive integer when provided.");
    }
    if (descriptor.captionTrackId !== undefined &&
        descriptor.captionTrackId.trim().length === 0) {
        throw invalidAudioAsset(id, "captionTrackId", "Audio asset captionTrackId must be non-empty when provided.");
    }
}
function invalidAudioAsset(id, field, message) {
    return new ApertureConfigError("aperture.config.invalidAudioAsset", `Asset '${id}' has invalid audio ${field}. ${message}`, "Use asset.audio('/assets/clip.ogg', { durationHint: 1.2 }) with finite plain-data options.");
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
function validateTextureAssetDescriptor(id, descriptor) {
    if (descriptor.colorSpace !== undefined &&
        !TEXTURE_COLOR_SPACES.has(descriptor.colorSpace)) {
        throw invalidTextureAsset(id, "colorSpace", `Unsupported texture colorSpace '${String(descriptor.colorSpace)}'.`);
    }
    if (descriptor.semantic !== undefined &&
        !TEXTURE_SEMANTICS.has(descriptor.semantic)) {
        throw invalidTextureAsset(id, "semantic", `Unsupported texture semantic '${String(descriptor.semantic)}'.`);
    }
    if (descriptor.mimeType !== undefined &&
        descriptor.mimeType.trim().length === 0) {
        throw invalidTextureAsset(id, "mimeType", "Texture asset mimeType must be non-empty when provided.");
    }
    const colorSpace = descriptor.colorSpace ?? "srgb";
    const semantic = descriptor.semantic ?? "base-color";
    if (colorSpace === "srgb" &&
        semantic !== "base-color" &&
        semantic !== "emissive") {
        throw invalidTextureAsset(id, "colorSpace", `${semantic} textures must use linear or data color space, not srgb.`);
    }
}
function invalidTextureAsset(id, field, message) {
    return new ApertureConfigError("aperture.config.invalidTextureAsset", `Asset '${id}' has invalid texture ${field}. ${message}`, "Use asset.texture('/assets/sprite.png', { colorSpace: 'srgb', semantic: 'base-color' }) with plain-data options.");
}
function validateInputActions(actions) {
    for (const [name, descriptor] of Object.entries(actions)) {
        validateActionName(name);
        const normalized = normalizeActionDescriptorForValidation(name, descriptor);
        if (normalized.bindings.length === 0) {
            throw new ApertureConfigError("aperture.config.emptyInputAction", `Input action '${name}' must declare at least one binding.`, "Add one or more bindings, such as input.key('Space') or input.gamepadButton('south').");
        }
        for (const binding of normalized.bindings) {
            validateInputBinding(name, binding);
        }
    }
}
function validateActionName(name) {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return;
    }
    throw new ApertureConfigError("aperture.config.invalidInputActionName", `Input action '${name}' is not a valid action key.`, "Use an identifier-like action key such as jump, reset, move, or throttle.");
}
function normalizeActionDescriptorForValidation(name, descriptor) {
    if (isInputActionBindingArray(descriptor)) {
        return { kind: "button", bindings: descriptor };
    }
    if (descriptor.kind === "button" ||
        descriptor.kind === "axis1d" ||
        descriptor.kind === "axis2d") {
        return descriptor;
    }
    throw new ApertureConfigError("aperture.config.invalidInputActionKind", `Input action '${name}' has unsupported kind '${String(descriptor.kind)}'.`, "Declare actions with input.button(...), input.axis1d(...), or input.axis2d(...).");
}
function isInputActionBindingArray(value) {
    return Array.isArray(value);
}
function validateInputBinding(actionName, binding) {
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
            throw invalidBinding(actionName, "Legacy gamepad bindings require a name.");
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
                throw invalidBinding(actionName, `Unsupported gamepad axis component '${String(binding.component)}'.`);
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
function validateInputCodes(actionName, codes) {
    for (const code of codes) {
        validateInputCode(actionName, code);
    }
}
function validateInputCode(actionName, code) {
    if (code.trim().length === 0) {
        throw invalidBinding(actionName, "Keyboard bindings require a non-empty KeyboardEvent.code value.");
    }
}
function validatePointerName(actionName, pointer) {
    if (pointer === "primary" ||
        pointer === "secondary" ||
        pointer === "middle") {
        return;
    }
    throw invalidBinding(actionName, `Unsupported pointer binding '${pointer}'.`);
}
function validateGamepadButton(actionName, button) {
    if (button === "south" ||
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
        button === "home") {
        return;
    }
    throw invalidBinding(actionName, `Unsupported standard gamepad button '${String(button)}'.`);
}
function validateGamepadStick(actionName, stick) {
    if (stick === "left" || stick === "right") {
        return;
    }
    throw invalidBinding(actionName, `Unsupported standard gamepad stick '${String(stick)}'.`);
}
function validateOptionalGamepadIndex(actionName, index) {
    if (index === undefined || (Number.isInteger(index) && index >= 0)) {
        return;
    }
    throw invalidBinding(actionName, "Gamepad index must be a non-negative integer.");
}
function validateDeadzone(actionName, deadzone) {
    if (deadzone === undefined ||
        (Number.isFinite(deadzone) && deadzone >= 0 && deadzone < 1)) {
        return;
    }
    throw invalidBinding(actionName, "Gamepad deadzone must be in the range [0, 1).");
}
function invalidBinding(actionName, message) {
    return new ApertureConfigError("aperture.config.invalidInputBinding", `Input action '${actionName}' has an invalid binding. ${message}`, "Use bindings from the exported input helpers in @aperture-engine/app/config.");
}
//# sourceMappingURL=validation.js.map