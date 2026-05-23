import { describe, expect, it } from "vitest";

import {
  Camera,
  Material,
  Mesh,
  RenderLayer,
  Visibility,
  WorldTransform,
  assetHandleKey,
  createBoxMeshAsset,
  createCamera,
  createRenderAssetCollections,
  createRootTransform,
  createStandardMaterialAsset,
  createTextureHandle,
  createUnlitMaterialAsset,
  createWorld,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  registerTransformComponents,
  validateStandardMaterialProofPoint,
} from "@aperture-engine/core";

describe("StandardMaterial proof-point contract", () => {
  it("accepts the direct-lit scalar proof-point fields", () => {
    const material = createStandardMaterialAsset({
      label: "Proof Standard",
      baseColorFactor: new Float32Array([0.8, 0.7, 0.6, 1]),
      metallicFactor: 0.25,
      roughnessFactor: 0.6,
      clearcoatFactor: 0.75,
      clearcoatRoughnessFactor: 0.12,
      transmissionFactor: 0.7,
      sheenColorFactor: [0.8, 0.35, 0.12],
      sheenRoughnessFactor: 0.4,
      iridescenceFactor: 0.9,
      iridescenceIor: 1.35,
      iridescenceThicknessMinimum: 140,
      iridescenceThicknessMaximum: 540,
      emissiveFactor: [0.05, 0.04, 0.03],
    });

    const report = validateStandardMaterialProofPoint(material);

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.supportedFeatures).toContain("baseColorTexture");
    expect(report.supportedFeatures).toContain("metallicRoughnessTexture");
    expect(report.supportedFeatures).toContain("normalTexture");
    expect(report.supportedFeatures).toContain("occlusionTexture");
    expect(report.supportedFeatures).toContain("emissiveTexture");
    expect(report.supportedFeatures).toContain("clearcoatFactor");
    expect(report.supportedFeatures).toContain("clearcoatRoughnessFactor");
    expect(report.supportedFeatures).toContain("transmissionFactor");
    expect(report.supportedFeatures).toContain("sheenColorFactor");
    expect(report.supportedFeatures).toContain("sheenRoughnessFactor");
    expect(report.supportedFeatures).toContain("iridescenceFactor");
    expect(report.supportedFeatures).toContain("iridescenceIor");
    expect(report.supportedFeatures).toContain("iridescenceThicknessRange");
    expect(report.supportedFeatures).toContain("directionalLight");
    expect(report.deferredFeatures).toContain("imageBasedLighting");
    expect(report.deferredFeatures).not.toContain("clearcoat");
  });

  it("distinguishes supported base-color texture fields from invalid scalar inputs", () => {
    const material = createStandardMaterialAsset({
      metallicFactor: 1.4,
      baseColorTexture: {
        texture: createTextureHandle("albedo"),
        sampler: null,
      },
      unsupportedFeatures: ["custom-shader"],
    });

    const report = validateStandardMaterialProofPoint(material);

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toEqual([
      {
        code: "standardMaterial.invalidFactor",
        field: "metallicFactor",
        severity: "error",
        message: "metallicFactor must be a finite value between 0 and 1.",
      },
      {
        code: "standardMaterial.unsupportedFeature",
        field: "custom-shader",
        severity: "error",
        message:
          "StandardMaterial proof point does not support 'custom-shader'.",
      },
    ]);
  });

  it("extracts standard material draw metadata without WebGPU handles", () => {
    const world = createWorld({ entityCapacity: 8 });
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Proof Standard" }),
    );

    registerTransformComponents(world);
    registerRenderAuthoringComponents(world);

    const camera = world.createEntity();
    const cameraTransform = createRootTransform({ translation: [0, 0, 5] });

    camera.addComponent(WorldTransform, cameraTransform.world);
    camera.addComponent(Camera, createCamera({ layerMask: 1 }));

    const cube = world.createEntity();
    const cubeTransform = createRootTransform();

    cube.addComponent(WorldTransform, cubeTransform.world);
    cube.addComponent(Mesh, { meshId: assetHandleKey(mesh) });
    cube.addComponent(Material, { materialId: assetHandleKey(material) });
    cube.addComponent(RenderLayer, { mask: 1 });
    cube.addComponent(Visibility);

    const snapshot = extractRenderSnapshot(world, assets.registry, {
      frame: 3,
    });

    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.meshDraws[0]?.material.kind).toBe("material");
    expect(snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|opaque|back|less|none",
    );
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("keeps mixed unlit and standard material draw keys deterministic", () => {
    const world = createWorld({ entityCapacity: 8 });
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const unlit = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Flat" }),
    );
    const standard = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Proof Standard" }),
    );

    registerTransformComponents(world);
    registerRenderAuthoringComponents(world);

    const camera = world.createEntity();
    const cameraTransform = createRootTransform({ translation: [0, 0, 5] });

    camera.addComponent(WorldTransform, cameraTransform.world);
    camera.addComponent(Camera, createCamera({ layerMask: 1 }));

    for (const material of [standard, unlit]) {
      const cube = world.createEntity();
      const cubeTransform = createRootTransform();

      cube.addComponent(WorldTransform, cubeTransform.world);
      cube.addComponent(Mesh, { meshId: assetHandleKey(mesh) });
      cube.addComponent(Material, { materialId: assetHandleKey(material) });
      cube.addComponent(RenderLayer, { mask: 1 });
      cube.addComponent(Visibility);
    }

    const snapshot = extractRenderSnapshot(world, assets.registry, {
      frame: 4,
    });

    expect(snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey)).toEqual(
      ["standard|opaque|back|less|none", "unlit|opaque|back|less|none"],
    );
    expect(
      snapshot.meshDraws.map((draw) => assetHandleKey(draw.material)),
    ).toEqual([assetHandleKey(standard), assetHandleKey(unlit)]);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
