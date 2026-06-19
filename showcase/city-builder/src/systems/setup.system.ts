import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  CAMERA_DEFAULT_YAW,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_FOV_Y_DEGREES,
  GRID_HALF_EXTENT,
  cameraOffset,
} from "../lib/city-data.js";

const CITY_SHADOW_MAP_SIZE = 2048;
const CITY_SHADOW_ORTHOGRAPHIC_SIZE = GRID_HALF_EXTENT * 2 * Math.SQRT2 + 4;

// Static scene: the isometric camera (driven each frame by camera.system), the
// sun + ambient fill (main.tscn Sun + main-environment.tres), and the ground
// plane the placement ray intersects.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const offset = cameraOffset(CAMERA_DEFAULT_YAW, CAMERA_DEFAULT_ZOOM);

    this.spawn.camera({
      key: "camera.main",
      name: "City Camera",
      transform: {
        translation: offset,
        lookAt: [0, 0, 0],
      },
      fovYDegrees: CAMERA_FOV_Y_DEGREES,
    });

    // main.tscn Sun: a shadow-casting directional light from the upper left.
    // The source leans on soft ambient GI (SDFGI + ambient_light_energy 0.75),
    // so we keep the sun gentle and the ambient strong — a harsh sun overstates
    // the buildings' per-floor ledges/gradient as banding.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 2.2,
      // The city tiles are large, flat shadow receivers. The `shadow: true`
      // shorthand uses zero bias, which produces receiver acne as long bands on
      // grass/road tops. Author a fixed city-sized shadow box and modest bias
      // instead, matching how this Godot scene treats shadows as a soft accent.
      shadow: {
        enabled: true,
        mapSize: CITY_SHADOW_MAP_SIZE,
        bias: 0.0005,
        normalBias: 0.055,
        slopeBias: 1.5,
        strength: 0.75,
        filterRadius: 1.5,
        center: [0, 0, 0],
        orthographicSize: CITY_SHADOW_ORTHOGRAPHIC_SIZE,
        near: 1,
        far: 90,
        lightDistance: 45,
      },
      transform: {
        rotationEulerDegrees: [-55, -35, 0],
      },
    });

    // main-environment.tres ambient fill (light bluish sky bounce).
    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: [0.66, 0.69, 0.77, 1],
      intensity: 1.3,
    });

    // Buildable ground. Tiles are authored with their base at y=0, so the ground
    // top is dropped a few cm below 0 — coplanar surfaces (ground top == tile
    // base) z-fight, and the small gap is sub-pixel at play distance.
    const span = GRID_HALF_EXTENT * 2 + 1;
    this.spawn.mesh({
      key: "ground",
      name: "Ground",
      tags: ["ground"],
      mesh: mesh.box({ size: [span, 0.5, span] }),
      material: material.standard({
        baseColor: [0.36, 0.45, 0.3, 1],
        roughness: 0.95,
      }),
      transform: { translation: [0, -0.3, 0] }, // top at y = -0.05
      receiveShadow: true,
    });
  }
}
