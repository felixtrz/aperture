import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { hexColor } from "../lib/math.js";
import { DIR_LIGHT, HEMI_LIGHT, VEHICLE_ROOT_SCALE } from "../lib/tuning.js";

const TRUCK_ASSET = "vehicle-truck-green";
const SUN_DISTANCE = Math.hypot(
  DIR_LIGHT.position[0],
  DIR_LIGHT.position[1],
  DIR_LIGHT.position[2],
);

// MINIMAL shadow-verification scene (per Felix): a flat ground + ONE glTF truck,
// nothing else. A single real racing caster keeps the shadow ortho tight so the
// ground shadow shape is easy to compare against the Three reference. Racing's
// sun + ambient lighting are kept. The full racing static scene
// (track/decorations/trucks) is recoverable via git on this file +
// decorations.system.ts.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    // Camera pose is owned by the split-screen Three compare harness.
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: { translation: [8, 6, 8], lookAt: [0, 0.5, 0] },
      fovYDegrees: 40,
      camera: { near: 0.1, far: 200, clearColor: hexColor(0xadb2ba) },
    });

    // Sun: racing's directional light + shadow.
    this.spawn.light({
      key: "light.sun",
      name: "sun",
      kind: "directional",
      color: hexColor(DIR_LIGHT.colorHex),
      illuminance: DIR_LIGHT.intensity,
      transform: { translation: DIR_LIGHT.position, lookAt: [0, 0, 0] },
      shadow: {
        mapSize: 4096,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: DIR_LIGHT.shadowRadius,
        // Three.js reference uses bias=-0.0004 and normalBias=0.02. Aperture's
        // receiver bias is authored as a positive subtraction from receiver
        // depth, so 0.0004 matches the same comparison direction.
        bias: 0.0004,
        normalBias: 0.02,
        center: [0, 0, 0],
        orthographicSize: 16,
        near: 0.5,
        far: 60,
        lightDistance: SUN_DISTANCE,
      },
    });

    // Racing's sky-biased ambient fill.
    const sky = hexColor(HEMI_LIGHT.skyHex);
    const ground = hexColor(HEMI_LIGHT.groundHex);
    const skyBias = 0.85;
    this.spawn.light({
      key: "light.ambient",
      name: "ambient",
      kind: "ambient",
      color: [
        sky[0] * skyBias + ground[0] * (1 - skyBias),
        sky[1] * skyBias + ground[1] * (1 - skyBias),
        sky[2] * skyBias + ground[2] * (1 - skyBias),
        1,
      ],
      // DIAGNOSTIC: ambient dropped from HEMI_LIGHT.intensity (2) so shadows go
      // dark and their SHAPE is unambiguous to judge. Restore to 2 for racing
      // look once shadows are verified.
      intensity: 0.25,
    });

    // Flat ground (top surface at y=0), receives shadow, does not cast.
    this.spawn.mesh({
      key: "ground",
      name: "ground",
      mesh: mesh.box({ size: 1 }),
      material: material.standard({
        baseColor: [0.45, 0.7, 0.45, 1],
        roughness: 1,
        metallic: 0,
      }),
      transform: { translation: [0, -0.5, 0], scale: [40, 1, 40] },
      receiveShadow: true,
      castShadow: false,
    });

    // Single real racing GLB caster. The import scale and slight Y offset match
    // the racing app's truck placements.
    this.spawn.gltf(this.assets.gltf(TRUCK_ASSET), {
      key: "truck",
      name: "truck",
      tags: ["shadow-caster", "truck"],
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: [0, -0.01, 0],
        scale: [VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE],
        rotationEulerDegrees: [0, 180, 0],
      },
    });
  }
}
