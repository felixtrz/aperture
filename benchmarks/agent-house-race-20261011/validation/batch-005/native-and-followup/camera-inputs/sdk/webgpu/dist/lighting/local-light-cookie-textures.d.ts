import { type AppTextureSamplerPreparationOptions } from "../app/app-texture-sampler-resources.js";
import { type TextureGpuResource } from "../resources/textures/texture-resources.js";
import type { CookieArrayCandidate, CookieAtlasCandidate, LocalLightClusterCookieResourceDiagnostic, PreparedCookieAtlasTextureResource } from "./local-light-cookie-types.js";
export declare function prepareCookieTextureArrayResource(options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieArrayCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): {
    readonly cacheKey: string;
    readonly resource: TextureGpuResource;
} | null;
export declare function prepareCookieTextureAtlasResource(options: AppTextureSamplerPreparationOptions & {
    readonly candidates: readonly CookieAtlasCandidate[];
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): PreparedCookieAtlasTextureResource | null;
//# sourceMappingURL=local-light-cookie-textures.d.ts.map