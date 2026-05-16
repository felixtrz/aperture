import { describe, expect, it } from "vitest";

import {
  MATCAP_MATERIAL_SHADER_VARIANT,
  createMatcapPipelineDescriptorPlan,
  type BatchCompatibilityKey,
  type BuiltInShaderSourceModule,
} from "@aperture-engine/webgpu";

const MATCAP_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
  materialKey: "material:studio-matcap",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("matcap material pipeline descriptor planning", () => {
  it("creates descriptor-like data and a cache key for the metadata-only matcap pipeline", () => {
    const result = createMatcapPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: MATCAP_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label: "aperture/matcap-mesh:bgra8unorm:triangle-list",
      layout: "auto",
      vertex: {
        moduleLabel: "aperture/matcap-mesh",
        entryPoint: "vs_main",
      },
      fragment: {
        moduleLabel: "aperture/matcap-mesh",
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
          label: "aperture/matcap-mesh",
          family: "matcap",
          variantKey: MATCAP_MATERIAL_SHADER_VARIANT,
        },
        targets: {
          colorFormats: ["bgra8unorm"],
          depthFormat: "depth24plus",
          stencilFormat: null,
        },
        layouts: {
          vertex: "primitive-interleaved",
          bindGroups: [
            "matcap/group-0:view-uniform@0",
            "matcap/group-1:world-transforms@0",
            "matcap/group-2:material-texture-sampler@0,1,2",
          ],
        },
        material: {
          pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
          variantKey: "material:studio-matcap",
        },
        batch: MATCAP_BATCH_KEY,
      },
    );
  });

  it("separates matcap descriptor cache keys by render target format", () => {
    const bgra = required(
      createMatcapPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: MATCAP_BATCH_KEY,
      }).plan,
    ).cacheKey;
    const rgba = required(
      createMatcapPipelineDescriptorPlan({
        colorFormat: "rgba8unorm",
        batchKey: MATCAP_BATCH_KEY,
      }).plan,
    ).cacheKey;

    expect(bgra).not.toBe(rgba);
  });

  it("diagnoses invalid metadata, missing color format, and non-matcap batch keys", () => {
    const invalidShader: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };
    const result = createMatcapPipelineDescriptorPlan({
      shader: invalidShader,
      colorFormat: "",
      batchKey: {
        pipelineKey: "unlit|opaque|back|less|none",
        materialKey: "",
        meshLayoutKey: "",
      } as unknown as BatchCompatibilityKey,
    });

    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingShaderMetadata",
      "matcapPipeline.missingColorFormat",
      "matcapPipeline.unsupportedTopology",
      "matcapPipeline.missingBatchKeyField",
      "matcapPipeline.missingBatchKeyField",
      "matcapPipeline.missingBatchKeyField",
      "matcapPipeline.unsupportedShaderFamily",
    ]);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
