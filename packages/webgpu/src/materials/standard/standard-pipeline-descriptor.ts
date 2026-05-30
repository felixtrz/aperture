import type {
  BatchCompatibilityKey,
  MeshTopology,
} from "@aperture-engine/render";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCacheKeyInput,
  type WebGpuRenderPipelineCreateDescriptor,
} from "../../gpu/pipeline-cache.js";
import { isColor0LayoutToken } from "../unlit/unlit-pipeline-descriptor.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuColorTargetStateKey,
  createWebGpuDepthStencilDescriptor,
  createWebGpuDepthStencilStateKey,
  resolveWebGpuPipelineRenderState,
} from "../core/material-render-state.js";
import {
  createStandardTextureShaderVariantKey,
  createStandardTextureVariantShader,
  validateStandardShaderMetadata,
  type StandardTextureShaderFeatures,
} from "./standard-shader.js";
import {
  STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY,
  standardSkinningEnabledFromBatchKey,
} from "./standard-skinning-shader.js";
import {
  STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
  STANDARD_MORPH_TARGET_DELTAS_BINDING,
  STANDARD_MORPH_TARGET_DESCRIPTORS_BINDING,
  STANDARD_SKINNED_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
  standardMorphTargetsEnabledFromBatchKey,
} from "./standard-morph-target-shader.js";
import {
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
} from "./standard-light-shadow-bind-group.js";
import {
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
} from "../../lighting/local-light-clusters.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

export const STANDARD_DEFERRED_PIPELINE_FEATURES = [] as const;

export type StandardDeferredPipelineFeature =
  (typeof STANDARD_DEFERRED_PIPELINE_FEATURES)[number];

export type StandardPipelineDescriptorDiagnosticCode =
  | "standardPipeline.missingShaderMetadata"
  | "standardPipeline.missingColorFormat"
  | "standardPipeline.unsupportedTopology"
  | "standardPipeline.missingBatchKeyField"
  | "standardPipeline.unsupportedShaderFamily"
  | "standardPipeline.deferredFeature";

