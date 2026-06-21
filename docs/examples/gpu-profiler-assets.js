export const gpuProfilerClearColor = [0.014, 0.018, 0.024, 1];
export const gpuProfilerOffscreenClearColor = [0.025, 0.02, 0.045, 1];
export const gpuProfilerOffscreenSize = 384;
export const gpuProfilerSceneLayerMask = 3;
export const gpuProfilerGridSize = 5;
export const gpuProfilerSpacing = 0.72;

export function registerGpuProfilerAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const renderTarget = aperture.createRenderTargetHandle(
    "gpu-profiler-offscreen",
  );
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "GpuProfilerBox",
      width: 0.46,
      height: 0.46,
      depth: 0.46,
    }),
    { id: "gpu-profiler-box" },
  );
  const materials = createProfilerMaterials(aperture, assets);

  return {
    mesh,
    materials,
    renderTarget,
  };
}

function createProfilerMaterials(aperture, assets) {
  const colors = [
    [0.94, 0.34, 0.24, 1],
    [0.22, 0.78, 0.54, 1],
    [0.26, 0.5, 0.96, 1],
    [0.96, 0.76, 0.28, 1],
    [0.72, 0.48, 0.94, 1],
  ];

  return colors.map((color, index) =>
    assets.materials.standard.add(
      aperture.createStandardMaterialAsset({
        label: `GpuProfilerMaterial${index}`,
        baseColorFactor: new Float32Array(color),
        metallicFactor: 0.18 + index * 0.05,
        roughnessFactor: 0.34 + index * 0.08,
      }),
      { id: `gpu-profiler-material-${index}` },
    ),
  );
}
