import { readdirSync } from "node:fs";
import { ApertureCliError } from "../errors.js";
import type { ApertureGpuMode } from "./types.js";

// Chrome flags that force WebGPU onto SwiftShader's CPU Vulkan backend. Aperture
// is WebGPU-only, so a GPU-less host (CI runner, dev container) exposes no
// `navigator.gpu` unless we opt into the software adapter explicitly. These match
// the proven pixel-proof e2e setup (playwright.local.config.ts) and, on modern
// Chrome, work in headless mode — no Xvfb/headed display required.
const SWIFT_SHADER_ARGS: readonly string[] = [
  "--enable-unsafe-webgpu",
  "--enable-unsafe-swiftshader",
  "--use-vulkan=swiftshader",
  "--enable-features=Vulkan",
];

export interface ResolvedApertureGpu {
  /** When true, launch Chrome with the SwiftShader CPU WebGPU backend. */
  readonly software: boolean;
  /** The requested mode after applying flag/env precedence. */
  readonly mode: ApertureGpuMode;
  /** Where the requested mode came from. */
  readonly source: "flag" | "env" | "default";
  /** Human-readable explanation for logs/diagnostics. */
  readonly reason: string;
}

export interface ResolveApertureGpuOptions {
  /** Explicit `--gpu` flag value, when provided. Takes precedence over env. */
  readonly mode?: ApertureGpuMode;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}

/** Chrome launch arguments for software (SwiftShader) WebGPU rendering. */
export function swiftShaderArgs(): readonly string[] {
  return SWIFT_SHADER_ARGS;
}

/**
 * Parse an `--gpu`/`APERTURE_GPU` value into a canonical mode. Returns
 * `undefined` for empty/unset input so callers can fall through to the next
 * precedence level; throws on a non-empty but unrecognized value.
 */
export function parseApertureGpuMode(
  value: string | undefined,
  source: "flag" | "env",
): ApertureGpuMode | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized === "auto") {
    return "auto";
  }

  if (
    normalized === "hardware" ||
    normalized === "gpu" ||
    normalized === "hw"
  ) {
    return "hardware";
  }

  if (
    normalized === "software" ||
    normalized === "swiftshader" ||
    normalized === "cpu" ||
    normalized === "sw"
  ) {
    return "software";
  }

  const origin =
    source === "env" ? "APERTURE_GPU environment variable" : "--gpu option";
  throw new ApertureCliError(
    "aperture.dev.invalidGpuMode",
    `Invalid ${origin} value '${value}'. Expected 'auto', 'hardware', or 'software'.`,
  );
}

/**
 * Decide whether to drive Chrome's WebGPU through hardware or SwiftShader.
 *
 * Precedence: explicit `--gpu` flag, then `APERTURE_GPU` env, then `auto`.
 * `auto` assumes a hardware GPU everywhere except Linux hosts with no DRI
 * device node (the GPU-less dev container / CI case), where it falls back to
 * SwiftShader so the same command renders in both environments.
 */
export function resolveApertureGpu(
  options: ResolveApertureGpuOptions = {},
): ResolvedApertureGpu {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;

  let mode: ApertureGpuMode;
  let source: ResolvedApertureGpu["source"];

  if (options.mode !== undefined) {
    mode = options.mode;
    source = "flag";
  } else {
    const envMode = parseApertureGpuMode(env["APERTURE_GPU"], "env");
    if (envMode !== undefined) {
      mode = envMode;
      source = "env";
    } else {
      mode = "auto";
      source = "default";
    }
  }

  if (mode === "software") {
    return {
      software: true,
      mode,
      source,
      reason: "software WebGPU (SwiftShader) requested",
    };
  }

  if (mode === "hardware") {
    return {
      software: false,
      mode,
      source,
      reason: "hardware WebGPU requested",
    };
  }

  const detection = detectSoftwareRendering(platform);
  return {
    software: detection.software,
    mode,
    source,
    reason: detection.reason,
  };
}

function detectSoftwareRendering(platform: NodeJS.Platform): {
  readonly software: boolean;
  readonly reason: string;
} {
  if (platform !== "linux") {
    return {
      software: false,
      reason: `auto: assuming a hardware GPU on ${platform}`,
    };
  }

  if (hasLinuxGpuDevice()) {
    return {
      software: false,
      reason: "auto: found a GPU device node in /dev/dri",
    };
  }

  return {
    software: true,
    reason: "auto: no GPU device node in /dev/dri, falling back to SwiftShader",
  };
}

function hasLinuxGpuDevice(): boolean {
  try {
    return readdirSync("/dev/dri").some(
      (entry) => entry.startsWith("card") || entry.startsWith("renderD"),
    );
  } catch {
    return false;
  }
}
