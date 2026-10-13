import type { WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuTaaPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly historyWeight?: number;
}
export declare function createWebGpuTaaPostEffect(options?: CreateWebGpuTaaPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-taa.d.ts.map