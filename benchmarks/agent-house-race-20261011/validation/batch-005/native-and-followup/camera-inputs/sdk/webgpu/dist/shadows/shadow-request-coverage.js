/** Accounting is separate from path selection so composed paths can serve a union. */
export function createShadowRequestCoverage(requestedRequests, servedRequests) {
    const identity = (request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind ?? "directional",
    });
    const selected = new Set(servedRequests);
    const omitted = requestedRequests
        .filter((request) => !selected.has(request))
        .map((request) => ({
        ...identity(request),
        reason: (request.lightKind ?? "directional") === "directional" ||
            request.lightKind === "point" ||
            request.lightKind === "spot"
            ? "mixed-shadow-kind-not-supported"
            : "unsupported-shadow-light-kind",
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
export function shadowRequestOmissionDiagnostics(coverage, path) {
    return coverage.omitted.map((request) => ({
        stage: "shadowRequests",
        code: "renderShadowFrame.omittedShadowRequest",
        severity: "warning",
        message: `Shadow request ${request.shadowId} for ${request.lightKind} light ${request.lightId} was omitted: ${request.reason}. The selected shadow path is ${path}.`,
    }));
}
//# sourceMappingURL=shadow-request-coverage.js.map