import { describe, expect, it } from "vitest";

import {
  createRenderResourceSummaryReport,
  createSamplerAsset,
  createSamplerGpuResource,
  createSnapshotLightBindGroupResources,
  createTextureGpuResource,
  renderResourceSummaryReportToJson,
  renderResourceSummaryReportToJsonValue,
  snapshotLightBindGroupResourcesToSummaryInput,
  type CreateLightBindGroupResourceResult,
  type CreateLightGpuBuffersResult,
  type CreateMeshGpuBuffersResult,
  type CreateSamplerGpuResourceResult,
  type CreateTextureGpuResourceResult,
  type CreateUnlitMaterialGpuBufferResult,
  type CreateViewUniformGpuBufferResult,
  type LightPacket,
  type RenderSnapshot,
  type SnapshotLightBindGroupDeviceLike,
  type TextureDescriptorInput,
  type TextureGpuDeviceLike,
} from "../../src/index.js";

describe("renderer resource summary JSON helpers", () => {
  it("serializes texture upload validation diagnostics with stable resource keys", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      textureResources: [
        validTextureResourceWithRawHandles(),
        textureUploadFailure("texture:bad-row", {
          data: new Uint8Array(16),
          bytesPerRow: 7,
          rowsPerImage: 2,
        }),
        textureUploadFailure("texture:bad-rows", {
          data: new Uint8Array(16),
          bytesPerRow: 8,
          rowsPerImage: 1,
        }),
        textureUploadFailure("texture:short-upload", {
          data: new Uint8Array(15),
          bytesPerRow: 8,
          rowsPerImage: 2,
        }),
      ],
      samplerResources: [],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
    });

    const value = renderResourceSummaryReportToJsonValue(report);
    const json = renderResourceSummaryReportToJson(report);

    expect(value.counts).toMatchObject({
      textures: 1,
      warnings: 3,
      errors: 0,
    });
    expect(value.diagnostics).toEqual([
      {
        code: "textureResource.invalidBytesPerRow",
        message:
          "Texture upload bytesPerRow for resource 'texture:bad-row' must be at least 8 bytes for 2 texel(s) of 'rgba8unorm'.",
        resourceKey: "texture:bad-row",
        severity: "warning",
      },
      {
        code: "textureResource.invalidRowsPerImage",
        message:
          "Texture upload rowsPerImage for resource 'texture:bad-rows' must be an integer at least 2 row(s).",
        resourceKey: "texture:bad-rows",
        severity: "warning",
      },
      {
        code: "textureResource.uploadDataTooSmall",
        message:
          "Texture upload data for resource 'texture:short-upload' must contain at least 16 byte(s); received 15.",
        resourceKey: "texture:short-upload",
        severity: "warning",
      },
    ]);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(renderResourceSummaryReportToJson(report));
    expect(json).not.toContain("raw-texture-handle");
    expect(json).not.toContain("raw-view-handle");
  });

  it("serializes sampler resource diagnostics without raw sampler handles", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      textureResources: [],
      samplerResources: [
        validSamplerResourceWithRawHandle(),
        createSamplerGpuResource({
          device: {},
          resourceKey: "sampler:missing-support",
          sampler: createSamplerAsset({ label: "missing-support" }),
        }),
        createSamplerGpuResource({
          device: {
            createSampler: () => {
              throw new Error("sampler denied");
            },
          },
          resourceKey: "sampler:creation-denied",
          sampler: createSamplerAsset({ label: "creation-denied" }),
        }),
      ],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
    });

    const value = renderResourceSummaryReportToJsonValue(report);
    const json = renderResourceSummaryReportToJson(report);

    expect(value.counts).toMatchObject({
      samplers: 1,
      warnings: 2,
      errors: 0,
    });
    expect(value.diagnostics).toEqual([
      {
        code: "samplerResource.createSamplerUnavailable",
        message: "WebGPU device cannot create samplers.",
        resourceKey: "sampler:missing-support",
        severity: "warning",
      },
      {
        code: "samplerResource.samplerCreationFailed",
        message: "sampler denied",
        resourceKey: "sampler:creation-denied",
        severity: "warning",
      },
    ]);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toContain("raw-sampler-handle");
  });

  it("serializes buffer-backed resource diagnostics with resource keys", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [meshFailure()],
      materialResources: [materialFailure()],
      textureResources: [],
      samplerResources: [],
      lightGpuBufferResources: [
        validLightGpuBufferResourceWithRawHandles(),
        lightGpuBufferFailure(),
      ],
      lightBindGroupResources: [
        validLightBindGroupResourceWithRawHandles(),
        lightBindGroupFailure(),
      ],
      viewUniformResources: [viewUniformFailure()],
      shaderResources: [],
      pipelines: [],
    });

    const value = renderResourceSummaryReportToJsonValue(report);
    const json = renderResourceSummaryReportToJson(report);

    expect(value.counts).toMatchObject({
      meshResources: 0,
      materialBuffers: 0,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      viewUniformBuffers: 0,
      warnings: 5,
      errors: 0,
    });
    expect(value.diagnostics).toEqual([
      {
        code: "meshGpuBuffer.vertexCreationFailed",
        message: "mesh vertex buffer failed",
        resourceKey: "mesh-buffer:Plane/vertex:main",
        severity: "warning",
      },
      {
        code: "unlitMaterialGpuBuffer.creationFailed",
        message: "material buffer failed",
        resourceKey: "material-buffer:Albedo/uniform",
        severity: "warning",
      },
      {
        code: "lightGpuBuffer.creationFailed",
        message: "light buffer failed",
        resourceKey: "light-buffer:Main/floats",
        severity: "warning",
      },
      {
        code: "lightBindGroupResource.creationFailed",
        message: "light bind group failed",
        resourceKey: "bind-group:lights/group-3/light-buffer:Main",
        severity: "warning",
      },
      {
        code: "viewUniformGpuBuffer.creationFailed",
        message: "view uniform buffer failed",
        resourceKey: "view-uniform-buffer:MainCamera/uniform",
        severity: "warning",
      },
    ]);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toContain("raw-buffer-handle");
    expect(json).not.toContain("raw-light-buffer-handle");
    expect(json).not.toContain("raw-light-bind-group-handle");
    expect(json).not.toContain("raw-light-layout-handle");
  });

  it("serializes snapshot-created light bind group summary counts without raw handles", () => {
    const snapshotLightResources = createSnapshotLightBindGroupResources(
      snapshot([light("directional", 1)]),
      {
        device: snapshotLightDevice(),
        lightBuffer: { resourceKey: "light-buffer:summary-json" },
      },
    );
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
      ...snapshotLightBindGroupResourcesToSummaryInput(snapshotLightResources),
    });

    const value = renderResourceSummaryReportToJsonValue(report);
    const json = renderResourceSummaryReportToJson(report);

    expect(value.counts).toMatchObject({
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      warnings: 0,
      errors: 0,
    });
    expect(value.diagnostics).toEqual([]);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).not.toContain("raw-snapshot-light-buffer");
    expect(json).not.toContain("raw-snapshot-light-layout");
    expect(json).not.toContain("raw-snapshot-light-bind-group");
  });
});

