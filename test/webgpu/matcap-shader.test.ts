import { describe, expect, it } from "vitest";

import {
  MATCAP_MATERIAL_SHADER_VARIANT,
  MATCAP_MESH_SHADER,
  MATCAP_MESH_WGSL,
  createMatcapMeshShaderModuleDescriptor,
  createWebGpuShaderModule,
  validateMatcapShaderMetadata,
  type BuiltInShaderSourceModule,
  type WebGpuShaderDeviceLike,
} from "@aperture-engine/webgpu";

describe("built-in matcap material WGSL shader metadata", () => {
  it("exports expected entry points and validates through the shader helper", async () => {
    const created: unknown[] = [];
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return {};
      },
    };
    const descriptor = createMatcapMeshShaderModuleDescriptor();

    expect(descriptor).toMatchObject({
      label: "aperture/matcap-mesh",
      entryPoints: ["vs_main", "fs_main"],
    });
    await expect(
      createWebGpuShaderModule({ device, descriptor }),
    ).resolves.toMatchObject({ ok: true });
    expect(created).toEqual([
      { label: descriptor.label, code: descriptor.code },
    ]);
  });

  it("declares transform, matcap material, texture, and sampler bindings", () => {
    expect(validateMatcapShaderMetadata(MATCAP_MESH_SHADER)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(MATCAP_MATERIAL_SHADER_VARIANT).toBe("matcap-texture");
    expect(MATCAP_MESH_WGSL).toContain("textureSample");
    expect(MATCAP_MESH_WGSL).toContain("matcapUv");
    expect(
      MATCAP_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["matcapMaterial", 2, 0, "uniform-buffer"],
      ["matcapTexture", 2, 1, "texture"],
      ["matcapSampler", 2, 2, "sampler"],
    ]);
  });

  it("diagnoses missing required matcap shader metadata fields", () => {
    const invalid: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };

    expect(
      validateMatcapShaderMetadata(invalid).diagnostics.map(
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
