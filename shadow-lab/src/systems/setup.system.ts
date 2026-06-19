import {
  createSystem,
  hexColor,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import {
  BACKGROUND_HEX,
  CAMERA,
  BLOOM_PROBE,
  DIR_LIGHT,
  FOG_HEX,
  HEMI_LIGHT,
  POINT_LIGHT,
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
const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

// Static visual scene ported from racing: track pieces, decoration tiles, parked
// NPC trucks, and the yellow player truck at spawn. Physics/gameplay systems stay
// out of Shadow Lab; this route isolates rendering/shadow parity on real racing
// content.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  #cells: readonly GridCell[] = TRACK_CELLS;

  override init(): void {
    this.#cells = resolveTrackCells(this.startOptions).cells;
    this.#spawnCamera();
    this.#spawnLights();
    this.#spawnFog();
    this.#spawnTrack();
    this.#spawnNpcs();
    this.#spawnPlayer();
    this.#spawnBloomProbe();
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

  // One shadow-casting light at a time keeps the shadow shape unambiguous.
  // `?light=point` swaps the directional sun for a cube-map point light; the
  // page-URL param is forwarded into startOptions by the generated bootstrap.
  #spawnLights(): void {
    if (this.startOptions.string("light") === "point") {
      this.#spawnPointLight();
    } else {
      this.#spawnDirectionalLight();
    }
    this.#spawnAmbient();
  }

  #spawnDirectionalLight(): void {
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
  }

  #spawnPointLight(): void {
    this.spawn.light({
      key: "light.point",
      name: "point-light",
      kind: "point",
      color: hexColor(POINT_LIGHT.colorHex),
      intensity: POINT_LIGHT.intensity,
      // `range` lives on LightInput (controls falloff + cube-shadow far plane).
      light: { range: POINT_LIGHT.range },
      transform: { translation: POINT_LIGHT.position },
      shadow: {
        // Cube-map shadow: near/far are derived from the light range by the
        // renderer, so only resolution + filtering are authored here.
        mapSize: POINT_LIGHT.shadowMapSize,
        shadowType: 1,
        filterRadius: POINT_LIGHT.shadowRadius,
        normalBias: 0.05,
      },
    });
  }

  #spawnAmbient(): void {
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

  #spawnPlayer(): void {
    this.spawn.gltf(this.assets.gltf(PLAYER_ASSET), {
      key: "player.vehicle",
      name: "player",
      tags: ["player"],
      materials: GLTF_FRONT_SIDE_MATERIALS,
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: [SPAWN_POS[0], SPAWN_POS[1] - 0.5, SPAWN_POS[2]],
        scale: [VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE],
      },
    });
  }

  #spawnBloomProbe(): void {
    this.spawn.mesh({
      key: "bloom.probe",
      name: "bloom-probe",
      tags: ["probe", "bloom"],
      mesh: mesh.sphere({
        radius: BLOOM_PROBE.radius,
        segments: BLOOM_PROBE.segments,
      }),
      material: material.standard({
        label: "Bloom Probe HDR Material",
        baseColor: hexColor(BLOOM_PROBE.baseColorHex),
        emissiveFactor: BLOOM_PROBE.emissiveFactor,
        metallic: 0,
        roughness: BLOOM_PROBE.roughness,
      }),
      transform: {
        translation: BLOOM_PROBE.position,
      },
      castShadow: false,
      receiveShadow: false,
    });
  }
}
