const shadowAssetConfigs = {
  point: {
    prefix: "PointShadow",
    idPrefix: "point-shadow",
  },
  spot: {
    prefix: "SpotShadow",
    idPrefix: "spot-shadow",
  },
};

export function registerSingleLightShadowAssets(aperture, registry, kind) {
  const config = shadowAssetConfigs[kind];

  if (config === undefined) {
    throw new Error(`Unsupported single-light shadow kind: ${kind}`);
  }

  const assets = aperture.createRenderAssetCollections({ registry });
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: `${config.prefix}ReceiverWall`,
      width: 4.2,
      height: 2.6,
      depth: 0.06,
    }),
    { id: `${config.idPrefix}-wall` },
  );
  const cubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: `${config.prefix}CasterCube`,
      width: 0.9,
      height: 0.9,
      depth: 0.9,
    }),
    { id: `${config.idPrefix}-cube` },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: `${config.prefix}ReceiverStandard`,
      baseColorFactor: new Float32Array([0.9, 0.94, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.74,
      emissiveFactor: [0, 0, 0],
    }),
    { id: `${config.idPrefix}-wall-standard` },
  );
  const cubeMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: `${config.prefix}CasterStandard`,
      baseColorFactor: new Float32Array([1.0, 0.54, 0.24, 1]),
      metallicFactor: 0.12,
      roughnessFactor: 0.42,
      emissiveFactor: [0, 0, 0],
    }),
    { id: `${config.idPrefix}-cube-standard` },
  );

  return {
    wallMesh,
    cubeMesh,
    wallMaterial,
    cubeMaterial,
    wallMeshKey: aperture.assetHandleKey(wallMesh),
    cubeMeshKey: aperture.assetHandleKey(cubeMesh),
    wallMaterialKey: aperture.assetHandleKey(wallMaterial),
    cubeMaterialKey: aperture.assetHandleKey(cubeMaterial),
  };
}
