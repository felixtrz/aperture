export const matcapClearColor = [0.78, 0.82, 0.86, 1];
export const matcapSpinAxis = [0.2, 1, 0.35];
export const matcapSpinRadiansPerSecond = 2.4;

export function registerMatcapAppAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "MatcapAppCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "matcap-app-cube" },
  );
  const texture = aperture.createTextureHandle("matcap-app-studio");
  const sampler = aperture.createSamplerHandle("matcap-app-linear");

  registry.register(texture);
  registry.markReady(
    texture,
    aperture.createTextureAsset({
      label: "MatcapAppStudioTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 210, 245, 255, 190, 230, 255, 255, 110, 135, 180, 255, 40, 52,
          76, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(sampler);
  registry.markReady(
    sampler,
    aperture.createSamplerAsset({ label: "MatcapAppLinearSampler" }),
  );

  const materialAsset = aperture.createMatcapMaterialAsset({
    label: "MatcapAppMaterial",
    baseColorFactor: new Float32Array([0.92, 0.78, 1, 1]),
    matcapTexture: { texture, sampler },
  });
  const material = assets.materials.matcap.add(materialAsset, {
    id: "matcap-app-material",
  });

  return {
    mesh,
    material,
    materialAsset,
    texture,
    sampler,
  };
}
