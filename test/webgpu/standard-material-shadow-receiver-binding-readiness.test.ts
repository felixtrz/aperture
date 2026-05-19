import {
  createStandardMaterialShadowReceiverBindingReadinessReport,
  standardMaterialShadowReceiverBindingReadinessReportToJsonValue,
  type ShadowDepthTextureResourceReport,
  type ShadowMatrixBufferResourceReport,
  type ShadowPassCommandBufferSubmissionReport,
  type ShadowSamplerResourceReport,
  type StandardMaterialShadowBindGroupResourceReport,
} from "@aperture-engine/webgpu";
import { describe, expect, it } from "vitest";

describe("StandardMaterialShadowReceiverBindingReadinessReport", () => {
  it("reports not-required when no StandardMaterial receivers exist", () => {
    const report = createStandardMaterialShadowReceiverBindingReadinessReport({
      standardMaterialCount: 0,
      matrixBufferResource: matrixBufferResource(),
      depthTextureResources: depthTextureResources(),
      samplerResource: samplerResource(),
      bindGroupResource: bindGroupResource(),
      commandBufferSubmission: commandBufferSubmission(),
    });

    expect(report).toMatchObject({
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      receiverCount: 0,
      records: [],
      diagnostics: [],
    });
  });

  it("reports ready receiver bindings with JSON-safe resource keys", () => {
    const report = createStandardMaterialShadowReceiverBindingReadinessReport({
      standardMaterialCount: 2,
      matrixBufferResource: matrixBufferResource(),
      depthTextureResources: depthTextureResources(),
      samplerResource: samplerResource(),
      bindGroupResource: bindGroupResource(),
      commandBufferSubmission: commandBufferSubmission(),
    });
    const json =
      standardMaterialShadowReceiverBindingReadinessReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      standardMaterialCount: 2,
      receiverCount: 2,
      sections: {
        matrixBufferResource: true,
        depthTextureResource: true,
        samplerResource: true,
        bindGroupResource: true,
        commandBufferSubmission: true,
        shaderSampling: false,
      },
      records: [
        {
          receiverKey: "standard-material-shadow-receiver:0",
          group: 5,
          matrixResourceKey: "shadow-matrix-buffer:directional",
          depthTextureResourceKey: "shadow-depth-resource:0",
          depthViewKey: "shadow-map:7:light:11:view",
          samplerResourceKey: "shadow-sampler:directional",
          bindGroupResourceKey: "standard-shadow-bind-group:directional",
          commandBufferStatus: "ready",
        },
        {
          receiverKey: "standard-material-shadow-receiver:1",
          group: 5,
          matrixResourceKey: "shadow-matrix-buffer:directional",
          depthTextureResourceKey: "shadow-depth-resource:0",
          depthViewKey: "shadow-map:7:light:11:view",
          samplerResourceKey: "shadow-sampler:directional",
          bindGroupResourceKey: "standard-shadow-bind-group:directional",
          commandBufferStatus: "ready",
        },
      ],
      diagnostics: [
        {
          code: "standardMaterialShadowReceiverBinding.shaderSamplingDeferred",
          severity: "warning",
          message:
            "StandardMaterial shadow receiver resources are bound, but WGSL shadow sampling remains deferred.",
        },
      ],
    });
    expect(JSON.stringify(json)).not.toMatch(
      /GPUBuffer|GPUTexture|GPUTextureView|GPUSampler|GPUBindGroup|GPUCommandBuffer|"raw"|callback/,
    );
  });

  it("reports missing resource prerequisites", () => {
    const report = createStandardMaterialShadowReceiverBindingReadinessReport({
      standardMaterialCount: 1,
      matrixBufferResource: { ...matrixBufferResource(), resource: null },
      depthTextureResources: { ...depthTextureResources(), resources: [] },
      samplerResource: { ...samplerResource(), resource: null },
      bindGroupResource: { ...bindGroupResource(), resource: null },
      commandBufferSubmission: {
        ...commandBufferSubmission(),
        ready: false,
        status: "missing",
      },
    });

    expect(report).toMatchObject({
      ready: false,
      status: "missing",
      receiverCount: 0,
      sections: {
        matrixBufferResource: false,
        depthTextureResource: false,
        samplerResource: false,
        bindGroupResource: false,
        commandBufferSubmission: false,
        shaderSampling: false,
      },
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialShadowReceiverBinding.missingMatrixBufferResource",
      "standardMaterialShadowReceiverBinding.missingDepthTextureResource",
      "standardMaterialShadowReceiverBinding.missingSamplerResource",
      "standardMaterialShadowReceiverBinding.missingBindGroupResource",
      "standardMaterialShadowReceiverBinding.commandBufferNotReady",
    ]);
  });
});

