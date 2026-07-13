// Hemisphere light example (parity plan E5). A single sphere lit almost
// entirely by a hemisphere light: the sky color (blue) tints the upward-facing
// top, the ground color (warm orange) tints the downward-facing bottom, giving
// a soft two-color ambient gradient — the three.js `HemisphereLight`.

export const clearColor = [0.02, 0.025, 0.035, 1];

// Sky/ground/intensity are shared by the worker (which authors the light) and
// the e2e assertions (top reads bluer, bottom reads warmer).
export const hemisphere = {
  skyColor: [0.3, 0.5, 1.0, 1],
  groundColor: [0.95, 0.55, 0.2, 1],
  intensity: 3.6,
};

// Normalized [0,1] screen samples (y grows downward): the sphere's lit top
// (sky-tinted), its lit bottom (ground-tinted), and its center.
export const readbackSamples = [
  { id: "sky-top", x: 0.5, y: 0.3 },
  { id: "ground-bottom", x: 0.5, y: 0.7 },
  { id: "center", x: 0.5, y: 0.5 },
];

export function registerHemisphereLightScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "HemisphereLightSphere",
      radius: 1.35,
      widthSegments: 64,
      heightSegments: 48,
    }),
    { id: "hemisphere-light-sphere" },
  );
  const material = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "HemisphereLightSurface",
      // A neutral mid-gray albedo so the hemisphere sky/ground colors show
      // through the diffuse ambient term unmodulated by a colored base.
      baseColorFactor: new Float32Array([0.82, 0.82, 0.82, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
    }),
    { id: "hemisphere-light-surface" },
  );

  return { mesh, material };
}
