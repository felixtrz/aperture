import {
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  createLocalLightClusterDescriptor,
  createLocalLightClusterGpuResource,
  type LocalLightClusterGpuResource,
  type LocalLightClusterSupportedPointShadowResource,
  type LocalLightClusterSupportedSpotShadowResource,
} from "../../lighting/local-light-clusters.js";
import type {
  CreateStandardFrameGpuResourcesDiagnostic,
  CreateStandardFrameGpuResourcesOptions,
  StandardFrameShadowReceiverResources,
} from "./standard-frame-resources.js";

export function requiresClusteredLocalLightBuffer(
  pipelineKey: string,
): boolean {
  return pipelineKey
    .split("|")
    .includes(CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE);
}

export function requiresClusteredLocalLightCookies(
  pipelineKey: string,
): boolean {
  return pipelineKey
    .split("|")
    .includes(CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE);
}

export function reusesShadowMatricesForClusteredLocalLightCookies(
  pipelineKey: string,
): boolean {
  return pipelineKey
    .split("|")
    .includes(CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE);
}

export function createLocalLightClusterResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    | "device"
    | "snapshot"
    | "pipelineKey"
    | "localLightClusterDescriptor"
    | "localLightClusterResources"
    | "localLightCookieResources"
    | "shadowReceiverResources"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): LocalLightClusterGpuResource | null {
  if (!requiresClusteredLocalLightBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.localLightClusterResources !== undefined) {
    return options.localLightClusterResources;
  }

  const descriptor =
    options.localLightClusterDescriptor ??
    createLocalLightClusterDescriptor(options.snapshot, {
      supportedPointShadowResources: supportedPointShadowResourcesFromReceiver(
        options.shadowReceiverResources,
      ),
      supportedSpotShadowResources: supportedSpotShadowResourcesFromReceiver(
        options.shadowReceiverResources,
      ),
      supportedCookieResources:
        options.localLightCookieResources?.supportedResources ?? [],
    });
  const result = createLocalLightClusterGpuResource({
    device: options.device,
    descriptor,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function supportedPointShadowResourcesFromReceiver(
  resources: StandardFrameShadowReceiverResources | undefined,
): readonly LocalLightClusterSupportedPointShadowResource[] {
  const pointResources =
    resources !== undefined && isMultiShadowKind(resources.shadowKind)
      ? resources.pointShadowReceiverResources
      : resources?.shadowKind === "point" ||
          resources?.shadowKind === "point-array" ||
          resources?.depthTextureResources.resources.some(
            (resource) =>
              resource.viewDimension === "cube" ||
              (resource.viewDimension === "2d-array" &&
                resource.faceCount === 6),
          ) === true
        ? resources
        : undefined;

  if (
    pointResources?.matrixBufferResource.resource === null ||
    pointResources?.samplerResource.resource === null
  ) {
    return [];
  }

  const pointDepthResources =
    pointResources?.depthTextureResources.resources.filter(
      (resource) =>
        (resource.viewDimension === "cube" ||
          (resource.viewDimension === "2d-array" &&
            resource.faceCount === 6)) &&
        resource.allocation.resource !== null,
    ) ?? [];

  if (pointDepthResources.length === 0) {
    return [];
  }

  return pointDepthResources.map((resource, index) => ({
    shadowId: resource.shadowId,
    lightId: resource.lightId,
    matrixBaseIndex:
      resource.viewDimension === "2d-array"
        ? (resource.layerBaseIndex ?? index * 6)
        : index * 6,
    ...(resource.filterRadiusTexels === undefined
      ? {}
      : { filterRadiusTexels: resource.filterRadiusTexels }),
  }));
}

function supportedSpotShadowResourcesFromReceiver(
  resources: StandardFrameShadowReceiverResources | undefined,
): readonly LocalLightClusterSupportedSpotShadowResource[] {
  const spotResources =
    resources !== undefined && isMultiShadowKind(resources.shadowKind)
      ? resources.spotShadowReceiverResources
      : resources?.shadowKind === "spot" ||
          resources?.shadowKind === "spot-array"
        ? resources
        : undefined;

  if (
    spotResources?.matrixBufferResource.resource === null ||
    spotResources?.samplerResource.resource === null
  ) {
    return [];
  }

  const spotDepthResources =
    spotResources?.depthTextureResources.resources.filter(
      (resource) =>
        (resource.viewDimension === "2d" ||
          resource.viewDimension === "2d-array") &&
        resource.allocation.resource !== null,
    ) ?? [];

  if (spotDepthResources.length === 0) {
    return [];
  }

  return spotDepthResources.map((resource, index) => ({
    shadowId: resource.shadowId,
    lightId: resource.lightId,
    matrixBaseIndex:
      resource.viewDimension === "2d-array"
        ? (resource.layerBaseIndex ?? index)
        : index,
    ...(resource.filterRadiusTexels === undefined
      ? {}
      : { filterRadiusTexels: resource.filterRadiusTexels }),
  }));
}

function isMultiShadowKind(
  shadowKind: StandardFrameShadowReceiverResources["shadowKind"] | undefined,
): boolean {
  return (
    shadowKind === "multi" ||
    shadowKind === "multi-spot-array" ||
    shadowKind === "multi-point-array" ||
    shadowKind === "multi-spot-array-point-array"
  );
}
