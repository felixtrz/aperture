import { describe, expect, it } from "vitest";

import {
  createMaterialPipelineKeyInput,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureHandle,
  materialPipelineKeyInputToKey,
} from "@aperture-engine/core";
import {
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL,
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER,
  STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL,
  STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
  STANDARD_DIFFUSE_IBL_SHADER_VARIANT,
  STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
  STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL,
  STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT,
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedAreaLightShapeId,
  PackedLightKindId,
  STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_CLEARCOAT_SHADER_VARIANT,
  STANDARD_TRANSMISSION_SHADER_VARIANT,
  STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY,
  STANDARD_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_SHADOW_RECEIVER_MESH_SHADER,
  STANDARD_SHADOW_RECEIVER_MESH_WGSL,
  STANDARD_MATERIAL_MVP_LIGHTING_MODEL,
  STANDARD_MESH_SHADER,
  STANDARD_MESH_WGSL,
  STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
  STANDARD_SHEEN_SHADER_VARIANT,
  STANDARD_IRIDESCENCE_SHADER_VARIANT,
  LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
  LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
  LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
  LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
  LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
  createStandardMeshShaderModuleDescriptor,
  createStandardTextureShaderVariantKey,
  createStandardTextureVariantShader,
  createWebGpuShaderModule,
  evaluateStandardMorphTargetBlend,
  validateStandardShaderMetadata,
  type BuiltInShaderSourceModule,
  type WebGpuShaderDeviceLike,
} from "@aperture-engine/webgpu";

