import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  createSpecularIblTextureResourceReport,
  specularIblTextureResourceReportToJson,
  specularIblTextureResourceReportToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
  type TextureGpuResource,
} from "@aperture-engine/webgpu/test-support";

describe("specular IBL texture resource", () => {
  it("creates a renderer-owned specular texture resource from planned IBL slots", () => {
    const created: unknown[] = [];
    const report = createSpecularIblTextureResourceReport({
      device: deviceWithTextures(created),
      textures: textures("deferred"),
      size: 32,
    });
    const json = specularIblTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      textureSlotCount: 2,
      specularSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        specularTextureResource: true,
        gpuAllocation: true,
        proofUpload: false,
        prefiltering: false,
        bindGroupResource: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          resourceKey: "texture:studio:specular-prefilter:texture",
          descriptor: {
            label: "environment-map:studio:specular-ibl",
            size: [32, 32, 6],
            format: "rgba16float",
            usage: 22,
            mipLevelCount: 6,
          },
        },
      ],
      diagnostics: [
        {
          code: "iblTextureResource.specularSourceNotPrepared",
          severity: "warning",
          resourceKey: "texture:studio:specular-prefilter:texture",
          message:
            "Specular IBL slot 'texture:studio:specular-prefilter:texture' has no prepared source (cube faces, source texture, or equirect projection); a neutral placeholder cube is bound until a source is provided.",
        },
      ],
    });
    expect(JSON.parse(specularIblTextureResourceReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|"raw"/);
    expect(created).toHaveLength(1);
  });

  it("executes renderer-owned PMREM prefiltering when a source cubemap is provided", () => {
    const calls: string[] = [];
    const report = createSpecularIblTextureResourceReport({
      device: pmremDevice(calls),
      textures: textures("ready"),
      pmremSources: [
        {
          sourceResourceKey: "texture:studio:specular-prefilter",
          label: "studio",
          faceSize: 4,
          faces: cubeFaces(4),
          format: "rgba8unorm",
          mipLevelCount: 3,
        },
      ],
    });
    const json = specularIblTextureResourceReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "available",
      specularSlotCount: 1,
      createdTextureCount: 1,
      sections: {
        proofUpload: false,
        prefiltering: true,
      },
      resources: [
        {
          valid: true,
          resourceKey: "texture:studio:specular-prefilter:texture",
          descriptor: {
            label: "studio:specular-ibl-pmrem-mip-chain",
            size: [4, 4, 6],
            format: "rgba8unorm",
            usage: 28,
            mipLevelCount: 3,
          },
        },
      ],
      diagnostics: [],
    });
    expect(calls.filter((call) => call === "writeTexture")).toHaveLength(6);
    expect(calls.filter((call) => call === "dispatch")).toHaveLength(3);
    expect(calls).toContain("submit");
    expect(JSON.stringify(json)).not.toMatch(
      /specularProofUploadPlaceholder|GPUTexture|GPUTextureView|"raw"/,
    );
  });

  it("prefilters a cube source texture without emitting placeholder diagnostics", () => {
    const calls: string[] = [];
    const device = pmremDevice(calls);
    const sourceTexture: TextureGpuResource = {
      resourceKey: "texture:studio:projected-cube",
      texture: device.createTexture({ label: "projected-cube" }),
      view: { label: "projected-cube-view" },
      descriptor: {
        size: [4, 4, 6],
        format: "rgba8unorm",
        usage: 22,
      },
    };
    const report = createSpecularIblTextureResourceReport({
      device,
      textures: textures("ready"),
      pmremSources: [
        {
          sourceResourceKey: "texture:studio:specular-prefilter",
          label: "studio",
          faceSize: 4,
          sourceTexture,
          format: "rgba8unorm",
          mipLevelCount: 3,
        },
      ],
    });
    const json = specularIblTextureResourceReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      status: "available",
      sections: {
        proofUpload: false,
        prefiltering: true,
      },
      diagnostics: [],
    });
    expect(report.resources[0]?.resource?.prefiltered).toBe(true);
    expect(calls.filter((call) => call === "writeTexture")).toHaveLength(0);
    expect(calls.filter((call) => call === "dispatch")).toHaveLength(3);
    expect(JSON.stringify(json)).not.toMatch(
      /specularSourceNotPrepared|specularProofUploadPlaceholder|specularPrefilteringDeferred/,
    );
  });

  it("replaces a cached placeholder cube once a PMREM source becomes available", () => {
    const calls: string[] = [];
    const cache = new Map<string, TextureGpuResource>();
    const placeholder = createSpecularIblTextureResourceReport({
      device: pmremDevice(calls),
      textures: textures("ready"),
      cache,
    });
    const prefiltered = createSpecularIblTextureResourceReport({
      device: pmremDevice(calls),
      textures: textures("ready"),
      cache,
      pmremSources: [
        {
          sourceResourceKey: "texture:studio:specular-prefilter",
          label: "studio",
          faceSize: 4,
          faces: cubeFaces(4),
          format: "rgba8unorm",
          mipLevelCount: 3,
        },
      ],
    });

    expect(placeholder.sections.prefiltering).toBe(false);
    expect(
      placeholder.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["iblTextureResource.specularSourceNotPrepared"]);
    expect(prefiltered.sections.prefiltering).toBe(true);
    expect(prefiltered.createdTextureCount).toBe(1);
    expect(prefiltered.reusedTextureCount).toBe(0);
    expect(prefiltered.diagnostics).toEqual([]);
    expect(
      cache.get("texture:studio:specular-prefilter:texture")?.prefiltered,
    ).toBe(true);
  });
});

