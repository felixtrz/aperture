import type { BuiltInShaderSourceModule } from "../materials/unlit/unlit-shader.js";
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

export interface CreateOutputTonemapWgslOptions {
  // When true the emitted `apertureOutputTonemap` takes an extra `exposure: f32`
  // and multiplies `color * exposure` BEFORE the operator — used by the HDR
  // post tonemap stage (M5-T4). Default false keeps the legacy in-material
  // single-argument form byte-identical.
  readonly exposure?: boolean;
}

export function createOutputTonemapWgsl(
  operator: TonemapOperator,
  options?: CreateOutputTonemapWgslOptions,
): string {
  const base = createOutputTonemapOperatorWgsl(operator);

  if (options?.exposure !== true) {
    return base;
  }

  // Rename the parameter to `inputColor` and define `color` from it: WGSL
  // forbids a `let` shadowing a parameter of the same name in the same scope,
  // so reusing `color` for both would be a redeclaration compile error.
  return base.replace(
    "fn apertureOutputTonemap(color: vec3f) -> vec3f {",
    "fn apertureOutputTonemap(inputColor: vec3f, exposure: f32) -> vec3f {\n  let color = inputColor * exposure;",
  );
}

function createOutputTonemapOperatorWgsl(operator: TonemapOperator): string {
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

const BUILT_IN_FRAGMENT_ENTRY =
  "@fragment\nfn fs_main(input: VertexOutput) -> @location(0) vec4f";
// The inner helper is NOT an entry point, so its return type must NOT carry the
// `@location(0)` IO attribute — Dawn/naga reject `@location` on non-entry-point
// return types ("'@location' is not valid for non-entry point function return
// types"). The wrapping `@fragment fn fs_main` below keeps `@location(0)`.
const BUILT_IN_INNER_ENTRY =
  "fn apertureOutputStageInner(input: VertexOutput) -> vec4f";

/**
 * AI-17: apply the output color-space + tonemap stage to any built-in material
 * family, not just StandardMaterial. Unlike `applyOutputTonemapToStandardShader`
 * (which keys off StandardMaterial's `return vec4f(color, alpha);` marker), this
 * is family-agnostic: it renames the shader's `@fragment fn fs_main` entry to a
 * plain inner function and emits a thin wrapping entry that calls
 * `apertureOutputColorSpace(apertureOutputTonemap(rgb))` while preserving alpha.
 * Every built-in family (unlit/matcap/debug-normal/sprite/msdf-text/ui-quad/
 * particle) shares the `fs_main(input: VertexOutput) -> @location(0) vec4f` entry
 * signature, so the wrapper forwards the single struct input unchanged.
 *
 * On the HDR-scene-buffer path (`operator === "none"` + `outputColorSpace ===
 * "linear"`) it is a no-op, leaving the single post-stage encode authoritative.
 */
/**
 * String-level core of {@link applyOutputStageToBuiltInShader}: wraps a built-in
 * fragment WGSL string's `@fragment fn fs_main(input: VertexOutput) -> @location(0)
 * vec4f` entry with the output color-space + tonemap stage. Returned unchanged on
 * the HDR-scene-buffer path (none + linear). Used directly by the string-based
 * family pipelines (sprite/particle/ui/text), which build raw WGSL rather than a
 * `BuiltInShaderSourceModule`.
 */
export function applyOutputStageToFragmentWgsl(
  code: string,
  operator: TonemapOperator,
  outputColorSpace: OutputColorSpace = "linear",
  label = "built-in shader",
): string {
  if (operator === "none" && outputColorSpace === "linear") {
    return code;
  }

  if (!code.includes(BUILT_IN_FRAGMENT_ENTRY)) {
    throw new Error(
      `Cannot apply ${createTonemapPipelineKey(operator)} and ${createOutputColorSpacePipelineKey(outputColorSpace)} to '${label}' because the built-in fragment entry '${BUILT_IN_FRAGMENT_ENTRY}' was not found.`,
    );
  }

  const outputWgsl = [
    createOutputTonemapWgsl(operator),
    createOutputColorSpaceWgsl(outputColorSpace),
  ].join("\n\n");
  const wrapperEntry = `@fragment\nfn fs_main(input: VertexOutput) -> @location(0) vec4f {\n  let apertureFragment = apertureOutputStageInner(input);\n  return vec4f(apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb)), apertureFragment.a);\n}`;
  const innerCode = code.replace(BUILT_IN_FRAGMENT_ENTRY, BUILT_IN_INNER_ENTRY);

  return `${outputWgsl}\n\n${innerCode}\n\n${wrapperEntry}`;
}

export function applyOutputStageToBuiltInShader(
  shader: BuiltInShaderSourceModule,
  operator: TonemapOperator,
  outputColorSpace: OutputColorSpace = "linear",
): BuiltInShaderSourceModule {
  const code = applyOutputStageToFragmentWgsl(
    shader.code,
    operator,
    outputColorSpace,
    shader.label,
  );

  if (code === shader.code) {
    return shader;
  }

  return {
    ...shader,
    label: [
      shader.label,
      createTonemapPipelineKey(operator),
      createOutputColorSpacePipelineKey(outputColorSpace),
    ].join("|"),
    code,
  };
}
