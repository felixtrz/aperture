import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createFontAtlasHandle,
  createMsdfFontAtlasAsset,
  createPackedSnapshotViewUniformsScratch,
  createSamplerAsset,
  createSamplerHandle,
  createTextureAsset,
  createTextureHandle,
  createWebGpuAppResourceCache,
  prepareUiFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("UI app frame resources", () => {
  it("packs panel, image, and MSDF text UI nodes into stack-ordered overlay commands", async () => {
    const imageTexture = createTextureHandle("ui-image");
    const fontTexture = createTextureHandle("ui-font-page");
    const sampler = createSamplerHandle("ui-linear");
    const font = createFontAtlasHandle("ui-font");
    const assets = new AssetRegistry();
    const writes: {
      readonly label: string;
      readonly data: ArrayBufferLike | ArrayBufferView;
      readonly dataOffset?: number;
      readonly size?: number;
    }[] = [];
    const device = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: () => ({
        getBindGroupLayout: (group: number) => ({ group }),
      }),
      createBuffer: (descriptor: { readonly label?: string }) => ({
        label: descriptor.label ?? "buffer",
        descriptor,
      }),
      createBindGroup: (descriptor: unknown) => ({ descriptor }),
      createTexture: () => ({ createView: () => ({ label: "view" }) }),
      createSampler: () => ({ label: "sampler" }),
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
    const snapshot = createUiSnapshot(imageTexture, sampler, font);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    registerTexture(assets, imageTexture, "ui-image", "srgb", "base-color");
    registerTexture(assets, fontTexture, "ui-font-page", "data", "data");
    assets.register(sampler);
    assets.markReady(
      sampler,
      createSamplerAsset({
        label: "ui-linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      }),
    );
    assets.register(font);
    assets.markReady(
      font,
      createMsdfFontAtlasAsset({
        source: fixtureFont(),
        pages: [fontTexture],
        sampler,
      }),
    );

    const result = await prepareUiFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot,
      viewUniforms,
      reuse: {
        textureResourcesCreated: 0,
        textureResourcesReused: 0,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 0,
      } as never,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.commands.map((command) => command.renderId)).toEqual([
      10, 10, 10, 10, 20, 20, 20, 20, 480, 480, 480, 480, 480,
    ]);
    expect(
      result.commands.filter((command) => command.kind === "draw"),
    ).toEqual([
      expect.objectContaining({
        renderId: 10,
        firstInstance: 0,
        instanceCount: 1,
      }),
      expect.objectContaining({
        renderId: 20,
        firstInstance: 0,
        instanceCount: 1,
      }),
      expect.objectContaining({
        renderId: 480,
        firstInstance: 0,
        instanceCount: 1,
      }),
    ]);

    const panelData = floatUpload(
      writes.find((write) => write.label === "UI/PanelData"),
    );
    const imageData = floatUpload(
      writes.find((write) => write.label === "UI/ImageData"),
    );
    const glyphData = floatUpload(
      writes.find((write) => write.label === "UI/TextGlyphData"),
    );

    expect(Array.from(panelData.slice(0, 16))).toEqual([
      1, 0, 0, 0.5, 8, 10, 100, 40, 0, 0, 1, 1, 8, 10, 50, 30,
    ]);
    expect(Array.from(imageData.slice(4, 16))).toEqual([
      40, 24, 20, 20, 0.25, 0.25, 0.5, 0.5, 40, 24, 20, 20,
    ]);
    expect(Array.from(glyphData.slice(20, 24))).toEqual([64, 40, 80, 30]);
  });
});

function createUiSnapshot(
  imageTexture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle>,
  font: ReturnType<typeof createFontAtlasHandle>,
): RenderSnapshot {
  return {
    frame: 2,
    views: [
      {
        viewId: 1,
        camera: { index: 1, generation: 1 },
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
    uiNodes: [
      {
        uiId: 10,
        screenId: 1,
        entity: { index: 10, generation: 1 },
        parentUiId: 1,
        kind: "panel",
        rect: { x: 8, y: 10, width: 100, height: 40 },
        clip: { x: 8, y: 10, width: 50, height: 30 },
        layoutMode: "absolute",
        stackIndex: 1,
        zIndex: 0,
        layerMask: 1,
        opacity: 0.5,
        clipsChildren: true,
        scrollOffset: [0, 0],
        color: [1, 0, 0, 1],
      },
      {
        uiId: 20,
        screenId: 1,
        entity: { index: 20, generation: 1 },
        parentUiId: 1,
        kind: "image",
        rect: { x: 40, y: 24, width: 20, height: 20 },
        clip: { x: 40, y: 24, width: 20, height: 20 },
        layoutMode: "absolute",
        stackIndex: 2,
        zIndex: 0,
        layerMask: 1,
        opacity: 1,
        clipsChildren: false,
        scrollOffset: [0, 0],
        texture: imageTexture,
        sampler,
        color: [1, 1, 1, 1],
        uvRect: [0.25, 0.25, 0.5, 0.5],
      },
      {
        uiId: 30,
        screenId: 1,
        entity: { index: 30, generation: 1 },
        parentUiId: 1,
        kind: "text",
        rect: { x: 64, y: 40, width: 80, height: 30 },
        clip: { x: 64, y: 40, width: 80, height: 30 },
        layoutMode: "absolute",
        stackIndex: 3,
        zIndex: 0,
        layerMask: 1,
        opacity: 1,
        clipsChildren: false,
        scrollOffset: [0, 0],
        text: "A",
        fontAtlasId: `${font.kind}:${font.id}`,
        fontSize: 20,
        color: [0, 1, 1, 1],
        textAlign: "left",
        glyphCount: 1,
      },
    ],
    uiHitRegions: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: matrixPair(),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      uiNodes: 3,
      uiHitRegions: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function registerTexture(
  assets: AssetRegistry,
  texture: ReturnType<typeof createTextureHandle>,
  label: string,
  colorSpace: "srgb" | "data",
  semantic: "base-color" | "data",
): void {
  assets.register(texture);
  assets.markReady(
    texture,
    createTextureAsset({
      label,
      dimension: "2d",
      width: 4,
      height: 4,
      format: colorSpace === "srgb" ? "rgba8unorm-srgb" : "rgba8unorm",
      colorSpace,
      semantic,
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array(4 * 4 * 4).fill(255),
        bytesPerRow: 16,
      },
    }),
  );
}

function fixtureFont() {
  return {
    pages: ["page.png"],
    info: { size: 20 },
    common: {
      lineHeight: 24,
      base: 18,
      scaleW: 64,
      scaleH: 64,
      pages: 1,
    },
    distanceField: { distanceRange: 4 },
    chars: [
      {
        id: 65,
        char: "A",
        x: 0,
        y: 0,
        width: 16,
        height: 20,
        xoffset: 1,
        yoffset: 2,
        xadvance: 18,
        page: 0,
      },
      {
        id: 32,
        char: " ",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        xoffset: 0,
        yoffset: 0,
        xadvance: 6,
        page: 0,
      },
    ],
    kernings: [],
  };
}

function matrixPair(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 1,
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
