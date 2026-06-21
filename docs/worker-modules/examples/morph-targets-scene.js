// Shared morph-target scene registration for the M2-T7 #3 proof route. Both the
// simulation worker (world/extraction) and the main thread (render source
// assets) register the same mesh + standard material so the renderer can
// resolve the morphed draw's dependencies.
export const clearColor = [0.02, 0.03, 0.05, 1];
export const morphReadbackSamples = [{ id: "center", x: 0.5, y: 0.5 }];
export const MORPH_TARGET_COUNT = 3;

export function morphTargetBoxMesh(aperture) {
  const baseMesh = aperture.createBoxMeshAsset({
    label: "MorphTargetBox",
    width: 1.1,
    height: 1.1,
    depth: 1.1,
  });
  const vertexCount = baseMesh.vertexStreams[0].vertexCount;
  const positionDeltas = new Float32Array(MORPH_TARGET_COUNT * vertexCount * 3);
  const normalDeltas = new Float32Array(MORPH_TARGET_COUNT * vertexCount * 3);
  // Targets 0 and 1 are zero; target 2 translates every vertex far along +X.
  for (let v = 0; v < vertexCount; v += 1) {
    positionDeltas[(2 * vertexCount + v) * 3] = 4;
  }
  return {
    ...baseMesh,
    morphTargetData: {
      targetCount: MORPH_TARGET_COUNT,
      vertexCount,
      hasNormals: false,
      positionDeltas,
      normalDeltas,
    },
  };
}

export function registerMorphTargetScene(aperture, registry) {
  const collections = aperture.createRenderAssetCollections({ registry });
  const mesh = collections.meshes.add(morphTargetBoxMesh(aperture), {
    id: "morph-target-box",
  });
  const material = collections.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "MorphTargetStandard",
      baseColorFactor: new Float32Array([1, 0.6, 0.2, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
      emissiveFactor: [0.9, 0.55, 0.2],
    }),
    { id: "morph-target-standard" },
  );

  return {
    mesh,
    material,
    targetCount: MORPH_TARGET_COUNT,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
  };
}
