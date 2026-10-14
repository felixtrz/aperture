import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createWebGpuBindGroupLayoutCacheKey,
  type WebGpuBindGroupLayoutDescriptor,
  type WebGpuBindGroupLayoutEntryDescriptor,
} from "../../gpu/bind-group-layout-cache.js";
import { createLightBindGroupLayoutDescriptor } from "../../lighting/light-bind-group-layout.js";
import {
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
} from "../../lighting/local-light-clusters.js";
import { isColor0LayoutToken } from "../unlit/unlit-pipeline-descriptor.js";
import { readStandardLightingSpecializationFeatures } from "./standard-light-specialization.js";
import {
  createStandardLightCascadedShadowBindGroupLayoutDescriptor,
  createStandardLightIblBindGroupLayoutDescriptor,
  createStandardLightMultiShadowBindGroupLayoutDescriptor,
  createStandardLightPointShadowBindGroupLayoutDescriptor,
  createStandardLightShadowBindGroupLayoutDescriptor,
} from "./standard-light-shadow-bind-group-layouts.js";
import { standardMorphTargetsEnabledFromBatchKey } from "./standard-morph-target-shader.js";
import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";
import { standardTextureVariantBindings } from "./standard-shader-variant-bindings.js";
import { standardSkinningEnabledFromBatchKey } from "./standard-skinning-shader.js";
import { supportsStandardSmallLightUniforms } from "./standard-small-light-uniforms.js";

export type StandardLightTransport = "storage" | "sun-ambient-v1";

export interface StandardTransmissionSceneColorRequirement {
  readonly group: 3;
  readonly textureBinding: 14;
  readonly samplerBinding: 15;
  readonly producer: "scene-color-grab";
  readonly viewDimension: "2d";
  readonly sampleType: "float";
}

/** One derived decision shared by shader, layout and resource consumers. */
export interface StandardRenderPlan {
  readonly version: 1;
  readonly features: StandardTextureShaderFeatures;
  readonly lightTransport: StandardLightTransport;
  readonly layoutMode: "auto" | "explicit";
  readonly lightBindingLayout: WebGpuBindGroupLayoutDescriptor;
  readonly bindGroupLayouts: readonly WebGpuBindGroupLayoutDescriptor[];
  readonly structuralKey: string;
  readonly usesAreaLightLtc: boolean;
  readonly transmissionSceneColor: StandardTransmissionSceneColorRequirement | null;
}

export interface StandardExplicitPipelineLayoutDeviceLike {
  createBindGroupLayout(descriptor: WebGpuBindGroupLayoutDescriptor): unknown;
  createPipelineLayout(descriptor: {
    readonly label?: string;
    readonly bindGroupLayouts: readonly unknown[];
  }): unknown;
}

export interface StandardExplicitPipelineLayout {
  readonly layout: unknown;
  readonly bindGroupLayouts: readonly unknown[];
}

const deviceLayouts = new WeakMap<
  object,
  Map<string, StandardExplicitPipelineLayout>
>();

/** Materialize on the device that owns the pipeline; cache never crosses devices. */
export function materializeStandardExplicitPipelineLayout(
  device: StandardExplicitPipelineLayoutDeviceLike,
  plan: StandardRenderPlan,
): StandardExplicitPipelineLayout | null {
  if (plan.layoutMode !== "explicit") return null;
  let cache = deviceLayouts.get(device);
  if (cache === undefined) {
    cache = new Map();
    deviceLayouts.set(device, cache);
  }
  const cached = cache.get(plan.structuralKey);
  if (cached !== undefined) return cached;
  // Admission is bounded per device. The caller uses the storage/auto plan
  // when no explicit artifact can be admitted; existing artifacts are retained.
  if (cache.size >= 128) return null;
  const bindGroupLayouts = plan.bindGroupLayouts.map((descriptor) =>
    device.createBindGroupLayout(descriptor),
  );
  const value = {
    bindGroupLayouts,
    layout: device.createPipelineLayout({
      label: "standard/render-plan-v1",
      bindGroupLayouts,
    }),
  };
  cache.set(plan.structuralKey, value);
  return value;
}

