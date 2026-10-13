import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuFxaaPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
}
export declare function createWebGpuFxaaPostEffect(options?: CreateWebGpuFxaaPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-fxaa.d.ts.map