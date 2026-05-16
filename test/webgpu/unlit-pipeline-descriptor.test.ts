import { describe, expect, it } from "vitest";

import {
  createUnlitPipelineDescriptorPlan,
  type BatchCompatibilityKey,
  type BuiltInShaderSourceModule,
} from "../../src/index.js";

const BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "unlit|opaque|back|less|none",
  materialKey: "material:white",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const TEXTURED_BATCH_KEY: BatchCompatibilityKey = {
  ...BATCH_KEY,
  pipelineKey: "unlit|baseColorTexture|opaque|back|less|none",
  materialKey: "material:textured",
};

describe("unlit pipeline descriptor planning", () => {
  it("creates descriptor-like data and a cache key for the MVP unlit pipeline", () => {
    const result = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label: "aperture/unlit-mesh:bgra8unorm:triangle-list",
      layout: "auto",
      vertex: {
        moduleLabel: "aperture/unlit-mesh",
        entryPoint: "vs_main",
      },
      fragment: {
        moduleLabel: "aperture/unlit-mesh",
        entryPoint: "fs_main",
        targets: [{ format: "bgra8unorm" }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shaderLabel: "aperture/unlit-mesh",
        colorFormats: ["bgra8unorm"],
        depthFormat: "depth24plus",
        topology: "triangle-list",
        batch: BATCH_KEY,
      },
    );
  });

  it("selects a textured shader and distinct cache key for base-color textures", () => {
    const factorOnly = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: BATCH_KEY,
    });
    const textured = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: TEXTURED_BATCH_KEY,
    });

    expect(textured.diagnostics).toEqual([]);
    expect(textured.plan?.descriptor).toMatchObject({
      label: "aperture/unlit-mesh-textured:bgra8unorm:triangle-list",
      vertex: { moduleLabel: "aperture/unlit-mesh-textured" },
      fragment: { moduleLabel: "aperture/unlit-mesh-textured" },
    });
    expect(required(textured.plan).cacheKey).not.toBe(
      required(factorOnly.plan).cacheKey,
    );
    expect(
      JSON.parse(required(textured.plan).cacheKey) as unknown,
    ).toMatchObject({
      shaderLabel: "aperture/unlit-mesh-textured",
      batch: TEXTURED_BATCH_KEY,
    });
  });

  it("separates cache keys by format and topology", () => {
    const bgra = required(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: BATCH_KEY,
      }).plan,
    ).cacheKey;
    const rgba = required(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "rgba8unorm",
        batchKey: BATCH_KEY,
      }).plan,
    ).cacheKey;
    const lineBatch: BatchCompatibilityKey = {
      ...BATCH_KEY,
      topology: "line-list",
    };

    expect(bgra).not.toBe(rgba);
    expect(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        topology: "line-list",
        batchKey: lineBatch,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["unlitPipeline.unsupportedTopology"]);
  });

  it("diagnoses invalid metadata, missing color format, and missing batch fields", () => {
    const invalidShader: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };
    const result = createUnlitPipelineDescriptorPlan({
      shader: invalidShader,
      colorFormat: "",
      batchKey: {
        pipelineKey: "",
        materialKey: "",
        meshLayoutKey: "",
      } as unknown as BatchCompatibilityKey,
    });

    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingShaderMetadata",
      "unlitPipeline.missingColorFormat",
      "unlitPipeline.unsupportedTopology",
      "unlitPipeline.missingBatchKeyField",
      "unlitPipeline.missingBatchKeyField",
      "unlitPipeline.missingBatchKeyField",
      "unlitPipeline.missingBatchKeyField",
    ]);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
