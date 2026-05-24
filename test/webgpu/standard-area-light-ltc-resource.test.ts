import { describe, expect, it } from "vitest";

import {
  STANDARD_AREA_LIGHT_LTC_BYTES_PER_TEXEL,
  STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY,
  STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY,
  STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH,
  STANDARD_AREA_LIGHT_LTC_SIZE,
  STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
  createStandardAreaLightLtcFresnelData,
  createStandardAreaLightLtcMatrixData,
  createStandardAreaLightLtcResources,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu";

describe("standard area-light LTC resources", () => {
  it("decodes production half-float matrix and fresnel payloads", () => {
    const matrix = createStandardAreaLightLtcMatrixData();
    const fresnel = createStandardAreaLightLtcFresnelData();

    expect(matrix.byteLength).toBe(STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH);
    expect(fresnel.byteLength).toBe(
      STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH,
    );
    expect(readHalfFloat(matrix, 0)).toBeCloseTo(1, 3);
    expect(readHalfFloat(matrix, 1)).toBeCloseTo(0, 5);
    expect(readHalfFloat(matrix, 2)).toBeCloseTo(0, 5);
    expect(readHalfFloat(matrix, 3)).toBeGreaterThan(0);
    expect(readHalfFloat(matrix, 3)).toBeLessThan(0.001);
    expect(readHalfFloat(matrix, 63 * 4 + 3)).toBeGreaterThan(1.1);
    expect(readHalfFloat(fresnel, 0)).toBeCloseTo(1, 3);
    expect(readHalfFloat(fresnel, 1)).toBeCloseTo(0, 5);
    expect(readHalfFloat(fresnel, 63 * 4)).toBeGreaterThan(0.3);
    expect(readHalfFloat(fresnel, 63 * 4 + 1)).toBeGreaterThan(0.00001);
    expect(readHalfFloat(fresnel, 63 * 4 + 1)).toBeLessThan(0.001);
    expect(Array.from(matrix.slice(0, 8))).toEqual([0, 60, 0, 0, 0, 0, 79, 1]);
  });

  it("uploads renderer-owned RGBA16F production LUT textures", () => {
    const created: unknown[] = [];
    const uploads: {
      readonly resourceKey: string;
      readonly byteLength: number;
      readonly layout: unknown;
      readonly size: unknown;
    }[] = [];
    let activeResourceKey = "";
    const device: TextureGpuDeviceLike = {
      createTexture: (descriptor) => {
        created.push(descriptor);
        activeResourceKey =
          typeof descriptor === "object" &&
          descriptor !== null &&
          "label" in descriptor
            ? String(descriptor.label)
            : "";
        return {
          createView: () => ({ label: `${activeResourceKey}:view` }),
        };
      },
      createSampler: (descriptor) => ({ descriptor }),
      queue: {
        writeTexture: (_destination, data, layout, size) => {
          uploads.push({
            resourceKey: activeResourceKey,
            byteLength: data.byteLength,
            layout,
            size,
          });
        },
      },
    };

    const result = createStandardAreaLightLtcResources({ device });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.createdTextureCount).toBe(2);
    expect(result.createdSamplerCount).toBe(1);
    expect(result.resources?.matrixTexture.descriptor).toMatchObject({
      size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
      format: STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
      colorSpace: "linear",
      semantic: "data",
    });
    expect(result.resources?.fresnelTexture.descriptor).toMatchObject({
      size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
      format: STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
      colorSpace: "linear",
      semantic: "data",
    });
    expect(created).toEqual([
      expect.objectContaining({
        label: STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY,
        size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
        format: STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
      }),
      expect.objectContaining({
        label: STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY,
        size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
        format: STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
      }),
    ]);
    expect(uploads).toEqual([
      {
        resourceKey: STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY,
        byteLength: STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH,
        layout: {
          bytesPerRow:
            STANDARD_AREA_LIGHT_LTC_SIZE *
            STANDARD_AREA_LIGHT_LTC_BYTES_PER_TEXEL,
          rowsPerImage: STANDARD_AREA_LIGHT_LTC_SIZE,
        },
        size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
      },
      {
        resourceKey: STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY,
        byteLength: STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH,
        layout: {
          bytesPerRow:
            STANDARD_AREA_LIGHT_LTC_SIZE *
            STANDARD_AREA_LIGHT_LTC_BYTES_PER_TEXEL,
          rowsPerImage: STANDARD_AREA_LIGHT_LTC_SIZE,
        },
        size: [STANDARD_AREA_LIGHT_LTC_SIZE, STANDARD_AREA_LIGHT_LTC_SIZE, 1],
      },
    ]);
  });
});

function readHalfFloat(bytes: Uint8Array, componentIndex: number): number {
  const offset = componentIndex * 2;
  const bits = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
  const sign = (bits & 0x8000) === 0 ? 1 : -1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;

  if (exponent === 0) {
    return sign * 2 ** -14 * (fraction / 1024);
  }

  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : Number.NaN;
  }

  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}