function textureUploadFailure(
  resourceKey: string,
  upload: {
    readonly data: Uint8Array;
    readonly bytesPerRow: number;
    readonly rowsPerImage: number;
  },
): CreateTextureGpuResourceResult {
  return createTextureGpuResource({
    device: device(),
    resourceKey,
    descriptor: textureDescriptor(),
    upload,
  });
}

function validTextureResourceWithRawHandles(): CreateTextureGpuResourceResult {
  return {
    valid: true,
    resource: {
      resourceKey: "texture:valid",
      texture: { handle: "raw-texture-handle" },
      view: { handle: "raw-view-handle" },
      descriptor: textureDescriptor(),
    },
    diagnostics: [],
  };
}

function validSamplerResourceWithRawHandle(): CreateSamplerGpuResourceResult {
  return {
    valid: true,
    resource: {
      resourceKey: "sampler:valid",
      sampler: { handle: "raw-sampler-handle" },
      descriptor: {
        label: "valid",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
        lodMinClamp: 0,
        lodMaxClamp: 32,
        maxAnisotropy: 1,
      },
    },
    diagnostics: [],
  };
}

function validLightGpuBufferResourceWithRawHandles(): CreateLightGpuBuffersResult {
  return {
    valid: true,
    resource: {
      resourceKey: "light-buffer:Main",
      floatResourceKey: "light-buffer:Main/floats",
      metadataResourceKey: "light-buffer:Main/metadata",
      floatBuffer: { handle: "raw-light-buffer-handle" },
      metadataBuffer: { handle: "raw-light-metadata-buffer-handle" },
      count: 1,
    },
    diagnostics: [],
  };
}

