import type { RenderSnapshot } from "@aperture-engine/render";
import {
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  createLocalLightClusterDescriptor,
} from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "./standard-frame-resources.js";

export function hasReadyStandardDiffuseIblResources(
  resources: StandardFrameIblResources | undefined,
): resources is StandardFrameIblResources {
  return (
    resources !== undefined &&
    resources.bindGroupResource.status === "available" &&
    resources.bindGroupResource.resource !== null &&
    resources.diffuseTextureResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true &&
    resources.samplerResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true
  );
}

export function hasReadyStandardSpecularIblProofResources(
  resources: StandardFrameIblResources | undefined,
): boolean {
  return (
    hasReadyStandardDiffuseIblResources(resources) &&
    resources.specularTextureResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true
  );
}

export function hasReadyStandardSpecularIblBrdfResources(
  resources: StandardFrameIblResources | undefined,
): boolean {
  return (
    hasReadyStandardSpecularIblProofResources(resources) &&
    resources?.brdfLutTextureResource?.ready === true &&
    resources.brdfLutTextureResource.resource !== null
  );
}

export function withStandardShadowPipelineKeys(
  snapshot: RenderSnapshot,
  shadowKind:
    | "directional"
    | "directional-cascaded"
    | "point"
    | "point-array"
    | "spot"
    | "spot-array"
    | "multi"
    | "multi-spot-array"
    | "multi-point-array"
    | "multi-spot-array-point-array" = "directional",
): RenderSnapshot {
  let changed = false;
  const shadowFeatures =
    shadowKind === "multi-spot-array-point-array"
      ? [
          "shadowMap",
          "pointShadowMap",
          CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
          CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
        ]
      : shadowKind === "multi-point-array"
        ? [
            "shadowMap",
            "pointShadowMap",
            CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
          ]
        : shadowKind === "multi-spot-array"
          ? [
              "shadowMap",
              "pointShadowMap",
              CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
            ]
          : shadowKind === "multi"
            ? ["shadowMap", "pointShadowMap"]
            : shadowKind === "point-array"
              ? [
                  "pointShadowMap",
                  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
                ]
              : shadowKind === "point"
                ? ["pointShadowMap"]
                : shadowKind === "directional-cascaded"
                  ? ["shadowMap", "cascadedShadowMap"]
                  : shadowKind === "spot-array"
                    ? [
                        "shadowMap",
                        CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
                      ]
                    : shadowKind === "spot"
                      ? ["shadowMap", "spotShadowMap"]
                      : ["shadowMap"];
  const meshDraws = snapshot.meshDraws.map((draw) => {
    let pipelineKey = draw.batchKey.pipelineKey;

    if (
      draw.receivesShadow === false ||
      !pipelineKey.startsWith("standard|") ||
      shadowFeatures.every((feature) => pipelineKey.includes(`|${feature}|`))
    ) {
      return draw;
    }

    changed = true;

    for (const shadowFeature of shadowFeatures) {
      if (!pipelineKey.includes(`|${shadowFeature}|`)) {
        pipelineKey = pipelineKey.replace(
          /^standard\|/,
          `standard|${shadowFeature}|`,
        );
      }
    }

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

export function standardShadowPipelineKind(
  resources: StandardFrameShadowReceiverResources,
):
  | "directional"
  | "directional-cascaded"
  | "point"
  | "point-array"
  | "spot"
  | "spot-array"
  | "multi"
  | "multi-spot-array"
  | "multi-point-array"
  | "multi-spot-array-point-array" {
  if (resources.shadowKind !== undefined) {
    return resources.shadowKind;
  }

  return resources.depthTextureResources.resources.some(
    (resource) =>
      resource.viewDimension === "2d-array" &&
      (resource.layerCount ?? resource.faceCount) > 1,
  )
    ? "directional-cascaded"
    : "directional";
}

export function canReuseClusteredLocalLightShadowMatricesForCookies(
  shadowResources: StandardFrameShadowReceiverResources | undefined,
  cookieResources: LocalLightClusterCookieResources | null,
): boolean {
  if (
    shadowResources === undefined ||
    cookieResources === null ||
    cookieResources.textureViewDimension !== "2d" ||
    cookieResources.supportedResources.length === 0
  ) {
    return false;
  }

  if (
    cookieResources.textureLayout === "atlas" &&
    cookieResources.shadowMatrixCompatible !== true
  ) {
    return false;
  }

  const spotResources = isMultiShadowKind(shadowResources.shadowKind)
    ? shadowResources.spotShadowReceiverResources
    : shadowResources.shadowKind === "spot" ||
        shadowResources.shadowKind === "spot-array"
      ? shadowResources
      : undefined;

  if (
    spotResources === undefined ||
    spotResources.matrixBufferResource.resource === null ||
    spotResources.samplerResource.resource === null
  ) {
    return false;
  }

  const supportedSpotLightIds = new Set(
    spotResources.depthTextureResources.resources
      .filter(
        (resource) =>
          (resource.viewDimension === "2d" ||
            resource.viewDimension === "2d-array") &&
          resource.allocation.resource !== null,
      )
      .map((resource) => resource.lightId),
  );

  return cookieResources.supportedResources.every(
    (resource) =>
      resource.textureViewDimension === "2d" &&
      supportedSpotLightIds.has(resource.lightId),
  );
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

export function withStandardIblPipelineKeys(
  snapshot: RenderSnapshot,
  includeSpecularProof: boolean,
  includeSpecularBrdf = false,
): RenderSnapshot {
  let changed = false;
  // The split-sum DFG term (iblSpecularBrdf) supersedes the hand-tuned proof
  // term: when the BRDF LUT is ready the snapshot carries iblSpecularBrdf
  // INSTEAD of iblSpecularProof so the pipeline cacheKey reflects the upgrade.
  const specularPrefix = includeSpecularBrdf
    ? "standard|iblDiffuse|iblSpecularBrdf|"
    : includeSpecularProof
      ? "standard|iblDiffuse|iblSpecularProof|"
      : "standard|iblDiffuse|";
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (
      !pipelineKey.startsWith("standard|") ||
      pipelineKey.includes("|iblDiffuse|")
    ) {
      return draw;
    }

    changed = true;
    const iblPipelineKey = pipelineKey.replace(/^standard\|/, specularPrefix);

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: iblPipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey: iblPipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

export function withStandardClusteredLocalLightPipelineKeys(
  snapshot: RenderSnapshot,
  options: {
    readonly supportedCookieResources?: readonly {
      readonly lightId: number;
      readonly textureKey: string;
      readonly samplerKey: string;
      readonly textureViewDimension: "2d" | "2d-array" | "cube";
      readonly matrixBaseIndex?: number;
    }[];
    readonly cookieTextureViewDimension?: "2d" | "2d-array" | "cube" | null;
    readonly reuseShadowMatricesForCookies?: boolean;
  } = {},
): RenderSnapshot {
  const descriptor = createLocalLightClusterDescriptor(snapshot, {
    supportedCookieResources: options.supportedCookieResources ?? [],
  });

  if (!descriptor.enabled) {
    return snapshot;
  }

  const cookieSamplingReady =
    descriptor.shadowCookieMetadata.cookie.samplingSupported;
  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (!pipelineKey.startsWith("standard|")) {
      return draw;
    }

    const clusteredPipelineKey = standardClusteredLocalLightPipelineKey(
      pipelineKey,
      cookieSamplingReady,
      options.cookieTextureViewDimension ?? null,
      options.reuseShadowMatricesForCookies === true,
    );

    if (clusteredPipelineKey === pipelineKey) {
      return draw;
    }

    changed = true;

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: clusteredPipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey: clusteredPipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

function standardClusteredLocalLightPipelineKey(
  pipelineKey: string,
  cookieSamplingReady: boolean,
  cookieTextureViewDimension: "2d" | "2d-array" | "cube" | null = null,
  reuseShadowMatricesForCookies = false,
): string {
  const tokens = pipelineKey.split("|");
  const family = tokens[0];

  if (family !== "standard") {
    return pipelineKey;
  }

  const rest = tokens
    .slice(1)
    .filter(
      (token) =>
        token !== CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
    );
  const cookieSamplingSupportedForDraw =
    cookieSamplingReady && !rest.includes("cascadedShadowMap");
  const reuseShadowMatricesForCookiesForDraw =
    reuseShadowMatricesForCookies &&
    cookieTextureViewDimension === "2d" &&
    rest.includes("shadowMap") &&
    !rest.includes("cascadedShadowMap");
  const features = [
    CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
    ...(cookieSamplingSupportedForDraw
      ? [
          CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
          ...(reuseShadowMatricesForCookiesForDraw
            ? [CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE]
            : []),
          ...(cookieTextureViewDimension === "cube"
            ? [CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE]
            : cookieTextureViewDimension === "2d-array"
              ? [CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE]
              : []),
        ]
      : []),
  ];

  return [family, ...features, ...rest].join("|");
}