// Only CPU structural data is shared. Numeric packets and GPU handles never enter
// this cache; compiled pipelines remain responsible for device-owned resources.
const derivedPlans = new Map<string, StandardRenderPlan>();
const MAX_DERIVED_PLANS = 256;

export function createStandardRenderPlan(
  batchKey: Partial<BatchCompatibilityKey> | null,
  options: {
    readonly features?: StandardTextureShaderFeatures;
    readonly authoredShader?: boolean;
    readonly explicitLayouts?: boolean;
    readonly smallLightUniforms?: boolean;
  } = {},
): StandardRenderPlan {
  // Explicit feature bags can be caller-owned and mutable. Derive those anew,
  // rather than treating their object identity as a revision or freezing them.
  const lookupKey =
    options.features === undefined
      ? JSON.stringify([
          batchKey?.pipelineKey ?? null,
          batchKey?.meshLayoutKey ?? null,
          batchKey?.skinned === true,
          batchKey?.morphed === true,
          options.authoredShader === true,
          options.explicitLayouts !== false,
          options.smallLightUniforms !== false,
        ])
      : null;
  if (lookupKey !== null) {
    const cached = derivedPlans.get(lookupKey);
    if (cached !== undefined) return cached;
  }
  const decoded =
    options.features ?? standardShaderFeaturesFromBatchKey(batchKey);
  const ordinary = isOrdinarySunAmbientPlan(batchKey, decoded);
  // A token is a boundary input, not authority to bypass the narrow ABI contract.
  const selectedFeatures =
    decoded.smallLightUniforms !== undefined &&
    (!ordinary ||
      options.authoredShader === true ||
      options.smallLightUniforms === false)
      ? withoutSmallLightUniforms(decoded)
      : decoded;
  const features: StandardTextureShaderFeatures = {
    ...selectedFeatures,
    ...(selectedFeatures.knownLightKindLayout === undefined
      ? {}
      : {
          knownLightKindLayout: [...selectedFeatures.knownLightKindLayout],
        }),
  };
  const lightTransport = features.smallLightUniforms ?? "storage";
  const usesAreaLightLtc =
    options.authoredShader === true ||
    features.lightKindMask === undefined ||
    (features.lightKindMask & 47) === 0 ||
    (features.lightKindMask & 32) !== 0;
  const lightBindingLayout = createStandardLightBindingLayout(
    features,
    lightTransport,
    usesAreaLightLtc,
  );
  const bindGroupLayouts = [
    {
      label: "standard/render-plan/view",
      entries: [{ binding: 0, visibility: 0x3, buffer: { type: "uniform" } }],
    },
    {
      label: "standard/render-plan/transforms",
      entries: [
        { binding: 0, visibility: 0x1, buffer: { type: "read-only-storage" } },
      ],
    },
    createStandardMaterialBindingLayout(features),
    lightBindingLayout,
  ];
  const layoutMode =
    ordinary &&
    options.authoredShader !== true &&
    options.explicitLayouts !== false
      ? "explicit"
      : "auto";
  const structuralKey = JSON.stringify({
    version: 1,
    layoutMode,
    lightTransport,
    features,
    layouts: bindGroupLayouts.map(createWebGpuBindGroupLayoutCacheKey),
  });
  const plan: StandardRenderPlan = {
    version: 1,
    features,
    lightTransport,
    layoutMode,
    lightBindingLayout,
    bindGroupLayouts,
    structuralKey,
    usesAreaLightLtc,
    transmissionSceneColor:
      features.transmission === true
        ? {
            group: 3,
            textureBinding: 14,
            samplerBinding: 15,
            producer: "scene-color-grab",
            viewDimension: "2d",
            sampleType: "float",
          }
        : null,
  };
  freezeDerivedPlanValue(plan);
  if (lookupKey !== null) {
    if (derivedPlans.size >= MAX_DERIVED_PLANS) {
      // Dropping a pure cache reference does not retire or mutate a plan held
      // by a compiled/in-flight pipeline. Re-derivation remains equivalent.
      const oldest = derivedPlans.keys().next().value;
      if (oldest !== undefined) derivedPlans.delete(oldest);
    }
    derivedPlans.set(lookupKey, plan);
  }
  return plan;
}

