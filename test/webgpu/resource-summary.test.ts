import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
  createLightGpuBuffers,
  createRenderResourceSummaryReport,
  planEnvironmentResources,
  type CreateLightGpuBuffersResult,
  type CreateMeshGpuBuffersResult,
  type CreateSamplerGpuResourceResult,
  type CreateShaderModuleResourceResult,
  type CreateTextureGpuResourceResult,
  type CreateUnlitMaterialGpuBufferResult,
  type CreateViewUniformGpuBufferResult,
  type GetOrCreateRenderPipelineResult,
  type LightPacket,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("renderer resource summary report", () => {
  it("counts all-ready renderer resources", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [meshResource(true)],
      materialResources: [materialResource(true)],
      textureResources: [textureResource(true)],
      samplerResources: [samplerResource(true)],
      lightBuffers: [createLightBufferDescriptor([])],
      lightGpuBufferResources: [lightGpuResource(true)],
      environmentResources: [planEnvironmentResources([environment(1)])],
      viewUniformResources: [viewResource(true)],
      shaderResources: [shaderResource(true)],
      pipelines: [pipeline("hit"), pipeline("miss")],
    });

    expect(report.diagnostics).toEqual([]);
    expect(report.counts).toEqual({
      meshResources: 1,
      meshVertexBuffers: 1,
      meshIndexBuffers: 1,
      materialBuffers: 1,
      textures: 1,
      samplers: 1,
      lightBuffers: 1,
      lightGpuBuffers: 1,
      environmentMaps: 1,
      viewUniformBuffers: 1,
      shaderModules: 1,
      pipelineHits: 1,
      pipelineMisses: 1,
      warnings: 0,
      errors: 0,
    });
  });

  it("preserves diagnostics for partial failures", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [meshResource(false)],
      materialResources: [materialResource(false)],
      textureResources: [textureResource(false)],
      samplerResources: [samplerResource(false)],
      lightGpuBufferResources: [lightGpuResource(false)],
      viewUniformResources: [viewResource(false)],
      shaderResources: [shaderResource(false)],
      pipelines: [pipelineFailure()],
    });

    expect(report.counts).toMatchObject({
      meshResources: 0,
      materialBuffers: 0,
      textures: 0,
      samplers: 0,
      lightGpuBuffers: 0,
      viewUniformBuffers: 0,
      shaderModules: 0,
      warnings: 6,
      errors: 2,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "meshGpuBuffer.vertexCreationFailed",
      "unlitMaterialGpuBuffer.creationFailed",
      "textureResource.textureCreationFailed",
      "samplerResource.samplerCreationFailed",
      "lightGpuBuffer.creationFailed",
      "viewUniformGpuBuffer.creationFailed",
      "shaderResource.creationFailed",
      "pipelineCacheIntegration.pipelineCreationFailed",
    ]);
  });

  it("summarizes texture upload validation diagnostics", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      textureResources: [
        textureResource(true),
        textureUploadDiagnostic("textureResource.invalidBytesPerRow"),
        textureUploadDiagnostic("textureResource.invalidRowsPerImage"),
        textureUploadDiagnostic("textureResource.uploadDataTooSmall"),
      ],
      samplerResources: [],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
    });

    expect(report.counts).toMatchObject({
      textures: 1,
      warnings: 3,
      errors: 0,
    });
    expect(report.diagnostics).toEqual([
      {
        code: "textureResource.invalidBytesPerRow",
        message: "textureResource.invalidBytesPerRow failed",
        resourceKey: "texture:upload",
        severity: "warning",
      },
      {
        code: "textureResource.invalidRowsPerImage",
        message: "textureResource.invalidRowsPerImage failed",
        resourceKey: "texture:upload",
        severity: "warning",
      },
      {
        code: "textureResource.uploadDataTooSmall",
        message: "textureResource.uploadDataTooSmall failed",
        resourceKey: "texture:upload",
        severity: "warning",
      },
    ]);
  });

  it("reports empty resource inputs", () => {
    expect(
      createRenderResourceSummaryReport({
        meshResources: [],
        materialResources: [],
        viewUniformResources: [],
        shaderResources: [],
        pipelines: [],
      }),
    ).toEqual({
      counts: {
        meshResources: 0,
        meshVertexBuffers: 0,
        meshIndexBuffers: 0,
        materialBuffers: 0,
        textures: 0,
        samplers: 0,
        lightBuffers: 0,
        lightGpuBuffers: 0,
        environmentMaps: 0,
        viewUniformBuffers: 0,
        shaderModules: 0,
        pipelineHits: 0,
        pipelineMisses: 0,
        warnings: 0,
        errors: 0,
      },
      diagnostics: [],
    });
  });
});

