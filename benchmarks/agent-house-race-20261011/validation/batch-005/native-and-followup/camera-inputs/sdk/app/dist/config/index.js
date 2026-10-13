import { ApertureConfigError } from "./errors.js";
import { isPreloadPolicy, validateApertureConfig } from "./validation.js";
export { ApertureConfigError } from "./errors.js";
export { validateApertureConfig } from "./validation.js";
export const asset = Object.freeze({
    gltf(url, options = {}) {
        return assetDescriptor("gltf", url, options);
    },
    texture(url, options = {}) {
        const descriptor = assetDescriptor("texture", url, options);
        return Object.freeze({
            ...descriptor,
            ...(options.colorSpace === undefined
                ? {}
                : { colorSpace: options.colorSpace }),
            ...(options.semantic === undefined ? {} : { semantic: options.semantic }),
            ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
        });
    },
    hdr(url, options = {}) {
        return assetDescriptor("hdr", url, options);
    },
    shader(url, options = {}) {
        return assetDescriptor("shader", url, options);
    },
    audio(url, options = {}) {
        const descriptor = assetDescriptor("audio", url, options);
        return Object.freeze({
            ...descriptor,
            ...(options.streaming === undefined
                ? {}
                : { streaming: options.streaming }),
            ...(options.durationHint === undefined
                ? {}
                : { durationHint: options.durationHint }),
            ...(options.channels === undefined ? {} : { channels: options.channels }),
            ...(options.captionTrackId === undefined
                ? {}
                : { captionTrackId: options.captionTrackId }),
        });
    },
    particleEffect(options = {}) {
        const preload = options.preload ?? "manual";
        if (!isPreloadPolicy(preload)) {
            throw new ApertureConfigError("aperture.config.invalidPreloadPolicy", `Unsupported preload policy '${String(preload)}'.`, "Use 'blocking', 'background', or 'manual'.");
        }
        if (options.type === "composite" || "emitters" in options) {
            const composite = options;
            return Object.freeze({
                kind: "particle-effect",
                preload,
                version: 2,
                type: "composite",
                ...(composite.label === undefined ? {} : { label: composite.label }),
                emitters: composite.emitters,
                ...(composite.source === undefined ? {} : { source: composite.source }),
            });
        }
        return Object.freeze({
            kind: "particle-effect",
            preload,
            version: 2,
            type: "emitter",
            ...(options.label === undefined ? {} : { label: options.label }),
            ...(options.main === undefined ? {} : { main: options.main }),
            ...(options.emission === undefined ? {} : { emission: options.emission }),
            ...(options.shape === undefined ? {} : { shape: options.shape }),
            ...(options.renderer === undefined ? {} : { renderer: options.renderer }),
            ...(options.textureSheetAnimation === undefined
                ? {}
                : { textureSheetAnimation: options.textureSheetAnimation }),
            ...(options.colorOverLifetime === undefined
                ? {}
                : { colorOverLifetime: options.colorOverLifetime }),
            ...(options.sizeOverLifetime === undefined
                ? {}
                : { sizeOverLifetime: options.sizeOverLifetime }),
            ...(options.rotationOverLifetime === undefined
                ? {}
                : { rotationOverLifetime: options.rotationOverLifetime }),
            ...(options.velocityOverLifetime === undefined
                ? {}
                : { velocityOverLifetime: options.velocityOverLifetime }),
            ...(options.forceOverLifetime === undefined
                ? {}
                : { forceOverLifetime: options.forceOverLifetime }),
            ...(options.limitVelocityOverLifetime === undefined
                ? {}
                : { limitVelocityOverLifetime: options.limitVelocityOverLifetime }),
            ...(options.noise === undefined ? {} : { noise: options.noise }),
            ...(options.subEmitters === undefined
                ? {}
                : { subEmitters: options.subEmitters }),
            ...(options.source === undefined ? {} : { source: options.source }),
            ...(options.curveSampleCount === undefined
                ? {}
                : { curveSampleCount: options.curveSampleCount }),
        });
    },
});
export const signal = Object.freeze({
    ref(initial) {
        return Object.freeze({ kind: "ref", initial });
    },
    string(initial) {
        return Object.freeze({ kind: "string", initial });
    },
    number(initial) {
        return Object.freeze({ kind: "number", initial });
    },
    boolean(initial) {
        return Object.freeze({ kind: "boolean", initial });
    },
});
export const input = Object.freeze({
    key(code) {
        return Object.freeze({ kind: "key", code });
    },
    pointer(pointer = "primary") {
        return Object.freeze({ kind: "pointer", pointer });
    },
    virtual() {
        return Object.freeze({ kind: "virtual" });
    },
    keyboard1d(options) {
        return Object.freeze({
            kind: "keyboard1d",
            ...(options.negative === undefined ? {} : { negative: options.negative }),
            ...(options.positive === undefined ? {} : { positive: options.positive }),
        });
    },
    keyboard2d(options) {
        return Object.freeze({
            kind: "keyboard2d",
            ...(options.negativeX === undefined
                ? {}
                : { negativeX: options.negativeX }),
            ...(options.positiveX === undefined
                ? {}
                : { positiveX: options.positiveX }),
            ...(options.negativeY === undefined
                ? {}
                : { negativeY: options.negativeY }),
            ...(options.positiveY === undefined
                ? {}
                : { positiveY: options.positiveY }),
        });
    },
    gamepadButton(button, options = {}) {
        return Object.freeze({
            kind: "gamepad-button",
            button,
            ...(options.gamepadIndex === undefined
                ? {}
                : { gamepadIndex: options.gamepadIndex }),
        });
    },
    gamepadStick(stick, options = {}) {
        return Object.freeze({
            kind: "gamepad-stick",
            stick,
            ...(options.gamepadIndex === undefined
                ? {}
                : { gamepadIndex: options.gamepadIndex }),
            ...(options.deadzone === undefined ? {} : { deadzone: options.deadzone }),
        });
    },
    gamepadAxis(stick, component, options = {}) {
        return Object.freeze({
            kind: "gamepad-axis",
            stick,
            component,
            ...(options.gamepadIndex === undefined
                ? {}
                : { gamepadIndex: options.gamepadIndex }),
            ...(options.deadzone === undefined ? {} : { deadzone: options.deadzone }),
            ...(options.scale === undefined ? {} : { scale: options.scale }),
        });
    },
    button(bindings) {
        return Object.freeze({ kind: "button", bindings: [...bindings] });
    },
    axis1d(bindings) {
        return Object.freeze({ kind: "axis1d", bindings: [...bindings] });
    },
    axis2d(bindings) {
        return Object.freeze({ kind: "axis2d", bindings: [...bindings] });
    },
});
export function defineApertureConfig(config) {
    validateApertureConfig(config);
    return config;
}
function assetDescriptor(kind, url, options) {
    if (url.trim().length === 0) {
        throw new ApertureConfigError("aperture.config.emptyAssetUrl", `Aperture ${kind} asset URL must be a non-empty string.`, "Provide a URL such as '/assets/robot.glb'.");
    }
    const preload = options.preload ?? "manual";
    if (!isPreloadPolicy(preload)) {
        throw new ApertureConfigError("aperture.config.invalidPreloadPolicy", `Unsupported preload policy '${String(preload)}'.`, "Use 'blocking', 'background', or 'manual'.");
    }
    return Object.freeze({
        kind,
        url,
        preload,
        ...(options.label === undefined ? {} : { label: options.label }),
    });
}
//# sourceMappingURL=index.js.map