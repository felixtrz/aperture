import type { AppTextureSamplerPreparationOptions } from "../app/app-texture-sampler-resources.js";
import { type SamplerGpuResource } from "../resources/textures/texture-resources.js";
import type { LocalLightClusterCookieResourceDiagnostic } from "./local-light-cookie-types.js";
export declare const DEFAULT_COOKIE_SAMPLER_CACHE_KEY = "local-light-cookie:default-sampler@1";
export declare function prepareDefaultCookieSamplerResource(options: Pick<AppTextureSamplerPreparationOptions, "cache" | "device" | "reuse"> & {
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): {
    readonly cacheKey: string;
    readonly resource: SamplerGpuResource;
} | null;
//# sourceMappingURL=local-light-cookie-sampler.d.ts.map