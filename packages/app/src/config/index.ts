import type {
  AudioClipHandle,
  EnvironmentMapHandle,
  SceneHandle,
  ShaderHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import type {
  ParticleEffectAssetInput,
  TextureColorSpace,
  TextureSemantic,
} from "@aperture-engine/render";
import { ApertureConfigError } from "./errors.js";
import { isPreloadPolicy, validateApertureConfig } from "./validation.js";

export { ApertureConfigError } from "./errors.js";
export { validateApertureConfig } from "./validation.js";

export type ApertureAppMode = "browser" | "headless";
export type AssetPreloadPolicy = "blocking" | "background" | "manual";
export type ConfigAssetKind =
  | "gltf"
  | "texture"
  | "hdr"
  | "shader"
  | "audio"
  | "particle-effect";
export type ConfigUrlAssetKind = Exclude<ConfigAssetKind, "particle-effect">;
export type DiagnosticsLevel = "debug" | "info" | "warn" | "error" | "silent";

export type EcsEntityRef = {
  readonly index: number;
  readonly generation: number;
};

export interface ApertureAssetOptions {
  readonly preload?: AssetPreloadPolicy;
  readonly label?: string;
}

export interface ApertureAudioAssetOptions extends ApertureAssetOptions {
  readonly streaming?: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
}

export interface ApertureTextureAssetOptions extends ApertureAssetOptions {
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  readonly mimeType?: string;
}

export interface ApertureParticleEffectAssetOptions
  extends
    ApertureAssetOptions,
    Omit<ParticleEffectAssetInput, "label" | "texture" | "sampler"> {
  readonly texture?: string | null;
  readonly sampler?: string | null;
}

export interface ApertureConfigAssetDescriptor<
  TKind extends ConfigUrlAssetKind = ConfigUrlAssetKind,
> {
  readonly kind: TKind;
  readonly url: string;
  readonly preload: AssetPreloadPolicy;
  readonly label?: string;
}

export type ApertureGltfAssetDescriptor = ApertureConfigAssetDescriptor<"gltf">;
export interface ApertureTextureAssetDescriptor extends ApertureConfigAssetDescriptor<"texture"> {
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  readonly mimeType?: string;
}
export type ApertureHdrAssetDescriptor = ApertureConfigAssetDescriptor<"hdr">;
export type ApertureShaderAssetDescriptor =
  ApertureConfigAssetDescriptor<"shader">;
export interface ApertureAudioAssetDescriptor extends ApertureConfigAssetDescriptor<"audio"> {
  readonly streaming?: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
}
export interface ApertureParticleEffectAssetDescriptor extends Omit<
  ApertureParticleEffectAssetOptions,
  "preload"
> {
  readonly kind: "particle-effect";
  readonly preload: AssetPreloadPolicy;
}

export type ApertureConfigAsset =
  | ApertureGltfAssetDescriptor
  | ApertureTextureAssetDescriptor
  | ApertureHdrAssetDescriptor
  | ApertureShaderAssetDescriptor
  | ApertureAudioAssetDescriptor
  | ApertureParticleEffectAssetDescriptor;

export interface ApertureConfigAssetHelpers {
  gltf(
    url: string,
    options?: ApertureAssetOptions,
  ): ApertureGltfAssetDescriptor;
  texture(
    url: string,
    options?: ApertureTextureAssetOptions,
  ): ApertureTextureAssetDescriptor;
  hdr(url: string, options?: ApertureAssetOptions): ApertureHdrAssetDescriptor;
  shader(
    url: string,
    options?: ApertureAssetOptions,
  ): ApertureShaderAssetDescriptor;
  audio(
    url: string,
    options?: ApertureAudioAssetOptions,
  ): ApertureAudioAssetDescriptor;
  particleEffect(
    options?: ApertureParticleEffectAssetOptions,
  ): ApertureParticleEffectAssetDescriptor;
}

export type ApertureSignalKind = "ref" | "string" | "number" | "boolean";

export interface ApertureSignalDescriptor<TValue = unknown> {
  readonly kind: ApertureSignalKind;
  readonly initial: TValue;
}

export interface ApertureSignalHelpers {
  ref<TValue>(initial: TValue): ApertureSignalDescriptor<TValue>;
  string(initial: string): ApertureSignalDescriptor<string>;
  number(initial: number): ApertureSignalDescriptor<number>;
  boolean(initial: boolean): ApertureSignalDescriptor<boolean>;
}

export type PointerBinding = {
  readonly pointer: "primary" | "secondary" | "middle";
};

export type KeyboardBinding = {
  readonly keyboard: string;
};

export type GamepadBinding = {
  readonly gamepad: string;
};

export type GamepadButtonName =
  | "south"
  | "east"
  | "west"
  | "north"
  | "leftBumper"
  | "rightBumper"
  | "leftTrigger"
  | "rightTrigger"
  | "select"
  | "start"
  | "leftStick"
  | "rightStick"
  | "dpadUp"
  | "dpadDown"
  | "dpadLeft"
  | "dpadRight"
  | "home";

export type GamepadStickName = "left" | "right";
export type GamepadAxisComponent = "x" | "y";

export interface InputKeyBinding {
  readonly kind: "key";
  readonly code: string;
}

export interface InputPointerBinding {
  readonly kind: "pointer";
  readonly pointer: "primary" | "secondary" | "middle";
}

export interface InputVirtualBinding {
  readonly kind: "virtual";
}

export interface InputKeyboard1dBinding {
  readonly kind: "keyboard1d";
  readonly negative?: readonly string[];
  readonly positive?: readonly string[];
}

export interface InputKeyboard2dBinding {
  readonly kind: "keyboard2d";
  readonly negativeX?: readonly string[];
  readonly positiveX?: readonly string[];
  readonly negativeY?: readonly string[];
  readonly positiveY?: readonly string[];
}

export interface InputGamepadButtonBinding {
  readonly kind: "gamepad-button";
  readonly button: GamepadButtonName;
  readonly gamepadIndex?: number;
}

export interface InputGamepadStickBinding {
  readonly kind: "gamepad-stick";
  readonly stick: GamepadStickName;
  readonly gamepadIndex?: number;
  readonly deadzone?: number;
}

export interface InputGamepadAxisBinding {
  readonly kind: "gamepad-axis";
  readonly stick: GamepadStickName;
  readonly component: GamepadAxisComponent;
  readonly gamepadIndex?: number;
  readonly deadzone?: number;
  readonly scale?: number;
}

export type InputActionBinding =
  | PointerBinding
  | KeyboardBinding
  | GamepadBinding
  | InputKeyBinding
  | InputPointerBinding
  | InputVirtualBinding
  | InputKeyboard1dBinding
  | InputKeyboard2dBinding
  | InputGamepadButtonBinding
  | InputGamepadStickBinding
  | InputGamepadAxisBinding;

export interface ButtonActionDescriptor {
  readonly kind: "button";
  readonly bindings: readonly InputActionBinding[];
}

export interface Axis1dActionDescriptor {
  readonly kind: "axis1d";
  readonly bindings: readonly InputActionBinding[];
}

export interface Axis2dActionDescriptor {
  readonly kind: "axis2d";
  readonly bindings: readonly InputActionBinding[];
}

export type InputActionDescriptor =
  | ButtonActionDescriptor
  | Axis1dActionDescriptor
  | Axis2dActionDescriptor;

export type InputActionConfigEntry =
  | InputActionDescriptor
  | readonly InputActionBinding[];

export interface ApertureInputConfig {
  readonly actions?: Readonly<Record<string, InputActionConfigEntry>>;
}

export interface InputConfigHelpers {
  key(code: string): InputKeyBinding;
  pointer(pointer?: InputPointerBinding["pointer"]): InputPointerBinding;
  virtual(): InputVirtualBinding;
  keyboard1d(options: {
    readonly negative?: readonly string[];
    readonly positive?: readonly string[];
  }): InputKeyboard1dBinding;
  keyboard2d(options: {
    readonly negativeX?: readonly string[];
    readonly positiveX?: readonly string[];
    readonly negativeY?: readonly string[];
    readonly positiveY?: readonly string[];
  }): InputKeyboard2dBinding;
  gamepadButton(
    button: GamepadButtonName,
    options?: { readonly gamepadIndex?: number },
  ): InputGamepadButtonBinding;
  gamepadStick(
    stick: GamepadStickName,
    options?: { readonly gamepadIndex?: number; readonly deadzone?: number },
  ): InputGamepadStickBinding;
  gamepadAxis(
    stick: GamepadStickName,
    component: GamepadAxisComponent,
    options?: {
      readonly gamepadIndex?: number;
      readonly deadzone?: number;
      readonly scale?: number;
    },
  ): InputGamepadAxisBinding;
  button(bindings: readonly InputActionBinding[]): ButtonActionDescriptor;
  axis1d(bindings: readonly InputActionBinding[]): Axis1dActionDescriptor;
  axis2d(bindings: readonly InputActionBinding[]): Axis2dActionDescriptor;
}

export type ApertureTonemapOperator =
  | "none"
  | "aces"
  | "agx"
  | "neutral"
  | "reinhard";

export interface ApertureBloomConfig {
  /** Luminance threshold above which pixels bloom (0..1). */
  readonly threshold?: number;
  /** Bloom additive intensity (UnrealBloom "strength"). */
  readonly intensity?: number;
  /** UnrealBloom/BloomNode radius in the range 0..1. */
  readonly radius?: number;
  /** Legacy Aperture blur radius fallback; prefer `radius` for new code. */
  readonly radiusPixels?: number;
  /** Number of downsampled bloom levels to blur and composite. */
  readonly levels?: number;
}

export interface ApertureRenderDefaults {
  readonly clearColor?: readonly [number, number, number, number];
  readonly defaultCamera?: boolean;
  readonly defaultLight?: boolean;
  readonly sampleCount?: number;
  readonly pixelRatio?: number;
  readonly maxPixelRatio?: number;
  /**
   * Tonemap operator applied when converting the linear HDR scene to display.
   * Defaults to "none". Use "aces" for filmic, "agx"/"neutral" for the
   * three.js-faithful operators.
   */
  readonly tonemap?: ApertureTonemapOperator;
  /**
   * HDR exposure scalar. Setting any finite value renders the scene into an
   * rgba16float buffer and moves tonemap + exposure to a final post stage
   * (required for post effects like bloom).
   */
  readonly exposure?: number;
  /** Enable UnrealBloom-style bloom (requires the HDR path; implies exposure). */
  readonly bloom?: boolean | ApertureBloomConfig;
  /**
   * Route the generated app through the single-encoder FrameGraph (AI-25:
   * default ON at parity). Set `false` to force the legacy multi-submit route.
   * The `?graph=1` / `?graph=0` URL flag remains a per-load override on top of
   * this option; the config option makes the choice reproducible without a
   * query string.
   */
  readonly frameGraph?: boolean;
}

export interface ApertureDiagnosticsConfig {
  readonly level?: DiagnosticsLevel;
}

export interface ApertureAudioAppConfig {
  /** Set false to keep declarative audio config present but disabled. */
  readonly enabled?: boolean;
  /** Resume the generated AudioContext on the first user gesture. Default true. */
  readonly autoUnlock?: boolean;
}

/**
 * Physics enablement for a generated app. Setting `physics` (to `true` or an
 * options object) installs the rigid-body backend in the simulation worker and
 * enables the fixed-step clock that drives it. Omit it for apps that do not need
 * physics. The config is evaluated inside the worker, so values must be plain
 * data.
 */
export interface AperturePhysicsAppConfig {
  /** Set to `false` to declare config but keep physics off. Defaults to `true`. */
  readonly enabled?: boolean;
  /** Rigid-body backend. Only the Rapier backend ships today. */
  readonly backend?: "rapier";
  /** World gravity vector (m/s²). Defaults to the backend default. */
  readonly gravity?: readonly [number, number, number];
}

export interface ApertureAssetDecoderConfig {
  readonly baseUrl?: string;
}

export interface ApertureConfig {
  readonly mode: ApertureAppMode;
  readonly canvas?: string;
  readonly systems?: readonly string[];
  readonly assets?: Readonly<Record<string, ApertureConfigAsset>>;
  readonly signals?: Readonly<Record<string, ApertureSignalDescriptor>>;
  readonly input?: ApertureInputConfig;
  readonly render?: ApertureRenderDefaults;
  readonly audio?: boolean | ApertureAudioAppConfig;
  readonly physics?: boolean | AperturePhysicsAppConfig;
  readonly diagnostics?: ApertureDiagnosticsConfig;
  readonly assetDecoders?: ApertureAssetDecoderConfig;
}

export type DefineApertureConfigInput<TConfig extends ApertureConfig> = TConfig;

export interface RuntimeAssetHandles {
  readonly gltf: Readonly<Record<string, SceneHandle>>;
  readonly texture: Readonly<Record<string, TextureHandle>>;
  readonly hdr: Readonly<Record<string, EnvironmentMapHandle>>;
  readonly shader: Readonly<Record<string, ShaderHandle>>;
  readonly audio: Readonly<Record<string, AudioClipHandle>>;
}

export const asset: ApertureConfigAssetHelpers = Object.freeze({
  gltf(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("gltf", url, options);
  },
  texture(url: string, options: ApertureTextureAssetOptions = {}) {
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
  hdr(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("hdr", url, options);
  },
  shader(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("shader", url, options);
  },
  audio(url: string, options: ApertureAudioAssetOptions = {}) {
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
  particleEffect(options: ApertureParticleEffectAssetOptions = {}) {
    const preload = options.preload ?? "manual";
    if (!isPreloadPolicy(preload)) {
      throw new ApertureConfigError(
        "aperture.config.invalidPreloadPolicy",
        `Unsupported preload policy '${String(preload)}'.`,
        "Use 'blocking', 'background', or 'manual'.",
      );
    }

    return Object.freeze({
      kind: "particle-effect",
      preload,
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
      ...(options.duration === undefined ? {} : { duration: options.duration }),
      ...(options.looping === undefined ? {} : { looping: options.looping }),
      ...(options.prewarm === undefined ? {} : { prewarm: options.prewarm }),
      ...(options.emissionRate === undefined
        ? {}
        : { emissionRate: options.emissionRate }),
      ...(options.bursts === undefined ? {} : { bursts: options.bursts }),
      ...(options.lifetime === undefined ? {} : { lifetime: options.lifetime }),
      ...(options.startSpeed === undefined
        ? {}
        : { startSpeed: options.startSpeed }),
      ...(options.startSize === undefined
        ? {}
        : { startSize: options.startSize }),
      ...(options.startColor === undefined
        ? {}
        : { startColor: options.startColor }),
      ...(options.endColor === undefined ? {} : { endColor: options.endColor }),
      ...(options.gravity === undefined ? {} : { gravity: options.gravity }),
      ...(options.blendMode === undefined
        ? {}
        : { blendMode: options.blendMode }),
      ...(options.texture === undefined ? {} : { texture: options.texture }),
      ...(options.sampler === undefined ? {} : { sampler: options.sampler }),
      ...(options.atlasFrameCount === undefined
        ? {}
        : { atlasFrameCount: options.atlasFrameCount }),
      ...(options.sizeOverLifetime === undefined
        ? {}
        : { sizeOverLifetime: options.sizeOverLifetime }),
      ...(options.colorOverLifetime === undefined
        ? {}
        : { colorOverLifetime: options.colorOverLifetime }),
      ...(options.curveSampleCount === undefined
        ? {}
        : { curveSampleCount: options.curveSampleCount }),
    });
  },
});

export const signal: ApertureSignalHelpers = Object.freeze({
  ref<TValue>(initial: TValue): ApertureSignalDescriptor<TValue> {
    return Object.freeze({ kind: "ref", initial });
  },
  string(initial: string): ApertureSignalDescriptor<string> {
    return Object.freeze({ kind: "string", initial });
  },
  number(initial: number): ApertureSignalDescriptor<number> {
    return Object.freeze({ kind: "number", initial });
  },
  boolean(initial: boolean): ApertureSignalDescriptor<boolean> {
    return Object.freeze({ kind: "boolean", initial });
  },
});

export const input: InputConfigHelpers = Object.freeze({
  key(code: string): InputKeyBinding {
    return Object.freeze({ kind: "key", code });
  },
  pointer(pointer: InputPointerBinding["pointer"] = "primary") {
    return Object.freeze({ kind: "pointer", pointer });
  },
  virtual(): InputVirtualBinding {
    return Object.freeze({ kind: "virtual" });
  },
  keyboard1d(options: {
    readonly negative?: readonly string[];
    readonly positive?: readonly string[];
  }): InputKeyboard1dBinding {
    return Object.freeze({
      kind: "keyboard1d",
      ...(options.negative === undefined ? {} : { negative: options.negative }),
      ...(options.positive === undefined ? {} : { positive: options.positive }),
    });
  },
  keyboard2d(options: {
    readonly negativeX?: readonly string[];
    readonly positiveX?: readonly string[];
    readonly negativeY?: readonly string[];
    readonly positiveY?: readonly string[];
  }): InputKeyboard2dBinding {
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
  gamepadButton(
    button: GamepadButtonName,
    options: { readonly gamepadIndex?: number } = {},
  ): InputGamepadButtonBinding {
    return Object.freeze({
      kind: "gamepad-button",
      button,
      ...(options.gamepadIndex === undefined
        ? {}
        : { gamepadIndex: options.gamepadIndex }),
    });
  },
  gamepadStick(
    stick: GamepadStickName,
    options: {
      readonly gamepadIndex?: number;
      readonly deadzone?: number;
    } = {},
  ): InputGamepadStickBinding {
    return Object.freeze({
      kind: "gamepad-stick",
      stick,
      ...(options.gamepadIndex === undefined
        ? {}
        : { gamepadIndex: options.gamepadIndex }),
      ...(options.deadzone === undefined ? {} : { deadzone: options.deadzone }),
    });
  },
  gamepadAxis(
    stick: GamepadStickName,
    component: GamepadAxisComponent,
    options: {
      readonly gamepadIndex?: number;
      readonly deadzone?: number;
      readonly scale?: number;
    } = {},
  ): InputGamepadAxisBinding {
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
  button(bindings: readonly InputActionBinding[]): ButtonActionDescriptor {
    return Object.freeze({ kind: "button", bindings: [...bindings] });
  },
  axis1d(bindings: readonly InputActionBinding[]): Axis1dActionDescriptor {
    return Object.freeze({ kind: "axis1d", bindings: [...bindings] });
  },
  axis2d(bindings: readonly InputActionBinding[]): Axis2dActionDescriptor {
    return Object.freeze({ kind: "axis2d", bindings: [...bindings] });
  },
});

export function defineApertureConfig<TConfig extends ApertureConfig>(
  config: DefineApertureConfigInput<TConfig>,
): TConfig {
  validateApertureConfig(config);
  return config;
}

function assetDescriptor<TKind extends ConfigUrlAssetKind>(
  kind: TKind,
  url: string,
  options: ApertureAssetOptions,
): ApertureConfigAssetDescriptor<TKind> {
  if (url.trim().length === 0) {
    throw new ApertureConfigError(
      "aperture.config.emptyAssetUrl",
      `Aperture ${kind} asset URL must be a non-empty string.`,
      "Provide a URL such as '/assets/robot.glb'.",
    );
  }

  const preload = options.preload ?? "manual";
  if (!isPreloadPolicy(preload)) {
    throw new ApertureConfigError(
      "aperture.config.invalidPreloadPolicy",
      `Unsupported preload policy '${String(preload)}'.`,
      "Use 'blocking', 'background', or 'manual'.",
    );
  }

  return Object.freeze({
    kind,
    url,
    preload,
    ...(options.label === undefined ? {} : { label: options.label }),
  });
}