function freezeDerivedPlanValue(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return;
  for (const child of Object.values(value)) freezeDerivedPlanValue(child);
  Object.freeze(value);
}

export function standardShaderFeaturesFromBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): StandardTextureShaderFeatures {
  const tokens =
    typeof batchKey?.pipelineKey === "string"
      ? batchKey.pipelineKey.split("|")
      : [];
  const cubeCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  );
  const arrayCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  );
  const shadowCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  );
  return {
    ...readStandardLightingSpecializationFeatures(tokens),
    ...(tokens.filter((token) => token === "standard-small-light-uniforms-v1")
      .length === 1
      ? { smallLightUniforms: "sun-ambient-v1" as const }
      : {}),
    baseColorTexture: tokens.includes("baseColorTexture"),
    metallicRoughnessTexture: tokens.includes("metallicRoughnessTexture"),
    clearcoatTexture: tokens.includes("clearcoatTexture"),
    clearcoatRoughnessTexture: tokens.includes("clearcoatRoughnessTexture"),
    transmissionTexture: tokens.includes("transmissionTexture"),
    sheenColorTexture: tokens.includes("sheenColorTexture"),
    sheenRoughnessTexture: tokens.includes("sheenRoughnessTexture"),
    iridescenceTexture: tokens.includes("iridescenceTexture"),
    iridescenceThicknessTexture: tokens.includes("iridescenceThicknessTexture"),
    normalTexture: tokens.includes("normalTexture"),
    occlusionTexture: tokens.includes("occlusionTexture"),
    emissiveTexture: tokens.includes("emissiveTexture"),
    shadowMap: tokens.includes("shadowMap"),
    cascadedShadowMap: tokens.includes("cascadedShadowMap"),
    pointShadowMap: tokens.includes("pointShadowMap"),
    directionalPointShadowMap: tokens.includes("directionalPointShadowMap"),
    spotShadowMap: tokens.includes("spotShadowMap"),
    iblDiffuse: tokens.includes("iblDiffuse"),
    iblSpecularProof: tokens.includes("iblSpecularProof"),
    iblSpecularBrdf: tokens.includes("iblSpecularBrdf"),
    texCoord1: tokens.includes("uv1"),
    instanceTint: tokens.includes("instance-tint"),
    clearcoat: tokens.includes("clearcoat"),
    transmission: tokens.includes("transmission"),
    sheen: tokens.includes("sheen"),
    iridescence: tokens.includes("iridescence"),
    fogLinear: tokens.includes("fogLinear"),
    fogExp: tokens.includes("fogExp"),
    fogExp2: tokens.includes("fogExp2"),
    clusteredLocalLights: tokens.includes(
      CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
    ),
    clusteredLocalLightCookies:
      tokens.includes(CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE) ||
      shadowCookies ||
      cubeCookies ||
      arrayCookies,
    clusteredLocalLightShadowCookies: shadowCookies,
    clusteredLocalLightArrayCookies: arrayCookies,
    clusteredLocalLightCubeCookies: cubeCookies,
    clusteredLocalLightArrayShadows: tokens.includes(
      CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
    ),
    clusteredLocalLightPointArrayShadows: tokens.includes(
      CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
    ),
    skinned: standardSkinningEnabledFromBatchKey(batchKey),
    morphed: standardMorphTargetsEnabledFromBatchKey(batchKey),
    vertexColor:
      typeof batchKey?.meshLayoutKey === "string" &&
      batchKey.meshLayoutKey.split(/[|,]/).some(isColor0LayoutToken),
  };
}

function withoutSmallLightUniforms(
  features: StandardTextureShaderFeatures,
): StandardTextureShaderFeatures {
  const { smallLightUniforms: _ignored, ...rest } = features;
  return rest;
}