export interface StandardPipelineDescriptorDiagnostic {
  readonly code: StandardPipelineDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface StandardPipelineDescriptorInput {
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  // Second color target carrying separated indirect lighting (M5-T6); mutually
  // exclusive with motionVectorColorFormat (both occupy @location(1)).
  readonly indirectColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly topology?: MeshTopology;
  readonly batchKey: BatchCompatibilityKey;
}

export interface StandardPipelineDescriptorPlan {
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
  readonly cacheKey: string;
}

export interface StandardPipelineDescriptorResult {
  readonly valid: boolean;
  readonly plan: StandardPipelineDescriptorPlan | null;
  readonly diagnostics: readonly StandardPipelineDescriptorDiagnostic[];
}

interface StandardPipelineTokens {
  readonly family: string | null;
  readonly features: readonly string[];
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly depthCompare: string | null;
  readonly blendPreset: string | null;
}

export interface StandardPipelineShaderFeaturePlan {
  readonly shader: BuiltInShaderSourceModule;
  readonly variantKey: string;
  readonly features: StandardTextureShaderFeatures;
  readonly normalMap: {
    readonly authored: boolean;
    readonly requiresTangents: boolean;
    readonly output: "tangent-space-normal-mapping" | "unchanged";
  };
  readonly skinning: {
    readonly enabled: boolean;
    readonly jointAttributeSemantic: "JOINTS_0" | null;
    readonly weightAttributeSemantic: "WEIGHTS_0" | null;
  };
  readonly morphedEnabled: boolean;
  readonly morphTargets: {
    readonly enabled: boolean;
    /** Storage-buffer render: deltas + per-instance descriptors, no attributes. */
    readonly render: "storage-buffer" | null;
    readonly deltaBufferBinding: number | null;
    readonly descriptorBufferBinding: number | null;
  };
}

export function createStandardPipelineDescriptorPlan(
  input: StandardPipelineDescriptorInput,
): StandardPipelineDescriptorResult {
  const diagnostics: StandardPipelineDescriptorDiagnostic[] = [];
  const batchKey = input.batchKey as Partial<BatchCompatibilityKey> | null;
  const shaderFeaturePlan = createStandardPipelineShaderFeaturePlan(
    batchKey,
    input.shader,
  );
  const shader = shaderFeaturePlan.shader;
  const metadata = validateStandardShaderMetadata(shader);
  const topology = input.topology ?? batchKey?.topology;
  const tokens = parsePipelineTokens(batchKey?.pipelineKey);

  for (const diagnostic of metadata.diagnostics) {
    diagnostics.push({
      code: "standardPipeline.missingShaderMetadata",
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    });
  }

  if (input.colorFormat.trim().length === 0) {
    diagnostics.push({
      code: "standardPipeline.missingColorFormat",
      field: "colorFormat",
      message: "Standard pipeline descriptor planning requires a color format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "standardPipeline.unsupportedTopology",
      field: "topology",
      message: `StandardMaterial MVP pipeline supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  validateBatchKey(batchKey, diagnostics);
  validateStandardPipelineTokens(tokens, diagnostics);

  if (diagnostics.length > 0 || !isCompleteBatchKey(batchKey)) {
    return { valid: false, plan: null, diagnostics };
  }

  const resolvedTopology = topology ?? batchKey.topology;
  const sampleCount = input.sampleCount ?? 1;
  const renderState = resolveWebGpuPipelineRenderState(
    batchKey.pipelineKey,
    input.depthFormat,
  );
  const depthStencil = createWebGpuDepthStencilStateKey(
    input.depthFormat,
    renderState,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  // Motion vectors and the M5-T6 indirect channel are mutually exclusive
  // second color targets (both @location(1)); the shader-variant label (set by
  // the respective wrapper) keeps their cache keys distinct.
  const secondColorFormat =
    input.motionVectorColorFormat ?? input.indirectColorFormat ?? null;
  const colorFormats =
    secondColorFormat === null
      ? [input.colorFormat]
      : [input.colorFormat, secondColorFormat];
  const colorTargets =
    secondColorFormat === null
      ? [colorTarget]
      : [colorTarget, { format: secondColorFormat }];
  const keyInput: WebGpuRenderPipelineCacheKeyInput = {
    shaderLabel: shader.label,
    shaderFamily: "standard",
    shaderVariantKey: shaderFeaturePlan.variantKey,
    colorFormats,
    depthFormat: input.depthFormat ?? null,
    stencilFormat: null,
    topology: resolvedTopology,
    vertexLayoutKey: batchKey.meshLayoutKey,
    bindGroupLayoutKeys: standardBindGroupLayoutKeys(batchKey),
    primitive: {
      topology: resolvedTopology,
      cullMode: renderState.cullMode,
      frontFace: "ccw",
      stripIndexFormat: null,
    },
    depthStencil,
    blend: {
      alphaToCoverageEnabled: false,
      colorTargets: [
        createWebGpuColorTargetStateKey(input.colorFormat, renderState),
        ...(secondColorFormat === null
          ? []
          : [
              {
                format: secondColorFormat,
                blend: null,
                writeMask: "all" as const,
              },
            ]),
      ],
    },
    sampleCount,
    materialPipelineKey: batchKey.pipelineKey,
    materialVariantKey: batchKey.materialKey,
    batchKey,
  };
  const cacheKey = createWebGpuRenderPipelineCacheKey(keyInput);
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:${resolvedTopology}`,
    layout: "auto",
    vertex: {
      moduleLabel: shader.label,
      entryPoint: shader.entryPoints.vertex,
      buffers: standardVertexBufferSemantics(shaderFeaturePlan.features),
    },
    fragment: {
      moduleLabel: shader.label,
      entryPoint: shader.entryPoints.fragment,
      targets: colorTargets,
    },
    primitive: {
      topology: resolvedTopology,
      cullMode: renderState.cullMode,
      frontFace: "ccw",
    },
    multisample: {
      count: sampleCount,
    },
  };
  const depthStencilDescriptor = createWebGpuDepthStencilDescriptor(
    input.depthFormat,
    renderState,
  );

  if (depthStencilDescriptor !== null) {
    return {
      valid: true,
      plan: {
        cacheKey,
        keyInput,
        descriptor: {
          ...descriptor,
          depthStencil: depthStencilDescriptor,
        },
      },
      diagnostics,
    };
  }

  return { valid: true, plan: { descriptor, keyInput, cacheKey }, diagnostics };
}

export function createStandardPipelineShaderFeaturePlan(
  batchKey: Partial<BatchCompatibilityKey> | null,
  shader?: BuiltInShaderSourceModule,
): StandardPipelineShaderFeaturePlan {
  const features = standardTextureFeatures(batchKey);

  return {
    shader: resolveStandardShaderForBatchKey(batchKey, shader),
    variantKey: standardShaderVariantKey(batchKey),
    features,
    normalMap: {
      authored: features.normalTexture,
      requiresTangents: features.normalTexture,
      output: features.normalTexture
        ? "tangent-space-normal-mapping"
        : "unchanged",
    },
    skinning: {
      enabled: features.skinned === true,
      jointAttributeSemantic: features.skinned === true ? "JOINTS_0" : null,
      weightAttributeSemantic: features.skinned === true ? "WEIGHTS_0" : null,
    },
    morphedEnabled: features.morphed === true,
    morphTargets: {
      enabled: features.morphed === true,
      render: features.morphed === true ? "storage-buffer" : null,
      deltaBufferBinding:
        features.morphed === true ? STANDARD_MORPH_TARGET_DELTAS_BINDING : null,
      descriptorBufferBinding:
        features.morphed === true
          ? STANDARD_MORPH_TARGET_DESCRIPTORS_BINDING
          : null,
    },
  };
}

function standardBindGroupLayoutKeys(
  batchKey: BatchCompatibilityKey,
): readonly string[] {
  const features = standardTextureFeatures(batchKey);
  const lightGroupKey =
    features.shadowMap === true && features.pointShadowMap === true
      ? standardMultiShadowLightGroupLayoutKey(features)
      : features.pointShadowMap === true
        ? `standard/lights-point-shadow/group-3:light-floats@0,light-metadata@1,matrix@2,${
            features.clusteredLocalLightPointArrayShadows === true
              ? "depth-array@3"
              : "depth-cube@3"
          },sampler@4`
        : features.shadowMap === true
          ? features.iblDiffuse === true
            ? features.iblSpecularProof === true ||
              features.iblSpecularBrdf === true
              ? features.cascadedShadowMap === true ||
                features.clusteredLocalLightArrayShadows === true
                ? `${STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY}:light-floats@0,light-metadata@1,matrix@2,depth-array@3,sampler@4,diffuse-ibl@5,ibl-sampler@6,specular-ibl-proof@7`
                : "standard/lights-shadow-ibl/group-3:light-floats@0,light-metadata@1,matrix@2,depth@3,sampler@4,diffuse-ibl@5,ibl-sampler@6,specular-ibl-proof@7"
              : features.cascadedShadowMap === true ||
                  features.clusteredLocalLightArrayShadows === true
                ? `${STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY}:light-floats@0,light-metadata@1,matrix@2,depth-array@3,sampler@4,diffuse-ibl@5,ibl-sampler@6`
                : "standard/lights-shadow-ibl/group-3:light-floats@0,light-metadata@1,matrix@2,depth@3,sampler@4,diffuse-ibl@5,ibl-sampler@6"
            : features.cascadedShadowMap === true ||
                features.clusteredLocalLightArrayShadows === true
              ? `${STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY}:light-floats@0,light-metadata@1,matrix@2,depth-array@3,sampler@4`
              : "standard/lights-shadow/group-3:light-floats@0,light-metadata@1,matrix@2,depth@3,sampler@4"
          : features.iblDiffuse === true
            ? features.iblSpecularProof === true ||
              features.iblSpecularBrdf === true
              ? "standard/lights-ibl/group-3:light-floats@0,light-metadata@1,diffuse-ibl@5,ibl-sampler@6,specular-ibl-proof@7"
              : "standard/lights-ibl/group-3:light-floats@0,light-metadata@1,diffuse-ibl@5,ibl-sampler@6"
            : "lights/group-3:light-floats@0,light-metadata@1";

  return [
    "standard/group-0:view-uniform@0",
    standardTransformBindGroupLayoutKey(features),
    standardMaterialLayoutKey(features),
    standardClusteredLocalLightGroupLayoutKey(
      standardTransmissionLightGroupLayoutKey(lightGroupKey, features),
      features,
    ),
  ];
}

function standardMultiShadowLightGroupLayoutKey(
  features: StandardTextureShaderFeatures,
): string {
  const directionalDepthKey =
    features.clusteredLocalLightArrayShadows === true
      ? "directional-depth-array@3"
      : "directional-depth@3";
  const spotBindings =
    features.clusteredLocalLights === true
      ? ""
      : ",spot-matrix@5,spot-depth@6,spot-sampler@7";
  const pointDepthKey =
    features.clusteredLocalLightPointArrayShadows === true
      ? "point-depth-array@9"
      : "point-depth-cube@9";

  return `standard/lights-multi-shadow/group-3:light-floats@0,light-metadata@1,directional-matrix@2,${directionalDepthKey},directional-sampler@4${spotBindings},point-matrix@8,${pointDepthKey},point-sampler@10`;
}

function standardTransmissionLightGroupLayoutKey(
  lightGroupKey: string,
  features: StandardTextureShaderFeatures,
): string {
  return features.transmission === true
    ? `${lightGroupKey},transmission-scene-color@14,transmission-scene-sampler@15`
    : lightGroupKey;
}

function standardClusteredLocalLightGroupLayoutKey(
  lightGroupKey: string,
  features: StandardTextureShaderFeatures,
): string {
  if (features.clusteredLocalLights !== true) {
    return lightGroupKey;
  }

  const clusterKey = `${lightGroupKey},cluster-params@16,cluster-cells@17,cluster-indices@18,cluster-metadata@19`;

  if (features.clusteredLocalLightCookies !== true) {
    return clusterKey;
  }

  const cookieTextureKey =
    features.clusteredLocalLightCubeCookies === true
      ? "cluster-cookie-cube-texture@20"
      : features.clusteredLocalLightArrayCookies === true
        ? "cluster-cookie-array-texture@20"
        : "cluster-cookie-texture@20";
  const cookieMatrixKey =
    features.clusteredLocalLightShadowCookies === true
      ? "cluster-cookie-shadow-matrix@2"
      : "cluster-cookie-matrix@22";

  return `${clusterKey},${cookieTextureKey},cluster-cookie-sampler@21,${cookieMatrixKey}`;
}

export function resolveStandardShaderForBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  shader?: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  if (shader !== undefined) {
    return shader;
  }

  const features = standardTextureFeatures(batchKey);

  return createStandardTextureVariantShader(features);
}

function standardTextureFeatures(
  batchKey: Partial<BatchCompatibilityKey> | null,
): StandardTextureShaderFeatures {
  const tokens =
    typeof batchKey?.pipelineKey === "string" &&
    batchKey.pipelineKey.trim().length > 0
      ? batchKey.pipelineKey.split("|")
      : [];

  const clusteredLocalLightCubeCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  );
  const clusteredLocalLightArrayCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  );
  const clusteredLocalLightArrayShadows = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  );
  const clusteredLocalLightPointArrayShadows = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
  );
  const clusteredLocalLightShadowCookies = tokens.includes(
    CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  );

  return {
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
      clusteredLocalLightShadowCookies ||
      clusteredLocalLightCubeCookies ||
      clusteredLocalLightArrayCookies,
    clusteredLocalLightShadowCookies,
    clusteredLocalLightArrayCookies,
    clusteredLocalLightCubeCookies,
    clusteredLocalLightArrayShadows,
    clusteredLocalLightPointArrayShadows,
    skinned: standardSkinningEnabledFromBatchKey(batchKey),
    morphed: standardMorphTargetsEnabledFromBatchKey(batchKey),
    vertexColor:
      typeof batchKey?.meshLayoutKey === "string" &&
      batchKey.meshLayoutKey.split(/[|,]/).some(isColor0LayoutToken),
  };
}

