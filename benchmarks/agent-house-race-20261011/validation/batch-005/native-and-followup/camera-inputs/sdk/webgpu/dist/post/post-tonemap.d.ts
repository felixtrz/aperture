import { type TonemapOperator } from "../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../output/output-stage-color-space.js";
import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuTonemapPostEffectOptions {
    readonly operator: TonemapOperator;
    readonly exposure: number;
    readonly outputColorSpace?: OutputColorSpace;
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
}
export declare function createWebGpuTonemapPostEffect(options: CreateWebGpuTonemapPostEffectOptions): WebGpuPostEffect;
export declare function tonemapPostEffectWgsl(operator: TonemapOperator, outputColorSpace: OutputColorSpace, exposure: number): string;
//# sourceMappingURL=post-tonemap.d.ts.map