import { type WebGpuPostEffect } from "./post-pass.js";
export interface CreateWebGpuBloomPostEffectOptions {
    readonly id?: string;
    readonly label?: string;
    readonly enabled?: boolean;
    readonly threshold?: number;
    readonly intensity?: number;
    readonly radius?: number;
    /**
     * Legacy Aperture blur radius fallback. Three.js BloomNode radius is
     * dimensionless; prefer `radius` for new code.
     */
    readonly radiusPixels?: number;
    readonly levels?: number;
}
export declare function createWebGpuBloomPostEffect(options?: CreateWebGpuBloomPostEffectOptions): WebGpuPostEffect;
//# sourceMappingURL=post-bloom.d.ts.map