import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuSsrPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly opacity?: number;
    readonly maxSteps?: number;
    readonly stridePixels?: number;
    readonly thickness?: number;
    readonly near?: number;
    readonly far?: number;
    readonly fovYRadians?: number;
    readonly maxDistance?: number;
    readonly fresnel?: boolean;
    readonly distanceAttenuation?: boolean;
    readonly reflectionBlurPixels?: number;
    readonly fallbackOpacity?: number;
}
export declare function createWebGpuSsrPostEffect(options?: CreateWebGpuSsrPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-ssr.d.ts.map