import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { systemAssetReadyMetadata } from "@aperture-engine/app/systems";
import type { Ktx2BasisTranscodeOptions } from "@aperture-engine/render";

describe("app glTF asset decoder providers", () => {
  it("threads KTX2 decoder providers through blocking app GLB preload with rgba32 fallback", async () => {
    const glbBytes = await readFile("examples/assets/basis-ktx2-texture.glb");
    const glbDataUrl = `data:model/gltf-binary;base64,${glbBytes.toString(
      "base64",
    )}`;
    let createBasisTranscoderCalls = 0;
    let decodeOptions: Ktx2BasisTranscodeOptions | undefined;
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        assets: {
          model: asset.gltf(glbDataUrl, { preload: "blocking" }),
        },
      }),
      gltfAssetDecoders: {
        createBasisKtx2Transcoder: () => {
          createBasisTranscoderCalls += 1;
          return Promise.resolve({
            decode(_source, options = {}) {
              decodeOptions = options;

              return {
                width: 40,
                height: 40,
                format: "rgba8unorm-srgb",
                sourceData: {
                  bytes: new Uint8Array(40 * 40 * 4),
                  bytesPerRow: 40 * 4,
                  rowsPerImage: 40,
                },
              };
            },
          });
        },
        ktx2TextureCompression: {},
      },
    });
    const model = app.context.assets.gltf("model");
    const texture =
      model.scene.value?.importReport.assetMapping?.textures[0] ?? null;
    const metadata = systemAssetReadyMetadata(model);

    expect(model.ready.value).toBe(true);
    expect(createBasisTranscoderCalls).toBe(1);
    expect(decodeOptions).toMatchObject({ textureCompression: {} });
    expect(texture?.texture).toMatchObject({
      format: "rgba8unorm-srgb",
      width: 40,
      height: 40,
      sourceData: {
        bytesPerRow: 160,
        rowsPerImage: 40,
      },
    });
    expect(metadata).toMatchObject({
      textures: [
        expect.objectContaining({
          format: "rgba8unorm-srgb",
          width: 40,
          height: 40,
          mipLevelCount: 1,
          sourceData: expect.objectContaining({
            byteLength: 6400,
            bytesPerRow: 160,
            rowsPerImage: 40,
            mipLevelCount: 1,
            mipLevels: null,
          }),
        }),
      ],
    });
  });
});
