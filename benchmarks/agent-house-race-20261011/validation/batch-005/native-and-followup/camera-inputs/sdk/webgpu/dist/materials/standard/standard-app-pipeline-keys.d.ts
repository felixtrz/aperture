import type { RenderSnapshot } from "@aperture-engine/render";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type { StandardFrameIblResources, StandardFrameShadowReceiverResources } from "./standard-frame-resources.js";
export declare function hasReadyStandardDiffuseIblResources(resources: StandardFrameIblResources | undefined): resources is StandardFrameIblResources;
export declare function hasReadyStandardSpecularIblProofResources(resources: StandardFrameIblResources | undefined): boolean;
export declare function hasReadyStandardSpecularIblBrdfResources(resources: StandardFrameIblResources | undefined): boolean;
export declare function withStandardShadowPipelineKeys(snapshot: RenderSnapshot, shadowKind?: "directional" | "directional-cascaded" | "point" | "point-array" | "directional-point-array" | "spot" | "spot-array" | "multi" | "multi-spot-array" | "multi-point-array" | "multi-spot-array-point-array"): RenderSnapshot;
export declare function standardShadowPipelineKind(resources: StandardFrameShadowReceiverResources): "directional" | "directional-cascaded" | "point" | "point-array" | "directional-point-array" | "spot" | "spot-array" | "multi" | "multi-spot-array" | "multi-point-array" | "multi-spot-array-point-array";
export declare function canReuseClusteredLocalLightShadowMatricesForCookies(shadowResources: StandardFrameShadowReceiverResources | undefined, cookieResources: LocalLightClusterCookieResources | null): boolean;
export declare function withStandardIblPipelineKeys(snapshot: RenderSnapshot, includeSpecularProof: boolean, includeSpecularBrdf?: boolean): RenderSnapshot;
export declare function withStandardClusteredLocalLightPipelineKeys(snapshot: RenderSnapshot, options?: {
    readonly supportedCookieResources?: readonly {
        readonly lightId: number;
        readonly textureKey: string;
        readonly samplerKey: string;
        readonly textureViewDimension: "2d" | "2d-array" | "cube";
        readonly matrixBaseIndex?: number;
    }[];
    readonly cookieTextureViewDimension?: "2d" | "2d-array" | "cube" | null;
    readonly reuseShadowMatricesForCookies?: boolean;
}): RenderSnapshot;
//# sourceMappingURL=standard-app-pipeline-keys.d.ts.map