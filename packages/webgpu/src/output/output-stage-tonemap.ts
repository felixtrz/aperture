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
      // Faithful port of three.js WebGLRenderer ACESFilmicToneMapping: the
      // Stephen Hill RRTAndODT fit, bracketed by the ACES input/output color
      // matrices, with the deliberate `/0.6` brighter-viewing-environment
      // scale. The previous Narkowicz approximation omitted both the color
      // matrices and the /0.6 scale, so it rendered ~1.67x too bright/hot
      // versus the reference renderer. Matrices are column vectors (three.js
      // `mat3(col0,col1,col2)` == WGSL column-major `m * v`), matching agx above.
      // When the exposure wrapper is applied it prepends `let color =
      // inputColor * exposure;`, so `color / 0.6` reproduces three.js's
      // `color *= toneMappingExposure / 0.6` exactly.
      // Reference: three.js src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let ACESInputMat = mat3x3<f32>(
    vec3f(0.59719, 0.07600, 0.02840),
    vec3f(0.35458, 0.90834, 0.13383),
    vec3f(0.04823, 0.01566, 0.83777)
  );
  let ACESOutputMat = mat3x3<f32>(
    vec3f(1.60475, -0.10208, -0.00327),
    vec3f(-0.53108, 1.10813, -0.07276),
    vec3f(-0.07367, -0.00605, 1.07602)
  );
  var c = max(color, vec3f(0.0)) / 0.6;
  c = ACESInputMat * c;
  let a = c * (c + vec3f(0.0245786)) - vec3f(0.000090537);
  let b = c * (0.983729 * c + vec3f(0.4329510)) + vec3f(0.238081);
  c = a / b;
  c = ACESOutputMat * c;
  return clamp(c, vec3f(0.0), vec3f(1.0));
}
`.trim();

    case "agx":
      // Faithful port of three.js agxToneMapping (AI-90). The contrast curve
      // alone (the old implementation) is not AgX: the look comes from the
      // LINEAR_SRGB<->LINEAR_REC2020 transforms plus the AgX inset/outset
      // matrices that desaturate highlights, and the final 2.2 power. Matrices
      // are column vectors, matching three.js `mat3(col0, col1, col2)` and
      // WGSL's column-major `m * v`.
      // Reference: three.js src/nodes/display/ToneMappingFunctions.js.
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let agxInset = mat3x3<f32>(
    vec3f(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3f(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3f(0.0482516061458583, 0.101439036467562, 0.811302368396859)
  );
  let agxOutset = mat3x3<f32>(
    vec3f(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3f(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3f(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
  );
  let linSrgbToRec2020 = mat3x3<f32>(
    vec3f(0.6274, 0.0691, 0.0164),
    vec3f(0.3293, 0.9195, 0.0880),
    vec3f(0.0433, 0.0113, 0.8956)
  );
  let linRec2020ToSrgb = mat3x3<f32>(
    vec3f(1.6605, -0.1246, -0.0182),
    vec3f(-0.5876, 1.1329, -0.1006),
    vec3f(-0.0728, -0.0083, 1.1187)
  );
  let minEv = -12.47393;
  let maxEv = 4.026069;

  var c = linSrgbToRec2020 * color;
  c = agxInset * c;
  c = max(c, vec3f(1e-10));
  c = log2(c);
  c = (c - vec3f(minEv)) / (maxEv - minEv);
  c = clamp(c, vec3f(0.0), vec3f(1.0));

  let x2 = c * c;
  let x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 -
    6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - vec3f(0.00232);

  c = agxOutset * c;
  c = pow(max(vec3f(0.0), c), vec3f(2.2));
  c = linRec2020ToSrgb * c;
  return clamp(c, vec3f(0.0), vec3f(1.0));
}
`.trim();

    case "neutral":
      // Faithful port of three.js neutralToneMapping (the Khronos PBR-neutral
      // operator, AI-90). The old implementation had the peak compression but
      // dropped the low-end black offset and the final hue-preserving
      // desaturation mix, so darks and bright saturated hues were off.
      // Reference: three.js src/nodes/display/ToneMappingFunctions.js
      // (modelviewer.dev/examples/tone-mapping).
      return `
fn apertureOutputTonemap(color: vec3f) -> vec3f {
  let startCompression = 0.8 - 0.04;
  let desaturation = 0.15;

  var c = color;
  let lowest = min(c.r, min(c.g, c.b));
  var offset = 0.04;
  if (lowest < 0.08) {
    offset = lowest - 6.25 * lowest * lowest;
  }
  c = c - vec3f(offset);

  let peak = max(c.r, max(c.g, c.b));
  if (peak < startCompression) {
    return c;
  }

  let d = 1.0 - startCompression;
  let newPeak = 1.0 - d * d / (peak + d - startCompression);
  c = c * (newPeak / peak);

  let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(c, vec3f(newPeak), g);
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