function matrixBufferResource(): ShadowMatrixBufferResourceReport {
  return {
    ready: true,
    status: "available",
    matrixCount: 1,
    byteSize: 64,
    createdBufferCount: 1,
    reusedBufferCount: 0,
    sections: {
      matrixComputation: true,
      bufferDescriptor: true,
      bufferAllocation: true,
      upload: true,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: {
      resourceKey: "shadow-matrix-buffer:directional",
      label: "DirectionalShadowMatrices",
      buffer: { raw: "buffer" },
      byteSize: 64,
      matrixCount: 1,
      entryMatrixKeys: ["shadow-matrix:7:light:11"],
    },
    diagnostics: [],
  };
}

function depthTextureResources(): ShadowDepthTextureResourceReport {
  return {
    ready: true,
    status: "available",
    textureDescriptorCount: 1,
    createdTextureCount: 1,
    sections: {
      textureDescriptors: true,
      depthTextureResource: true,
      gpuAllocation: true,
      matrixUpload: false,
      passSubmission: false,
      shaderSampling: false,
    },
    resources: [
      {
        shadowId: 7,
        lightId: 11,
        resourceKey: "shadow-depth-resource:0",
        textureKey: "shadow-map:7:light:11:texture",
        viewKey: "shadow-map:7:light:11:view",
        allocation: {
          valid: true,
          resource: {
            resourceKey: "shadow-depth-resource:0",
            texture: { raw: "texture" },
            view: { raw: "view" },
            descriptor: {
              size: [1024, 1024, 1],
              format: "depth24plus",
              usage: 20,
            },
          },
          diagnostics: [],
        },
      },
    ],
    diagnostics: [],
  };
}

function samplerResource(): ShadowSamplerResourceReport {
  return {
    ready: true,
    status: "available",
    createdSamplerCount: 1,
    reusedSamplerCount: 0,
    sections: {
      samplerDescriptor: true,
      samplerResource: true,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: {
      resourceKey: "shadow-sampler:directional",
      sampler: { raw: "sampler" },
      descriptor: {
        label: "shadow-sampler:directional",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
        lodMinClamp: 0,
        lodMaxClamp: 32,
        compare: "less-equal",
      },
    },
    diagnostics: [],
  };
}

function bindGroupResource(): StandardMaterialShadowBindGroupResourceReport {
  return {
    ready: true,
    status: "available",
    standardMaterialCount: 2,
    group: 5,
    createdBindGroupCount: 1,
    reusedBindGroupCount: 0,
    sections: {
      descriptorPlan: true,
      layoutResource: true,
      matrixBufferResource: true,
      depthTextureResource: true,
      samplerResource: true,
      bindGroupResource: true,
      passSubmission: false,
      shaderSampling: false,
    },
    resource: {
      group: 5,
      resourceKey: "standard-shadow-bind-group:directional",
      layoutKey: "standard-material/shadow/group-5",
      bindGroup: { raw: "bind-group" },
      entryResourceKeys: [
        "shadow-matrix-buffer:directional",
        "shadow-map:7:light:11:view",
        "shadow-sampler:directional",
      ],
    },
    diagnostics: [],
  };
}

function commandBufferSubmission(): ShadowPassCommandBufferSubmissionReport {
  return {
    ready: true,
    status: "ready",
    counts: {
      assembledPasses: 1,
      commandCount: 15,
      drawCalls: 3,
      commandBuffers: 1,
      submittedCommandBuffers: 0,
      skippedSubmissions: 1,
    },
    sections: {
      encoderAssembly: true,
      commandBufferFinish: true,
      queueSubmission: false,
      shaderSampling: false,
    },
    commandBufferKeys: ["command-buffer:shadow-pass:directional"],
    diagnostics: [],
  };
}