describe("built-in standard material WGSL shader metadata", () => {
  it("exports expected entry points and validates through the shader helper", async () => {
    const created: unknown[] = [];
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return {};
      },
    };
    const descriptor = createStandardMeshShaderModuleDescriptor();

    expect(descriptor).toMatchObject({
      label: "aperture/standard-mesh",
      entryPoints: ["vs_main", "fs_main"],
    });
    await expect(
      createWebGpuShaderModule({ device, descriptor }),
    ).resolves.toMatchObject({ ok: true });
    expect(created).toEqual([
      { label: descriptor.label, code: descriptor.code },
    ]);
  });

  it("applies occlusion texture transforms before sampling", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: true,
      emissiveTexture: false,
    });

    expect(shader.code).toContain("fn standardTextureTransformUv");
    expect(shader.code).toContain("material.occlusionTextureOffset");
    expect(shader.code).toContain("material.occlusionTextureScale");
    expect(shader.code).toContain("material.occlusionTextureRotation");
    expect(shader.code).toContain(
      "textureSample(occlusionTexture, occlusionSampler, occlusionTextureUv)",
    );
  });

  it("applies emissive texture transforms before sampling", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
    });

    expect(shader.code).toContain("fn standardTextureTransformUv");
    expect(shader.code).toContain("material.emissiveTextureOffset");
    expect(shader.code).toContain("material.emissiveTextureScale");
    expect(shader.code).toContain("material.emissiveTextureRotation");
    expect(shader.code).toContain(
      "textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv)",
    );
  });

  it("declares transform, standard material, and light buffer bindings", () => {
    expect(validateStandardShaderMetadata(STANDARD_MESH_SHADER)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      STANDARD_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
    ]);
  });

  it("documents the MVP lighting scope in WGSL and metadata", () => {
    expect(STANDARD_MATERIAL_MVP_LIGHTING_MODEL).toMatchObject({
      variant: "direct-lit-metallic-roughness",
      supported: expect.arrayContaining(["ambientLight", "directionalLight"]),
      deferred: expect.arrayContaining(["imageBasedLighting", "shadows"]),
    });
    expect(STANDARD_MATERIAL_MVP_LIGHTING_MODEL.supported).toContain(
      "metallicRoughnessTexture",
    );
    expect(STANDARD_MATERIAL_MVP_LIGHTING_MODEL.supported).toContain(
      "normalTexture",
    );
    expect(STANDARD_MATERIAL_MVP_LIGHTING_MODEL.supported).toContain(
      "emissiveTexture",
    );
    expect(STANDARD_MATERIAL_MVP_LIGHTING_MODEL.supported).toContain(
      "occlusionTexture",
    );
    expect(STANDARD_MESH_WGSL).toContain("distributionGGX");
    expect(STANDARD_MESH_WGSL).toContain("fresnelSchlick");
    expect(STANDARD_MESH_WGSL).toContain("cameraPosition: vec4f");
    expect(STANDARD_MESH_WGSL).toContain(
      "normalize(view.cameraPosition.xyz - input.worldPosition)",
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const PACKED_LIGHT_FLOAT_STRIDE: u32 = ${PACKED_LIGHT_FLOAT_STRIDE}u;`,
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const PACKED_LIGHT_METADATA_STRIDE: u32 = ${PACKED_LIGHT_METADATA_STRIDE}u;`,
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const LIGHT_KIND_DIRECTIONAL: i32 = ${PackedLightKindId.Directional};`,
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const LIGHT_KIND_RECT_AREA: i32 = ${PackedLightKindId.RectArea};`,
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const AREA_LIGHT_SHAPE_DISK: i32 = ${PackedAreaLightShapeId.Disk};`,
    );
    expect(STANDARD_MESH_WGSL).toContain(
      `const AREA_LIGHT_SHAPE_SPHERE: i32 = ${PackedAreaLightShapeId.Sphere};`,
    );
    expect(STANDARD_MESH_WGSL).toContain("LIGHT_KIND_AMBIENT");
    expect(STANDARD_MESH_WGSL).toContain("standardAreaLightLtcMatrixTexture");
  });

  it("samples production LTC area-light tables with reference UV scale and matrix/fresnel terms", () => {
    expect(STANDARD_MESH_WGSL).toContain(
      "let lutScale = (lutSize - 1.0) / lutSize;",
    );
    expect(STANDARD_MESH_WGSL).toContain("let lutBias = 0.5 / lutSize;");
    expect(STANDARD_MESH_WGSL).toContain(
      "return uv * lutScale + vec2f(lutBias);",
    );
    expect(STANDARD_MESH_WGSL).toContain("fn areaLightLtcMatrix");
    expect(STANDARD_MESH_WGSL).toContain("fn areaLightLtcFresnel");
    expect(STANDARD_MESH_WGSL).toContain("fn ltcEvaluateRect");
    expect(STANDARD_MESH_WGSL).toContain("fn areaLightFiniteNonNegative");
    expect(STANDARD_MESH_WGSL).toContain(
      "specularColor * texel.x + (vec3f(1.0) - specularColor) * texel.y",
    );
    expect(STANDARD_MESH_WGSL).toContain("areaLightLtcMatrix(ltcMatrixTexel)");
  });

  it("routes StandardMaterial point and spot lights through clustered local-light storage", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clusteredLocalLights: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clusteredLocalLights: true,
      }),
    ).toBe("direct-lit-metallic-roughness-clustered-local-lights-texture");
    expect(shader.bindings).toEqual(
      expect.arrayContaining([
        {
          id: "localLightClusterParams",
          label: "Standard material local-light cluster params",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
          resource: "read-only-storage-buffer",
        },
        {
          id: "localLightClusterCells",
          label: "Standard material local-light cluster cells",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
          resource: "read-only-storage-buffer",
        },
        {
          id: "localLightClusterIndices",
          label: "Standard material local-light cluster indices",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
          resource: "read-only-storage-buffer",
        },
        {
          id: "localLightClusterMetadata",
          label: "Standard material local-light cluster metadata",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
          resource: "read-only-storage-buffer",
        },
      ]),
    );
    expect(shader.code).toContain("fn localLightClusterCellIndex");
    expect(shader.code).toContain("fn localLightClusterSamplePosition");
    expect(shader.code).toContain("fn localLightClusterMetadataFlags");
    expect(shader.code).toContain(
      "fn localLightClusterShadowFilterRadiusTexels",
    );
    expect(shader.code).toContain(
      "fn localLightClusterUnsupportedShadowFactor",
    );
    expect(shader.code).toContain("return 0.99999994;");
    expect(shader.code).toContain(
      "lightRadiance(lightIndex) * attenuation * shadowFactor",
    );
    expect(shader.code).toContain("localLightClusterViewMatrix()");
    expect(shader.code).toContain("fn evaluateClusteredLocalLights");
    expect(shader.code).toContain(
      "direct = direct + evaluateClusteredLocalLights",
    );
    expect(shader.code.match(/if \(kind == LIGHT_KIND_POINT\)/g)).toHaveLength(
      1,
    );
    expect(shader.code.match(/if \(kind == LIGHT_KIND_SPOT\)/g)).toHaveLength(
      1,
    );
  });

  it("declares base-color texture bindings for the textured StandardMaterial variant", () => {
    expect(
      validateStandardShaderMetadata(STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER),
    ).toEqual({ valid: true, diagnostics: [] });
    expect(STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-base-color-texture",
    );
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain("textureSample");
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "fn standardTextureTransformUv",
    );
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "material.baseColorTextureOffset",
    );
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "material.baseColorTextureScale",
    );
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "material.baseColorTextureRotation",
    );
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain("cos(rotation)");
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain("sin(rotation)");
    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "baseColorSample.rgb * material.baseColorFactor.rgb",
    );
    expect(
      STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
    ]);
  });

  it("multiplies StandardMaterial base-color textures with COLOR_0 vertex colors", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      vertexColor: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        vertexColor: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-vertex-color-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-vertex-color-textured",
    );
    expect(shader.code).toContain("@location(5) color: vec4f");
    expect(shader.code).toContain("@location(6) vertexColor: vec4f");
    expect(shader.code).toContain(
      "baseColorSample.rgb * material.baseColorFactor.rgb * input.vertexColor.rgb",
    );
    expect(shader.code).toContain(
      "baseColorSample.a * material.baseColorFactor.a * input.vertexColor.a",
    );
  });

  it("generates fog-specialized StandardMaterial shader variants", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      fogExp2: true,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        fogExp2: true,
      }),
    ).toBe("direct-lit-metallic-roughness-fog-exp2-texture");
    expect(shader.label).toBe("aperture/standard-mesh-fog-exp2-textured");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain("fogColor: vec4f");
    expect(shader.code).toContain("fogParams: vec4f");
    expect(shader.code).toContain("fn applyDistanceFog");
    expect(shader.code).toContain(
      "exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y)",
    );
    expect(shader.code).toContain(
      "var color = ambientDiffuse + direct + material.emissiveFactor;",
    );
    expect(shader.code).not.toContain(
      "let color = ambientDiffuse + direct + material.emissiveFactor;",
    );
    expect(shader.code).toContain("color = applyDistanceFog");
    expect(shader.code).toContain("return vec4f(color, alpha);");
  });

  it("generates a scalar clearcoat StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clearcoat: true,
    });
    const material = createStandardMaterialAsset({
      clearcoatFactor: 1,
      clearcoatRoughnessFactor: 0.08,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clearcoat: true,
      }),
    ).toBe(STANDARD_CLEARCOAT_SHADER_VARIANT);
    expect(shader.label).toBe("aperture/standard-mesh-clearcoat");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual(STANDARD_MESH_SHADER.bindings);
    expect(shader.code).toContain("clearcoatFactor: f32");
    expect(shader.code).toContain("clearcoatRoughnessFactor: f32");
    expect(shader.code).toContain(`directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
        clearcoatFactor,`);
    expect(shader.code).toContain("let clearcoatFresnel = fresnelSchlick");
    expect(shader.code).toContain("clearcoatAttenuation");
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|clearcoat|opaque|back|less|none");
  });

  it("generates a texture-backed clearcoat StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      clearcoatTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clearcoat: true,
    });
    const material = createStandardMaterialAsset({
      clearcoatFactor: 1,
      clearcoatTexture: {
        texture: createTextureHandle("clearcoat-factor"),
        sampler: createSamplerHandle("clearcoat-nearest"),
      },
      clearcoatRoughnessFactor: 0.08,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        clearcoatTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clearcoat: true,
      }),
    ).toBe("direct-lit-metallic-roughness-clearcoat-texture-clearcoat-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-clearcoat-texture-clearcoat-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "clearcoatTexture",
        label: "Clearcoat texture",
        group: 2,
        binding: 11,
        resource: "texture",
      },
      {
        id: "clearcoatSampler",
        label: "Clearcoat sampler",
        group: 2,
        binding: 12,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(11) var clearcoatTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "textureSample(clearcoatTexture, clearcoatSampler, input.uv).r",
    );
    expect(shader.code).toContain(`directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
        clearcoatFactor,`);
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|clearcoat|clearcoatTexture|opaque|back|less|none");
  });

  it("generates a texture-backed clearcoat roughness StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      clearcoatRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clearcoat: true,
    });
    const material = createStandardMaterialAsset({
      clearcoatFactor: 1,
      clearcoatRoughnessFactor: 0.86,
      clearcoatRoughnessTexture: {
        texture: createTextureHandle("clearcoat-roughness"),
        sampler: createSamplerHandle("clearcoat-roughness-nearest"),
      },
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        clearcoatRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clearcoat: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-clearcoat-roughness-texture-clearcoat-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-clearcoat-roughness-texture-clearcoat-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "clearcoatRoughnessTexture",
        label: "Clearcoat roughness texture",
        group: 2,
        binding: 23,
        resource: "texture",
      },
      {
        id: "clearcoatRoughnessSampler",
        label: "Clearcoat roughness sampler",
        group: 2,
        binding: 24,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(23) var clearcoatRoughnessTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "textureSample(clearcoatRoughnessTexture, clearcoatRoughnessSampler, input.uv).g",
    );
    expect(shader.code).toContain(
      "let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * textureSample(clearcoatRoughnessTexture, clearcoatRoughnessSampler, input.uv).g, 0.045, 1.0);",
    );
    expect(shader.code).toContain(`directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
        clearcoatFactor,
        clearcoatRoughness,`);
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe(
      "standard|clearcoat|clearcoatRoughnessTexture|opaque|back|less|none",
    );
  });

  it("threads clearcoat factors through shadowed direct-light calls", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      clearcoatTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clearcoat: true,
      shadowMap: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(`roughness,
        clearcoatFactor,
        clearcoatRoughness,
      ) * shadowFactor;`);
    expect(shader.code).toContain(`roughness,
          clearcoatFactor,
          clearcoatRoughness,
        );`);
    expect(shader.code).not.toContain(`roughness,
      ) * shadowFactor;`);
  });

  it("generates a scalar transmission StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      transmission: true,
    });
    const material = createStandardMaterialAsset({
      transmissionFactor: 0.72,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
      },
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        transmission: true,
      }),
    ).toBe(STANDARD_TRANSMISSION_SHADER_VARIANT);
    expect(shader.label).toBe("aperture/standard-mesh-transmission");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "standardTransmissionSceneColorTexture",
        label: "Standard material transmission scene color texture",
        group: 3,
        binding: 14,
        resource: "texture",
      },
      {
        id: "standardTransmissionSceneColorSampler",
        label: "Standard material transmission scene color sampler",
        group: 3,
        binding: 15,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain("transmissionFactor: f32");
    expect(shader.code).toContain(
      "@group(3) @binding(14) var standardTransmissionSceneColorTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let transmission = clamp(material.transmissionFactor",
    );
    expect(shader.code).toContain(
      "textureSampleLevel(\n    standardTransmissionSceneColorTexture",
    );
    expect(shader.code).toContain("transmissionBlurRadiusPixels");
    expect(shader.code).toContain(
      "transmissionRoughness * transmissionRoughness * 42.0",
    );
    expect(shader.code).toContain(
      "smoothstep(0.08, 0.85, transmissionRoughness)",
    );
    expect(shader.code).toContain("var alpha = material.baseColorFactor.a");
    expect(shader.code).toContain(
      "alpha = alpha * max(1.0 - transmission * 0.25, 0.72)",
    );
    expect(shader.code).toContain("return vec4f(color, alpha);");
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|transmission|blend|back|less|alpha");
  });

  it("generates a texture-backed transmission StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      transmissionTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      transmission: true,
    });
    const material = createStandardMaterialAsset({
      transmissionFactor: 0.9,
      transmissionTexture: {
        texture: createTextureHandle("transmission-factor"),
        sampler: createSamplerHandle("transmission-nearest"),
      },
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
      },
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        transmissionTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        transmission: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-transmission-texture-transmission-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-transmission-texture-transmission-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "transmissionTexture",
        label: "Transmission texture",
        group: 2,
        binding: 13,
        resource: "texture",
      },
      {
        id: "transmissionSampler",
        label: "Transmission sampler",
        group: 2,
        binding: 14,
        resource: "sampler",
      },
      {
        id: "standardTransmissionSceneColorTexture",
        label: "Standard material transmission scene color texture",
        group: 3,
        binding: 14,
        resource: "texture",
      },
      {
        id: "standardTransmissionSceneColorSampler",
        label: "Standard material transmission scene color sampler",
        group: 3,
        binding: 15,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(13) var transmissionTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let transmission = clamp(material.transmissionFactor * textureSample(transmissionTexture, transmissionSampler, input.uv).r",
    );
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|transmission|transmissionTexture|blend|back|less|alpha");
  });

  it("generates a scalar sheen StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      sheen: true,
    });
    const material = createStandardMaterialAsset({
      sheenColorFactor: [0.9, 0.52, 0.2],
      sheenRoughnessFactor: 0.35,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        sheen: true,
      }),
    ).toBe(STANDARD_SHEEN_SHADER_VARIANT);
    expect(shader.label).toBe("aperture/standard-mesh-sheen");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual(STANDARD_MESH_SHADER.bindings);
    expect(shader.code).toContain("sheenColorRoughnessFactor: vec4f");
    expect(shader.code).toContain("let sheenDistribution");
    expect(shader.code).toContain("brdf = brdf * sheenAttenuation");
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|sheen|opaque|back|less|none");
  });

  it("generates a texture-backed sheen color StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      sheenColorTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      sheen: true,
    });
    const material = createStandardMaterialAsset({
      sheenColorFactor: [0.9, 0.52, 0.2],
      sheenColorTexture: {
        texture: createTextureHandle("sheen-color"),
        sampler: createSamplerHandle("sheen-nearest"),
      },
      sheenRoughnessFactor: 0.35,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        sheenColorTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        sheen: true,
      }),
    ).toBe("direct-lit-metallic-roughness-sheen-color-texture-sheen-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-sheen-color-texture-sheen-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "sheenColorTexture",
        label: "Sheen color texture",
        group: 2,
        binding: 15,
        resource: "texture",
      },
      {
        id: "sheenColorSampler",
        label: "Sheen color sampler",
        group: 2,
        binding: 16,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(15) var sheenColorTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let sheenColor = clamp(material.sheenColorRoughnessFactor.rgb * textureSample(sheenColorTexture, sheenColorSampler, input.uv).rgb",
    );
    expect(shader.code).toContain("sheenColor: vec3f");
    expect(shader.code).toContain(
      `        roughness,
        sheenColor,
        sheenRoughness,
      );`,
    );
    expect(shader.code).toContain(
      "let sheenRoughness = clamp(material.sheenColorRoughnessFactor.a, 0.045, 1.0);",
    );
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|sheen|sheenColorTexture|opaque|back|less|none");
  });

  it("generates a texture-backed sheen roughness StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      sheenRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      sheen: true,
    });
    const material = createStandardMaterialAsset({
      sheenColorFactor: [0.9, 0.52, 0.2],
      sheenRoughnessFactor: 1,
      sheenRoughnessTexture: {
        texture: createTextureHandle("sheen-roughness"),
        sampler: createSamplerHandle("sheen-roughness-nearest"),
      },
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        sheenRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        sheen: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-sheen-roughness-texture-sheen-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-sheen-roughness-texture-sheen-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "sheenRoughnessTexture",
        label: "Sheen roughness texture",
        group: 2,
        binding: 19,
        resource: "texture",
      },
      {
        id: "sheenRoughnessSampler",
        label: "Sheen roughness sampler",
        group: 2,
        binding: 20,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(19) var sheenRoughnessTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let sheenRoughness = clamp(material.sheenColorRoughnessFactor.a * textureSample(sheenRoughnessTexture, sheenRoughnessSampler, input.uv).a, 0.045, 1.0);",
    );
    expect(shader.code).toContain("let sheenColor = clamp(");
    expect(shader.code).toContain("sheenRoughness: f32");
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|sheen|sheenRoughnessTexture|opaque|back|less|none");
  });

  it("generates a scalar iridescence StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      iridescence: true,
    });
    const material = createStandardMaterialAsset({
      iridescenceFactor: 1,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 480,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        iridescence: true,
      }),
    ).toBe(STANDARD_IRIDESCENCE_SHADER_VARIANT);
    expect(shader.label).toBe("aperture/standard-mesh-iridescence");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual(STANDARD_MESH_SHADER.bindings);
    expect(shader.code).toContain("iridescenceFactorIorThickness: vec4f");
    expect(shader.code).toContain("fn standardIridescenceFresnel");
    expect(shader.code).toContain(
      "fresnel = mix(fresnel, iridescenceFresnel, iridescence)",
    );
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|iridescence|opaque|back|less|none");
  });

  it("generates a texture-backed iridescence StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      iridescenceTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      iridescence: true,
    });
    const material = createStandardMaterialAsset({
      iridescenceFactor: 1,
      iridescenceTexture: {
        texture: createTextureHandle("iridescence-factor"),
        sampler: createSamplerHandle("iridescence-nearest"),
      },
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 480,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        iridescenceTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        iridescence: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-iridescence-texture-iridescence-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-iridescence-texture-iridescence-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "iridescenceTexture",
        label: "Iridescence texture",
        group: 2,
        binding: 17,
        resource: "texture",
      },
      {
        id: "iridescenceSampler",
        label: "Iridescence sampler",
        group: 2,
        binding: 18,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(17) var iridescenceTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let iridescence = clamp(material.iridescenceFactorIorThickness.x * textureSample(iridescenceTexture, iridescenceSampler, input.uv).r",
    );
    expect(shader.code).toContain("iridescence: f32");
    expect(shader.code).toContain("iridescenceThickness: f32");
    expect(shader.code).toContain(
      `        roughness,
        iridescence,
        iridescenceThickness,
      );`,
    );
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|iridescence|iridescenceTexture|opaque|back|less|none");
  });

  it("generates a texture-backed iridescence thickness StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      iridescenceThicknessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      iridescence: true,
    });
    const material = createStandardMaterialAsset({
      iridescenceFactor: 1,
      iridescenceThicknessTexture: {
        texture: createTextureHandle("iridescence-thickness"),
        sampler: createSamplerHandle("iridescence-thickness-nearest"),
      },
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 100,
      iridescenceThicknessMaximum: 480,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        iridescenceThicknessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        iridescence: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-iridescence-thickness-texture-iridescence-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-iridescence-thickness-texture-iridescence-textured",
    );
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.bindings).toEqual([
      ...STANDARD_MESH_SHADER.bindings,
      {
        id: "iridescenceThicknessTexture",
        label: "Iridescence thickness texture",
        group: 2,
        binding: 21,
        resource: "texture",
      },
      {
        id: "iridescenceThicknessSampler",
        label: "Iridescence thickness sampler",
        group: 2,
        binding: 22,
        resource: "sampler",
      },
    ]);
    expect(shader.code).toContain(
      "@group(2) @binding(21) var iridescenceThicknessTexture: texture_2d<f32>;",
    );
    expect(shader.code).toContain(
      "let iridescenceThickness = clamp(mix(material.iridescenceFactorIorThickness.z, material.iridescenceFactorIorThickness.w, textureSample(iridescenceThicknessTexture, iridescenceThicknessSampler, input.uv).g), 0.0, 1200.0);",
    );
    expect(shader.code).toContain("iridescenceThickness: f32");
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe(
      "standard|iridescence|iridescenceThicknessTexture|opaque|back|less|none",
    );
  });

  it("generates a skinned StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        skinned: true,
      }),
    ).toBe("direct-lit-metallic-roughness-skinned-texture");
    expect(shader.label).toBe("aperture/standard-mesh-skinned-textured");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain("@location(8) joints0: vec4u");
    expect(shader.code).toContain("@location(9) weights0: vec4f");
    expect(shader.code).toContain(
      "@group(1) @binding(1) var<storage, read> skinJointMatrices",
    );
    expect(shader.code).toContain("fn apertureSkinMatrix");
    expect(shader.code).toContain("apertureSkinPosition(input.position");
    expect(shader.code).toContain("apertureSkinDirection(input.normal");
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toContainEqual(["skinJointMatrices", 1, 1, "read-only-storage-buffer"]);
    expect(STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY).toBe(
      "standard/group-1:world-transforms@0,skin-joint-matrices@1",
    );

    const deformed = applySyntheticSkinningPosition({
      position: [1, 2, 3],
      joints: [0, 1, 0, 0],
      weights: [0.25, 0.75, 0, 0],
      matrices: [identityMatrix(), scaleMatrix(3, 1, 1)],
    });

    expect(deformed[0]).toBeCloseTo(2.5);
    expect(deformed[1]).toBeCloseTo(2);
    expect(deformed[2]).toBeCloseTo(3);
  });

  it("generates a morphed StandardMaterial shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      morphed: true,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        morphed: true,
      }),
    ).toBe("direct-lit-metallic-roughness-morphed-texture");
    expect(shader.label).toBe("aperture/standard-mesh-morphed-textured");
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain("@location(10) morphPosition0: vec3f");
    expect(shader.code).toContain("@location(11) morphNormal0: vec3f");
    expect(shader.code).toContain("@location(12) morphPosition1: vec3f");
    expect(shader.code).toContain("@location(13) morphNormal1: vec3f");
    expect(shader.code).toContain(
      "@group(1) @binding(2) var<storage, read> standardMorphTargetWeights",
    );
    expect(shader.code).toContain("fn apertureMorphPosition");
    expect(shader.code).toContain("apertureMorphPosition(input.position");
    expect(shader.code).toContain("apertureMorphDirection(input.normal");
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toContainEqual([
      "standardMorphTargetWeights",
      1,
      2,
      "read-only-storage-buffer",
    ]);
    expect(STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY).toBe(
      "standard/group-1:world-transforms@0,morph-target-weights@2",
    );

    const deformed = evaluateStandardMorphTargetBlend({
      base: [1, 2, 3],
      target0: [2, 0, -1],
      target1: [-1, 4, 0.5],
      weights: [0.25, 0.5],
    });

    expect(deformed[0]).toBeCloseTo(1);
    expect(deformed[1]).toBeCloseTo(4);
    expect(deformed[2]).toBeCloseTo(3);
  });

  it("declares browser-safe group 3 bindings and 3x3 PCF comparison sampling for shadow receivers", () => {
    expect(
      validateStandardShaderMetadata(STANDARD_SHADOW_RECEIVER_MESH_SHADER),
    ).toEqual({ valid: true, diagnostics: [] });
    expect(STANDARD_SHADOW_MAP_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-shadow-map",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "@group(3) @binding(2) var<storage, read> directionalShadowMatrices: array<mat4x4f>;",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "@group(3) @binding(4) var directionalShadowSampler: sampler_comparison;",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "fn sampleDirectionalShadowFactor(worldPosition: vec3f) -> f32",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, filterRadiusTexels: f32) -> f32",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "for (var y: i32 = -1; y <= 1; y = y + 1)",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "let shadowDepth = select(",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "if (projectionDistance > 0.0) {",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "let receiverDepth = clamp(",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "let rawVisibility = sampleDirectionalShadowPcf3x3(",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(
      "return compareFactor;",
    );
    expect(STANDARD_SHADOW_RECEIVER_MESH_WGSL).toContain(") * shadowFactor;");
    expect(
      STANDARD_SHADOW_RECEIVER_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["directionalShadowMatrices", 3, 2, "read-only-storage-buffer"],
      ["directionalShadowMap", 3, 3, "texture"],
      ["directionalShadowSampler", 3, 4, "sampler"],
    ]);
  });

  it("compares point shadow cube samples against projected receiver depth", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      pointShadowMap: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-point-shadow-map",
    );
    expect(shader.label).toBe("aperture/standard-mesh-point-shadow-receiver");
    expect(shader.code).toContain(
      "@group(3) @binding(3) var pointShadowMap: texture_depth_cube;",
    );
    expect(shader.code).toContain(
      "fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32",
    );
    expect(shader.code).toContain(
      "fn samplePointShadowFactorWithMatrixBase(worldPosition: vec3f, lightPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32",
    );
    expect(shader.code).toContain("let clampedShadowDepth = clamp(");
    expect(shader.code).toContain(
      "clampedShadowDepth - STANDARD_POINT_SHADOW_DEPTH_BIAS",
    );
    expect(shader.code).not.toContain(
      "let receiverDepth = 1.0 - STANDARD_POINT_SHADOW_DEPTH_BIAS;",
    );
  });

  it("declares cascaded directional shadow array sampling and distance selection", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      cascadedShadowMap: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-cascaded-shadow-map",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-cascaded-shadow-receiver",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d_array;",
    );
    expect(shader.code).toContain(
      "fn selectDirectionalShadowCascade(lightIndex: u32, worldPosition: vec3f) -> u32",
    );
    expect(shader.code).toContain(
      "let viewDistance = distance(view.cameraPosition.xyz, worldPosition);",
    );
    expect(shader.code).toContain(
      "textureSampleCompareLevel(\n        directionalShadowMap,\n        directionalShadowSampler,\n        sampleUv,\n        i32(cascadeIndex),",
    );
    expect(shader.code).toContain(
      "fn sampleDirectionalShadowReceiverFactor(worldPosition: vec3f) -> f32",
    );
    expect(shader.code).toContain(
      "let shadowFactor = sampleDirectionalShadowFactor(lightIndex, input.worldPosition);",
    );
  });

  it("declares cascaded directional shadows and IBL in one group 3 route", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      cascadedShadowMap: true,
      iblDiffuse: true,
      iblSpecularProof: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d_array;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(5) var standardDiffuseIblTexture: texture_cube<f32>;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(7) var standardSpecularIblTexture: texture_cube<f32>;",
    );
    expect(shader.code).toContain(
      "let color = (ambientDiffuse + diffuseIbl + specularIblProof + direct) * receiverShadowFactor + material.emissiveFactor;",
    );
  });

  it("declares non-overlapping bindings for combined 2D and cube shadow receivers", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      pointShadowMap: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-multi-shadow-map",
    );
    expect(shader.label).toBe("aperture/standard-mesh-multi-shadow-receiver");
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(6) var spotShadowMap: texture_depth_2d;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(9) var pointShadowMap: texture_depth_cube;",
    );
    expect(shader.code).toContain(
      "fn sampleSpotShadowFactor(worldPosition: vec3f) -> f32",
    );
    expect(shader.code).toContain(
      "fn sampleSpotShadowFactorWithMatrixBase(worldPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32",
    );
    expect(shader.code).toContain(
      "fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32",
    );
  });

  it("keeps clustered local point and spot shadow receivers within the minimum fragment storage-buffer limit", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      pointShadowMap: true,
      clusteredLocalLights: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;",
    );
    expect(shader.code).not.toContain(
      "@group(3) @binding(5) var<storage, read> spotShadowMatrices",
    );
    expect(shader.code).not.toContain(
      "@group(3) @binding(6) var spotShadowMap",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(9) var pointShadowMap: texture_depth_cube;",
    );
    expect(shader.code).toContain("directionalShadowMatrices[matrixBaseIndex]");
    expect(shader.code).toContain("fn packedLightPosition");
    expect(shader.code.match(/worldTransforms\[/g)).toHaveLength(1);
    expect(shader.code).toContain("return packedLightPosition(lightIndex);");
    expect(shader.code).toContain("return packedLightDirection(lightIndex);");
    const fragmentStorageBindings = shader.bindings
      .filter(
        (binding) =>
          binding.group === 3 &&
          binding.resource === "read-only-storage-buffer",
      )
      .map((binding) => binding.binding);

    expect(fragmentStorageBindings).toEqual([0, 1, 2, 8, 16, 17, 18, 19]);
  });

  it("samples supported point shadows from clustered local-light metadata", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      pointShadowMap: true,
      clusteredLocalLights: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var pointShadowMap: texture_depth_cube;",
    );
    expect(shader.code).toContain("fn localLightClusterPointShadowFactor");
    expect(shader.code).toContain("samplePointShadowFactorWithMatrixBase(");
    expect(shader.code).toContain(
      "localLightClusterPointShadowMatrixBase(lightIndex)",
    );
    expect(shader.code).toContain(
      "let shadowFactor = localLightClusterPointShadowFactor(position, lightIndex, lightPosition);",
    );
    expect(shader.code).toContain(
      "lightRadiance(lightIndex) * attenuation * shadowFactor",
    );
    expect(shader.code).not.toContain("receiverPointShadowFactor");
    expect(shader.code).toContain(
      "direct = direct + evaluateClusteredLocalLights",
    );
    expect(shader.code.match(/if \(kind == LIGHT_KIND_POINT\)/g)).toHaveLength(
      1,
    );
  });

  it("samples supported spot shadows from clustered local-light metadata", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      clusteredLocalLights: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;",
    );
    expect(shader.code).toContain("fn localLightClusterSpotShadowFactor");
    expect(shader.code).toContain("sampleSpotShadowFactorWithMatrixBase(");
    expect(shader.code).toContain(
      "localLightClusterPointShadowMatrixBase(lightIndex)",
    );
    expect(shader.code).toContain(
      "let shadowFactor = localLightClusterSpotShadowFactor(position, lightIndex);",
    );
    expect(shader.code).toContain(
      "lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation * shadowFactor",
    );
    expect(shader.code).not.toContain(
      "let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);",
    );
    expect(shader.code.match(/if \(kind == LIGHT_KIND_SPOT\)/g)).toHaveLength(
      1,
    );
  });

  it("samples clustered spot-shadow arrays by metadata matrix and layer index", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d_array;",
    );
    expect(shader.code).toContain(
      "fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, layerIndex: u32, filterRadiusTexels: f32) -> f32",
    );
    expect(shader.code).toContain("i32(layerIndex),\n        receiverDepth");
    expect(shader.code).toContain("receiverDepth,\n    matrixBaseIndex,");
    expect(shader.code).toContain("fn localLightClusterSpotShadowFactor");
    expect(shader.code).toContain(
      "localLightClusterPointShadowMatrixBase(lightIndex)",
    );
    expect(shader.code).not.toContain(
      "let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);",
    );
  });

  it("samples compact clustered point plus spot-shadow arrays without duplicate spot bindings", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      shadowMap: true,
      pointShadowMap: true,
      clusteredLocalLights: true,
      clusteredLocalLightArrayShadows: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(3) var directionalShadowMap: texture_depth_2d_array;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(9) var pointShadowMap: texture_depth_cube;",
    );
    expect(shader.code).not.toContain(
      "@group(3) @binding(6) var spotShadowMap",
    );
    expect(shader.code).toContain("receiverDepth,\n    matrixBaseIndex,");
    expect(shader.code).toContain("fn localLightClusterPointShadowFactor");
  });

  it("samples clustered spot cookies without requiring shadow-map bindings", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clusteredLocalLights: true,
      clusteredLocalLightCookies: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.code).toContain(
      "@group(3) @binding(22) var<storage, read> localLightClusterCookieMatrices: array<mat4x4f>;",
    );
    expect(shader.code).toContain(
      "let cookiePosition = localLightClusterCookieMatrices[matrixBaseIndex] * vec4f(position, 1.0);",
    );
    expect(shader.code).toContain(
      "textureSampleLevel(\n    localLightClusterCookieTexture,",
    );
    expect(shader.code).not.toContain("var directionalShadowMap");
    expect(shader.code).not.toContain("var spotShadowMap");
    expect(shader.code).not.toContain("sampler_comparison");
  });

  it("samples clustered spot cookie arrays with metadata layer indices", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clusteredLocalLights: true,
      clusteredLocalLightCookies: true,
      clusteredLocalLightArrayCookies: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clusteredLocalLights: true,
        clusteredLocalLightCookies: true,
        clusteredLocalLightArrayCookies: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-clustered-local-lights-clustered-local-light-array-cookies-texture",
    );
    expect(shader.code).toContain(
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING}) var localLightClusterCookieTexture: texture_2d_array<f32>;`,
    );
    expect(shader.code).toContain("i32(matrixBaseIndex),");
    expect(shader.code).toContain(
      "let cookiePosition = localLightClusterCookieMatrices[matrixBaseIndex] * vec4f(position, 1.0);",
    );
    expect(shader.code).toContain(
      "struct LocalLightClusterCubeFaceCoordinates",
    );
    expect(shader.code).toContain(
      "let layerIndex = layerBaseIndex + faceCoordinates.faceIndex;",
    );
    expect(shader.code).toContain("i32(layerIndex),");
    expect(shader.code).not.toContain("texture_cube<f32>");
  });

  it("samples clustered point cookies from cube textures without spot-cookie projection", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      clusteredLocalLights: true,
      clusteredLocalLightCookies: true,
      clusteredLocalLightCubeCookies: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        clusteredLocalLights: true,
        clusteredLocalLightCookies: true,
        clusteredLocalLightCubeCookies: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-clustered-local-lights-clustered-local-light-cube-cookies-texture",
    );
    expect(shader.bindings).toEqual(
      expect.arrayContaining([
        {
          id: "localLightClusterCookieTexture",
          label: "Standard material local-light cookie texture",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
          resource: "texture",
        },
        {
          id: "localLightClusterCookieSampler",
          label: "Standard material local-light cookie sampler",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
          resource: "sampler",
        },
        {
          id: "localLightClusterCookieMatrices",
          label: "Standard material local-light cookie matrices",
          group: 3,
          binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
          resource: "read-only-storage-buffer",
        },
      ]),
    );
    expect(shader.code).toContain(
      `@group(3) @binding(${LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING}) var localLightClusterCookieTexture: texture_cube<f32>;`,
    );
    expect(shader.code).toContain("fn localLightClusterPointCookieColor");
    expect(shader.code).toContain("normalize(toReceiver)");
    expect(shader.code).toContain(
      "lightRadiance(lightIndex) * attenuation * shadowFactor * cookieColor",
    );
    expect(shader.code).toContain(
      "fn localLightClusterSpotCookieColor(position: vec3f, lightIndex: u32) -> vec3f {\n  _ = position;\n  return localLightClusterUnsupportedCookieColor(lightIndex);",
    );
    expect(shader.code).not.toContain(
      "let cookiePosition = localLightClusterCookieMatrices[matrixBaseIndex] * vec4f(position, 1.0);",
    );
  });

  it("declares browser-safe group 3 bindings for the diffuse IBL shader variant", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      iblDiffuse: true,
    });

    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        iblDiffuse: true,
      }),
    ).toBe(STANDARD_DIFFUSE_IBL_SHADER_VARIANT);
    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(shader.label).toBe("aperture/standard-mesh-diffuse-ibl");
    expect(shader.code).toContain(
      "@group(3) @binding(5) var standardDiffuseIblTexture: texture_cube<f32>;",
    );
    expect(shader.code).toContain(
      "@group(3) @binding(6) var standardIblSampler: sampler;",
    );
    expect(shader.code).toContain(
      "textureSample(\n    standardDiffuseIblTexture,",
    );
    expect(shader.code).toContain(
      "let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["standardDiffuseIblTexture", 3, 5, "texture"],
      ["standardIblSampler", 3, 6, "sampler"],
    ]);
  });

  it("keeps textured alpha-mask discard tied to sampled base-color alpha", () => {
    const alphaSampleOffset =
      STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL.indexOf("baseColorSample.a");
    const alphaCutoffOffset = STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL.indexOf(
      "material.alphaCutoff",
    );
    const discardOffset =
      STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL.indexOf("discard;");
    const material = createStandardMaterialAsset({
      baseColorTexture: {
        texture: createTextureHandle("alpha-mask"),
        sampler: createSamplerHandle("nearest"),
      },
      renderState: {
        alphaMode: "mask",
        alphaCutoff: 0.5,
        cullMode: "none",
        frontFace: "ccw",
        depth: { test: true, write: true, compare: "less" },
        blend: { preset: "none" },
        colorWriteMask: "all",
      },
    });

    expect(STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL).toContain(
      "let alpha = baseColorSample.a * material.baseColorFactor.a;",
    );
    expect(alphaSampleOffset).toBeGreaterThanOrEqual(0);
    expect(alphaCutoffOffset).toBeGreaterThan(alphaSampleOffset);
    expect(discardOffset).toBeGreaterThan(alphaCutoffOffset);
    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe("standard|baseColorTexture|mask|none|less|none");
  });

  it("declares metallic-roughness texture sampling for the PBR texture variant", () => {
    expect(
      validateStandardShaderMetadata(
        STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
      ),
    ).toEqual({ valid: true, diagnostics: [] });
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-texture",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "metallicRoughnessSample.b",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "metallicRoughnessSample.g",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicFactor * metallicRoughnessSample.b",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.roughnessFactor * metallicRoughnessSample.g",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "fn standardTextureTransformUv",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicRoughnessTextureOffset",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicRoughnessTextureScale",
    );
    expect(STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicRoughnessTextureRotation",
    );
    expect(
      STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER.bindings.map(
        (binding) => [
          binding.id,
          binding.group,
          binding.binding,
          binding.resource,
        ],
      ),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
    ]);
  });

  it("declares combined base-color and metallic-roughness texture bindings", () => {
    expect(
      validateStandardShaderMetadata(
        STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
      ),
    ).toEqual({ valid: true, diagnostics: [] });
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT).toBe(
      "direct-lit-metallic-roughness-base-color-metallic-roughness-texture",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "baseColorSample.rgb * material.baseColorFactor.rgb",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.baseColorTextureOffset",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "metallicRoughnessSample.b",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicRoughnessTextureOffset",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.metallicFactor * metallicRoughnessSample.b",
    );
    expect(STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL).toContain(
      "material.roughnessFactor * metallicRoughnessSample.g",
    );
    expect(
      STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER.bindings.map(
        (binding) => [
          binding.id,
          binding.group,
          binding.binding,
          binding.resource,
        ],
      ),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
    ]);
  });

  it("generates emissive and occlusion texture variants for StandardMaterial", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: true,
      emissiveTexture: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: true,
        emissiveTexture: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-base-color-metallic-roughness-occlusion-emissive-texture",
    );
    expect(shader.code).toContain("occlusionSample.r");
    expect(shader.code).toContain(
      "mix(1.0, occlusionSample.r, clamp(material.occlusionStrength, 0.0, 1.0))",
    );
    expect(shader.code).toContain(
      "material.emissiveFactor * emissiveSample.rgb",
    );
    expect(shader.code).toContain(
      "ambient * baseColor * (1.0 - metallic) * occlusion",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
      ["occlusionTexture", 2, 7, "texture"],
      ["occlusionSampler", 2, 8, "sampler"],
      ["emissiveTexture", 2, 9, "texture"],
      ["emissiveSampler", 2, 10, "sampler"],
    ]);
  });

  it("generates a tangent-space normal-map variant for StandardMaterial", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: true,
        occlusionTexture: false,
        emissiveTexture: false,
      }),
    ).toBe("direct-lit-metallic-roughness-normal-map-texture");
    expect(shader.label).toBe("aperture/standard-mesh-normal-map-textured");
    expect(shader.code).toContain("@location(3) tangent: vec4f");
    expect(shader.code).toContain("sampleTangentSpaceNormal");
    expect(shader.code).toContain("fn standardTextureTransformUv");
    expect(shader.code).toContain("material.normalTextureOffset");
    expect(shader.code).toContain("material.normalTextureScale");
    expect(shader.code).toContain("material.normalTextureRotation");
    expect(shader.code).toContain("textureSample(normalTexture, normalSampler");
    expect(shader.code).toContain("tangentNormal.xy * material.normalScale");
    expect(shader.code).toContain("mat3x3f(tangent, bitangent, normal)");
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["normalTexture", 2, 5, "texture"],
      ["normalSampler", 2, 6, "sampler"],
    ]);
  });

  it("combines StandardMaterial base-color texture sampling with normal mapping", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: true,
        occlusionTexture: false,
        emissiveTexture: false,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-normal-map-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-normal-map-textured",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain("sampleTangentSpaceNormal");
    expect(shader.code).toContain("textureSample(normalTexture, normalSampler");
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["normalTexture", 2, 5, "texture"],
      ["normalSampler", 2, 6, "sampler"],
    ]);
  });

  it("combines StandardMaterial base-color texture sampling with occlusion texture sampling", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: true,
      emissiveTexture: false,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: true,
        emissiveTexture: false,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-occlusion-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-occlusion-textured",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain("occlusionSample.r");
    expect(shader.code).toContain(
      "ambient * baseColor * (1.0 - metallic) * occlusion",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["occlusionTexture", 2, 7, "texture"],
      ["occlusionSampler", 2, 8, "sampler"],
    ]);
  });

  it("routes StandardMaterial base-color plus normal textures through TEXCOORD_1", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: true,
        occlusionTexture: false,
        emissiveTexture: false,
        texCoord1: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-normal-map-uv1-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-normal-map-uv1-textured",
    );
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "standardTextureUv(material.normalTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain("textureSample(normalTexture, normalSampler");
  });

  it("combines StandardMaterial metallic-roughness texture sampling with normal mapping", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: true,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: true,
        normalTexture: true,
        occlusionTexture: false,
        emissiveTexture: false,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-metallic-roughness-normal-map-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-metallic-roughness-normal-map-textured",
    );
    expect(shader.code).toContain(
      "textureSample(\n    metallicRoughnessTexture",
    );
    expect(shader.code).toContain(
      "material.metallicFactor * metallicRoughnessSample.b",
    );
    expect(shader.code).toContain(
      "material.roughnessFactor * metallicRoughnessSample.g",
    );
    expect(shader.code).toContain("material.metallicRoughnessTextureOffset");
    expect(shader.code).toContain("material.metallicRoughnessTextureScale");
    expect(shader.code).toContain("material.metallicRoughnessTextureRotation");
    expect(shader.code).toContain("sampleTangentSpaceNormal");
    expect(shader.code).toContain("material.normalTextureOffset");
    expect(shader.code).toContain("material.normalTextureScale");
    expect(shader.code).toContain("material.normalTextureRotation");
    expect(shader.code).toContain("textureSample(normalTexture, normalSampler");
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
      ["normalTexture", 2, 5, "texture"],
      ["normalSampler", 2, 6, "sampler"],
    ]);
  });

  it("combines StandardMaterial occlusion texture sampling with normal mapping", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: true,
      emissiveTexture: false,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: true,
        occlusionTexture: true,
        emissiveTexture: false,
      }),
    ).toBe("direct-lit-metallic-roughness-normal-map-occlusion-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-normal-map-occlusion-textured",
    );
    expect(shader.code).toContain("sampleTangentSpaceNormal");
    expect(shader.code).toContain("textureSample(normalTexture, normalSampler");
    expect(shader.code).toContain("occlusionSample.r");
    expect(shader.code).toContain(
      "ambient * baseColor * (1.0 - metallic) * occlusion",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["normalTexture", 2, 5, "texture"],
      ["normalSampler", 2, 6, "sampler"],
      ["occlusionTexture", 2, 7, "texture"],
      ["occlusionSampler", 2, 8, "sampler"],
    ]);
  });

  it("combines StandardMaterial metallic-roughness sampling with emissive texture contribution", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: true,
      }),
    ).toBe("direct-lit-metallic-roughness-metallic-roughness-emissive-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-metallic-roughness-emissive-textured",
    );
    expect(shader.code).toContain(
      "material.metallicFactor * metallicRoughnessSample.b",
    );
    expect(shader.code).toContain(
      "material.roughnessFactor * metallicRoughnessSample.g",
    );
    expect(shader.code).toContain(
      "material.emissiveFactor * emissiveSample.rgb",
    );
    expect(shader.code).toContain(
      "let color = ambientDiffuse + direct + emissive",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
      ["emissiveTexture", 2, 9, "texture"],
      ["emissiveSampler", 2, 10, "sampler"],
    ]);
  });

  it("combines StandardMaterial base-color texture sampling with emissive texture contribution", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-emissive-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-emissive-textured",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain(
      "textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv)",
    );
    expect(shader.code).toContain(
      "let color = ambientDiffuse + direct + emissive;",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["emissiveTexture", 2, 9, "texture"],
      ["emissiveSampler", 2, 10, "sampler"],
    ]);
  });

  it("combines StandardMaterial base-color, metallic-roughness, and emissive texture sampling", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-base-color-metallic-roughness-emissive-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-metallic-roughness-emissive-textured",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain(
      "textureSample(\n    metallicRoughnessTexture",
    );
    expect(shader.code).toContain(
      "textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv)",
    );
    expect(shader.code).toContain(
      "let color = ambientDiffuse + direct + emissive;",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["metallicRoughnessTexture", 2, 3, "texture"],
      ["metallicRoughnessSampler", 2, 4, "sampler"],
      ["emissiveTexture", 2, 9, "texture"],
      ["emissiveSampler", 2, 10, "sampler"],
    ]);
  });

  it("generates TEXCOORD_1 texture variants for StandardMaterial", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        texCoord1: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-uv1-texture");
    expect(shader.label).toBe("aperture/standard-mesh-base-color-uv1-textured");
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain("@location(5) uv1: vec2f");
    expect(shader.code).toContain("fn standardTextureUv");
    expect(shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
  });

  it("routes StandardMaterial base-color plus occlusion textures through TEXCOORD_1", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: true,
      emissiveTexture: false,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: true,
        emissiveTexture: false,
        texCoord1: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-occlusion-uv1-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-occlusion-uv1-textured",
    );
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "standardTextureUv(material.occlusionTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain(
      "textureSample(occlusionTexture, occlusionSampler, occlusionTextureUv)",
    );
    expect(shader.code).toContain(
      "ambient * baseColor * (1.0 - metallic) * occlusion",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["occlusionTexture", 2, 7, "texture"],
      ["occlusionSampler", 2, 8, "sampler"],
    ]);
  });

  it("routes StandardMaterial base-color plus emissive textures through TEXCOORD_1", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: true,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: true,
        texCoord1: true,
      }),
    ).toBe("direct-lit-metallic-roughness-base-color-emissive-uv1-texture");
    expect(shader.label).toBe(
      "aperture/standard-mesh-base-color-emissive-uv1-textured",
    );
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "standardTextureUv(material.emissiveTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain("textureSample(baseColorTexture");
    expect(shader.code).toContain(
      "textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv)",
    );
    expect(shader.code).toContain(
      "let color = ambientDiffuse + direct + emissive;",
    );
    expect(
      shader.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["standardMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
      ["emissiveTexture", 2, 9, "texture"],
      ["emissiveSampler", 2, 10, "sampler"],
    ]);
  });

  it("routes StandardMaterial metallic-roughness plus emissive textures through TEXCOORD_1", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: true,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: true,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: true,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: true,
        texCoord1: true,
      }),
    ).toBe(
      "direct-lit-metallic-roughness-metallic-roughness-emissive-uv1-texture",
    );
    expect(shader.label).toBe(
      "aperture/standard-mesh-metallic-roughness-emissive-uv1-textured",
    );
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain(
      "standardTextureUv(material.metallicRoughnessTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "standardTextureUv(material.emissiveTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "textureSample(emissiveTexture, emissiveSampler, emissiveTextureUv)",
    );
  });

  it("routes normal-map variants through TEXCOORD_1 when authored", () => {
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
      texCoord1: true,
    });

    expect(validateStandardShaderMetadata(shader)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      createStandardTextureShaderVariantKey({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: true,
        occlusionTexture: false,
        emissiveTexture: false,
        texCoord1: true,
      }),
    ).toBe("direct-lit-metallic-roughness-normal-map-uv1-texture");
    expect(shader.label).toBe("aperture/standard-mesh-normal-map-uv1-textured");
    expect(shader.code).toContain("@location(3) tangent: vec4f");
    expect(shader.code).toContain("@location(4) uv1: vec2f");
    expect(shader.code).toContain("@location(5) uv1: vec2f");
    expect(shader.code).toContain("sampleTangentSpaceNormal");
    expect(shader.code).toContain("material.normalTextureOffset");
    expect(shader.code).toContain("material.normalTextureScale");
    expect(shader.code).toContain("material.normalTextureRotation");
    expect(shader.code).toContain(
      "standardTextureUv(material.normalTexCoord, input.uv, input.uv1)",
    );
    expect(shader.code).toContain(
      "textureSample(normalTexture, normalSampler, normalTextureUv)",
    );
  });

  it("diagnoses missing required standard shader metadata fields", () => {
    const invalid: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };

    expect(
      validateStandardShaderMetadata(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "shaderMetadata.missingLabel",
      "shaderMetadata.missingCode",
      "shaderMetadata.missingEntryPoint",
      "shaderMetadata.missingEntryPoint",
      "shaderMetadata.missingBinding",
      "shaderMetadata.missingBinding",
      "shaderMetadata.missingBinding",
      "shaderMetadata.missingBinding",
      "shaderMetadata.missingBinding",
    ]);
  });
});

