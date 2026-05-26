import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  createStandardMaterialAsset,
  createStandardMaterialSamplerFidelityReport,
  createTextureAsset,
  standardMaterialSamplerFidelityReportToJsonValue,
} from "@aperture-engine/render";

describe("StandardMaterial sampler fidelity report", () => {
  it("warns when mip filtering and LOD exceed a single-mip texture", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("base-color");
    const sampler = createSamplerHandle("mip-linear");
    const material = createMaterialHandle("standard");

    registry.register(texture);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "Base Color",
        dimension: "2d",
        width: 4,
        height: 4,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
        mipLevelCount: 1,
        usage: ["sampled"],
      }),
    );
    registry.register(sampler);
    registry.markReady(
      sampler,
      createSamplerAsset({
        label: "Mip Linear",
        mipmapFilter: "linear",
        lodMaxClamp: 32,
      }),
    );
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const report = createStandardMaterialSamplerFidelityReport({
      registry,
      material,
    });

    expect(report.ready).toBe(true);
    expect(report.slots).toEqual([
      expect.objectContaining({
        field: "baseColorTexture",
        textureKey: "texture:base-color",
        samplerKey: "sampler:mip-linear",
        mipLevelCount: 1,
        mipmapFilter: "linear",
        lodMaxClamp: 32,
        warningCount: 2,
      }),
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialSampler.mipmapFilterWithoutMips",
      "standardMaterialSampler.lodMaxExceedsMipRange",
    ]);
    expect(report.diagnostics[1]).toMatchObject({
      lodMaxClamp: 32,
      maxSupportedLod: 0,
    });
  });

  it("warns when anisotropy is authored for StandardMaterial sampling", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("normal");
    const sampler = createSamplerHandle("anisotropic");
    const material = createMaterialHandle("standard");

    registry.register(texture);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "Normal",
        dimension: "2d",
        width: 8,
        height: 8,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "normal",
        mipLevelCount: 4,
        usage: ["sampled"],
      }),
    );
    registry.register(sampler);
    registry.markReady(
      sampler,
      createSamplerAsset({
        label: "Anisotropic",
        mipmapFilter: "linear",
        lodMaxClamp: 3,
        maxAnisotropy: 8,
      }),
    );
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        normalTexture: { texture, sampler },
      }),
    );

    const report = createStandardMaterialSamplerFidelityReport({
      registry,
      material,
    });
    const json = standardMaterialSamplerFidelityReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.diagnostics).toEqual([
      expect.objectContaining({
        code: "standardMaterialSampler.anisotropyNotReported",
        textureKey: "texture:normal",
        samplerKey: "sampler:anisotropic",
        maxAnisotropy: 8,
      }),
    ]);
    expect(JSON.stringify(json)).not.toContain("sourceData");
    expect(JSON.stringify(json)).not.toContain("GPU");
  });

  it("reports source readiness failures without exposing source payloads", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("loading-base-color");
    const sampler = createSamplerHandle("ready-sampler");
    const material = createMaterialHandle("standard");

    registry.register(texture);
    registry.markLoading(texture);
    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset());
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const report = createStandardMaterialSamplerFidelityReport({
      registry,
      material,
    });

    expect(report).toMatchObject({
      ready: true,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialSampler.textureNotReady",
          severity: "warning",
          textureKey: "texture:loading-base-color",
          samplerKey: "sampler:ready-sampler",
          status: "loading",
        },
      ],
    });
    expect(
      JSON.stringify(standardMaterialSamplerFidelityReportToJsonValue(report)),
    ).not.toContain("bytes");
  });
});
