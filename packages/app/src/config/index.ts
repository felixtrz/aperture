import type {
  EnvironmentMapHandle,
  SceneHandle,
  ShaderHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import { ApertureConfigError } from "./errors.js";
import { isPreloadPolicy, validateApertureConfig } from "./validation.js";

export { ApertureConfigError } from "./errors.js";
export { validateApertureConfig } from "./validation.js";

export type ApertureAppMode = "browser" | "headless";
export type AssetPreloadPolicy = "blocking" | "background" | "manual";
export type ConfigAssetKind = "gltf" | "texture" | "hdr" | "shader";
export type DiagnosticsLevel = "debug" | "info" | "warn" | "error" | "silent";

export type EcsEntityRef = {
  readonly index: number;
  readonly generation: number;
};

export interface ApertureAssetOptions {
  readonly preload?: AssetPreloadPolicy;
  readonly label?: string;
}

export interface ApertureConfigAssetDescriptor<
  TKind extends ConfigAssetKind = ConfigAssetKind,
> {
  readonly kind: TKind;
  readonly url: string;
  readonly preload: AssetPreloadPolicy;
  readonly label?: string;
}

export type ApertureGltfAssetDescriptor = ApertureConfigAssetDescriptor<"gltf">;
export type ApertureTextureAssetDescriptor =
  ApertureConfigAssetDescriptor<"texture">;
export type ApertureHdrAssetDescriptor = ApertureConfigAssetDescriptor<"hdr">;
export type ApertureShaderAssetDescriptor =
  ApertureConfigAssetDescriptor<"shader">;

export interface ApertureConfigAssetHelpers {
  gltf(
    url: string,
    options?: ApertureAssetOptions,
  ): ApertureGltfAssetDescriptor;
  texture(
    url: string,
    options?: ApertureAssetOptions,
  ): ApertureTextureAssetDescriptor;
  hdr(url: string, options?: ApertureAssetOptions): ApertureHdrAssetDescriptor;
  shader(
    url: string,
    options?: ApertureAssetOptions,
  ): ApertureShaderAssetDescriptor;
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

export interface ApertureRenderDefaults {
  readonly clearColor?: readonly [number, number, number, number];
  readonly defaultCamera?: boolean;
  readonly defaultLight?: boolean;
  readonly sampleCount?: number;
  readonly pixelRatio?: number;
  readonly maxPixelRatio?: number;
  /**
   * Opt the generated app into the single-encoder FrameGraph forward route
   * (default off). Previously reachable only via the `?graph=1` URL flag, which
   * still works as a per-load override; this config option makes the choice
   * reproducible without a query string.
   */
  readonly frameGraph?: boolean;
}

export interface ApertureDiagnosticsConfig {
  readonly level?: DiagnosticsLevel;
}

export interface ApertureAssetDecoderConfig {
  readonly baseUrl?: string;
}

export interface ApertureConfig {
  readonly mode: ApertureAppMode;
  readonly canvas?: string;
  readonly systems?: readonly string[];
  readonly assets?: Readonly<
    Record<string, ApertureConfigAssetDescriptor<ConfigAssetKind>>
  >;
  readonly signals?: Readonly<Record<string, ApertureSignalDescriptor>>;
  readonly input?: ApertureInputConfig;
  readonly render?: ApertureRenderDefaults;
  readonly diagnostics?: ApertureDiagnosticsConfig;
  readonly assetDecoders?: ApertureAssetDecoderConfig;
}

export type DefineApertureConfigInput<TConfig extends ApertureConfig> = TConfig;

export interface RuntimeAssetHandles {
  readonly gltf: Readonly<Record<string, SceneHandle>>;
  readonly texture: Readonly<Record<string, TextureHandle>>;
  readonly hdr: Readonly<Record<string, EnvironmentMapHandle>>;
  readonly shader: Readonly<Record<string, ShaderHandle>>;
}

export const asset: ApertureConfigAssetHelpers = Object.freeze({
  gltf(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("gltf", url, options);
  },
  texture(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("texture", url, options);
  },
  hdr(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("hdr", url, options);
  },
  shader(url: string, options: ApertureAssetOptions = {}) {
    return assetDescriptor("shader", url, options);
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

function assetDescriptor<TKind extends ConfigAssetKind>(
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
