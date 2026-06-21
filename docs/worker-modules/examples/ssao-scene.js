export function registerSsaoScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const floorMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "SsaoFloorPlane",
      width: 4.8,
      height: 4.8,
    }),
    { id: "ssao-floor-plane" },
  );
  const wallMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "SsaoWallPlane",
      width: 4.8,
      height: 2.8,
    }),
    { id: "ssao-wall-plane" },
  );
  const cubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SsaoContactCube",
      width: 0.78,
      height: 0.78,
      depth: 0.78,
    }),
    { id: "ssao-contact-cube" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoWarmFloor",
      baseColorFactor: new Float32Array([0.76, 0.72, 0.64, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.9,
    }),
    { id: "ssao-warm-floor" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoCoolWall",
      baseColorFactor: new Float32Array([0.62, 0.68, 0.76, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.86,
    }),
    { id: "ssao-cool-wall" },
  );
  const cubeMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoMatteCube",
      baseColorFactor: new Float32Array([0.82, 0.52, 0.34, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "ssao-matte-cube" },
  );

  return {
    floorMesh,
    wallMesh,
    cubeMesh,
    floorMaterial,
    wallMaterial,
    cubeMaterial,
    meshKeys: [
      aperture.assetHandleKey(floorMesh),
      aperture.assetHandleKey(wallMesh),
      aperture.assetHandleKey(cubeMesh),
    ],
    materialKeys: [
      aperture.assetHandleKey(floorMaterial),
      aperture.assetHandleKey(wallMaterial),
      aperture.assetHandleKey(cubeMaterial),
    ],
  };
}
