import { describe, expect, it } from "vitest";

import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedLightKindId,
  STANDARD_MATERIAL_MVP_LIGHTING_MODEL,
  STANDARD_MESH_SHADER,
  STANDARD_MESH_WGSL,
  createStandardMeshShaderModuleDescriptor,
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
      deferred: expect.arrayContaining([
        "textureSampling",
        "imageBasedLighting",
        "shadows",
      ]),
    });
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
