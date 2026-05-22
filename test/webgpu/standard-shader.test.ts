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
  PackedLightKindId,
  STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY,
  STANDARD_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_SHADOW_RECEIVER_MESH_SHADER,
  STANDARD_SHADOW_RECEIVER_MESH_WGSL,
  STANDARD_MATERIAL_MVP_LIGHTING_MODEL,
  STANDARD_MESH_SHADER,
  STANDARD_MESH_WGSL,
  STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
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
    expect(STANDARD_MESH_WGSL).toContain("LIGHT_KIND_AMBIENT");
    expect(STANDARD_MESH_WGSL).toContain("standardAreaLightLtcMatrixTexture");
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
      "fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32) -> f32",
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
    expect(shader.code).toContain("let clampedShadowDepth = clamp(");
    expect(shader.code).toContain(
      "clampedShadowDepth - STANDARD_POINT_SHADOW_DEPTH_BIAS",
    );
    expect(shader.code).not.toContain(
      "let receiverDepth = 1.0 - STANDARD_POINT_SHADOW_DEPTH_BIAS;",
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
      "fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32",
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