function standardTransformBindGroupLayoutKey(
  features: Pick<StandardTextureShaderFeatures, "skinned" | "morphed">,
): string {
  if (features.skinned === true && features.morphed === true) {
    return STANDARD_SKINNED_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY;
  }

  if (features.skinned === true) {
    return STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY;
  }

  if (features.morphed === true) {
    return STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY;
  }

  return "standard/group-1:world-transforms@0";
}

function standardVertexBufferSemantics(
  features: StandardTextureShaderFeatures,
): readonly string[] {
  const semantics = ["POSITION", "NORMAL", "TEXCOORD_0"];

  if (features.normalTexture) {
    semantics.push("TANGENT");
  }

  if (features.texCoord1 === true) {
    semantics.push("TEXCOORD_1");
  }

  if (features.vertexColor === true) {
    semantics.push("COLOR_0");
  }

  if (features.instanceTint === true) {
    semantics.push("INSTANCE_TINT");
  }

  if (features.skinned === true) {
    semantics.push("JOINTS_0", "WEIGHTS_0");
  }

  // Morph deltas are not vertex attributes: they render from the group(1)
  // storage buffer (binding 4) indexed by target+vertex, so morphed meshes use
  // the base vertex layout.

  return semantics;
}

function standardShaderVariantKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): string {
  const features = standardTextureFeatures(batchKey);

  return createStandardTextureShaderVariantKey(features);
}

