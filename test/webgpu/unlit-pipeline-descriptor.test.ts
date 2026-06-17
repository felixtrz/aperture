import { describe, expect, it } from "vitest";

import {
  createUnlitPipelineDescriptorPlan,
  type BatchCompatibilityKey,
  type BuiltInShaderSourceModule,
} from "@aperture-engine/webgpu/test-support";

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

const VERTEX_COLOR_BATCH_KEY: BatchCompatibilityKey = {
  ...BATCH_KEY,
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
  materialKey: "material:vertex-color",
};

const TEXTURED_VERTEX_COLOR_BATCH_KEY: BatchCompatibilityKey = {
  ...TEXTURED_BATCH_KEY,
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
  materialKey: "material:textured-vertex-color",
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
        shader: {
          label: "aperture/unlit-mesh",
          family: "unlit",
          variantKey: "baseColorFactor",
        },
        targets: {
          colorFormats: ["bgra8unorm"],
          depthFormat: "depth24plus",
          stencilFormat: null,
        },
        layouts: {
          vertex: "primitive-interleaved",
          bindGroups: [
            "unlit/group-0:view-uniform@0",
            "unlit/group-1:world-transforms@0",
            "unlit/group-2:material@0",
          ],
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "back",
          frontFace: "ccw",
          stripIndexFormat: null,
        },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: true,
          depthCompare: "less",
        },
        material: {
          pipelineKey: "unlit|opaque|back|less|none",
          variantKey: "material:white",
        },
        batch: BATCH_KEY,
      },
    );
  });

  it("applies authored material depth bias to unlit pipeline descriptors", () => {
    const result = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: {
        ...BATCH_KEY,
        pipelineKey: "unlit|depth-bias:-2:1.25|blend|none|less|alpha",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less",
        depthBias: -2,
        depthBiasSlopeScale: 1.25,
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        depthStencil: {
          depthBias: -2,
          depthBiasSlopeScale: 1.25,
        },
      },
    );
  });

  it("honors authored cw front-face state in unlit descriptors and cache keys", () => {
    const batchKey = {
      ...BATCH_KEY,
      pipelineKey: "unlit|front-face:cw|opaque|back|less|none",
    };
    const result = createUnlitPipelineDescriptorPlan({
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
          pipelineKey: "unlit|front-face:cw|opaque|back|less|none",
        },
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
      shader: {
        label: "aperture/unlit-mesh-textured",
        family: "unlit",
        variantKey: "baseColorTexture",
      },
      layouts: {
        bindGroups: [
          "unlit/group-0:view-uniform@0",
          "unlit/group-1:world-transforms@0",
          "unlit/group-2:material-textured@0,1,2",
        ],
      },
      batch: TEXTURED_BATCH_KEY,
    });
  });

  it("selects a vertex-color shader variant from the mesh layout", () => {
    const factorOnly = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: BATCH_KEY,
    });
    const vertexColor = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: VERTEX_COLOR_BATCH_KEY,
    });

    expect(vertexColor.diagnostics).toEqual([]);
    expect(vertexColor.plan?.descriptor).toMatchObject({
      label: "aperture/unlit-mesh-vertex-color:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/unlit-mesh-vertex-color",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"],
      },
      fragment: { moduleLabel: "aperture/unlit-mesh-vertex-color" },
    });
    expect(required(vertexColor.plan).cacheKey).not.toBe(
      required(factorOnly.plan).cacheKey,
    );
    expect(
      JSON.parse(required(vertexColor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        label: "aperture/unlit-mesh-vertex-color",
        family: "unlit",
        variantKey: "vertexColor",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        bindGroups: [
          "unlit/group-0:view-uniform@0",
          "unlit/group-1:world-transforms@0",
          "unlit/group-2:material@0",
        ],
      },
      batch: VERTEX_COLOR_BATCH_KEY,
    });
  });

  it("combines textured and vertex-color shader variants", () => {
    const textured = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: TEXTURED_BATCH_KEY,
    });
    const texturedVertexColor = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: TEXTURED_VERTEX_COLOR_BATCH_KEY,
    });

    expect(texturedVertexColor.diagnostics).toEqual([]);
    expect(texturedVertexColor.plan?.descriptor).toMatchObject({
      label:
        "aperture/unlit-mesh-textured-vertex-color:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/unlit-mesh-textured-vertex-color",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"],
      },
      fragment: {
        moduleLabel: "aperture/unlit-mesh-textured-vertex-color",
      },
    });
    expect(required(texturedVertexColor.plan).cacheKey).not.toBe(
      required(textured.plan).cacheKey,
    );
    expect(
      JSON.parse(required(texturedVertexColor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        label: "aperture/unlit-mesh-textured-vertex-color",
        family: "unlit",
        variantKey: "baseColorTexture+vertexColor",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        bindGroups: [
          "unlit/group-0:view-uniform@0",
          "unlit/group-1:world-transforms@0",
          "unlit/group-2:material-textured@0,1,2",
        ],
      },
      batch: TEXTURED_VERTEX_COLOR_BATCH_KEY,
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
    const line = createUnlitPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      topology: "line-list",
      batchKey: lineBatch,
    });

    expect(bgra).not.toBe(rgba);
    expect(line.diagnostics).toEqual([]);
    expect(required(line.plan).descriptor).toMatchObject({
      label: "aperture/unlit-mesh:bgra8unorm:line-list",
      primitive: { topology: "line-list" },
    });
    expect(JSON.parse(required(line.plan).cacheKey) as unknown).toMatchObject({
      primitive: { topology: "line-list" },
      batch: lineBatch,
    });
  });

  it("rejects unsupported point-list topology", () => {
    const pointBatch: BatchCompatibilityKey = {
      ...BATCH_KEY,
      topology: "point-list",
    };

    expect(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        topology: "point-list",
        batchKey: pointBatch,
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
