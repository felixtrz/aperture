import { createSystem } from "@aperture-engine/app/systems";
import { hexColor } from "../lib/math.js";
import {
  BACKGROUND_HEX,
  CAMERA,
  DIR_LIGHT,
  FOG_HEX,
  HEMI_LIGHT,
  SPAWN_POS,
  VEHICLE_ROOT_SCALE,
} from "../lib/tuning.js";
import {
  CELL_RAW,
  GRID_SCALE,
  NPC_TRUCKS,
  ORIENT_DEG,
  TRACK_CELLS,
  computeTrackBounds,
  resolveTrackCells,
  type GridCell,
} from "../lib/track.js";

const PLAYER_ASSET = "vehicle-truck-yellow";
const GROUP_Y = GRID_SCALE * 0.5 - 0.5;

// Static visual scene ported from racing: track pieces, decoration tiles, parked
// NPC trucks, and the yellow player truck at spawn. Physics/gameplay systems stay
// out of Shadow Lab; this route isolates rendering/shadow parity on real racing
// content.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  #cells: readonly GridCell[] = TRACK_CELLS;

  override init(): void {
    this.#cells = resolveTrackCells(this.world).cells;
    this.#spawnCamera();
    this.#spawnLights();
    this.#spawnFog();
    this.#spawnTrack();
    this.#spawnNpcs();
    this.#spawnPlayer();
  }

  #spawnCamera(): void {
    const target: [number, number, number] = [SPAWN_POS[0], 0, SPAWN_POS[2]];
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [
          target[0] + CAMERA.offset[0],
          target[1] + CAMERA.offset[1],
          target[2] + CAMERA.offset[2],
        ],
        lookAt: target,
      },
      fovYDegrees: CAMERA.fovDeg,
      camera: {
        near: CAMERA.near,
        far: CAMERA.far,
        clearColor: hexColor(BACKGROUND_HEX),
      },
    });
  }

  #spawnLights(): void {
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
        normalBias: 0.05,
      },
    });

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
      intensity: HEMI_LIGHT.intensity,
    });
  }

  #spawnFog(): void {
    const bounds = computeTrackBounds(this.#cells);
    const groundSize = Math.max(bounds.halfWidth, bounds.halfDepth) * 2 + 20;
    this.spawn.fog({
      key: "fog.main",
      mode: "linear",
      color: hexColor(FOG_HEX),
      start: groundSize * 0.4,
      end: groundSize * 0.8,
    });
  }

  #spawnTrack(): void {
    for (const cell of this.#cells) {
      this.#spawnPiece(cell);
    }
  }

  #spawnPiece(cell: GridCell): void {
    const [gx, gz, key, orient] = cell;
    this.spawn.gltf(this.assets.gltf(key), {
      key: `track.${gx}.${gz}`,
      name: `track.${gx}.${gz}`,
      tags: ["track"],
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: [
          GRID_SCALE * (gx + 0.5) * CELL_RAW,
          GROUP_Y,
          GRID_SCALE * (gz + 0.5) * CELL_RAW,
        ],
        scale: [GRID_SCALE, GRID_SCALE, GRID_SCALE],
        rotationEulerDegrees: [0, ORIENT_DEG[orient] ?? 0, 0],
      },
    });
  }

  #spawnNpcs(): void {
    NPC_TRUCKS.forEach(([key, x, y, z, rotDeg], i) => {
      this.spawn.gltf(this.assets.gltf(key), {
        key: `npc.${i}`,
        name: `npc.${i}`,
        tags: ["npc"],
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: [x, y, z],
          scale: [VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE],
          rotationEulerDegrees: [0, rotDeg + 180, 0],
        },
      });
    });
  }

  #spawnPlayer(): void {
    this.spawn.gltf(this.assets.gltf(PLAYER_ASSET), {
      key: "player.vehicle",
      name: "player",
      tags: ["player"],
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: [SPAWN_POS[0], SPAWN_POS[1] - 0.5, SPAWN_POS[2]],
        scale: [VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE],
      },
    });
  }
}