function standardMaterialLayoutKey(features: {
  readonly baseColorTexture: boolean;
  readonly metallicRoughnessTexture: boolean;
  readonly clearcoatTexture?: boolean;
  readonly clearcoatRoughnessTexture?: boolean;
  readonly transmissionTexture?: boolean;
  readonly sheenColorTexture?: boolean;
  readonly sheenRoughnessTexture?: boolean;
  readonly iridescenceTexture?: boolean;
  readonly iridescenceThicknessTexture?: boolean;
  readonly normalTexture: boolean;
  readonly occlusionTexture: boolean;
  readonly emissiveTexture: boolean;
}): string {
  if (
    features.baseColorTexture &&
    features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture
  ) {
    return "standard/group-2:material-base-color-metallic-roughness-texture@0,1,2,3,4";
  }

  if (
    features.baseColorTexture &&
    !features.metallicRoughnessTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture
  ) {
    return "standard/group-2:material-base-color-texture@0,1,2";
  }

  if (
    features.metallicRoughnessTexture &&
    !features.baseColorTexture &&
    features.clearcoatTexture !== true &&
    features.clearcoatRoughnessTexture !== true &&
    features.transmissionTexture !== true &&
    features.sheenColorTexture !== true &&
    features.sheenRoughnessTexture !== true &&
    features.iridescenceTexture !== true &&
    features.iridescenceThicknessTexture !== true &&
    !features.normalTexture &&
    !features.occlusionTexture &&
    !features.emissiveTexture
  ) {
    return "standard/group-2:material-metallic-roughness-texture@0,3,4";
  }

  if (
    features.baseColorTexture ||
    features.metallicRoughnessTexture ||
    features.clearcoatTexture === true ||
    features.clearcoatRoughnessTexture === true ||
    features.transmissionTexture === true ||
    features.sheenColorTexture === true ||
    features.sheenRoughnessTexture === true ||
    features.iridescenceTexture === true ||
    features.iridescenceThicknessTexture === true ||
    features.normalTexture ||
    features.occlusionTexture ||
    features.emissiveTexture
  ) {
    const names: string[] = [];
    const bindings = [0];

    if (features.baseColorTexture) {
      names.push("base-color");
      bindings.push(1, 2);
    }

    if (features.metallicRoughnessTexture) {
      names.push("metallic-roughness");
      bindings.push(3, 4);
    }

    if (features.clearcoatTexture === true) {
      names.push("clearcoat");
      bindings.push(11, 12);
    }

    if (features.clearcoatRoughnessTexture === true) {
      names.push("clearcoat-roughness");
      bindings.push(23, 24);
    }

    if (features.transmissionTexture === true) {
      names.push("transmission");
      bindings.push(13, 14);
    }

    if (features.sheenColorTexture === true) {
      names.push("sheen-color");
      bindings.push(15, 16);
    }

    if (features.sheenRoughnessTexture === true) {
      names.push("sheen-roughness");
      bindings.push(19, 20);
    }

    if (features.iridescenceTexture === true) {
      names.push("iridescence");
      bindings.push(17, 18);
    }

    if (features.iridescenceThicknessTexture === true) {
      names.push("iridescence-thickness");
      bindings.push(21, 22);
    }

    if (features.normalTexture) {
      names.push("normal-map");
      bindings.push(5, 6);
    }

    if (features.occlusionTexture) {
      names.push("occlusion");
      bindings.push(7, 8);
    }

    if (features.emissiveTexture) {
      names.push("emissive");
      bindings.push(9, 10);
    }

    return `standard/group-2:material-${names.join("-")}-texture@${bindings.join(
      ",",
    )}`;
  }

  return "standard/group-2:material@0";
}

