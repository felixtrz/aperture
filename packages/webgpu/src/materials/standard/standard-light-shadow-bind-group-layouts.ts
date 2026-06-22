import type {
  WebGpuBindGroupLayoutDescriptor,
  WebGpuBindGroupLayoutEntryDescriptor,
} from "../../gpu/bind-group-layout-cache.js";
import { appendClusteredLocalLightLayoutEntries } from "../../lighting/light-bind-group-layout.js";
import {
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
} from "./standard-light-shadow-bind-group-constants.js";

type ClusteredLocalLightCookieTextureViewDimension = "2d" | "2d-array" | "cube";

export function createStandardLightShadowBindGroupLayoutDescriptor(options?: {
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor {
  return createStandardLightShadowBindGroupLayoutDescriptorForView(
    "2d",
    options,
  );
}

export function createStandardLightCascadedShadowBindGroupLayoutDescriptor(options?: {
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor {
  return createStandardLightShadowBindGroupLayoutDescriptorForView(
    "2d-array",
    options,
  );
}

export function createStandardLightPointShadowBindGroupLayoutDescriptor(options?: {
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightPointArrayShadows?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor {
  return createStandardLightShadowBindGroupLayoutDescriptorForView(
    options?.clusteredLocalLightPointArrayShadows === true
      ? "2d-array"
      : "cube",
    options,
  );
}

export function createStandardLightMultiShadowBindGroupLayoutDescriptor(options?: {
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightArrayShadows?: boolean;
  readonly clusteredLocalLightPointArrayShadows?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor {
  const compactClusteredLocalShadows = options?.clusteredLocalLights === true;
  const spotShadowViewDimension =
    options?.clusteredLocalLightArrayShadows === true ? "2d-array" : "2d";
  const pointShadowViewDimension =
    options?.clusteredLocalLightPointArrayShadows === true
      ? "2d-array"
      : "cube";
  const entries: WebGpuBindGroupLayoutEntryDescriptor[] = [
    { binding: 0, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 1, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 2, visibility: 0x3, buffer: { type: "read-only-storage" } },
    {
      binding: 3,
      visibility: 0x2,
      texture: {
        sampleType: "depth",
        viewDimension: spotShadowViewDimension,
        multisampled: false,
      },
    },
    { binding: 4, visibility: 0x2, sampler: { type: "comparison" } },
    { binding: 8, visibility: 0x3, buffer: { type: "read-only-storage" } },
    {
      binding: 9,
      visibility: 0x2,
      texture: {
        sampleType: "depth",
        viewDimension: pointShadowViewDimension,
        multisampled: false,
      },
    },
    { binding: 10, visibility: 0x2, sampler: { type: "comparison" } },
  ];

  if (!compactClusteredLocalShadows) {
    entries.splice(
      5,
      0,
      { binding: 5, visibility: 0x3, buffer: { type: "read-only-storage" } },
      {
        binding: 6,
        visibility: 0x2,
        texture: {
          sampleType: "depth",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      { binding: 7, visibility: 0x2, sampler: { type: "comparison" } },
    );
  }

  appendClusteredLocalLightLayoutEntries(
    entries,
    0x2,
    options?.clusteredLocalLights === true,
    options?.clusteredLocalLightCookies === true,
    options?.clusteredLocalLightCookieTextureViewDimension,
    options?.clusteredLocalLightShadowCookies !== true,
  );

  return {
    label: STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
    entries,
  };
}

function createStandardLightShadowBindGroupLayoutDescriptorForView(
  viewDimension: "2d" | "2d-array" | "cube",
  options?: {
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
  },
): WebGpuBindGroupLayoutDescriptor {
  const entries: WebGpuBindGroupLayoutEntryDescriptor[] = [
    { binding: 0, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 1, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 2, visibility: 0x3, buffer: { type: "read-only-storage" } },
    {
      binding: 3,
      visibility: 0x2,
      texture: {
        sampleType: "depth",
        viewDimension,
        multisampled: false,
      },
    },
    { binding: 4, visibility: 0x2, sampler: { type: "comparison" } },
  ];

  appendClusteredLocalLightLayoutEntries(
    entries,
    0x2,
    options?.clusteredLocalLights === true,
    options?.clusteredLocalLightCookies === true,
    options?.clusteredLocalLightCookieTextureViewDimension,
    options?.clusteredLocalLightShadowCookies !== true,
  );

  return {
    label:
      viewDimension === "cube"
        ? STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY
        : viewDimension === "2d-array"
          ? STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY
          : STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
    entries,
  };
}

export function createStandardLightIblBindGroupLayoutDescriptor(options?: {
  readonly shadowMap?: boolean;
  readonly cascadedShadowMap?: boolean;
  readonly specularProof?: boolean;
  readonly clusteredLocalLights?: boolean;
  readonly clusteredLocalLightCookies?: boolean;
  readonly clusteredLocalLightShadowCookies?: boolean;
  readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor {
  const entries: WebGpuBindGroupLayoutEntryDescriptor[] = [
    { binding: 0, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 1, visibility: 0x2, buffer: { type: "read-only-storage" } },
  ];

  if (options?.shadowMap === true) {
    const viewDimension =
      options.cascadedShadowMap === true ? "2d-array" : "2d";

    entries.push(
      { binding: 2, visibility: 0x3, buffer: { type: "read-only-storage" } },
      {
        binding: 3,
        visibility: 0x2,
        texture: {
          sampleType: "depth",
          viewDimension,
          multisampled: false,
        },
      },
      { binding: 4, visibility: 0x2, sampler: { type: "comparison" } },
    );
  }

  entries.push(
    {
      binding: 5,
      visibility: 0x2,
      texture: {
        sampleType: "float",
        viewDimension: "cube",
        multisampled: false,
      },
    },
    { binding: 6, visibility: 0x2, sampler: { type: "filtering" } },
  );

  if (options?.specularProof === true) {
    entries.push({
      binding: 7,
      visibility: 0x2,
      texture: {
        sampleType: "float",
        viewDimension: "cube",
        multisampled: false,
      },
    });
  }

  appendClusteredLocalLightLayoutEntries(
    entries,
    0x2,
    options?.clusteredLocalLights === true,
    options?.clusteredLocalLightCookies === true,
    options?.clusteredLocalLightCookieTextureViewDimension,
    options?.clusteredLocalLightShadowCookies !== true,
  );

  return {
    label:
      options?.shadowMap === true && options.cascadedShadowMap === true
        ? STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
        : options?.shadowMap === true
          ? STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
          : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
    entries,
  };
}