function isOrdinarySunAmbientPlan(
  batchKey: Partial<BatchCompatibilityKey> | null,
  features: StandardTextureShaderFeatures,
): boolean {
  const states = batchKey?.pipelineKey?.split("|") ?? [];
  return (
    supportsStandardSmallLightUniforms(features) && states.at(-4) === "opaque"
  );
}

function createStandardMaterialBindingLayout(
  features: StandardTextureShaderFeatures,
): WebGpuBindGroupLayoutDescriptor {
  return {
    label: "standard/render-plan/material",
    entries: [
      { binding: 0, visibility: 0x2, buffer: { type: "uniform" } },
      ...standardTextureVariantBindings(features)
        .filter((binding) => binding.group === 2)
        .map((binding) => ({
          binding: binding.binding,
          visibility: 0x2,
          ...(binding.resource === "sampler"
            ? { sampler: { type: "filtering" } }
            : {
                texture: {
                  sampleType: "float",
                  viewDimension: "2d",
                  multisampled: false,
                },
              }),
        })),
    ],
  };
}

function createStandardLightBindingLayout(
  features: StandardTextureShaderFeatures,
  transport: StandardLightTransport,
  usesAreaLightLtc: boolean,
): WebGpuBindGroupLayoutDescriptor {
  const common = {
    clusteredLocalLights: features.clusteredLocalLights === true,
    clusteredLocalLightCookies: features.clusteredLocalLightCookies === true,
    clusteredLocalLightShadowCookies:
      features.clusteredLocalLightShadowCookies === true,
    clusteredLocalLightCookieTextureViewDimension:
      features.clusteredLocalLightCubeCookies === true
        ? ("cube" as const)
        : features.clusteredLocalLightArrayCookies === true
          ? ("2d-array" as const)
          : ("2d" as const),
  };
  const cascaded =
    features.cascadedShadowMap === true ||
    features.clusteredLocalLightArrayShadows === true;
  const base =
    features.shadowMap === true && features.pointShadowMap === true
      ? createStandardLightMultiShadowBindGroupLayoutDescriptor({
          ...common,
          iblDiffuse: features.iblDiffuse === true,
          iblSpecular:
            features.iblSpecularProof === true ||
            features.iblSpecularBrdf === true,
          clusteredLocalLightArrayShadows:
            features.clusteredLocalLightArrayShadows === true,
          clusteredLocalLightPointArrayShadows:
            features.clusteredLocalLightPointArrayShadows === true,
        })
      : features.iblDiffuse === true
        ? createStandardLightIblBindGroupLayoutDescriptor({
            ...common,
            shadowMap: features.shadowMap === true,
            cascadedShadowMap: cascaded,
            specularProof:
              features.iblSpecularProof === true ||
              features.iblSpecularBrdf === true,
          })
        : features.pointShadowMap === true
          ? createStandardLightPointShadowBindGroupLayoutDescriptor({
              ...common,
              clusteredLocalLightPointArrayShadows:
                features.clusteredLocalLightPointArrayShadows === true,
            })
          : features.shadowMap === true
            ? cascaded
              ? createStandardLightCascadedShadowBindGroupLayoutDescriptor(
                  common,
                )
              : createStandardLightShadowBindGroupLayoutDescriptor(common)
            : createLightBindGroupLayoutDescriptor(common);
  const entries: WebGpuBindGroupLayoutEntryDescriptor[] = base.entries.map(
    (entry) =>
      transport === "sun-ambient-v1" &&
      (entry.binding === 0 || entry.binding === 1)
        ? {
            ...entry,
            buffer: {
              type: "uniform",
              minBindingSize: entry.binding === 0 ? 240 : 64,
            },
          }
        : entry,
  );
  if (usesAreaLightLtc) {
    entries.push(
      {
        binding: 11,
        visibility: 0x2,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      {
        binding: 12,
        visibility: 0x2,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      { binding: 13, visibility: 0x2, sampler: { type: "filtering" } },
    );
  }
  if (features.transmission === true) {
    entries.push(
      {
        binding: 14,
        visibility: 0x2,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      { binding: 15, visibility: 0x2, sampler: { type: "filtering" } },
    );
  }
  return { ...base, entries: entries.sort((a, b) => a.binding - b.binding) };
}
