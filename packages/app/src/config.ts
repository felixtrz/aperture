import type {
  EnvironmentMapHandle,
  SceneHandle,
  TextureHandle,
} from "@aperture-engine/simulation";

export type ApertureAppMode = "browser" | "headless";
export type AssetPreloadPolicy = "blocking" | "background" | "manual";
export type ConfigAssetKind = "gltf" | "texture" | "hdr";
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
}

export interface ApertureDiagnosticsConfig {
  readonly level?: DiagnosticsLevel;
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
}

export type DefineApertureConfigInput<TConfig extends ApertureConfig> = TConfig;

export interface RuntimeAssetHandles {
  readonly gltf: Readonly<Record<string, SceneHandle>>;
  readonly texture: Readonly<Record<string, TextureHandle>>;
  readonly hdr: Readonly<Record<string, EnvironmentMapHandle>>;
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

export class ApertureConfigError extends Error {
  readonly code: string;
  readonly suggestedFix: string;

  constructor(code: string, message: string, suggestedFix: string) {
    super(`${message} Suggested fix: ${suggestedFix}`);
    this.name = "ApertureConfigError";
    this.code = code;
    this.suggestedFix = suggestedFix;
  }
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

function isPreloadPolicy(value: unknown): value is AssetPreloadPolicy {
  return value === "blocking" || value === "background" || value === "manual";
}