function lightGpuBufferFailure(): CreateLightGpuBuffersResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code: "lightGpuBuffer.creationFailed",
        message: "light buffer failed",
        resourceKey: "light-buffer:Main/floats",
      },
    ],
  };
}

function validLightBindGroupResourceWithRawHandles(): CreateLightBindGroupResourceResult {
  return {
    valid: true,
    resource: {
      group: 3,
      resourceKey: "bind-group:lights/group-3/light-buffer:Main",
      layoutKey: "bind-group-layout:lights/group-3",
      bindGroup: { handle: "raw-light-bind-group-handle" },
      entryResourceKeys: [
        "light-buffer:Main/floats",
        "light-buffer:Main/metadata",
      ],
    },
    diagnostics: [],
  };
}

function lightBindGroupFailure(): CreateLightBindGroupResourceResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code: "lightBindGroupResource.creationFailed",
        message: "light bind group failed",
        resourceKey: "bind-group:lights/group-3/light-buffer:Main",
        layoutKey: "bind-group-layout:lights/group-3",
      },
    ],
  };
}

function meshFailure(): CreateMeshGpuBuffersResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code: "meshGpuBuffer.vertexCreationFailed",
        message: "mesh vertex buffer failed",
        resourceKey: "mesh-buffer:Plane/vertex:main",
      },
    ],
  };
}

function materialFailure(): CreateUnlitMaterialGpuBufferResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code: "unlitMaterialGpuBuffer.creationFailed",
        message: "material buffer failed",
        resourceKey: "material-buffer:Albedo/uniform",
      },
    ],
  };
}

function viewUniformFailure(): CreateViewUniformGpuBufferResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code: "viewUniformGpuBuffer.creationFailed",
        message: "view uniform buffer failed",
        resourceKey: "view-uniform-buffer:MainCamera/uniform",
      },
    ],
  };
}

function textureDescriptor(): TextureDescriptorInput {
  return {
    label: "albedo",
    size: [2, 2, 1],
    format: "rgba8unorm",
    usage: 0x6,
    mipLevelCount: 1,
  };
}

function device(): TextureGpuDeviceLike {
  return {
    createTexture: () => ({
      createView: () => ({ handle: "raw-view-handle" }),
    }),
    queue: { writeTexture: () => undefined },
  };
}

function snapshot(lights: readonly LightPacket[]): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights,
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: lights.length,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 1, 1, 1],
    intensity: seed,
    range: 10,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 16 * seed,
    layerMask: 1,
  };
}

function snapshotLightDevice(): SnapshotLightBindGroupDeviceLike {
  return {
    queue: {
      writeBuffer: () => undefined,
    },
    createBuffer: () => ({ handle: "raw-snapshot-light-buffer" }),
    createBindGroupLayout: () => ({
      handle: "raw-snapshot-light-layout",
    }),
    createBindGroup: () => ({
      handle: "raw-snapshot-light-bind-group",
    }),
  };
}