function environment(environmentId: number) {
  return {
    environmentId,
    handle: createEnvironmentMapHandle("studio"),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}

function meshResource(valid: boolean): CreateMeshGpuBuffersResult {
  return valid
    ? {
        valid: true,
        resource: {
          resourceKey: "mesh-buffer:Cube",
          vertexCount: 3,
          vertexBuffers: [
            { streamId: "main", resourceKey: "v", buffer: {}, vertexCount: 3 },
          ],
          indexBuffer: {
            resourceKey: "i",
            buffer: {},
            format: "uint16",
            indexCount: 3,
          },
        },
        diagnostics: [],
      }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "meshGpuBuffer.vertexCreationFailed",
            message: "failed",
          },
        ],
      };
}

function materialResource(valid: boolean): CreateUnlitMaterialGpuBufferResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "unlitMaterialGpuBuffer.creationFailed",
            message: "failed",
          },
        ],
      };
}

function textureResource(valid: boolean): CreateTextureGpuResourceResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "textureResource.textureCreationFailed",
            resourceKey: "texture:failed",
            message: "failed",
          },
        ],
      };
}

function textureUploadDiagnostic(
  code:
    | "textureResource.invalidBytesPerRow"
    | "textureResource.invalidRowsPerImage"
    | "textureResource.uploadDataTooSmall",
): CreateTextureGpuResourceResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code,
        resourceKey: "texture:upload",
        message: `${code} failed`,
      },
    ],
  };
}

function samplerResource(valid: boolean): CreateSamplerGpuResourceResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "samplerResource.samplerCreationFailed",
            resourceKey: "sampler:failed",
            message: "failed",
          },
        ],
      };
}

function lightGpuResource(valid: boolean): CreateLightGpuBuffersResult {
  if (!valid) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightGpuBuffer.creationFailed",
          message: "failed",
          resourceKey: "light-buffer:failed/floats",
        },
      ],
    };
  }

  const plan = createLightBufferDescriptorPlan(
    createLightBufferDescriptor([environmentLight()]),
  ).plan;

  if (plan === null) {
    throw new Error("Expected light buffer descriptor plan.");
  }

  return createLightGpuBuffers({
    device: lightBufferDevice(),
    plan,
  });
}

function lightBufferDevice(): WebGpuBufferDeviceLike {
  return {
    queue: { writeBuffer: () => {} },
    createBuffer: (descriptor) => ({ descriptor }),
  };
}

function environmentLight(): LightPacket {
  return {
    lightId: 1,
    entity: { index: 1, generation: 0 },
    kind: "directional" as const,
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 0,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function viewResource(valid: boolean): CreateViewUniformGpuBufferResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "viewUniformGpuBuffer.creationFailed",
            message: "failed",
          },
        ],
      };
}

function shaderResource(valid: boolean): CreateShaderModuleResourceResult {
  return valid
    ? { valid: true, resource: null, diagnostics: [] }
    : {
        valid: false,
        resource: null,
        diagnostics: [
          {
            code: "shaderResource.creationFailed",
            message: "failed",
          },
        ],
      };
}

function pipeline(status: "hit" | "miss"): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status,
    key: status,
    pipeline: {},
    diagnostics: [],
  };
}

function pipelineFailure(): GetOrCreateRenderPipelineResult {
  return {
    ok: false,
    reason: "create-render-pipeline-unavailable",
    diagnostics: [
      {
        code: "pipelineCacheIntegration.pipelineCreationFailed",
        message: "failed",
      },
    ],
  };
}
