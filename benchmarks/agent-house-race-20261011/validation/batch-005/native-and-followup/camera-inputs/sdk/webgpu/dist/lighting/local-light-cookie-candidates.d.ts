import type { RenderSnapshot } from "@aperture-engine/render";
import { type AppTextureSamplerPreparationOptions } from "../app/app-texture-sampler-resources.js";
import type { StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import type { CookieArrayCandidate, CookieAtlasCandidate } from "./local-light-cookie-types.js";
export declare function collectCookieArrayCandidates(options: Pick<AppTextureSamplerPreparationOptions, "assets"> & {
    readonly snapshot: RenderSnapshot;
}): readonly CookieArrayCandidate[];
export declare function collectCookieAtlasCandidates(options: Pick<AppTextureSamplerPreparationOptions, "assets"> & {
    readonly snapshot: RenderSnapshot;
}): readonly CookieAtlasCandidate[];
export declare function collectShadowAlignedCookieAtlasCandidates(candidates: readonly CookieAtlasCandidate[], shadowReceiverResources: StandardFrameShadowReceiverResources | undefined): readonly CookieAtlasCandidate[];
//# sourceMappingURL=local-light-cookie-candidates.d.ts.map