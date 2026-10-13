import type { BuiltInShaderSourceModule } from "../materials/unlit/unlit-shader.js";
import { type OutputColorSpace } from "./output-stage-color-space.js";
export declare const TONEMAP_OPERATORS: readonly ["none", "linear", "reinhard", "aces", "agx", "neutral"];
export type TonemapOperator = (typeof TONEMAP_OPERATORS)[number];
export declare const DEFAULT_TONEMAP_OPERATOR: TonemapOperator;
export declare function isTonemapOperator(value: unknown): value is TonemapOperator;
export declare function parseTonemapOperator(value: unknown): TonemapOperator | null;
export declare function resolveTonemapOperator(value: unknown): TonemapOperator;
export declare function createTonemapPipelineKey(operator: TonemapOperator): string;
export interface CreateOutputTonemapWgslOptions {
    readonly exposure?: boolean;
}
export declare function createOutputTonemapWgsl(operator: TonemapOperator, options?: CreateOutputTonemapWgslOptions): string;
export declare function applyOutputTonemapToStandardShader(shader: BuiltInShaderSourceModule, operator: TonemapOperator, outputColorSpace?: OutputColorSpace): BuiltInShaderSourceModule;
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
export declare function applyOutputStageToFragmentWgsl(code: string, operator: TonemapOperator, outputColorSpace?: OutputColorSpace, label?: string): string;
export declare function applyOutputStageToBuiltInShader(shader: BuiltInShaderSourceModule, operator: TonemapOperator, outputColorSpace?: OutputColorSpace): BuiltInShaderSourceModule;
//# sourceMappingURL=output-stage-tonemap.d.ts.map