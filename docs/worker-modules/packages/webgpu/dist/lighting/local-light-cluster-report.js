import { cloneShadowCookieMetadata } from "./local-light-cluster-metadata.js";
/**
 * AI-18: make the silent clustered shadow/cookie fallback loud. When a shadow or
 * cookie was requested for clustered local lights but the selected pipeline variant
 * cannot sample it, the cluster summary reports `status:'metadata-only'` and the
 * shader emits a near-1.0 sentinel (host-undetectable). Derive a structured warning
 * so the host can observe the deferral instead of only seeing the sentinel.
 */
export function localLightClusterDeferredSamplingDiagnostics(report) {
    if (report === undefined) {
        return [];
    }
    const { shadow, cookie } = report.shadowCookieMetadata;
    const diagnostics = [];
    if (shadow.status === "metadata-only") {
        const reason = shadow.fallbackReason ??
            "clustered-local-shadow-sampling-not-implemented";
        diagnostics.push({
            code: "webGpuApp.clusteredLocalShadowSamplingDeferred",
            severity: "warning",
            deferredLightCount: shadow.clusteredLightCount,
            fallbackReason: shadow.fallbackReason,
            message: `Clustered local shadow sampling is deferred for ${shadow.clusteredLightCount} light(s) (${reason}); those lights render unshadowed (in-shader sentinel) until the variant supports clustered shadow sampling.`,
        });
    }
    if (cookie.status === "metadata-only") {
        const reason = cookie.fallbackReason ??
            "clustered-local-cookie-sampling-not-implemented";
        diagnostics.push({
            code: "webGpuApp.clusteredLocalCookieSamplingDeferred",
            severity: "warning",
            deferredLightCount: cookie.clusteredLightCount,
            fallbackReason: cookie.fallbackReason,
            message: `Clustered local cookie sampling is deferred for ${cookie.clusteredLightCount} light(s) (${reason}); those lights render without their cookie texture (in-shader sentinel) until the variant supports clustered cookie sampling.`,
        });
    }
    return diagnostics;
}
export function localLightClusterReportFromDescriptor(descriptor, options = {}) {
    const resource = options.resource ?? null;
    return {
        enabled: descriptor.enabled,
        fallbackReason: descriptor.fallbackReason,
        totalLights: descriptor.totalLights,
        totalLocalLights: descriptor.totalLocalLights,
        clusteredLocalLights: descriptor.clusteredLocalLights,
        layerMask: descriptor.layerMask,
        lightSetKey: descriptor.lightSetKey,
        coordinateSpace: descriptor.coordinateSpace,
        viewId: descriptor.viewId,
        boundsMin: { ...descriptor.boundsMin },
        boundsMax: { ...descriptor.boundsMax },
        clusterDimensions: { ...descriptor.dimensions },
        cellCount: descriptor.cellCount,
        populatedCells: descriptor.populatedCells,
        maxLightsPerPopulatedCell: descriptor.maxLightsPerPopulatedCell,
        averageLightsPerPopulatedCell: descriptor.averageLightsPerPopulatedCell,
        totalAssignedLightReferences: descriptor.totalAssignedLightReferences,
        occupancyHash: descriptor.occupancyHash,
        overflowedCells: descriptor.overflowedCells,
        maxLightsPerCell: descriptor.maxLightsPerCell,
        buildPressure: { ...descriptor.buildPressure },
        shadowCookieMetadata: cloneShadowCookieMetadata(descriptor.shadowCookieMetadata),
        resourceKey: descriptor.resourceKey,
        paramsResourceKey: resource?.paramsResourceKey ?? `${descriptor.resourceKey}/params`,
        cellsResourceKey: resource?.cellsResourceKey ?? `${descriptor.resourceKey}/cells`,
        indicesResourceKey: resource?.indicesResourceKey ?? `${descriptor.resourceKey}/indices`,
        metadataResourceKey: resource?.metadataResourceKey ?? `${descriptor.resourceKey}/metadata`,
        resourceReuse: {
            buffersCreated: options.buffersCreated ?? 0,
            buffersReused: options.buffersReused ?? 0,
            bufferWrites: options.bufferWrites ?? 0,
            bufferWritesSkipped: options.bufferWritesSkipped ?? 0,
        },
    };
}
//# sourceMappingURL=local-light-cluster-report.js.map