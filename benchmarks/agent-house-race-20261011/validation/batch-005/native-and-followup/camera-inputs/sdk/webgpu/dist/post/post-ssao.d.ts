import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuSsaoPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly radiusPixels?: number;
    readonly intensity?: number;
    readonly depthBias?: number;
    readonly maxDepthDifference?: number;
    readonly near?: number;
    readonly far?: number;
    readonly fovYRadians?: number;
    readonly sampleCount?: number;
    readonly minAngleDegrees?: number;
    readonly power?: number;
    readonly randomSeed?: number;
}
export declare function createWebGpuSsaoPostEffect(options?: CreateWebGpuSsaoPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-ssao.d.ts.map