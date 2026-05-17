import { describe, expect, it } from "vitest";

import {
  DEBUG_NORMAL_MESH_SHADER,
  DEBUG_NORMAL_MESH_WGSL,
  DEBUG_NORMAL_SHADER_VARIANT,
  createDebugNormalMeshShaderModuleDescriptor,
  createWebGpuShaderModule,
  validateDebugNormalShaderMetadata,
  type BuiltInShaderSourceModule,
  type WebGpuShaderDeviceLike,
} from "@aperture-engine/webgpu";

describe("debug-normal material WGSL shader metadata", () => {
  it("exports expected entry points and validates through the shader helper", async () => {
    const created: unknown[] = [];
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return {};
      },
    };
    const descriptor = createDebugNormalMeshShaderModuleDescriptor();

    expect(descriptor).toMatchObject({
      label: "aperture/debug-normal-mesh",
      entryPoints: ["vs_main", "fs_main"],
    });
    await expect(
      createWebGpuShaderModule({ device, descriptor }),
    ).resolves.toMatchObject({ ok: true });
    expect(created).toEqual([
      { label: descriptor.label, code: descriptor.code },
    ]);
  });

  it("declares transform and debug-normal material bindings", () => {
    expect(validateDebugNormalShaderMetadata(DEBUG_NORMAL_MESH_SHADER)).toEqual(
      {
        valid: true,
        diagnostics: [],
      },
    );
    expect(DEBUG_NORMAL_SHADER_VARIANT).toBe("world-normal-rgb");
    expect(DEBUG_NORMAL_MESH_WGSL).toContain("worldNormal");
    expect(DEBUG_NORMAL_MESH_WGSL).toContain("vec3f(0.5)");
    expect(
      DEBUG_NORMAL_MESH_SHADER.bindings.map((binding) => [
        binding.id,
        binding.group,
        binding.binding,
        binding.resource,
      ]),
    ).toEqual([
      ["viewProjection", 0, 0, "uniform-buffer"],
      ["worldTransforms", 1, 0, "read-only-storage-buffer"],
      ["debugNormalMaterial", 2, 0, "uniform-buffer"],
    ]);
  });

  it("diagnoses missing required debug-normal shader metadata fields", () => {
    const invalid: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };

    expect(
      validateDebugNormalShaderMetadata(invalid).diagnostics.map(
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
