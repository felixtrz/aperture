import type { LightPacket, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import type { CookieArrayCandidate, CookieAtlasCandidate, LocalLightClusterCookieMatrixResource, LocalLightClusterCookieResourceDiagnostic } from "./local-light-cookie-types.js";
export declare function prepareCookieMatrixResource(options: {
    readonly device: WebGpuBufferDeviceLike;
    readonly snapshot: RenderSnapshot;
    readonly light: LightPacket;
    readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null;
export declare function prepareCookieMatrixArrayResource(options: {
    readonly device: WebGpuBufferDeviceLike;
    readonly snapshot: RenderSnapshot;
    readonly candidates: readonly CookieArrayCandidate[];
    readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null;
export declare function prepareCookieAtlasMatrixResource(options: {
    readonly device: WebGpuBufferDeviceLike;
    readonly snapshot: RenderSnapshot;
    readonly candidates: readonly CookieAtlasCandidate[];
    readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
    readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null;
//# sourceMappingURL=local-light-cookie-matrices.d.ts.map