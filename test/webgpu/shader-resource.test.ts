import { describe, expect, it } from "vitest";

import {
  createShaderModuleResource,
  createUnlitMeshShaderModuleDescriptor,
  type WebGpuShaderDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("shader module resource creation", () => {
  it("creates shader module resources for the built-in unlit shader", async () => {
    const module = {};
    const created: unknown[] = [];
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return module;
      },
    };
    const descriptor = createUnlitMeshShaderModuleDescriptor();
    const result = await createShaderModuleResource({ device, descriptor });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toEqual({
      resourceKey: "shader-module:aperture/unlit-mesh",
      module,
      entryPoints: ["vs_main", "fs_main"],
    });
    expect(created).toEqual([
      { label: descriptor.label, code: descriptor.code },
    ]);
  });

  it("reports null descriptors and missing device support", async () => {
    await expect(
      createShaderModuleResource({ device: {}, descriptor: null }),
    ).resolves.toMatchObject({
      valid: false,
      diagnostics: [{ code: "shaderResource.nullDescriptor" }],
    });

    await expect(
      createShaderModuleResource({
        device: {},
        descriptor: createUnlitMeshShaderModuleDescriptor(),
      }),
    ).resolves.toMatchObject({
      valid: false,
      diagnostics: [{ code: "shaderResource.creationFailed" }],
    });
  });

  it("preserves shader compilation diagnostics", async () => {
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({
          messages: [{ type: "warning", message: "unused binding" }],
        }),
      }),
    };
    const result = await createShaderModuleResource({
      device,
      descriptor: createUnlitMeshShaderModuleDescriptor(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([
      {
        code: "shaderResource.compilationDiagnostic",
        severity: "warning",
        message: "unused binding",
      },
    ]);
  });
});
