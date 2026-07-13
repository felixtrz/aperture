// B3 (three.js parity plan): MRT authoring for custom WGSL materials. A
// custom material may declare N color targets (formats + write masks); the
// declaration is data-only — target 0 is always the pass color the camera
// renders into (declared with the `"swapchain"` sentinel), and every extra
// target references a facade `RenderTargetAsset` handle whose realized color
// texture the frame attaches at `@location(index)`. Everything here is pure
// and headless-safe: format resolution, the pipeline-key segment (present
// ONLY when targets are declared so undeclared materials keep byte-identical
// keys), and the best-effort WGSL fragment-output-location parser used to
// validate `@location` outputs against the declaration before any pipeline
// is created.

import type {
  ColorWriteMask,
  CustomWgslColorTargetDeclaration,
} from "./types.js";

/**
 * Color formats a custom-material color target may declare. `"swapchain"`
 * resolves renderer-side to the pass color format the material renders into
 * (target 0 must use it; extra targets may use it when their paired render
 * target also declares `"swapchain"`). The concrete entries mirror the
 * `RenderTargetAssetFormat` set — extra targets are backed by facade render
 * targets, so a format outside that set could never realize an attachment.
 */
export const CUSTOM_WGSL_COLOR_TARGET_FORMATS = [
  "swapchain",
  "rgba8unorm",
  "rgba8unorm-srgb",
  "bgra8unorm",
  "bgra8unorm-srgb",
  "rgba16float",
] as const;

export type CustomWgslColorTargetFormat =
  (typeof CUSTOM_WGSL_COLOR_TARGET_FORMATS)[number];

/**
 * WebGPU guarantees 8 color attachments but only 32 bytes per sample; four
 * targets keeps every declarable combination inside the default limits.
 */
export const MAX_CUSTOM_WGSL_COLOR_TARGETS = 4;

export const CUSTOM_WGSL_COLOR_WRITE_MASKS: readonly ColorWriteMask[] = [
  "all",
  "none",
  "rgb",
  "alpha",
];

/** Resolve a declared target format against the frame's pass color format. */
export function resolveCustomWgslColorTargetFormat(
  format: CustomWgslColorTargetFormat,
  passColorFormat: string,
): string {
  return format === "swapchain" ? passColorFormat : format;
}

/**
 * The pipeline-key segment for a colorTargets declaration. Returns null when
 * no targets are declared so undeclared materials keep byte-identical keys
 * (the A1/A4 byte-identity rule). Render-target handle ids stay OUT of the
 * key: re-pointing a target at another handle of the same format must not
 * rebuild the pipeline.
 */
export function customWgslColorTargetsPipelineKeySegment(
  colorTargets: readonly CustomWgslColorTargetDeclaration[] | undefined,
): string | null {
  if (colorTargets === undefined || colorTargets.length === 0) {
    return null;
  }

  return `color-targets:${colorTargets
    .map((target) => `${target.format}/${target.writeMask ?? "all"}`)
    .join("+")}`;
}

/**
 * Best-effort parse of a WGSL fragment entry point's `@location(N)` outputs:
 * an inline `-> @location(N) <type>` return yields `[N]`; a struct return
 * yields every `@location(N)` member (ignoring `@builtin` members). Returns
 * null when the entry point or its return type cannot be recognized —
 * callers must then SKIP location validation rather than guess (the same
 * best-effort stance as `containsWgslEntrypoint`).
 */
export function parseWgslFragmentOutputLocations(
  code: string,
  entryPoint: string,
): readonly number[] | null {
  const entryPattern = new RegExp(
    `\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`,
    "g",
  );
  const entryMatch = entryPattern.exec(code);

  if (entryMatch === null) {
    return null;
  }

  const parametersEnd = findMatchingParenthesis(
    code,
    entryMatch.index + entryMatch[0].length - 1,
  );

  if (parametersEnd === -1) {
    return null;
  }

  const arrowMatch = /^\s*->\s*/.exec(code.slice(parametersEnd + 1));

  if (arrowMatch === null) {
    return null;
  }

  const returnStart = parametersEnd + 1 + arrowMatch[0].length;
  const returnText = code.slice(returnStart, code.indexOf("{", returnStart));
  const inlineLocation = /^@location\(\s*(\d+)\s*\)/.exec(returnText.trim());

  if (inlineLocation !== null) {
    return [Number(inlineLocation[1])];
  }

  const structName = /^([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(returnText.trim());

  if (structName === null) {
    return null;
  }

  return parseWgslStructOutputLocations(code, structName[1] ?? "");
}

function parseWgslStructOutputLocations(
  code: string,
  structName: string,
): readonly number[] | null {
  const structPattern = new RegExp(
    `\\bstruct\\s+${escapeRegExp(structName)}\\s*\\{`,
  );
  const structMatch = structPattern.exec(code);

  if (structMatch === null) {
    return null;
  }

  const bodyStart = structMatch.index + structMatch[0].length;
  const bodyEnd = code.indexOf("}", bodyStart);

  if (bodyEnd === -1) {
    return null;
  }

  const body = code.slice(bodyStart, bodyEnd);
  const locations: number[] = [];

  for (const member of body.matchAll(/@location\(\s*(\d+)\s*\)/g)) {
    locations.push(Number(member[1]));
  }

  return locations.sort((a, b) => a - b);
}

function findMatchingParenthesis(code: string, openIndex: number): number {
  let depth = 0;

  for (let index = openIndex; index < code.length; index += 1) {
    const character = code[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
