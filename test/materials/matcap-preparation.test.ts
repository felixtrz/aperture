import { describe, expect, it } from "vitest";

import {
  createMatcapMaterialAsset,
  createMatcapMaterialPreparationPlan,
  createRenderAssetCollections,
  createSamplerHandle,
  createTextureHandle,
  createUnlitMaterialAsset,
} from "@aperture-engine/core";

describe("matcap material preparation metadata", () => {
  it("creates a renderer-independent preparation plan for ready matcap dependencies", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("studio-matcap");
    const sampler = createSamplerHandle("studio-linear");

    assets.registry.register(texture);
    assets.registry.register(sampler);
    assets.registry.markReady(texture, {});
    assets.registry.markReady(sampler, {});

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Studio Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    const result = createMatcapMaterialPreparationPlan({
      registry: assets.registry,
      material,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      materialKey: "material:matcap-material-1",
      label: "Studio Matcap",
      materialKind: "matcap",
      matcapTexture: {
        textureKey: "texture:studio-matcap",
        samplerKey: "sampler:studio-linear",
      },
      pipelineKey: {
        shaderFamily: "matcap",
        features: ["matcapTexture"],
      },
      dependencyReadiness: {
        ready: true,
        materialKind: "matcap",
        slots: [
          {
            field: "matcapTexture",
            dependencyKind: "texture",
            handleKey: "texture:studio-matcap",
            status: "ready",
          },
          {
            field: "matcapTexture",
            dependencyKind: "sampler",
            handleKey: "sampler:studio-linear",
            status: "ready",
          },
        ],
      },
    });
  });

  it("reports blocked matcap texture and sampler dependencies", () => {
    const assets = createRenderAssetCollections();
    const missingTexture = createTextureHandle("missing-matcap");
    const loadingSampler = createSamplerHandle("loading-sampler");

    assets.registry.register(loadingSampler);
    assets.registry.markLoading(loadingSampler);

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        matcapTexture: {
          texture: missingTexture,
          sampler: loadingSampler,
        },
      }),
    );

    const result = createMatcapMaterialPreparationPlan({
      registry: assets.registry,
      material,
    });

    expect(result.valid).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code: "materialDependency.dependencyMissing",
        field: "matcapTexture",
        dependencyKind: "texture",
        dependencyKey: "texture:missing-matcap",
      },
      {
        code: "materialDependency.dependencyLoading",
        field: "matcapTexture",
        dependencyKind: "sampler",
        dependencyKey: "sampler:loading-sampler",
      },
    ]);
  });

  it("rejects non-matcap materials without creating WebGPU resources", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());

    expect(
      createMatcapMaterialPreparationPlan({
        registry: assets.registry,
        material,
      }),
    ).toMatchObject({
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "matcapPrepare.unsupportedMaterialKind",
          materialKey: "material:unlit-material-1",
        },
      ],
    });
  });
});
