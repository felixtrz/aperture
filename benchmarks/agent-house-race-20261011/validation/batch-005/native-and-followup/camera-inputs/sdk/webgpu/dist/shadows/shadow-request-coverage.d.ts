import type { ShadowRequestPacket } from "@aperture-engine/render";
import type { RenderShadowFrameReport } from "./render-shadow-frame.js";
/** Accounting is separate from path selection so composed paths can serve a union. */
export declare function createShadowRequestCoverage(requestedRequests: readonly ShadowRequestPacket[], servedRequests: readonly ShadowRequestPacket[]): NonNullable<RenderShadowFrameReport["requestCoverage"]>;
/** The omission diagnostic follows selection, never resource readiness. */
export declare function shadowRequestOmissionDiagnostics(coverage: NonNullable<RenderShadowFrameReport["requestCoverage"]>, path: string): RenderShadowFrameReport["diagnostics"];
//# sourceMappingURL=shadow-request-coverage.d.ts.map