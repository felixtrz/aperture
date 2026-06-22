import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMsdfTextFrameResources,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  createQuadSnapshotBuffers,
  createSamplerAsset,
  createSamplerHandle,
  createTextureAsset,
  createTextureHandle,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MsdfTextRenderPipelineResource,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("MSDF text app frame resources", () => {
  it("packs glyph quad ABI records into a storage buffer and draw command", () => {
    const texture = createTextureHandle("font-page-0");
    const sampler = createSamplerHandle("font-linear");
    const assets = new AssetRegistry();
    const writes: {
      readonly label: string;
      readonly data: ArrayBufferLike | ArrayBufferView;
      readonly dataOffset?: number;
      readonly size?: number;
    }[] = [];
    const bindGroups: unknown[] = [];
    const createdTextures: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const device = {
      createBuffer: (descriptor: { readonly label?: string }) => ({
        label: descriptor.label ?? "buffer",
        descriptor,
      }),
      createBindGroup: (descriptor: unknown) => {
        bindGroups.push(descriptor);
        return { descriptor };
      },
      createTexture: (descriptor: unknown) => {
        createdTextures.push(descriptor);
        return { createView: () => ({ label: "font-view" }) };
      },
      createSampler: (descriptor: unknown) => {
        createdSamplers.push(descriptor);
        return { label: "font-sampler" };
      },
      queue: {
        writeBuffer: (
          buffer: { readonly label: string },
          _bufferOffset: number,
          data: ArrayBufferLike | ArrayBufferView,
          dataOffset?: number,
          size?: number,
        ) => {
          writes.push({
            label: buffer.label,
            data,
            ...(dataOffset === undefined ? {} : { dataOffset }),
            ...(size === undefined ? {} : { size }),
          });
        },
        writeTexture: () => undefined,
      },
    };
    const snapshot = createTextSnapshot(texture, sampler);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );
    const worldTransforms = writePackedSnapshotTransforms(
      snapshot,
      createPackedSnapshotTransformsScratch(),
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "font-page-0",
        dimension: "2d",
        width: 4,
        height: 4,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array(4 * 4 * 4).fill(255),
          bytesPerRow: 16,
        },
      }),
    );
    assets.markReady(
      sampler,
      createSamplerAsset({
        label: "font-linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      }),
    );

    const result = createMsdfTextFrameResources({
      app: {
        canvas: { width: 640, height: 360 } as never,
        initialization: { device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache: {
        textures: new Map(),
        samplers: new Map(),
      } as never,
      snapshot,
      viewUniforms,
      worldTransforms,
      pipeline: createPipelineResource(),
      reuse: {
        textureResourcesCreated: 0,
        textureResourcesReused: 0,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 0,
      } as never,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.commands).toEqual([
      expect.objectContaining({
        kind: "setPipeline",
        renderId: 901,
        pipelineKey: "aperture/msdf-text:bgra8unorm:depth24plus:1",
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        index: 0,
        resourceKey: "msdf-text:view:1",
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        index: 1,
        resourceKey: "msdf-text:transforms:1",
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        index: 2,
        resourceKey:
          "msdf-text:glyphs:1:901:texture:font-page-0@1:sampler:font-linear@1",
      }),
      {
        kind: "draw",
        renderId: 901,
        vertexCount: 6,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
    expect(bindGroups).toHaveLength(3);
    expect(createdTextures).toEqual([
      expect.objectContaining({
        label: "font-page-0",
        format: "rgba8unorm",
      }),
    ]);
    expect(createdSamplers).toEqual([
      expect.objectContaining({
        label: "MsdfTextDefaultSampler",
        magFilter: "linear",
      }),
      expect.objectContaining({
        label: "font-linear",
        magFilter: "linear",
      }),
    ]);

    const glyphUpload = writes.find(
      (write) => write.label === "MSDFText/GlyphData",
    );
    expect(glyphUpload).toBeDefined();

    const glyphData = floatUpload(glyphUpload);

    expect(Array.from(glyphData.slice(4, 20))).toEqual([
      14, 26, 18, 20, 0.25, 0.5, 0.125, 0.25, 8, 64, 32, 1.5, 1, 65, 4, 2,
    ]);
    expect(glyphData[0]).toBeCloseTo(0.2);
    expect(glyphData[1]).toBeCloseTo(0.4);
    expect(glyphData[2]).toBeCloseTo(0.6);
    expect(glyphData[3]).toBeCloseTo(0.8);
  });
});

function createTextSnapshot(
  texture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle>,
): RenderSnapshot {
  const floats = new Float32Array(24);
  const words = new Uint32Array(8);

  floats[0] = 14;
  floats[1] = 26;
  floats[4] = 18;
  floats[5] = 20;
  floats[9] = 0.25;
  floats[10] = 0.5;
  floats[11] = 0.125;
  floats[12] = 0.25;
  floats[13] = 0.2;
  floats[14] = 0.4;
  floats[15] = 0.6;
  floats[16] = 0.8;
  floats[17] = 8;
  floats[18] = 64;
  floats[19] = 32;
  floats[20] = 1.5;
  words[0] = 16;
  words[2] = 65;
  words[5] = 4;
  words[6] = 2;

  return {
    frame: 1,
    views: [
      {
        viewId: 1,
        camera: { index: 0, generation: 1 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 16,
        projectionMatrixOffset: 0,
        viewProjectionMatrixOffset: 0,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    meshDraws: [],
    quads: createQuadSnapshotBuffers({
      instanceFloats: floats,
      instanceWords: words,
    }),
    quadBatches: [
      {
        batchId: 901,
        kind: "glyph",
        texture,
        sampler,
        materialKey: "font:fixture",
        pipelineVariant: "msdf-text",
        coordinateMode: "screen",
        billboardMode: "none",
        sizeMode: "screen-pixels",
        blendMode: "alpha",
        firstInstance: 0,
        instanceCount: 1,
        layerMask: 1,
        sortKey: {
          queue: "transparent",
          viewId: 1,
          layer: 0,
          order: 0,
          pipelineKey: "msdf-text",
          materialKey: "font:fixture",
          meshKey: "glyph-quad",
          depth: 0,
          stableId: 901,
        },
      },
    ],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: matrixPair(),
    viewMatrices: matrixPair(),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
      quadInstances: 1,
      quadBatches: 1,
    },
  };
}

function createPipelineResource(): MsdfTextRenderPipelineResource {
  return {
    cacheKey: "aperture/msdf-text:bgra8unorm:depth24plus:1",
    shaderModule: {},
    pipeline: {
      getBindGroupLayout: (group: number) => ({ group }),
    },
    descriptor: {},
  } as MsdfTextRenderPipelineResource;
}

function matrixPair(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 1, 0, 20, 30, 0, 1,
  ]);
}

function floatUpload(
  upload:
    | {
        readonly data: ArrayBufferLike | ArrayBufferView;
        readonly dataOffset?: number;
        readonly size?: number;
      }
    | undefined,
): Float32Array {
  if (upload === undefined) {
    return new Float32Array(0);
  }

  if (ArrayBuffer.isView(upload.data)) {
    return new Float32Array(
      upload.data.buffer,
      upload.data.byteOffset + (upload.dataOffset ?? 0),
      (upload.size ?? upload.data.byteLength) / 4,
    );
  }

  return new Float32Array(
    upload.data,
    upload.dataOffset ?? 0,
    (upload.size ?? upload.data.byteLength) / 4,
  );
}
