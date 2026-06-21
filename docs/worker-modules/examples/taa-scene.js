export const clearColor = [0.012, 0.014, 0.018, 1];

export const taaCanvasSize = {
  width: 512,
  height: 512,
};

export const taaFrameCount = 24;

export function registerTaaScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const edgeMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "TaaEdgePlane",
      width: 1.56,
      height: 1.78,
    }),
    { id: "taa-edge-plane" },
  );
  const whiteMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "TaaWhite",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      renderState: { cullMode: "none" },
    }),
    { id: "taa-white" },
  );

  return {
    edgeMesh,
    whiteMaterial,
    meshKey: aperture.assetHandleKey(edgeMesh),
    materialKey: aperture.assetHandleKey(whiteMaterial),
  };
}

export function temporalJitterForFrame(frame, width, height) {
  const sample =
    taaJitterSamples[(Math.max(1, frame) - 1) % taaJitterSamples.length];

  return [(sample[0] * 2) / width, (sample[1] * -2) / height];
}

export function cameraPanForFrame(frame) {
  return Math.sin(frame * 0.58) * 0.018;
}

export function objectMotionForFrame(frame) {
  return Math.sin(frame * 0.47) * 0.046;
}

const taaJitterSamples = [
  [0.125, -0.375],
  [-0.375, 0.125],
  [0.375, 0.375],
  [-0.125, -0.125],
  [-0.25, 0.375],
  [0.25, -0.125],
  [0.5, 0.125],
  [0, -0.375],
];
