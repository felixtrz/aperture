import { describe, expect, it } from "vitest";
import {
  createDebugNormalMaterialAsset,
  createDebugNormalMaterialPreparationPlan,
  createRenderAssetCollections,
  createUnlitMaterialAsset,
} from "@aperture-engine/render";

describe("DebugNormalMaterial preparation metadata", () => {
  it("creates a renderer-independent preparation plan without dependencies", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({
        label: "Normals",
      }),
    );

    const result = createDebugNormalMaterialPreparationPlan({
      registry: assets.registry,
      material,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      materialKey: "material:debug-normal-material-1",
      label: "Normals",
      materialKind: "debug-normal",
      pipelineKey: {
        shaderFamily: "debug-normal",
        features: [],
        alphaMode: "opaque",
      },
      dependencyReadiness: {
        ready: true,
        materialKind: "debug-normal",
        slots: [],
        diagnostics: [],
      },
    });
  });

  it("includes render-state variants in stable pipeline metadata", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({
        label: "Masked Normals",
        renderState: {
          alphaMode: "mask",
          cullMode: "none",
          depth: { test: true, write: true, compare: "less-equal" },
        },
      }),
    );

    const result = createDebugNormalMaterialPreparationPlan({
      registry: assets.registry,
      material,
    });

    expect(result.valid).toBe(true);
    expect(result.plan?.pipelineKey).toMatchObject({
      shaderFamily: "debug-normal",
      features: [],
      alphaMode: "mask",
      cullMode: "none",
      depth: { compare: "less-equal" },
      blend: { preset: "none" },
    });
  });

  it("rejects incompatible render state without creating WebGPU resources", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: true, compare: "less" },
          blend: { preset: "none" },
        },
      }),
    );

    const result = createDebugNormalMaterialPreparationPlan({
      registry: assets.registry,
      material,
    });

    expect(result.valid).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code: "debugNormalPrepare.invalidMaterial",
        materialKey: "material:debug-normal-material-1",
        field: "renderState.depth.write",
      },
      {
        code: "debugNormalPrepare.invalidMaterial",
        materialKey: "material:debug-normal-material-1",
        field: "renderState.blend",
      },
    ]);
  });

  it("rejects non-debug-normal materials", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());

    expect(
      createDebugNormalMaterialPreparationPlan({
        registry: assets.registry,
        material,
      }),
    ).toMatchObject({
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "debugNormalPrepare.unsupportedMaterialKind",
          materialKey: "material:unlit-material-1",
        },
      ],
    });
  });
});
