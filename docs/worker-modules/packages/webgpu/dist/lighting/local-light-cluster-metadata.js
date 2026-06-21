import { LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST, LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_DEFERRED, LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED, LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST, LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED, LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED, LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE, } from "./local-light-cluster-constants.js";
import { lightMatchesLayer } from "./local-light-cluster-layer.js";
export function createLocalLightClusterShadowCookieMetadata(snapshot, clusteredLights, layerMask, supportedPointShadowResources, supportedSpotShadowResources, supportedCookieResources) {
    const metadata = new Uint32Array(Math.max(snapshot.lights.length * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE, LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE));
    const clusteredLightIndices = new Set(clusteredLights.map((light) => light.lightIndex));
    const localLightIndexById = new Map();
    for (let index = 0; index < snapshot.lights.length; index += 1) {
        const light = snapshot.lights[index];
        if (light !== undefined &&
            (light.kind === "point" || light.kind === "spot") &&
            lightMatchesLayer(light, layerMask)) {
            localLightIndexById.set(light.lightId, index);
        }
    }
    const localShadowLightIndices = new Set();
    const clusteredShadowLightIndices = new Set();
    const supportedShadowLightIndices = new Set();
    const localCookieLightIndices = new Set();
    const clusteredCookieLightIndices = new Set();
    const supportedCookieLightIndices = new Set();
    const supportedPointShadowByKey = new Map(supportedPointShadowResources.map((resource, index) => [
        `${resource.shadowId}:${resource.lightId}`,
        {
            matrixBaseIndex: Math.max(resource.matrixBaseIndex ?? index * 6, 0),
            filterRadiusTexels: normalizeShadowFilterRadiusTexels(resource.filterRadiusTexels, 0),
        },
    ]));
    const supportedSpotShadowByKey = new Map(supportedSpotShadowResources.map((resource, index) => [
        `${resource.shadowId}:${resource.lightId}`,
        {
            matrixBaseIndex: Math.max(resource.matrixBaseIndex ?? index, 0),
            filterRadiusTexels: normalizeShadowFilterRadiusTexels(resource.filterRadiusTexels, 1),
        },
    ]));
    const supportedCookieByLightId = new Map(supportedCookieResources.map((resource, index) => [
        resource.lightId,
        Math.max(resource.matrixBaseIndex ?? index, 0),
    ]));
    for (let lightIndex = 0; lightIndex < snapshot.lights.length; lightIndex += 1) {
        const light = snapshot.lights[lightIndex];
        if (light === undefined ||
            (light.kind !== "point" && light.kind !== "spot") ||
            !lightMatchesLayer(light, layerMask) ||
            light.cookieTexture === undefined ||
            light.cookieTexture === null) {
            continue;
        }
        localCookieLightIndices.add(lightIndex);
        const metadataOffset = lightIndex * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
        const supportedMatrixBaseIndex = supportedCookieByLightId.get(light.lightId);
        const cookieFlags = LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST |
            (supportedMatrixBaseIndex === undefined
                ? LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_DEFERRED
                : LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED);
        metadata[metadataOffset] = (metadata[metadataOffset] ?? 0) | cookieFlags;
        metadata[metadataOffset + 3] = supportedMatrixBaseIndex ?? 0;
        if (clusteredLightIndices.has(lightIndex)) {
            clusteredCookieLightIndices.add(lightIndex);
            if (supportedMatrixBaseIndex !== undefined) {
                supportedCookieLightIndices.add(lightIndex);
            }
        }
    }
    for (const request of snapshot.shadowRequests) {
        const lightIndex = localLightIndexById.get(request.lightId);
        if (lightIndex === undefined) {
            continue;
        }
        const light = snapshot.lights[lightIndex];
        if (light === undefined ||
            (request.lightKind !== undefined &&
                request.lightKind !== "point" &&
                request.lightKind !== "spot")) {
            continue;
        }
        localShadowLightIndices.add(lightIndex);
        const supportedShadowResource = request.lightKind === "point"
            ? supportedPointShadowByKey.get(`${request.shadowId}:${request.lightId}`)
            : request.lightKind === "spot"
                ? supportedSpotShadowByKey.get(`${request.shadowId}:${request.lightId}`)
                : undefined;
        const metadataOffset = lightIndex * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
        const shadowFlags = LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST |
            (supportedShadowResource === undefined
                ? LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED
                : LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED);
        metadata[metadataOffset] = (metadata[metadataOffset] ?? 0) | shadowFlags;
        metadata[metadataOffset + 1] = request.shadowId >>> 0;
        metadata[metadataOffset + 2] =
            supportedShadowResource?.matrixBaseIndex ?? 0;
        metadata[metadataOffset + 4] =
            supportedShadowResource?.filterRadiusTexels ?? 0;
        if (clusteredLightIndices.has(lightIndex)) {
            clusteredShadowLightIndices.add(lightIndex);
            if (supportedShadowResource !== undefined) {
                supportedShadowLightIndices.add(lightIndex);
            }
        }
    }
    const localShadowRequestCount = localShadowLightIndices.size;
    const clusteredShadowLightCount = clusteredShadowLightIndices.size;
    const supportedShadowLightCount = supportedShadowLightIndices.size;
    let hardFilterLightCount = 0;
    let softFilterLightCount = 0;
    let maxFilterRadiusTexels = 0;
    for (const lightIndex of supportedShadowLightIndices) {
        const metadataOffset = lightIndex * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
        const filterRadiusTexels = metadata[metadataOffset + 4] ?? 0;
        if (filterRadiusTexels <= 0) {
            hardFilterLightCount += 1;
        }
        if (filterRadiusTexels > 1) {
            softFilterLightCount += 1;
        }
        maxFilterRadiusTexels = Math.max(maxFilterRadiusTexels, filterRadiusTexels);
    }
    const shadowStatus = supportedShadowLightCount > 0
        ? "sampling-ready"
        : clusteredShadowLightCount > 0
            ? "metadata-only"
            : "not-requested";
    const localCookieRequestCount = localCookieLightIndices.size;
    const clusteredCookieLightCount = clusteredCookieLightIndices.size;
    const supportedCookieLightCount = supportedCookieLightIndices.size;
    const cookieStatus = supportedCookieLightCount > 0
        ? "sampling-ready"
        : clusteredCookieLightCount > 0
            ? "metadata-only"
            : "not-requested";
    return {
        metadata,
        summary: {
            wordsPerLight: LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
            totalMetadataLights: snapshot.lights.length,
            shadow: {
                status: shadowStatus,
                samplingSupported: supportedShadowLightCount > 0,
                localRequestCount: localShadowRequestCount,
                clusteredLightCount: clusteredShadowLightCount,
                supportedLightCount: supportedShadowLightCount,
                hardFilterLightCount,
                softFilterLightCount,
                maxFilterRadiusTexels,
                fallbackReason: shadowStatus === "sampling-ready" &&
                    supportedShadowLightCount < clusteredShadowLightCount
                    ? "clustered-local-shadow-sampling-partial"
                    : shadowStatus === "metadata-only"
                        ? "clustered-local-shadow-sampling-not-implemented"
                        : null,
            },
            cookie: {
                status: cookieStatus,
                samplingSupported: supportedCookieLightCount > 0,
                localRequestCount: localCookieRequestCount,
                clusteredLightCount: clusteredCookieLightCount,
                supportedLightCount: supportedCookieLightCount,
                fallbackReason: cookieStatus === "sampling-ready" &&
                    supportedCookieLightCount < clusteredCookieLightCount
                    ? "clustered-local-cookie-sampling-partial"
                    : cookieStatus === "metadata-only"
                        ? "clustered-local-cookie-sampling-not-implemented"
                        : null,
            },
        },
    };
}
export function cloneShadowCookieMetadata(metadata) {
    return {
        wordsPerLight: metadata.wordsPerLight,
        totalMetadataLights: metadata.totalMetadataLights,
        shadow: { ...metadata.shadow },
        cookie: { ...metadata.cookie },
    };
}
function normalizeShadowFilterRadiusTexels(value, fallback) {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(16, Math.max(0, Math.round(value)));
}
//# sourceMappingURL=local-light-cluster-metadata.js.map