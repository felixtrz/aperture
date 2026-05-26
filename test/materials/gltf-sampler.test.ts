import { describe, expect, it } from "vitest";
import {
  createSamplerAssetFromGltfSampler,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  gltfSamplerMappingReportToJson,
  gltfSamplerMappingReportToJsonValue,
} from "@aperture-engine/render";

describe("glTF sampler mapping", () => {
  it("uses Aperture's documented glTF sampler defaults when sampler data is missing", () => {
    const report = createSamplerAssetFromGltfSampler(undefined);

    expect(report).toMatchObject({
      valid: true,
      diagnostics: [],
      sampler: {
        label: "glTF Sampler",
        addressModeU: "repeat",
        addressModeV: "repeat",
        addressModeW: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      },
    });
  });

  it("maps repeated linear mipmapped sampler fields", () => {
    const report = createSamplerAssetFromGltfSampler({
      name: "BaseColorSampler",
      wrapS: GLTF_SAMPLER_WRAP.REPEAT,
      wrapT: GLTF_SAMPLER_WRAP.REPEAT,
      magFilter: GLTF_SAMPLER_FILTER.LINEAR,
      minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
    });

    expect(report.valid).toBe(true);
    expect(report.sampler).toMatchObject({
      label: "BaseColorSampler",
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });
  });

  it("maps clamp, mirror, nearest, and nearest-mipmap sampler fields", () => {
    const report = createSamplerAssetFromGltfSampler(
      {
        wrapS: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
        wrapT: GLTF_SAMPLER_WRAP.MIRRORED_REPEAT,
        magFilter: GLTF_SAMPLER_FILTER.NEAREST,
        minFilter: GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_NEAREST,
      },
      { label: "NearestDataSampler" },
    );

    expect(report.valid).toBe(true);
    expect(report.sampler).toMatchObject({
      label: "NearestDataSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "mirror-repeat",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    });
  });

  it("splits glTF minification filters into WebGPU min and mipmap filters", () => {
    expect(
      createSamplerAssetFromGltfSampler({
        minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_NEAREST,
      }).sampler,
    ).toMatchObject({
      minFilter: "linear",
      mipmapFilter: "nearest",
    });
    expect(
      createSamplerAssetFromGltfSampler({
        minFilter: GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR,
      }).sampler,
    ).toMatchObject({
      minFilter: "nearest",
      mipmapFilter: "linear",
    });
  });

  it("reports malformed sampler enum values without silently accepting them", () => {
    const report = createSamplerAssetFromGltfSampler({
      wrapS: 123,
      wrapT: "10497",
      magFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
      minFilter: null,
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toEqual([
      {
        code: "gltfSampler.invalidWrapMode",
        field: "wrapS",
        value: 123,
        expected: [
          GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
          GLTF_SAMPLER_WRAP.MIRRORED_REPEAT,
          GLTF_SAMPLER_WRAP.REPEAT,
        ],
        message: "wrapS must be a glTF sampler wrap enum value.",
      },
      {
        code: "gltfSampler.invalidWrapMode",
        field: "wrapT",
        value: "10497",
        expected: [
          GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
          GLTF_SAMPLER_WRAP.MIRRORED_REPEAT,
          GLTF_SAMPLER_WRAP.REPEAT,
        ],
        message: "wrapT must be a glTF sampler wrap enum value.",
      },
      {
        code: "gltfSampler.invalidMagFilter",
        field: "magFilter",
        value: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        expected: [GLTF_SAMPLER_FILTER.NEAREST, GLTF_SAMPLER_FILTER.LINEAR],
        message: "magFilter must be NEAREST or LINEAR.",
      },
      {
        code: "gltfSampler.invalidMinFilter",
        field: "minFilter",
        value: null,
        expected: [
          GLTF_SAMPLER_FILTER.NEAREST,
          GLTF_SAMPLER_FILTER.LINEAR,
          GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_NEAREST,
          GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_NEAREST,
          GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR,
          GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        ],
        message: "minFilter must be a glTF sampler filter enum value.",
      },
    ]);
    expect(report.sampler).toMatchObject({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });
    expect(JSON.parse(gltfSamplerMappingReportToJson(report))).toEqual(
      gltfSamplerMappingReportToJsonValue(report),
    );
  });
});