function validateStandardPipelineTokens(
  tokens: StandardPipelineTokens,
  diagnostics: StandardPipelineDescriptorDiagnostic[],
): void {
  if (tokens.family !== null && tokens.family !== "standard") {
    diagnostics.push({
      code: "standardPipeline.unsupportedShaderFamily",
      field: "batchKey.pipelineKey",
      message: `Standard pipeline descriptor planning requires a 'standard' material pipeline key, not '${tokens.family}'.`,
    });
  }

  for (const feature of tokens.features) {
    if (isDeferredPipelineFeature(feature)) {
      diagnostics.push({
        code: "standardPipeline.deferredFeature",
        field: `batchKey.pipelineKey.${feature}`,
        message: `${feature} is deferred for the direct-lit StandardMaterial MVP pipeline.`,
      });
    }
  }
}

function parsePipelineTokens(
  pipelineKey: string | undefined,
): StandardPipelineTokens {
  if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
    return {
      family: null,
      features: [],
      alphaMode: null,
      cullMode: null,
      depthCompare: null,
      blendPreset: null,
    };
  }

  const parts = pipelineKey.split("|");
  const renderStateStart = Math.max(1, parts.length - 4);

  return {
    family: parts[0] ?? null,
    features: parts.slice(1, renderStateStart),
    alphaMode: parts[renderStateStart] ?? null,
    cullMode: parts[renderStateStart + 1] ?? null,
    depthCompare: parts[renderStateStart + 2] ?? null,
    blendPreset: parts[renderStateStart + 3] ?? null,
  };
}

