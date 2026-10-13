import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuDofPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly near?: number;
    readonly far?: number;
    readonly focusDistance?: number;
    readonly focusRange?: number;
    readonly aperture?: number;
    readonly maxBlurPixels?: number;
    readonly nearBlur?: boolean;
    readonly blurRings?: number;
    readonly blurRingPoints?: number;
    readonly farBlurScale?: number;
    readonly nearBlurScale?: number;
}
export declare function createWebGpuDofPostEffect(options?: CreateWebGpuDofPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-dof.d.ts.map