import { describe, expect, it } from "vitest";

import {
  UNLIT_MESH_SHADER,
  UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER,
  UNLIT_TEXTURED_MESH_SHADER,
  UNLIT_TEXTURED_MESH_WGSL,
  UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL,
  createUnlitMeshShaderModuleDescriptor,
  createWebGpuShaderModule,
  validateBuiltInShaderMetadata,
  type BuiltInShaderSourceModule,
  type WebGpuShaderDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("built-in unlit mesh WGSL shader metadata", () => {
  it("exports expected entry points and validates through the shader helper", async () => {
    const created: unknown[] = [];
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return {};
      },
    };
    const descriptor = createUnlitMeshShaderModuleDescriptor();

    expect(descriptor).toMatchObject({
      label: "aperture/unlit-mesh",
      entryPoints: ["vs_main", "fs_main"],
    });
    await expect(
      createWebGpuShaderModule({ device, descriptor }),
    ).resolves.toMatchObject({ ok: true });
    expect(created).toEqual([
      { label: descriptor.label, code: descriptor.code },
    ]);
  });

  it("identifies required transform and material bindings", () => {
    expect(validateBuiltInShaderMetadata(UNLIT_MESH_SHADER)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(
      UNLIT_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["unlitMaterial", 2, 0, "uniform-buffer"],
    ]);
  });

  it("exports a textured variant with base-color texture bindings", () => {
    expect(validateBuiltInShaderMetadata(UNLIT_TEXTURED_MESH_SHADER)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(UNLIT_TEXTURED_MESH_WGSL).toContain("textureSample");
    expect(
      UNLIT_TEXTURED_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["unlitMaterial", 2, 0, "uniform-buffer"],
      ["baseColorTexture", 2, 1, "texture"],
      ["baseColorSampler", 2, 2, "sampler"],
    ]);
    expect(
      createUnlitMeshShaderModuleDescriptor(UNLIT_TEXTURED_MESH_SHADER),
    ).toMatchObject({
      label: "aperture/unlit-mesh-textured",
      code: UNLIT_TEXTURED_MESH_WGSL,
      entryPoints: ["vs_main", "fs_main"],
    });
  });

  it("applies the base-color texture transform in every textured variant", () => {
    // Atlas sub-rect materials (offset/scale/rotation on baseColorTexture)
    // are sanctioned by the app-facing UnlitMaterialOptions docs; the shader
    // has to consume the packed transform or every atlas quad samples the
    // whole sheet (the talos ground-milestone regression).
    for (const code of [
      UNLIT_TEXTURED_MESH_WGSL,
      UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL,
    ]) {
      expect(code).toContain("baseColorUvOffsetScale: vec4f");
      expect(code).toContain("baseColorUvRotation: vec4f");
      expect(code).toContain("fn unlitBaseColorUv(uv: vec2f) -> vec2f");
      expect(code).toContain(
        "textureSample(baseColorTexture, baseColorSampler, unlitBaseColorUv(input.uv))",
      );
      expect(code).not.toContain(
        "textureSample(baseColorTexture, baseColorSampler, input.uv)",
      );
    }
  });

  it("exports a metadata-only variant with future light bindings", () => {
    expect(
      validateBuiltInShaderMetadata(UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER),
    ).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER.code).toBe(
      UNLIT_MESH_SHADER.code,
    );
    expect(
      UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["unlitMaterial", 2, 0, "uniform-buffer"],
      ["lightFloats", 3, 0, "read-only-storage-buffer"],
      ["lightMetadata", 3, 1, "read-only-storage-buffer"],
    ]);
  });

  it("diagnoses missing required shader metadata fields", () => {
    const invalid: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };

    expect(
      validateBuiltInShaderMetadata(invalid).diagnostics.map(
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
    ]);
  });
});
