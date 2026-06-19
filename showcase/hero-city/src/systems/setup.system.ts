import { createSystem, quatFromEulerYXZ } from "@aperture-engine/app/systems";
import {
  BUILDINGS,
  CAMERA_FOV_Y_DEGREES,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  GROUND_TILES,
  TOWN_HALF_EXTENT,
  cameraOffset,
} from "../lib/city-layout.js";

const SHADOW_MAP_SIZE = 2048;
// Size the shadow box to the diagonal of the tiled pad plus a little margin.
const SHADOW_ORTHOGRAPHIC_SIZE = TOWN_HALF_EXTENT * 2 * Math.SQRT2 * 0.5 + 3;

function quarterTurn(r: number) {
  return quatFromEulerYXZ(0, (r * Math.PI) / 2, 0);
}

// Builds the fixed hero town once at startup: the isometric camera (then driven
// each frame by orbit.system), a soft shadow-casting sun, an ambient sky fill,
// and every Kenney tile — the tiles themselves form the ground (there is no big
// ground plane), with buildings packed on top.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const offset = cameraOffset(CAMERA_START_YAW, CAMERA_ZOOM);
    this.spawn.camera({
      key: "camera.main",
      name: "Hero Camera",
      transform: {
        translation: offset,
        lookAt: [0, 0, 0],
      },
      fovYDegrees: CAMERA_FOV_Y_DEGREES,
    });

    // Soft directional sun from the upper-left. Gentle illuminance + a fixed
    // town-sized shadow box keeps the Kenney tiles' shading clean rather than
    // banded.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 3.1,
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
      transform: {
        rotationEulerDegrees: [-52, -38, 0],
      },
    });

    // Bluish sky bounce so shadowed faces stay readable.
    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: [0.66, 0.71, 0.82, 1],
      intensity: 1.5,
    });

    // Ground layer: every cell is a real tile (grass / road / pavement), so the
    // pad is seamless and needs no underlying plane.
    for (const tile of GROUND_TILES) {
      this.spawn.gltf(this.assets.gltf(tile.id), {
        name: tile.id,
        tags: ["tile", "ground"],
        castShadow: tile.casts,
        receiveShadow: true,
        transform: {
          translation: [tile.x, 0, tile.z],
          rotation: quarterTurn(tile.r),
        },
      });
    }

    // Buildings packed on top of their grass tiles, facing the ring road.
    for (const building of BUILDINGS) {
      this.spawn.gltf(this.assets.gltf(building.id), {
        name: building.id,
        tags: ["tile", "building"],
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: [building.x, 0, building.z],
          rotation: quarterTurn(building.r),
        },
      });
    }
  }
}
