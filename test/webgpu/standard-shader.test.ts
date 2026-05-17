import { describe, expect, it } from "vitest";

import {
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL,
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER,
  STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL,
  STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
  STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER,
  STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL,
  STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedLightKindId,
  STANDARD_MATERIAL_MVP_LIGHTING_MODEL,
  STANDARD_MESH_SHADER,
  STANDARD_MESH_WGSL,
  createStandardMeshShaderModuleDescriptor,
  createStandardTextureShaderVariantKey,
  createStandardTextureVariantShader,
  createWebGpuShaderModule,
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
    expect(STANDARD_MESH_WGSL).toContain("LIGHT_KIND_AMBIENT");
    expect(STANDARD_MESH_WGSL).not.toContain("textureSample");
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
      "metallicRoughnessSample.b",
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
