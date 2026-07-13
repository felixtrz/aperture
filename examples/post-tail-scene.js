// Shared scene for the E4 post-processing tail example (outline + motion blur +
// LUT color grading). A mid-gray target box (outlined + LUT-graded), a bright
// red mover box (animated for motion blur), and two lights. Kept tiny so the
// SwiftShader e2e stays fast.
export function registerPostTailScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const targetMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PostTailTargetBox",
      width: 1.4,
      height: 1.4,
      depth: 1.4,
    }),
    { id: "post-tail-target-box" },
  );
  const moverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PostTailMoverBox",
      width: 0.5,
      height: 0.5,
      depth: 0.5,
    }),
    { id: "post-tail-mover-box" },
  );
  // Unlit materials: flat, lighting-independent color keeps the LUT/outline
  // pixel proofs deterministic and uses the unlit motion-vector variant TAA
  // exercises (the standard-mesh motion-vector variant is a separate concern).
  const targetMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PostTailTargetMaterial",
      baseColorFactor: new Float32Array([0.55, 0.55, 0.55, 1]),
    }),
    { id: "post-tail-target-material" },
  );
  const moverMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PostTailMoverMaterial",
      baseColorFactor: new Float32Array([0.92, 0.16, 0.12, 1]),
    }),
    { id: "post-tail-mover-material" },
  );

  return {
    targetMesh,
    moverMesh,
    targetMaterial,
    moverMaterial,
    targetMaterialKey: aperture.assetHandleKey(targetMaterial),
    meshKeys: [
      aperture.assetHandleKey(targetMesh),
      aperture.assetHandleKey(moverMesh),
    ],
    materialKeys: [
      aperture.assetHandleKey(targetMaterial),
      aperture.assetHandleKey(moverMaterial),
    ],
  };
}

// Horizontal position of the mover box at a given frame (large per-frame
// displacement so the motion-vector-driven blur is visibly non-trivial).
export function postTailMoverX(frame) {
  return Math.sin(frame * 0.55) * 1.5;
}
