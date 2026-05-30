// Shared scene assets + entity layout for the M5-T5 refraction proof
// (examples/transmission-ior). Both the worker (extraction) and the main thread
// (app-side material resources) register the SAME asset ids from one config so
// the IOR / thickness / Beer-Lambert volume parameters drive the same glass.
//
// Two background modes decouple the two proofs:
//   - "stripes": high-contrast vertical bars; an off-center probe through the
//     glass shifts across bars as IOR bends the view ray (refraction proof).
//   - "white": a flat bright wall; a center probe through the glass tints toward
//     the attenuation passband as thickness grows (Beer-Lambert proof).

export const clearColor = [0.01, 0.012, 0.018, 1];

export const transmissionIorSphereId = "transmission-ior-sphere";
export const transmissionIorGlassMaterialId = "transmission-ior-glass";

// A confined horizontal brightness RAMP (not uniform stripes): the IOR
// refraction shifts the through-glass sample by ~0.1 screen-u, so a smooth ramp
// guarantees a measurable color change with IOR, whereas uniform wide stripes
// would leave both samples in the same band. The ramp is steep across the
// central region the refraction sweeps, then clamps to black/white outside.
const rampCount = 40;
const rampSpan = 12;
const rampStart = -1.7;
const rampEnd = 1.7;
const whiteWall = [0.96, 0.97, 1.0, 1];

function rampBrightness(x) {
  const t = (x - rampStart) / (rampEnd - rampStart);
  return Math.min(1, Math.max(0.03, t));
}

export function defaultTransmissionIorConfig() {
  return {
    ior: 1.5,
    thickness: 1.6,
    attenuationColor: [1, 1, 1],
    attenuationDistance: 0,
    background: "stripes",
  };
}

export function registerTransmissionIorAssets(aperture, registry, config) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const sphereMesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "TransmissionIorSphere",
      radius: 1.1,
      widthSegments: 96,
      heightSegments: 64,
    }),
    { id: transmissionIorSphereId },
  );
  const panelMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "TransmissionIorPanel",
      width: 1,
      height: 1,
    }),
    { id: "transmission-ior-panel" },
  );
  const stripeWidth = rampSpan / rampCount;
  const leftEdge = -rampSpan * 0.5;
  const rampMaterials = [];

  for (let index = 0; index < rampCount; index += 1) {
    const centerX = leftEdge + stripeWidth * (index + 0.5);
    const brightness = rampBrightness(centerX);

    rampMaterials.push(
      assets.materials.unlit.add(
        aperture.createUnlitMaterialAsset({
          label: `TransmissionIorRamp${index}`,
          baseColorFactor: new Float32Array([
            brightness,
            brightness,
            brightness * 1.02,
            1,
          ]),
          renderState: { cullMode: "none" },
        }),
        { id: `transmission-ior-ramp-${index}` },
      ),
    );
  }

  const wallMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "TransmissionIorWall",
      baseColorFactor: new Float32Array(whiteWall),
      renderState: { cullMode: "none" },
    }),
    { id: "transmission-ior-wall" },
  );
  const glassMaterialAsset = aperture.createStandardMaterialAsset({
    label: "TransmissionIorGlass",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    metallicFactor: 0,
    roughnessFactor: 0.04,
    transmissionFactor: 1,
    ior: config.ior,
    thickness: config.thickness,
    attenuationColor: config.attenuationColor,
    attenuationDistance: config.attenuationDistance,
  });
  const glassMaterial = assets.materials.standard.add(glassMaterialAsset, {
    id: transmissionIorGlassMaterialId,
  });

  return {
    sphereMesh,
    panelMesh,
    rampMaterials,
    wallMaterial,
    glassMaterial,
    glassMaterialAsset,
    sphereMeshKey: aperture.assetHandleKey(sphereMesh),
    glassMaterialKey: aperture.assetHandleKey(glassMaterial),
  };
}

export function spawnTransmissionIorEntities(
  aperture,
  app,
  registered,
  canvasSize,
  config,
) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.2] }),
    aperture.withCamera({
      aspect,
      near: 0.1,
      far: 40,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.85,
      layerMask: 1,
    }),
  );

  if (config.background === "white") {
    app.spawn(
      aperture.withTransform({
        translation: [0, 0, -1.6],
        scale: [rampSpan, rampSpan, 1],
      }),
      aperture.withMesh(registered.panelMesh),
      aperture.withMaterial(registered.wallMaterial),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  } else {
    const stripeWidth = rampSpan / rampCount;
    const leftEdge = -rampSpan * 0.5;

    registered.rampMaterials.forEach((material, index) => {
      app.spawn(
        aperture.withTransform({
          translation: [leftEdge + stripeWidth * (index + 0.5), 0, -1.6],
          scale: [stripeWidth * 1.02, rampSpan, 1],
        }),
        aperture.withMesh(registered.panelMesh),
        aperture.withMaterial(material),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
    });
  }

  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(registered.sphereMesh),
    aperture.withMaterial(registered.glassMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}
