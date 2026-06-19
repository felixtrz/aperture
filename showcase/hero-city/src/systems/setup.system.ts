import { createSystem, quatFromEulerYXZ } from "@aperture-engine/app/systems";
import {
  CAMERA_FOV_Y_DEGREES,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  CITY_HALF_EXTENT,
  TILES,
  cameraOffset,
  tileCastsShadow,
} from "../lib/city-layout.js";

const SHADOW_MAP_SIZE = 2048;
const SHADOW_ORTHOGRAPHIC_SIZE = CITY_HALF_EXTENT * 2 * Math.SQRT2 * 0.5 + 3;
// Height of the street-lamp point lights above their tile (≈ the lamp heads).
const LAMP_HEIGHT = 1.35;

function quarterTurn(r: number) {
  return quatFromEulerYXZ(0, (r * Math.PI) / 2, 0);
}

// Builds the authored hero town once at startup: the isometric camera (then
// driven each frame by orbit.system), the sun + ambient (animated by
// daynight.system), every Kenney tile from the authored city, and a warm point
// light over each street-lamp tile (lit in the evening by daynight.system).
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Hero Camera",
      transform: {
        translation: cameraOffset(CAMERA_START_YAW, CAMERA_ZOOM),
        lookAt: [0, 0, 0],
      },
      fovYDegrees: CAMERA_FOV_Y_DEGREES,
    });

    // Sun + ambient: initial values for the opening (midday) phase; the
    // DayNightSystem drives color/intensity/angle every frame thereafter.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 3.6,
      shadow: {
        enabled: true,
        mapSize: SHADOW_MAP_SIZE,
        bias: 0.0005,
        normalBias: 0.055,
        slopeBias: 1.5,
        strength: 0.78,
        filterRadius: 1.5,
        center: [0, 0, 0],
        orthographicSize: SHADOW_ORTHOGRAPHIC_SIZE,
        near: 1,
        far: 90,
        lightDistance: 45,
      },
      transform: { rotationEulerDegrees: [-72, -18, 0] },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: [0.66, 0.74, 0.86, 1],
      intensity: 1.5,
    });

    // The authored city: every tile placed at (x, 0, z) with its quarter-turn.
    for (const tile of TILES) {
      this.spawn.gltf(this.assets.gltf(tile.id), {
        name: tile.id,
        tags: ["tile"],
        castShadow: tileCastsShadow(tile.id),
        receiveShadow: true,
        transform: {
          translation: [tile.x, 0, tile.z],
          rotation: quarterTurn(tile.orientation),
        },
      });
    }

    // A warm point light over each street-lamp tile. They start dark (midday)
    // and DayNightSystem ramps their intensity up as the sun sets.
    let lampIndex = 0;
    for (const tile of TILES) {
      if (tile.id !== "road-straight-lightposts") {
        continue;
      }
      this.spawn.light({
        key: `light.lamp.${lampIndex}`,
        name: "Street Lamp",
        kind: "point",
        color: [1.0, 0.76, 0.42, 1],
        intensity: 0,
        light: { range: 7 },
        transform: { translation: [tile.x, LAMP_HEIGHT, tile.z] },
      });
      lampIndex += 1;
    }
  }
}
