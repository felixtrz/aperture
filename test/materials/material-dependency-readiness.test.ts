import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createMaterialDependencyReadinessReport,
  createMatcapMaterialAsset,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  materialDependencyReadinessReportToJson,
  materialDependencyReadinessReportToJsonValue,
} from "@aperture-engine/render";

describe("material dependency readiness reports", () => {
  it("reports ready unlit texture and sampler dependencies", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("textured");
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, {});
    registry.markReady(sampler, {});
    registry.register(material);
    registry.markReady(
      material,
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    expect(
      createMaterialDependencyReadinessReport({ registry, material }),
    ).toMatchObject({
      ready: true,
      materialKey: "material:textured",
      materialStatus: "ready",
      slots: [
        {
          field: "baseColorTexture",
          dependencyKind: "texture",
          handleKey: "texture:albedo",
          status: "ready",
        },
        {
          field: "baseColorTexture",
          dependencyKind: "sampler",
          handleKey: "sampler:linear",
          status: "ready",
        },
      ],
      diagnostics: [],
    });
  });

  it("distinguishes missing, loading, and failed standard material dependencies", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const loadingTexture = createTextureHandle("loading");
    const failedSampler = createSamplerHandle("failed");
    const missingTexture = createTextureHandle("missing");
    const readySampler = createSamplerHandle("ready");

    registry.register(loadingTexture);
    registry.markLoading(loadingTexture);
    registry.register(failedSampler);
    registry.markFailed(failedSampler, [
      {
        code: "sampler.invalid",
        message: "sampler failed validation",
        severity: "error",
      },
    ]);
    registry.register(readySampler);
    registry.markReady(readySampler, {});
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture: loadingTexture,
          sampler: failedSampler,
        },
        normalTexture: {
          texture: missingTexture,
          sampler: readySampler,
        },
      }),
    );

    const report = createMaterialDependencyReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(false);
    expect(report.slots).toMatchObject([
      {
        field: "baseColorTexture",
        dependencyKind: "texture",
        status: "loading",
      },
      {
        field: "baseColorTexture",
        dependencyKind: "sampler",
        status: "failed",
      },
      {
        field: "normalTexture",
        dependencyKind: "texture",
        status: "missing",
      },
      {
        field: "normalTexture",
        dependencyKind: "sampler",
        status: "ready",
      },
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "materialDependency.dependencyLoading",
      "materialDependency.dependencyFailed",
      "materialDependency.dependencyMissing",
    ]);
    expect(report.diagnostics).toMatchObject([
      {
        field: "baseColorTexture",
        dependencyKind: "texture",
        dependencyKey: "texture:loading",
        textureKey: "texture:loading",
        samplerKey: "sampler:failed",
      },
      {
        field: "baseColorTexture",
        dependencyKind: "sampler",
        dependencyKey: "sampler:failed",
        textureKey: "texture:loading",
        samplerKey: "sampler:failed",
      },
      {
        field: "normalTexture",
        dependencyKind: "texture",
        dependencyKey: "texture:missing",
        textureKey: "texture:missing",
        samplerKey: "sampler:ready",
      },
    ]);
  });

  it("reports missing matcap texture and sampler handles", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("matcap");

    registry.register(material);
    registry.markReady(material, createMatcapMaterialAsset());

    const report = createMaterialDependencyReadinessReport({
      registry,
      material,
    });

    expect(report.ready).toBe(false);
    expect(report.slots).toMatchObject([
      {
        field: "matcapTexture",
        dependencyKind: "texture",
        handleKey: null,
        status: "missing",
      },
      {
        field: "matcapTexture",
        dependencyKind: "sampler",
        handleKey: null,
        status: "missing",
      },
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "materialDependency.missingTextureHandle",
      "materialDependency.missingSamplerHandle",
    ]);
  });

  it("reports a material handle that is not ready", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("pending");

    registry.register(material);
    registry.markLoading(material);

    expect(
      createMaterialDependencyReadinessReport({ registry, material }),
    ).toMatchObject({
      ready: false,
      materialKey: "material:pending",
      materialStatus: "loading",
      diagnostics: [
        {
          code: "materialDependency.materialNotReady",
          status: "loading",
        },
      ],
    });
  });

  it("serializes readiness reports as stable JSON-safe values", () => {
    const registry = new AssetRegistry();
    const material = createMaterialHandle("standard");
    const missingTexture = createTextureHandle("missing");
    const loadingSampler = createSamplerHandle("loading");

    registry.register(loadingSampler);
    registry.markLoading(loadingSampler);
    registry.register(material);
    registry.markReady(
      material,
      createStandardMaterialAsset({
        baseColorTexture: {
          texture: missingTexture,
          sampler: loadingSampler,
        },
      }),
    );

    const report = createMaterialDependencyReadinessReport({
      registry,
      material,
    });
    const value = materialDependencyReadinessReportToJsonValue(report);
    const json = materialDependencyReadinessReportToJson(report);

    expect(value).toMatchObject({
      ready: false,
      materialKey: "material:standard",
      materialStatus: "ready",
      materialKind: "standard",
      slots: [
        {
          field: "baseColorTexture",
          dependencyKind: "texture",
          handleKey: "texture:missing",
          status: "missing",
        },
        {
          field: "baseColorTexture",
          dependencyKind: "sampler",
          handleKey: "sampler:loading",
          status: "loading",
        },
      ],
      diagnostics: [
        {
          code: "materialDependency.dependencyMissing",
          dependencyKey: "texture:missing",
          textureKey: "texture:missing",
          samplerKey: "sampler:loading",
        },
        {
          code: "materialDependency.dependencyLoading",
          dependencyKey: "sampler:loading",
          textureKey: "texture:missing",
          samplerKey: "sampler:loading",
        },
      ],
    });
    expect(value.dependencies).toEqual(value.slots);
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(materialDependencyReadinessReportToJson(report));
    expect(json).not.toContain('"texture":{"');
    expect(json).not.toContain('"sampler":{"');
  });
});
