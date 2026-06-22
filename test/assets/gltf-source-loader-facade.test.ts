import { describe, expect, it } from "vitest";

import { createNoFetchGltfSourceLoaderReport } from "@aperture-engine/render";

describe("no-fetch glTF source-loader facade", () => {
  it("reuses provided decoded image bytes for glTF texture source data", () => {
    const decoded = decodedImage();

    const report = createNoFetchGltfSourceLoaderReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        images: [{ uri: "data:image/png,%01%02%03%04" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      },
      createAssetMapping: true,
      decodedImageData: new Map([[0, decoded]]),
    });

    const sourceData =
      report.gltfImportReport.assetMapping?.textures[0]?.texture?.sourceData;
    expect(report.gltfImportReport.valid).toBe(true);
    expect(sourceData?.bytes).toBe(decoded.sourceData.bytes);
  });
});

function decodedImage() {
  return {
    width: 1,
    height: 1,
    sourceData: {
      bytes: new Uint8Array([255, 0, 0, 255]),
      bytesPerRow: 4,
      rowsPerImage: 1,
    },
  };
}
