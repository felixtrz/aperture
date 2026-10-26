import { ApertureSystemError } from "./errors.js";

export type LinearColor = [number, number, number, number];

// Material, light, sky and fog colors are linear RGB. Swatches, CSS and design
// tools speak sRGB, so authoring "#ff8800" directly as [1, 0.53, 0, 1] renders
// washed out. These helpers decode sRGB the way three.js `Color` does under
// color management, returning tuples every Vec4Like/Vec3Like option accepts.

/** sRGB-authored colors converted to the linear values Aperture expects. */
export const color = Object.freeze({
  /**
   * Parse `0xff8800`, `"#ff8800"`, `"#f80"` or `"#ff8800cc"` as sRGB and
   * return linear `[r, g, b, a]`. `alpha` overrides any alpha in the string.
   */
  hex(value: string | number, alpha?: number): LinearColor {
    const [r, g, b, a] = parseHex(value);
    return [
      srgbToLinear(r),
      srgbToLinear(g),
      srgbToLinear(b),
      readAlpha(alpha ?? a, value),
    ];
  },
  /** Convert 0–1 sRGB channels (e.g. from a color picker) to linear. */
  srgb(r: number, g: number, b: number, alpha = 1): LinearColor {
    for (const channel of [r, g, b]) {
      if (!Number.isFinite(channel)) {
        throw invalidColor(
          `color.srgb() channels must be finite numbers, received ${String(channel)}.`,
        );
      }
    }
    return [
      srgbToLinear(r),
      srgbToLinear(g),
      srgbToLinear(b),
      readAlpha(alpha, [r, g, b]),
    ];
  },
});

function parseHex(value: string | number): [number, number, number, number] {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
      throw invalidColor(
        `color.hex() expects an integer from 0x000000 to 0xffffff, received ${String(value)}.`,
      );
    }
    return [
      ((value >> 16) & 0xff) / 255,
      ((value >> 8) & 0xff) / 255,
      (value & 0xff) / 255,
      1,
    ];
  }

  const digits =
    typeof value === "string" ? value.trim().replace(/^#/, "") : "";
  const expanded =
    digits.length === 3 || digits.length === 4
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  if (!/^(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(expanded)) {
    throw invalidColor(
      `color.hex() expects "#rgb", "#rrggbb", "#rrggbbaa" or a 0xrrggbb number, received ${JSON.stringify(value)}.`,
    );
  }
  const byte = (offset: number): number =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255;
  return [byte(0), byte(2), byte(4), expanded.length === 8 ? byte(6) : 1];
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function readAlpha(alpha: number, source: unknown): number {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw invalidColor(
      `color alpha must be from 0 to 1, received ${String(alpha)} for ${JSON.stringify(source)}.`,
    );
  }
  return alpha;
}

function invalidColor(message: string): ApertureSystemError {
  const diagnostic = {
    code: "aperture.color.invalid",
    message,
    suggestedFix:
      'Use color.hex("#4a7c3a") or color.hex(0x4a7c3a) for sRGB swatches, or pass linear [r, g, b, a] tuples directly.',
  };
  return new ApertureSystemError(
    diagnostic.code,
    diagnostic.message,
    diagnostic.suggestedFix,
  );
}
