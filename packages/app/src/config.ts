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

export type InputActionBinding =
  | PointerBinding
  | KeyboardBinding
  | GamepadBinding;

export interface ApertureInputConfig {
  readonly actions?: Readonly<Record<string, readonly InputActionBinding[]>>;
}

export interface ApertureRenderDefaults {
  readonly clearColor?: readonly [number, number, number, number];
  readonly defaultCamera?: boolean;
  readonly defaultLight?: boolean;
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

function isPreloadPolicy(value: unknown): value is AssetPreloadPolicy {
  return value === "blocking" || value === "background" || value === "manual";
}
