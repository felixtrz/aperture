import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  transmissionAppConfig,
  transmissionAppRoughness,
  transmissionAppStripeCount,
  transmissionAppStripeSpan,
  transmissionAppTransmissionFactor,
} from "./transmission-app.shared.js";

// Same render state the low-level transmission scene applies to its glass
// materials: blended transparency that keeps depth testing but skips depth
// writes so both sphere hemispheres composite over the grabbed scene color.
const glassRenderState = {
  alphaMode: "blend",
  depth: { test: true, write: false, compare: "less" },
  blend: { preset: "alpha" },
  cullMode: "none",
};

function glassMaterial(label, roughness) {
  return material.standard({
    label,
    baseColor: [0.42, 0.72, 1, 1],
    metallic: 0,
    roughness,
    transmissionFactor: transmissionAppTransmissionFactor,
    renderState: glassRenderState,
  });
}

class TransmissionAppSetupSystem extends createSystem({ priority: 0 }) {
  init() {
    // Same framing as the low-level transmission worker: an orthographic
    // camera looking down -Z at the stripe wall with the spheres in front.
    this.spawn.camera({
      key: "camera.main",
      name: "transmission-app camera",
      transform: { translation: [0, 0, 4.2] },
      camera: {
        projection: "orthographic",
        orthographicHeight: 2.4,
        near: 0.1,
        far: 20,
        frustumCulling: false,
      },
    });
    this.spawn.light({
      key: "light.ambient",
      name: "transmission-app ambient light",
      kind: "ambient",
      color: [1, 1, 1, 1],
      intensity: 0.18,
    });
    this.spawn.light({
      key: "light.key",
      name: "transmission-app key light",
      kind: "point",
      color: [0.82, 0.94, 1, 1],
      intensity: 10,
      transform: { translation: [0.2, 0.35, 3] },
      light: { range: 8 },
    });

    this.#spawnBackgroundStripes();

    this.spawn.mesh({
      key: "transmission-app.glossy-sphere",
      name: "glossy transmissive sphere",
      mesh: mesh.sphere({ radius: 0.4, segments: 48 }),
      material: glassMaterial(
        "GlossyBlueGlass",
        transmissionAppRoughness.glossy,
      ),
      transform: { translation: [-0.48, 0, 0] },
    });
    this.spawn.mesh({
      key: "transmission-app.rough-sphere",
      name: "rough transmissive sphere",
      mesh: mesh.sphere({ radius: 0.4, segments: 48 }),
      material: glassMaterial("RoughBlueGlass", transmissionAppRoughness.rough),
      transform: { translation: [0.48, 0, 0] },
    });
  }

  #spawnBackgroundStripes() {
    const stripeWidth = transmissionAppStripeSpan / transmissionAppStripeCount;
    const leftEdge = -transmissionAppStripeSpan * 0.5;

    for (let index = 0; index < transmissionAppStripeCount; index += 1) {
      const centerX = leftEdge + stripeWidth * (index + 0.5);
      const bright = index % 2 === 0;

      this.spawn.mesh({
        key: `transmission-app.stripe.${index}`,
        name: bright ? "bright background stripe" : "dark background stripe",
        mesh: mesh.box(),
        material: bright
          ? material.standard({
              label: "BrightTransmissionStripe",
              baseColor: [0.95, 0.78, 0.12, 1],
              metallic: 0,
              roughness: 0.9,
              emissiveFactor: [0.35, 0.24, 0.03],
              renderState: { cullMode: "none" },
            })
          : material.standard({
              label: "DarkTransmissionStripe",
              baseColor: [0.02, 0.12, 0.55, 1],
              metallic: 0,
              roughness: 0.9,
              emissiveFactor: [0.0, 0.02, 0.18],
              renderState: { cullMode: "none" },
            }),
        transform: {
          translation: [centerX, 0, -0.35],
          scale: [stripeWidth * 0.98, 1.28, 0.04],
        },
      });
    }
  }
}

startGeneratedSimulationWorker({
  config: transmissionAppConfig,
  systems: [{ default: TransmissionAppSetupSystem }],
});
