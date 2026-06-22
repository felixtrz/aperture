import { describe, expect, it } from "vitest";

import {
  DEBUG_NORMAL_SHADER_VARIANT,
  createDebugNormalPipelineDescriptorPlan,
  type BatchCompatibilityKey,
  type BuiltInShaderSourceModule,
} from "@aperture-engine/webgpu/test-support";

const DEBUG_NORMAL_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "debug-normal|opaque|back|less|none",
  materialKey: "material:debug-normals",
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("debug-normal material pipeline descriptor planning", () => {
  it("creates descriptor-like data and a cache key for normal visualization", () => {
    const result = createDebugNormalPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: DEBUG_NORMAL_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label: "aperture/debug-normal-mesh:bgra8unorm:triangle-list",
      layout: "auto",
      vertex: {
        moduleLabel: "aperture/debug-normal-mesh",
        entryPoint: "vs_main",
        buffers: ["POSITION", "NORMAL"],
      },
      fragment: {
        moduleLabel: "aperture/debug-normal-mesh",
        entryPoint: "fs_main",
        targets: [{ format: "bgra8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shader: {
          label: "aperture/debug-normal-mesh",
          family: "debug-normal",
          variantKey: DEBUG_NORMAL_SHADER_VARIANT,
        },
        targets: {
          colorFormats: ["bgra8unorm"],
          depthFormat: "depth24plus",
          stencilFormat: null,
        },
        layouts: {
          vertex: "POSITION,NORMAL,TEXCOORD_0",
          bindGroups: [
            "debug-normal/group-0:view-uniform@0",
            "debug-normal/group-1:world-transforms@0",
            "debug-normal/group-2:material@0",
          ],
        },
        material: {
          pipelineKey: "debug-normal|opaque|back|less|none",
          variantKey: "material:debug-normals",
        },
        batch: DEBUG_NORMAL_BATCH_KEY,
      },
    );
  });

  it("separates debug-normal descriptor cache keys by render target format", () => {
    const bgra = required(
      createDebugNormalPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: DEBUG_NORMAL_BATCH_KEY,
      }).plan,
    ).cacheKey;
    const rgba = required(
      createDebugNormalPipelineDescriptorPlan({
        colorFormat: "rgba8unorm",
        batchKey: DEBUG_NORMAL_BATCH_KEY,
      }).plan,
    ).cacheKey;

    expect(bgra).not.toBe(rgba);
  });

  it("honors authored cw front-face state in debug-normal descriptors and cache keys", () => {
    const batchKey = {
      ...DEBUG_NORMAL_BATCH_KEY,
      pipelineKey: "debug-normal|front-face:cw|opaque|back|less|none",
    };
    const result = createDebugNormalPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor.primitive).toMatchObject({
      cullMode: "back",
      frontFace: "cw",
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        primitive: {
          cullMode: "back",
          frontFace: "cw",
        },
        material: {
          pipelineKey: "debug-normal|front-face:cw|opaque|back|less|none",
        },
      },
    );
  });

  it("accepts padded source stream layout keys", () => {
    const result = createDebugNormalPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: {
        ...DEBUG_NORMAL_BATCH_KEY,
        meshLayoutKey: "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.keyInput.vertexLayoutKey).toBe(
      "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
    );
  });

  it("rejects missing normal attributes and unsupported topology", () => {
    const result = createDebugNormalPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      topology: "line-list",
      batchKey: {
        ...DEBUG_NORMAL_BATCH_KEY,
        meshLayoutKey: "POSITION,TEXCOORD_0",
        topology: "line-list",
      },
    });

    expect(result.plan).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "debugNormalPipeline.unsupportedTopology",
        field: "topology",
        message:
          "DebugNormalMaterial pipeline supports triangle-list topology, not 'line-list'.",
      },
      {
        code: "debugNormalPipeline.missingVertexAttribute",
        field: "batchKey.meshLayoutKey.NORMAL",
        message:
          "DebugNormalMaterial pipeline requires 'NORMAL' vertex attribute data.",
      },
    ]);
  });

  it("diagnoses invalid metadata, missing color format, and non-debug-normal batch keys", () => {
    const invalidShader: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };
    const result = createDebugNormalPipelineDescriptorPlan({
      shader: invalidShader,
      colorFormat: "",
      batchKey: {
        pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
        materialKey: "",
        meshLayoutKey: "",
      } as unknown as BatchCompatibilityKey,
    });

    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingShaderMetadata",
      "debugNormalPipeline.missingColorFormat",
      "debugNormalPipeline.unsupportedTopology",
      "debugNormalPipeline.missingBatchKeyField",
      "debugNormalPipeline.missingBatchKeyField",
      "debugNormalPipeline.missingBatchKeyField",
      "debugNormalPipeline.unsupportedShaderFamily",
      "debugNormalPipeline.unsupportedFeature",
    ]);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
