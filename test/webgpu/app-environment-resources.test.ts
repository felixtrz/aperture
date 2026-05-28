import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblSamplerDescriptorReadinessReport,
  createIblTexturePreparationReport,
  prepareWebGpuAppEnvironmentAssets,
  prepareWebGpuAppIblResourceReports,
  webGpuPreparedEnvironmentAssetSetToJsonValue,
  type EnvironmentPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

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

  it("prepares multiple versioned environment assets with reuse and invalidation summaries", () => {
    const calls: string[] = [];
    const app = {
      initialization: {
        device: pmremDevice(calls),
      },
    };
    const warm = createEnvironmentMapHandle("materials-showcase-warm");
    const cool = createEnvironmentMapHandle("materials-showcase-cool");

    const first = prepareWebGpuAppEnvironmentAssets({
      app,
      assets: [
        environmentAsset(warm, "warm", "v1"),
        environmentAsset(cool, "cool", "v1"),
      ],
      activeHandle: warm,
    });
    const second = prepareWebGpuAppEnvironmentAssets({
      app,
      assets: [
        environmentAsset(warm, "warm", "v1"),
        environmentAsset(cool, "cool", "v1"),
      ],
      activeHandle: cool,
    });
    const invalidated = prepareWebGpuAppEnvironmentAssets({
      app,
      assets: [
        environmentAsset(warm, "warm", "v2"),
        environmentAsset(cool, "cool", "v1"),
      ],
      activeHandle: warm,
    });
    const json = webGpuPreparedEnvironmentAssetSetToJsonValue(second);

    expect(first.totals).toMatchObject({
      assetCount: 2,
      readyAssetCount: 2,
      diffuseTextureResourcesCreated: 2,
      diffuseTextureResourcesReused: 0,
      specularTextureResourcesCreated: 2,
      specularTextureResourcesReused: 0,
      samplerResourcesCreated: 4,
      samplerResourcesReused: 0,
      standardIblBindGroupsCreated: 2,
      standardIblBindGroupsReused: 0,
    });
    expect(second.totals).toMatchObject({
      assetCount: 2,
      readyAssetCount: 2,
      diffuseTextureResourcesCreated: 0,
      diffuseTextureResourcesReused: 2,
      specularTextureResourcesCreated: 0,
      specularTextureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 4,
      standardIblBindGroupsCreated: 0,
      standardIblBindGroupsReused: 2,
    });
    expect(second.active?.environmentMapResourceKey).toBe(
      "environment-map:materials-showcase-cool",
    );
    expect(json.assets.map((asset) => asset.version)).toEqual(["v1", "v1"]);
    expect(json.assets[0]?.resourceKeys.diffuseResourceKey).toBe(
      "texture:warm:diffuse@v1",
    );
    expect(json.assets[1]?.resourceKeys.specularTextureKey).toBe(
      "texture:cool:specular@v1:texture",
    );
    expect(invalidated.totals).toMatchObject({
      assetCount: 2,
      readyAssetCount: 2,
      diffuseTextureResourcesCreated: 1,
      diffuseTextureResourcesReused: 1,
      specularTextureResourcesCreated: 1,
      specularTextureResourcesReused: 1,
      samplerResourcesCreated: 2,
      samplerResourcesReused: 2,
      standardIblBindGroupsCreated: 1,
      standardIblBindGroupsReused: 1,
    });
    expect(JSON.stringify(json)).not.toMatch(
      /GPUTexture|GPUTextureView|GPUSampler|GPUBindGroup|"raw"/,
    );
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

function environmentAsset(
  handle: ReturnType<typeof createEnvironmentMapHandle>,
  label: string,
  version: string,
) {
  const faces = cubeFaces(4);

  return {
    handle,
    label,
    version,
    diffuseResourceKey: `texture:${label}:diffuse`,
    specularResourceKey: `texture:${label}:specular`,
    diffuseSource: {
      label: `${label}:diffuse`,
      faceSize: 4,
      faces,
      format: "rgba8unorm" as const,
    },
    specularPmremSource: {
      label: `${label}:specular`,
      faceSize: 4,
      faces,
      format: "rgba8unorm" as const,
      mipLevelCount: 3,
    },
    standardMaterialCount: 1,
  };
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