function textures(preparation: "deferred" | "ready" | "unsupported") {
  return createIblTexturePreparationReport({
    descriptors: createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse-irradiance",
          specularResourceKey: "texture:studio:specular-prefilter",
        },
      ],
    }),
    preparation,
  });
}

function environment(
  environmentId: number,
  handleId: string,
): EnvironmentPacket {
  return {
    environmentId,
    handle: createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function deviceWithTextures(created: unknown[]): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      created.push(descriptor);

      return {
        createView: () => ({ descriptor }),
      };
    },
  };
}

function cubeFaces(faceSize: number): Uint8Array[] {
  return Array.from({ length: 6 }, (_, face) => {
    const data = new Uint8Array(faceSize * faceSize * 4);

    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = face * 30;
      data[offset + 1] = 32 + face * 20;
      data[offset + 2] = 224 - face * 24;
      data[offset + 3] = 255;
    }

    return data;
  });
}

function pmremDevice(calls: string[]) {
  return {
    createShaderModule: (descriptor: unknown) => ({ descriptor }),
    createBindGroupLayout: (descriptor: unknown) => ({ descriptor }),
    createPipelineLayout: (descriptor: unknown) => ({ descriptor }),
    createComputePipeline: (descriptor: unknown) => ({ descriptor }),
    createTexture: (descriptor: unknown) => ({
      descriptor,
      createView: (viewDescriptor?: unknown) => ({
        descriptor,
        viewDescriptor,
      }),
    }),
    createSampler: (descriptor: unknown) => ({ descriptor }),
    createBuffer: (descriptor: unknown) => ({ descriptor }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: (descriptor: unknown) => ({
      descriptor,
      beginComputePass: (passDescriptor: unknown) => ({
        passDescriptor,
        setPipeline: () => calls.push("setPipeline"),
        setBindGroup: () => calls.push("setBindGroup"),
        dispatchWorkgroups: () => calls.push("dispatch"),
        end: () => calls.push("end"),
      }),
      finish: () => {
        calls.push("finish");
        return { descriptor };
      },
    }),
    queue: {
      writeTexture: () => calls.push("writeTexture"),
      writeBuffer: () => calls.push("writeBuffer"),
      submit: () => calls.push("submit"),
    },
  };
}
