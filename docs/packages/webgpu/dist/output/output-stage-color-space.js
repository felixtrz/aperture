export const OUTPUT_COLOR_SPACES = ["linear", "srgb"];
export const DEFAULT_OUTPUT_COLOR_SPACE = "srgb";
export function isOutputColorSpace(value) {
    return (typeof value === "string" &&
        OUTPUT_COLOR_SPACES.includes(value));
}
export function parseOutputColorSpace(value) {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return isOutputColorSpace(normalized) ? normalized : null;
}
export function resolveOutputColorSpace(value) {
    return parseOutputColorSpace(value) ?? DEFAULT_OUTPUT_COLOR_SPACE;
}
export function createOutputColorSpacePipelineKey(colorSpace) {
    return `output-color:${colorSpace}`;
}
export function createOutputColorSpaceWgsl(colorSpace) {
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
//# sourceMappingURL=output-stage-color-space.js.map