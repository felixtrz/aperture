import type { RenderStateDescriptor } from "@aperture-engine/render";
import type { Vec4Like } from "@aperture-engine/simulation";
import { ApertureSystemError } from "../errors.js";
import type { StandardMaterialOptions, UnlitMaterialOptions } from "./types.js";

type SurfaceOptions = StandardMaterialOptions | UnlitMaterialOptions;
type SurfaceFamily = "standard" | "unlit";

// Translates the three.js-shaped surface knobs (opacity, doubleSided,
// alphaMode) into a render state that passes material validation: blending
// needs the alpha blend preset AND depth writes off, which agents otherwise
// had to rediscover from the renderer's validation rules.

/** The base color with `opacity` folded into its alpha. */
export function surfaceBaseColor(
  options: SurfaceOptions,
  family: SurfaceFamily,
): Vec4Like | undefined {
  if (options.opacity === undefined) {
    return options.baseColor;
  }
  const opacity = readUnitInterval(options.opacity, "opacity", family);
  const base = options.baseColor ?? [1, 1, 1, 1];
  return [base[0] ?? 1, base[1] ?? 1, base[2] ?? 1, (base[3] ?? 1) * opacity];
}

/** Render-state overrides implied by the surface options, if any. */
export function surfaceRenderState(
  options: SurfaceOptions,
  family: SurfaceFamily,
): Partial<RenderStateDescriptor> | undefined {
  const alphaMode =
    "alphaMode" in options
      ? (options.alphaMode as string | undefined)
      : undefined;
  const alphaCutoff =
    "alphaCutoff" in options ? options.alphaCutoff : undefined;
  const alpha = surfaceBaseColor(options, family)?.[3] ?? 1;
  const state: {
    -readonly [K in keyof RenderStateDescriptor]?: RenderStateDescriptor[K];
  } = {};

  if (
    alphaMode !== undefined &&
    alphaMode !== "opaque" &&
    alphaMode !== "mask" &&
    alphaMode !== "blend"
  ) {
    throw invalidSurface(
      family,
      `alphaMode '${alphaMode}' is not supported.`,
      "Use alphaMode 'opaque', 'mask', or 'blend' (or just set opacity below 1).",
    );
  }

  if (alphaMode === "blend" || (alphaMode === undefined && alpha < 1)) {
    state.alphaMode = "blend";
    state.blend = { preset: "alpha" };
    state.depth = { test: true, write: false, compare: "less" };
  } else if (alphaMode !== undefined) {
    state.alphaMode = alphaMode;
  }
  if (alphaCutoff !== undefined) {
    state.alphaCutoff = readUnitInterval(alphaCutoff, "alphaCutoff", family);
  }
  if (options.doubleSided === true) {
    state.cullMode = "none";
  }

  const merged = { ...state, ...(options.renderState ?? {}) };
  return Object.keys(merged).length === 0 ? undefined : merged;
}

function readUnitInterval(
  value: unknown,
  field: string,
  family: SurfaceFamily,
): number {
  if (typeof value !== "number" || !(value >= 0 && value <= 1)) {
    throw invalidSurface(
      family,
      `${field} must be a number from 0 to 1, received ${String(value)}.`,
      `Pass ${field} between 0 (fully transparent) and 1 (opaque).`,
    );
  }
  return value;
}

function invalidSurface(
  family: SurfaceFamily,
  message: string,
  fix: string,
): ApertureSystemError {
  const diagnostic = {
    code: "aperture.spawn.invalidMaterialSurface",
    message: `material.${family}() ${message}`,
    suggestedFix: fix,
  };
  return new ApertureSystemError(
    diagnostic.code,
    diagnostic.message,
    diagnostic.suggestedFix,
  );
}