function applySyntheticSkinningPosition(input: {
  readonly position: readonly [number, number, number];
  readonly joints: readonly [number, number, number, number];
  readonly weights: readonly [number, number, number, number];
  readonly matrices: readonly (readonly number[])[];
}): readonly [number, number, number] {
  const weightSum = input.weights.reduce((sum, weight) => sum + weight, 0);
  const weights =
    weightSum <= 0.0001
      ? ([1, 0, 0, 0] as const)
      : input.weights.map((weight) => weight / weightSum);
  const blended = new Array(16).fill(0) as number[];

  for (let jointSlot = 0; jointSlot < 4; jointSlot += 1) {
    const joint = input.joints[jointSlot] ?? 0;
    const matrix = input.matrices[joint] ?? identityMatrix();
    const weight = weights[jointSlot] ?? 0;

    for (let index = 0; index < 16; index += 1) {
      blended[index] = (blended[index] ?? 0) + (matrix[index] ?? 0) * weight;
    }
  }

  return [
    (blended[0] ?? 0) * input.position[0] +
      (blended[4] ?? 0) * input.position[1] +
      (blended[8] ?? 0) * input.position[2] +
      (blended[12] ?? 0),
    (blended[1] ?? 0) * input.position[0] +
      (blended[5] ?? 0) * input.position[1] +
      (blended[9] ?? 0) * input.position[2] +
      (blended[13] ?? 0),
    (blended[2] ?? 0) * input.position[0] +
      (blended[6] ?? 0) * input.position[1] +
      (blended[10] ?? 0) * input.position[2] +
      (blended[14] ?? 0),
  ];
}

function identityMatrix(): readonly number[] {
  return scaleMatrix(1, 1, 1);
}

function scaleMatrix(x: number, y: number, z: number): readonly number[] {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
}
