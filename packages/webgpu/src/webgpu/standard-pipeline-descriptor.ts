import type {
  BatchCompatibilityKey,
  MeshTopology,
} from "@aperture-engine/render";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCacheKeyInput,
  type WebGpuRenderPipelineCreateDescriptor,
} from "./pipeline-cache.js";
import { isColor0LayoutToken } from "./unlit-pipeline-descriptor.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuColorTargetStateKey,
  createWebGpuDepthStencilDescriptor,
  createWebGpuDepthStencilStateKey,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";
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
} from "./local-light-clusters.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

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
    readonly positionAttributeSemantics:
      | readonly ["MORPH_POSITION_0", "MORPH_POSITION_1"]
      | null;
    readonly normalAttributeSemantics:
      | readonly ["MORPH_NORMAL_0", "MORPH_NORMAL_1"]
      | null;
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
  const colorFormats =
    input.motionVectorColorFormat === undefined ||
    input.motionVectorColorFormat === null
      ? [input.colorFormat]
      : [input.colorFormat, input.motionVectorColorFormat];
  const colorTargets =
    input.motionVectorColorFormat === undefined ||
    input.motionVectorColorFormat === null
      ? [colorTarget]
      : [colorTarget, { format: input.motionVectorColorFormat }];
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
        ...(input.motionVectorColorFormat === undefined ||
        input.motionVectorColorFormat === null
          ? []
          : [
              {
                format: input.motionVectorColorFormat,
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
      positionAttributeSemantics:
        features.morphed === true
          ? ["MORPH_POSITION_0", "MORPH_POSITION_1"]
          : null,
      normalAttributeSemantics:
        features.morphed === true ? ["MORPH_NORMAL_0", "MORPH_NORMAL_1"] : null,
    },
  };
}

function standardBindGroupLayoutKeys(
  batchKey: BatchCompatibilityKey,
): readonly string[] {
  const features = standardTextureFeatures(batchKey);
  const lightGroupKey =
    features.shadowMap === true && features.pointShadowMap === true
      ? "standard/lights-multi-shadow/group-3:light-floats@0,light-metadata@1,directional-matrix@2,directional-depth@3,directional-sampler@4,spot-matrix@5,spot-depth@6,spot-sampler@7,point-matrix@8,point-depth-cube@9,point-sampler@10"
      : features.pointShadowMap === true
        ? "standard/lights-point-shadow/group-3:light-floats@0,light-metadata@1,matrix@2,depth-cube@3,sampler@4"
        : features.shadowMap === true
          ? features.iblDiffuse === true
            ? features.iblSpecularProof === true
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
            ? features.iblSpecularProof === true
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

  return `${clusterKey},${cookieTextureKey},cluster-cookie-sampler@21,cluster-cookie-matrix@22`;
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
      clusteredLocalLightCubeCookies ||
      clusteredLocalLightArrayCookies,
    clusteredLocalLightArrayCookies,
    clusteredLocalLightCubeCookies,
    clusteredLocalLightArrayShadows,
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

  if (features.morphed === true) {
    semantics.push(
      "MORPH_POSITION_0",
      "MORPH_NORMAL_0",
      "MORPH_POSITION_1",
      "MORPH_NORMAL_1",
    );
  }

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
