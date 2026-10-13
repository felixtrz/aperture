export const OUTPUT_COLOR_SPACES = ["linear", "srgb"] as const;

export type OutputColorSpace = (typeof OUTPUT_COLOR_SPACES)[number];

export const DEFAULT_OUTPUT_COLOR_SPACE: OutputColorSpace = "srgb";

export function isOutputColorSpace(value: unknown): value is OutputColorSpace {
  return (
    typeof value === "string" &&
    (OUTPUT_COLOR_SPACES as readonly string[]).includes(value)
  );
}

export function parseOutputColorSpace(value: unknown): OutputColorSpace | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isOutputColorSpace(normalized) ? normalized : null;
}

export function resolveOutputColorSpace(value: unknown): OutputColorSpace {
  return parseOutputColorSpace(value) ?? DEFAULT_OUTPUT_COLOR_SPACE;
}

export function createOutputColorSpacePipelineKey(
  colorSpace: OutputColorSpace,
): string {
  return `output-color:${colorSpace}`;
}

export function createOutputColorSpaceWgsl(
  colorSpace: OutputColorSpace,
): string {
  switch (colorSpace) {
    case "linear":
      return `
fn apertureOutputColorSpace(color: vec3f) -> vec3f {
  return color;
}
`.trim();

    case "srgb":
      return `
fn apertureLinearToSrgbChannel(value: f32) -> f32 {
  let clamped = clamp(value, 0.0, 1.0);

  if (clamped <= 0.0031308) {
    return 12.92 * clamped;
  }

  return 1.055 * pow(clamped, 1.0 / 2.4) - 0.055;
}

fn apertureOutputColorSpace(color: vec3f) -> vec3f {
  return vec3f(
    apertureLinearToSrgbChannel(color.r),
    apertureLinearToSrgbChannel(color.g),
    apertureLinearToSrgbChannel(color.b),
  );
}
`.trim();
  }
}
