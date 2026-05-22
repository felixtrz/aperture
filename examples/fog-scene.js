export const clearColor = [0.018, 0.022, 0.028, 1];

export const fogColor = [0.46, 0.62, 0.82, 1];
export const fogMeshId = "fog-demo-cube-mesh";
export const fogMaterialId = "fog-demo-standard-material";

export const fogReadbackSamples = [
  { id: "near-cube", x: 0.28, y: 0.5 },
  { id: "far-cube", x: 0.72, y: 0.5 },
  { id: "background", x: 0.5, y: 0.14 },
];

export function registerFogScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(fogMeshId);
  const material = aperture.createMaterialHandle(fogMaterialId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createBoxMeshAsset({
      label: "FogDemoCube",
      width: 0.78,
      height: 0.78,
      depth: 0.78,
    }),
  );
  registry.register(material);
  registry.markReady(
    material,
    aperture.createStandardMaterialAsset({
      label: "FogDemoStandardMaterial",
      baseColorFactor: new Float32Array([0.96, 0.24, 0.06, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.74,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    material,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
    samples: fogReadbackSamples,
  };
}

export function normalizeFogMode(value) {
  if (value === "exp" || value === "exp2" || value === "linear") {
    return value;
  }

  return "linear";
}

export function fogSettingsForMode(mode) {
  switch (normalizeFogMode(mode)) {
    case "exp":
      return {
        mode: "exp",
        color: fogColor,
        density: 0.08,
      };
    case "exp2":
      return {
        mode: "exp2",
        color: fogColor,
        density: 0.07,
      };
    case "linear":
    default:
      return {
        mode: "linear",
        color: fogColor,
        start: 7,
        end: 16,
      };
  }
}
