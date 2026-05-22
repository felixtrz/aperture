import type { BuiltInShaderSourceModule } from "./unlit-shader.js";
import {
  createOutputColorSpacePipelineKey,
  createOutputColorSpaceWgsl,
  type OutputColorSpace,
} from "./output-stage-color-space.js";

export const TONEMAP_OPERATORS = [
  "none",
  "linear",
  "reinhard",
  "aces",
  "agx",
  "neutral",
] as const;

export type TonemapOperator = (typeof TONEMAP_OPERATORS)[number];

export const DEFAULT_TONEMAP_OPERATOR: TonemapOperator = "none";

const STANDARD_FRAGMENT_RETURN = "return vec4f(color, alpha);";
const STANDARD_FRAGMENT_ANCHOR = "@fragment\nfn fs_main";

export function isTonemapOperator(value: unknown): value is TonemapOperator {
  return (
    typeof value === "string" &&
    (TONEMAP_OPERATORS as readonly string[]).includes(value)
  );
}

export function parseTonemapOperator(value: unknown): TonemapOperator | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isTonemapOperator(normalized) ? normalized : null;
}

export function resolveTonemapOperator(value: unknown): TonemapOperator {
  return parseTonemapOperator(value) ?? DEFAULT_TONEMAP_OPERATOR;
}

export function createTonemapPipelineKey(operator: TonemapOperator): string {
  return `tonemap:${operator}`;
}

export function createOutputTonemapWgsl(operator: TonemapOperator): string {
  switch (operator) {
    case "none":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  return color;
}
`.trim();

    case "linear":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  return clamp(color, vec3f(0.0), vec3f(1.0));
}
`.trim();

    case "reinhard":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let positive = max(color, vec3f(0.0));
  return positive / (positive + vec3f(1.0));
}
`.trim();

    case "aces":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let positive = max(color, vec3f(0.0));
  let mapped = (positive * (2.51 * positive + vec3f(0.03))) /
    (positive * (2.43 * positive + vec3f(0.59)) + vec3f(0.14));
  return clamp(mapped, vec3f(0.0), vec3f(1.0));
}
`.trim();

    case "agx":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let positive = max(color, vec3f(0.0));
  let logColor = clamp((log2(positive + vec3f(0.00001)) + vec3f(12.47393)) / vec3f(16.5), vec3f(0.0), vec3f(1.0));
  let mapped = 15.5 * pow(logColor, vec3f(6.0)) -
    40.14 * pow(logColor, vec3f(5.0)) +
    31.96 * pow(logColor, vec3f(4.0)) -
    6.868 * pow(logColor, vec3f(3.0)) +
    0.4298 * pow(logColor, vec3f(2.0)) +
    0.1191 * logColor - vec3f(0.00232);
  return clamp(mapped, vec3f(0.0), vec3f(1.0));
}
`.trim();

    case "neutral":
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let positive = max(color, vec3f(0.0));
  let peak = max(positive.r, max(positive.g, positive.b));
  let startCompression = 0.76;

  if (peak < startCompression) {
    return positive;
  }

  let compressionRange = 1.0 - startCompression;
  let compressedPeak = 1.0 - compressionRange * compressionRange /
    (peak + compressionRange - startCompression);
  return positive * (compressedPeak / max(peak, 0.0001));
}
`.trim();
  }
}

export function applyOutputTonemapToStandardShader(
  shader: BuiltInShaderSourceModule,
  operator: TonemapOperator,
  outputColorSpace: OutputColorSpace = "linear",
): BuiltInShaderSourceModule {
  if (operator === "none" && outputColorSpace === "linear") {
    return shader;
  }

  if (!shader.code.includes(STANDARD_FRAGMENT_RETURN)) {
    throw new Error(
      `Cannot apply ${createTonemapPipelineKey(operator)} and ${createOutputColorSpacePipelineKey(outputColorSpace)} to '${shader.label}' because the standard fragment output marker was not found.`,
    );
  }

  const outputWgsl = [
    createOutputTonemapWgsl(operator),
    createOutputColorSpaceWgsl(outputColorSpace),
  ].join("\n\n");
  const codeWithFunction = shader.code.includes(STANDARD_FRAGMENT_ANCHOR)
    ? shader.code.replace(
        STANDARD_FRAGMENT_ANCHOR,
        `${outputWgsl}\n\n${STANDARD_FRAGMENT_ANCHOR}`,
      )
    : `${outputWgsl}\n\n${shader.code}`;

  return {
    ...shader,
    label: [
      shader.label,
      createTonemapPipelineKey(operator),
      createOutputColorSpacePipelineKey(outputColorSpace),
    ].join("|"),
    code: codeWithFunction.replace(
      STANDARD_FRAGMENT_RETURN,
      "return vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);",
    ),
  };
}
