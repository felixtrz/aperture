import {
  RenderInterpolation,
  createSystem,
  hexColor,
} from "@aperture-engine/app/systems";
import {
  CELL_RAW,
  GRID_SCALE,
  NPC_TRUCKS,
  ORIENT_DEG,
  TRACK_CELLS,
  computeSpawnPosition,
  resolveTrackCells,
  type GridCell,
} from "../lib/track.js";
import {
  BACKGROUND_HEX,
  CAMERA,
  DIR_LIGHT,
  FOG_HEX,
  HEMI_LIGHT,
  VEHICLE_ROOT_SCALE,
} from "../lib/tuning.js";
import { computeTrackBounds } from "../lib/track.js";
import {
  computeGroundCollider,
  computeWallColliders,
} from "../lib/physics-colliders.js";

const GROUP_Y = GRID_SCALE * 0.5 - 0.5; // trackGroup.position.y(-0.5) + scale*0.5
const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

export default class SetupSystem extends createSystem({ priority: 0 }) {
  // Active track cells for this run: a `?map=` codec string from the page URL
  // (forwarded into the worker start options) when present, else TRACK_CELLS.
  #cells: readonly GridCell[] = TRACK_CELLS;

  override init(): void {
    this.#cells = resolveTrackCells(this.startOptions).cells;
    this.#spawnCamera();
    this.#spawnLights();
    this.#spawnFog();
    // Ground is now provided by decoration-empty tiles (decorations.system.ts),
    // matching the reference which draws no ground mesh.
    this.#spawnColliders();
    this.#spawnTrack();
    this.#spawnNpcs();
  }

  #spawnColliders(): void {
    // Static ground box (main.js) + wall colliders (Physics.js), sized to the
    // active track so a custom `?map=` gets matching walls/ground.
    const ground = computeGroundCollider(this.#cells);
    this.#spawnStaticBox("collider.ground", ground);
    computeWallColliders(this.#cells).forEach((spec, i) => {
      this.#spawnStaticBox(`collider.wall.${i}`, spec);
    });
  }

  #spawnStaticBox(
    key: string,
    spec: {
      halfExtents: readonly [number, number, number];
      position: readonly [number, number, number];
      quaternion: readonly [number, number, number, number];
      friction: number;
      restitution: number;
    },
  ): void {
    this.spawn.physics({
      key,
      transform: {
        translation: [...spec.position],
        rotation: [...spec.quaternion],
      },
      physics: {
        rigidBody: { type: "static" },
        collider: {
          shape: { kind: "box", halfExtents: [...spec.halfExtents] },
          friction: spec.friction,
          restitution: spec.restitution,
        },
      },
    });
  }

  #spawnFog(): void {
    // scene.fog = Fog(0xadb2ba, near, far) sized from track bounds (main.js).
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

  #spawnCamera(): void {
    const spawn = computeSpawnPosition(this.#cells);
    const target: [number, number, number] = [
      spawn.position[0],
      0,
      spawn.position[2],
    ];
    const camera = this.spawn.camera({
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
    camera.addComponent(RenderInterpolation);
  }

  #spawnLights(): void {
    // Sun: directional, aimed from DIR_LIGHT.position toward the origin.
    this.spawn.light({
      key: "light.sun",
      name: "sun",
      kind: "directional",
      color: hexColor(DIR_LIGHT.colorHex),
      illuminance: DIR_LIGHT.intensity,
      transform: {
        translation: DIR_LIGHT.position,
        lookAt: [0, 0, 0],
      },
      shadow: {
        // Aperture auto-fits the directional shadow camera from the active
        // render camera frustum; these remain quality/filtering knobs only.
        mapSize: 4096,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: DIR_LIGHT.shadowRadius,
        normalBias: 0.05,
      },
    });

    // BISECT (black-screen): temporarily reverted from kind:"hemisphere" back to the
    // known-good sky-biased flat ambient to isolate whether the new hemisphere light
    // path is what's rendering the scene unlit/black.
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
      materials: GLTF_FRONT_SIDE_MATERIALS,
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
        materials: GLTF_FRONT_SIDE_MATERIALS,
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
}
