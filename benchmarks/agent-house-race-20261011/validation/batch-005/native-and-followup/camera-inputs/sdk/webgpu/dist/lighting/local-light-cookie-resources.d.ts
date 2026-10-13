import type { RenderSnapshot } from "@aperture-engine/render";
import { type AppTextureSamplerPreparationOptions } from "../app/app-texture-sampler-resources.js";
import type { StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import type { LocalLightClusterCookieMatrixResource, PrepareLocalLightClusterCookieResourcesResult } from "./local-light-cookie-types.js";
export type { LocalLightClusterCookieAtlasUpdateReport, LocalLightClusterCookieMatrixResource, LocalLightClusterCookieResourceDiagnostic, LocalLightClusterCookieResources, LocalLightClusterCookieTextureViewDimension, PrepareLocalLightClusterCookieResourcesResult, } from "./local-light-cookie-types.js";
export declare function prepareLocalLightClusterCookieResources(options: AppTextureSamplerPreparationOptions & {
    readonly snapshot: RenderSnapshot;
    readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
    readonly matrixCache?: Map<string, LocalLightClusterCookieMatrixResource>;
}): PrepareLocalLightClusterCookieResourcesResult;
//# sourceMappingURL=local-light-cookie-resources.d.ts.map