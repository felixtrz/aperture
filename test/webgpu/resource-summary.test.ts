import { describe, expect, it } from "vitest";

import {
  createRenderResourceSummaryReport,
  type CreateMeshGpuBuffersResult,
  type CreateSamplerGpuResourceResult,
  type CreateShaderModuleResourceResult,
  type CreateTextureGpuResourceResult,
  type CreateUnlitMaterialGpuBufferResult,
  type CreateViewUniformGpuBufferResult,
  type GetOrCreateRenderPipelineResult,
} from "../../src/index.js";

describe("renderer resource summary report", () => {
  it("counts all-ready renderer resources", () => {
    const report = createRenderResourceSummaryReport({
      meshResources: [meshResource(true)],
      materialResources: [materialResource(true)],
      textureResources: [textureResource(true)],
      samplerResources: [samplerResource(true)],
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
      viewUniformResources: [viewResource(false)],
      shaderResources: [shaderResource(false)],
      pipelines: [pipelineFailure()],
    });

    expect(report.counts).toMatchObject({
      meshResources: 0,
      materialBuffers: 0,
      textures: 0,
      samplers: 0,
      viewUniformBuffers: 0,
      shaderModules: 0,
      warnings: 5,
      errors: 2,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "meshGpuBuffer.vertexCreationFailed",
      "unlitMaterialGpuBuffer.creationFailed",
      "textureResource.textureCreationFailed",
      "samplerResource.samplerCreationFailed",
      "viewUniformGpuBuffer.creationFailed",
      "shaderResource.creationFailed",
      "pipelineCacheIntegration.pipelineCreationFailed",
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
