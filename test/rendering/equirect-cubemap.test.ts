import { describe, expect, it } from "vitest";
import {
  createEquirectangularCubeTextureAsset,
  createTextureAsset,
} from "@aperture-engine/render";

describe("equirectangular cubemap texture assets", () => {
  it("projects equirect face centers into a cube texture asset", () => {
    const source = createTextureAsset({
      label: "Test Panorama",
      dimension: "2d",
      width: 8,
      height: 4,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      sourceData: {
        bytes: gradientBytes(8, 4),
        bytesPerRow: 8 * 4,
        rowsPerImage: 4,
      },
    });

    const cube = createEquirectangularCubeTextureAsset(source, {
      label: "Test Cube",
      faceSize: 1,
    });

    expect(cube).toMatchObject({
      label: "Test Cube",
      dimension: "cube",
      width: 1,
      height: 1,
      depthOrLayers: 6,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      mipLevelCount: 1,
      usage: ["sampled", "copy-dst"],
    });
    expect(cube.sourceData).toMatchObject({
      bytesPerRow: 4,
      rowsPerImage: 1,
    });
    expect(Array.from(cube.sourceData?.bytes ?? [])).toEqual([
      ...rgba(5, 2), // +X
      ...rgba(2, 2), // -X
      ...rgba(4, 3), // +Y
      ...rgba(7, 0), // -Y
      ...rgba(4, 2), // +Z
      ...rgba(0, 2), // -Z
    ]);
  });

  it("rejects unsupported source textures", () => {
    const source = createTextureAsset({
      label: "No Bytes",
      dimension: "2d",
      width: 2,
      height: 1,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "base-color",
    });

    expect(() => createEquirectangularCubeTextureAsset(source)).toThrow(
      /requires texture bytes/,
    );
  });
});

function gradientBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      bytes.set(rgba(x, y), (y * width + x) * 4);
    }
  }

  return bytes;
}

function rgba(x: number, y: number): readonly [number, number, number, number] {
  return [x, y, 0, 255];
}