function isDeferredPipelineFeature(
  feature: string,
): feature is StandardDeferredPipelineFeature {
  return STANDARD_DEFERRED_PIPELINE_FEATURES.includes(
    feature as StandardDeferredPipelineFeature,
  );
}

function validateBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  diagnostics: StandardPipelineDescriptorDiagnostic[],
): void {
  if (batchKey === null) {
    diagnostics.push({
      code: "standardPipeline.missingBatchKeyField",
      field: "batchKey",
      message: "Standard pipeline descriptor planning requires a batch key.",
    });
    return;
  }

  for (const field of [
    "pipelineKey",
    "materialKey",
    "meshLayoutKey",
  ] satisfies readonly (keyof BatchCompatibilityKey)[]) {
    const value = batchKey[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      diagnostics.push({
        code: "standardPipeline.missingBatchKeyField",
        field: `batchKey.${field}`,
        message: `Standard pipeline descriptor planning requires batchKey.${field}.`,
      });
    }
  }

  if (batchKey.topology === undefined) {
    diagnostics.push({
      code: "standardPipeline.missingBatchKeyField",
      field: "batchKey.topology",
      message:
        "Standard pipeline descriptor planning requires batchKey.topology.",
    });
  }
}

function isCompleteBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): batchKey is BatchCompatibilityKey {
  return (
    batchKey !== null &&
    typeof batchKey.pipelineKey === "string" &&
    batchKey.pipelineKey.trim().length > 0 &&
    typeof batchKey.materialKey === "string" &&
    batchKey.materialKey.trim().length > 0 &&
    typeof batchKey.meshLayoutKey === "string" &&
    batchKey.meshLayoutKey.trim().length > 0 &&
    batchKey.topology !== undefined &&
    typeof batchKey.instanced === "boolean" &&
    typeof batchKey.skinned === "boolean" &&
    typeof batchKey.morphed === "boolean"
  );
}
