import {
  STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING,
  STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING,
  STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING,
  type StandardAreaLightLtcResources,
} from "./standard-area-light-ltc-resource.js";
import {
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  type LocalLightClusterGpuResource,
} from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type {
  StandardLightIblShadowReceiverResources,
  StandardLightShadowBindGroupDescriptorEntry,
  StandardLightShadowBindGroupDiagnostic,
} from "./standard-light-shadow-bind-group.js";

export function appendAreaLightLtcEntries(
  entries: StandardLightShadowBindGroupDescriptorEntry[],
  resources: StandardAreaLightLtcResources | null,
): void {
  if (resources === null) {
    return;
  }

  entries.push(
    {
      binding: STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING,
      resourceKey: resources.matrixTexture.resourceKey,
      resourceKind: "texture-view",
    },
    {
      binding: STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING,
      resourceKey: resources.fresnelTexture.resourceKey,
      resourceKind: "texture-view",
    },
    {
      binding: STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING,
      resourceKey: resources.sampler.resourceKey,
      resourceKind: "sampler",
    },
  );
}

export function appendLocalLightClusterEntries(
  entries: StandardLightShadowBindGroupDescriptorEntry[],
  resources: LocalLightClusterGpuResource | null,
): void {
  if (resources === null) {
    return;
  }

  entries.push(
    {
      binding: 16,
      resourceKey: resources.paramsResourceKey,
      resourceKind: "buffer",
    },
    {
      binding: 17,
      resourceKey: resources.cellsResourceKey,
      resourceKind: "buffer",
    },
    {
      binding: 18,
      resourceKey: resources.indicesResourceKey,
      resourceKind: "buffer",
    },
    {
      binding: 19,
      resourceKey: resources.metadataResourceKey,
      resourceKind: "buffer",
    },
  );
}

export function appendLocalLightCookieEntries(
  entries: StandardLightShadowBindGroupDescriptorEntry[],
  resources: LocalLightClusterCookieResources | null,
  matrixEntryEnabled = true,
): void {
  if (resources === null) {
    return;
  }

  entries.push({
    binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
    resourceKey: resources.textureResource.resourceKey,
    resourceKind: "texture-view",
  });
  entries.push({
    binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
    resourceKey: resources.samplerResource.resourceKey,
    resourceKind: "sampler",
  });

  if (matrixEntryEnabled) {
    entries.push({
      binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
      resourceKey: resources.matrixResource.resourceKey,
      resourceKind: "buffer",
    });
  }
}

export function appendShadowEntries(
  shadowResources: StandardLightIblShadowReceiverResources,
  entries: StandardLightShadowBindGroupDescriptorEntry[],
  diagnostics: StandardLightShadowBindGroupDiagnostic[],
  bindings: {
    readonly matrix: number;
    readonly depth: number;
    readonly sampler: number;
  } = { matrix: 2, depth: 3, sampler: 4 },
): void {
  if (shadowResources.matrixBufferResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingMatrixBufferResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow matrix buffer.",
    });
  } else {
    entries.push({
      binding: bindings.matrix,
      resourceKey: shadowResources.matrixBufferResource.resource.resourceKey,
      resourceKind: "buffer",
    });
  }

  const depthResource = shadowResources.depthTextureResources.resources.find(
    (resource) => resource.allocation.resource !== null,
  );

  if (depthResource === undefined) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingDepthTextureResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow depth texture view.",
    });
  } else {
    entries.push({
      binding: bindings.depth,
      resourceKey: depthResource.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (shadowResources.samplerResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingSamplerResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow comparison sampler.",
    });
  } else {
    entries.push({
      binding: bindings.sampler,
      resourceKey: shadowResources.samplerResource.resource.resourceKey,
      resourceKind: "sampler",
    });
  }
}
