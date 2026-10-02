import type { ShadowRequestPacket } from "@aperture-engine/render";
import type { RenderShadowFrameReport } from "./render-shadow-frame.js";

/** Accounting is separate from path selection so composed paths can serve a union. */
export function createShadowRequestCoverage(
  requestedRequests: readonly ShadowRequestPacket[],
  servedRequests: readonly ShadowRequestPacket[],
): NonNullable<RenderShadowFrameReport["requestCoverage"]> {
  const identity = (request: ShadowRequestPacket) => ({
    shadowId: request.shadowId,
    lightId: request.lightId,
    lightKind: request.lightKind ?? "directional",
  });
  const selected = new Set(servedRequests);
  const omitted = requestedRequests
    .filter((request) => !selected.has(request))
    .map((request) => ({
      ...identity(request),
      reason:
        (request.lightKind ?? "directional") === "directional" ||
        request.lightKind === "point" ||
        request.lightKind === "spot"
          ? ("mixed-shadow-kind-not-supported" as const)
          : ("unsupported-shadow-light-kind" as const),
    }));
  return {
    requestedCount: requestedRequests.length,
    servedCount: servedRequests.length,
    omittedCount: omitted.length,
    requested: requestedRequests.map(identity),
    served: servedRequests.map(identity),
    omitted,
  };
}

/** The omission diagnostic follows selection, never resource readiness. */
export function shadowRequestOmissionDiagnostics(
  coverage: NonNullable<RenderShadowFrameReport["requestCoverage"]>,
  path: string,
): RenderShadowFrameReport["diagnostics"] {
  return coverage.omitted.map((request) => ({
    stage: "shadowRequests",
    code: "renderShadowFrame.omittedShadowRequest",
    severity: "warning",
    message: `Shadow request ${request.shadowId} for ${request.lightKind} light ${request.lightId} was omitted: ${request.reason}. The selected shadow path is ${path}.`,
  }));
}
