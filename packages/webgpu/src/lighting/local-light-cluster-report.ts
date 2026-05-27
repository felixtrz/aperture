import { cloneShadowCookieMetadata } from "./local-light-cluster-metadata.js";
import type {
  LocalLightClusterDescriptor,
  LocalLightClusterGpuResource,
  LocalLightClusterReport,
} from "./local-light-cluster-types.js";

export function localLightClusterReportFromDescriptor(
  descriptor: LocalLightClusterDescriptor,
  options: {
    readonly resource?: LocalLightClusterGpuResource | null;
    readonly buffersCreated?: number;
    readonly buffersReused?: number;
    readonly bufferWrites?: number;
    readonly bufferWritesSkipped?: number;
  } = {},
): LocalLightClusterReport {
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
    shadowCookieMetadata: cloneShadowCookieMetadata(
      descriptor.shadowCookieMetadata,
    ),
    resourceKey: descriptor.resourceKey,
    paramsResourceKey:
      resource?.paramsResourceKey ?? `${descriptor.resourceKey}/params`,
    cellsResourceKey:
      resource?.cellsResourceKey ?? `${descriptor.resourceKey}/cells`,
    indicesResourceKey:
      resource?.indicesResourceKey ?? `${descriptor.resourceKey}/indices`,
    metadataResourceKey:
      resource?.metadataResourceKey ?? `${descriptor.resourceKey}/metadata`,
    resourceReuse: {
      buffersCreated: options.buffersCreated ?? 0,
      buffersReused: options.buffersReused ?? 0,
      bufferWrites: options.bufferWrites ?? 0,
      bufferWritesSkipped: options.bufferWritesSkipped ?? 0,
    },
  };
}
