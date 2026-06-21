// Scene for the M5-T6 proof (examples/ssao-indirect). Mirrors examples/ssao-scene
// (floor + wall + contact cube in a corner that produces strong AO creases) but
// makes the contact cube EMISSIVE. With SSAO attenuating only indirect light:
//   - the diffuse floor/wall creases (ambient-lit, high AO) darken, while
//   - the emissive cube (emissive-dominated, also in a high-AO pocket) is
//     preserved — the old whole-image multiply would have darkened it too.
// The example runs with MSAA off so the lit pass can emit its indirect channel.

export function registerSsaoIndirectScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const floorMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "SsaoIndirectFloorPlane",
      width: 4.8,
      height: 4.8,
    }),
    { id: "ssao-indirect-floor-plane" },
  );
  const wallMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "SsaoIndirectWallPlane",
      width: 4.8,
      height: 2.8,
    }),
    { id: "ssao-indirect-wall-plane" },
  );
  const cubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SsaoIndirectContactCube",
      width: 0.78,
      height: 0.78,
      depth: 0.78,
    }),
    { id: "ssao-indirect-contact-cube" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoIndirectWarmFloor",
      baseColorFactor: new Float32Array([0.76, 0.72, 0.64, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.9,
    }),
    { id: "ssao-indirect-warm-floor" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoIndirectCoolWall",
      baseColorFactor: new Float32Array([0.62, 0.68, 0.76, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.86,
    }),
    { id: "ssao-indirect-cool-wall" },
  );
  // Dark base + bright emissive: AO must NOT attenuate the emissive (it is not
  // indirect lighting). Sits in the same high-AO corner as the diffuse creases.
  const cubeMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SsaoIndirectEmissiveCube",
      // Near-zero base so the cube has essentially no indirect (ambient) term —
      // its appearance is pure emissive, which AO must leave untouched.
      baseColorFactor: new Float32Array([0.01, 0.01, 0.01, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
      emissiveFactor: [0.88, 0.52, 0.22],
    }),
    { id: "ssao-indirect-emissive-cube" },
  );

  return {
    floorMesh,
    wallMesh,
    cubeMesh,
    floorMaterial,
    wallMaterial,
    cubeMaterial,
    floorMaterialKey: aperture.assetHandleKey(floorMaterial),
    cubeMaterialKey: aperture.assetHandleKey(cubeMaterial),
  };
}
