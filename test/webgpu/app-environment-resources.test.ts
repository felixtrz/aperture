import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblTexturePreparationReport,
  prepareWebGpuAppIblResourceReports,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("WebGPU app environment resource cache", () => {
  it("creates then reuses app-owned IBL texture and sampler resources", () => {
    const createdTextures: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const app = {
      initialization: {
        device: device(createdTextures, createdSamplers),
      },
    };
    const preparedTextures = textures();
    const preparedSamplers = createIblSamplerDescriptorReadinessReport({
      textures: preparedTextures,
      allocation: "ready",
    });

    const first = prepareWebGpuAppIblResourceReports({
      app,
      textures: preparedTextures,
      samplers: preparedSamplers,
    });
    const second = prepareWebGpuAppIblResourceReports({
      app,
      textures: preparedTextures,
      samplers: preparedSamplers,
    });

    expect(first.reuse).toEqual({
      diffuseTextureResourcesCreated: 1,
      diffuseTextureResourcesReused: 0,
      specularTextureResourcesCreated: 1,
      specularTextureResourcesReused: 0,
      samplerResourcesCreated: 2,
      samplerResourcesReused: 0,
    });
    expect(first.cacheSummary).toEqual({
      diffuseTextureEntries: 1,
      specularTextureEntries: 1,
      samplerEntries: 2,
      standardIblBindGroupEntries: 0,
      shadowSamplerEntries: 0,
      standardShadowBindGroupEntries: 0,
      shadowCasterPipelineEntries: 0,
      shadowCasterMatrixBindGroupEntries: 0,
      totalEntries: 4,
    });
    expect(second.reuse).toEqual({
      diffuseTextureResourcesCreated: 0,
      diffuseTextureResourcesReused: 1,
      specularTextureResourcesCreated: 0,
      specularTextureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
    });
    expect(second.diffuseTextureResource.createdTextureCount).toBe(0);
    expect(second.diffuseTextureResource.reusedTextureCount).toBe(1);
    expect(second.specularTextureResource.createdTextureCount).toBe(0);
    expect(second.specularTextureResource.reusedTextureCount).toBe(1);
    expect(second.samplerResources.createdSamplerCount).toBe(0);
    expect(second.samplerResources.reusedSamplerCount).toBe(2);
    expect(second.cacheSummary).toEqual(first.cacheSummary);
    expect(createdTextures).toHaveLength(2);
    expect(createdSamplers).toHaveLength(2);
    expect(JSON.stringify(second.cacheSummary)).not.toMatch(
      /GPUTexture|GPUTextureView|GPUSampler|raw/,
    );
  });

  it("threads PMREM sources into app-owned specular IBL resources", () => {
    const calls: string[] = [];
    const app = {
      initialization: {
        device: pmremDevice(calls),
      },
    };
    const preparedTextures = textures();
    const preparedSamplers = createIblSamplerDescriptorReadinessReport({
      textures: preparedTextures,
      allocation: "ready",
    });
    const report = prepareWebGpuAppIblResourceReports({
      app,
      textures: preparedTextures,
      samplers: preparedSamplers,
      specularPmremSources: [
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

    expect(report.specularTextureResource.sections).toMatchObject({
      proofUpload: false,
      prefiltering: true,
    });
    expect(
      report.specularTextureResource.diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).not.toContain("iblTextureResource.specularProofUploadPlaceholder");
    expect(report.reuse.specularTextureResourcesCreated).toBe(1);
    expect(calls.filter((call) => call === "dispatch")).toHaveLength(3);
  });
});

function textures() {
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

function device(
  createdTextures: unknown[],
  createdSamplers: unknown[],
): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      createdTextures.push(descriptor);

      return {
        createView: () => ({ descriptor }),
      };
    },
    createSampler: (descriptor) => {
      createdSamplers.push(descriptor);

      return { descriptor };
    },
  };
}

function cubeFaces(faceSize: number): Uint8Array[] {
  return Array.from({ length: 6 }, (_, face) => {
    const data = new Uint8Array(faceSize * faceSize * 4);

    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = face * 24;
      data[offset + 1] = 48 + face * 18;
      data[offset + 2] = 220 - face * 20;
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
