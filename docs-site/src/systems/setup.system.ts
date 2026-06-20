import {
  createSystem,
  material,
  mesh,
  quatFromEulerYXZ,
} from "@aperture-engine/app/systems";
import {
  CAMERA_FOV_Y_DEGREES,
  CAMERA_COMPOSITION_RIGHT_OFFSET,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  CITY_HALF_EXTENT,
  CITY_YAW,
  TILES,
  cameraOffset,
  cameraRightOffset,
  tileCastsShadow,
} from "../lib/city-layout.js";

const SHADOW_MAP_SIZE = 2048;
const MOBILE_SHADOW_MAP_SIZE = 1024;
const SHADOW_ORTHOGRAPHIC_SIZE = CITY_HALF_EXTENT * 2 * Math.SQRT2 * 0.5 + 3;
// Height of the street-lamp spot lights above their tile (≈ the lamp heads).
const LAMP_HEIGHT = 0.48;
const LAMP_SIDE_OFFSET = 0.3;
const LAMP_LOOK_AT_Y = 0;
const LAMP_RANGE = 4.5;
const LAMP_INNER_CONE = Math.PI / 7;
const LAMP_OUTER_CONE = Math.PI / 3;
const LIGHT_MARKER_RADIUS = 0.04;
const GARAGE_TRUCK_ASSET_ID = "vehicle-truck-red";
const GARAGE_TRUCK_LOCAL_POSITION = [-0.5, -0.02, 1] as const;
const GARAGE_TRUCK_SCALE = 1 / 6;
const GARAGE_TRUCK_YAW_OFFSET = Math.PI / 2;
const HEADLIGHT_LOCAL_POSITIONS = [
  [-0.42, 0.55, 1.24],
  [0.42, 0.55, 1.24],
] as const;
const HEADLIGHT_LOOK_AHEAD = 1.8;
const HEADLIGHT_INTENSITY = 20;
const HEADLIGHT_RANGE = 2.2;
const HEADLIGHT_INNER_CONE = Math.PI / 12;
const HEADLIGHT_OUTER_CONE = Math.PI / 5;
const HEADLIGHT_MARKER_RADIUS = 0.025;
const WINDOW_SIZE = [0.1, 0.2] as const;
const WINDOW_WALL_OFFSET = 0.41;
const WINDOW_COLUMNS = {
  left: -0.19,
  right: 0.19,
} as const;
const WINDOW_FLOORS = {
  second: 0.62,
  third: 1.02,
  fourth: 1.42,
} as const;
type HeroCityTile = (typeof TILES)[number];
type WindowColumn = keyof typeof WINDOW_COLUMNS;
type WindowFloor = keyof typeof WINDOW_FLOORS;
type WindowSlot = readonly [WindowColumn, WindowFloor];

const BUILDING_WINDOW_PATTERNS: Record<string, readonly WindowSlot[]> = {
  "building-small-a": [["right", "second"]],
  "building-small-b": [
    ["left", "second"],
    ["right", "third"],
  ],
  "building-small-c": [
    ["right", "second"],
    ["left", "third"],
    ["right", "fourth"],
  ],
  "building-small-d": [["left", "second"]],
};
const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

// Tile orientation (quarter-turns) plus the whole-town CITY_YAW rotation.
function tileRotation(r: number) {
  return quatFromEulerYXZ(0, (r * Math.PI) / 2 + CITY_YAW, 0);
}

function tileYaw(tile: HeroCityTile): number {
  return (tile.orientation * Math.PI) / 2 + CITY_YAW;
}

function tileLocalToWorld(
  tile: HeroCityTile,
  localX: number,
  localY: number,
  localZ: number,
) {
  const yaw = tileYaw(tile);
  return [
    tile.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    localY,
    tile.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  ] as const;
}

function lampPosition(tile: HeroCityTile, side: -1 | 1) {
  return tileLocalToWorld(tile, side * LAMP_SIDE_OFFSET, LAMP_HEIGHT, 0);
}

function lampLookAt(tile: HeroCityTile, side: -1 | 1) {
  const position = lampPosition(tile, side);
  return [position[0], LAMP_LOOK_AT_Y, position[2]] as const;
}

function garageTruckPosition(tile: HeroCityTile) {
  return tileLocalToWorld(
    tile,
    GARAGE_TRUCK_LOCAL_POSITION[0],
    GARAGE_TRUCK_LOCAL_POSITION[1],
    GARAGE_TRUCK_LOCAL_POSITION[2],
  );
}

function garageTruckRotation(tile: HeroCityTile) {
  return quatFromEulerYXZ(0, tileYaw(tile) + GARAGE_TRUCK_YAW_OFFSET, 0);
}

function garageTruckLocalToWorld(
  tile: HeroCityTile,
  localX: number,
  localY: number,
  localZ: number,
) {
  const root = garageTruckPosition(tile);
  const yaw = tileYaw(tile) + GARAGE_TRUCK_YAW_OFFSET;
  const x = localX * GARAGE_TRUCK_SCALE;
  const y = localY * GARAGE_TRUCK_SCALE;
  const z = localZ * GARAGE_TRUCK_SCALE;
  return [
    root[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    root[1] + y,
    root[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
  ] as const;
}

function tileHasWindows(tile: HeroCityTile): boolean {
  return windowPattern(tile).length > 0;
}

function windowPattern(tile: HeroCityTile): readonly WindowSlot[] {
  return BUILDING_WINDOW_PATTERNS[tile.id] ?? [];
}

function windowPosition(tile: HeroCityTile, localX: number, localY: number) {
  return tileLocalToWorld(tile, localX, localY, WINDOW_WALL_OFFSET);
}

function windowRotation(tile: HeroCityTile) {
  const yaw = (tile.orientation * Math.PI) / 2 + CITY_YAW;
  return quatFromEulerYXZ(0, yaw, 0);
}

// Builds the authored hero town once at startup: a fixed isometric camera, the
// sun + ambient (animated by daynight.system), every Kenney tile from the
// authored city, and warm spot lights over each street-lamp tile (lit in the
// evening by daynight.system).
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const renderProfile = this.startOptions.string("apertureRenderProfile");
    const shadowMapSize =
      renderProfile === "mobile" ? MOBILE_SHADOW_MAP_SIZE : SHADOW_MAP_SIZE;
    const cameraFocus = cameraRightOffset(
      CAMERA_START_YAW,
      CAMERA_COMPOSITION_RIGHT_OFFSET,
    );
    const cameraRigOffset = cameraOffset(CAMERA_START_YAW, CAMERA_ZOOM);
    this.spawn.camera({
      key: "camera.main",
      name: "Hero Camera",
      transform: {
        translation: [
          cameraFocus[0] + cameraRigOffset[0],
          cameraFocus[1] + cameraRigOffset[1],
          cameraFocus[2] + cameraRigOffset[2],
        ],
        lookAt: cameraFocus,
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
        mapSize: shadowMapSize,
        bias: 0.00035,
        normalBias: 0.018,
        slopeBias: 1.0,
        strength: 0.86,
        filterRadius: 1.2,
        center: [0, 0, 0],
        orthographicSize: SHADOW_ORTHOGRAPHIC_SIZE,
        near: 1,
        far: 90,
        lightDistance: 45,
      },
      transform: { rotationEulerDegrees: [-72, -83, 0] },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: [0.66, 0.74, 0.86, 1],
      intensity: 1.5,
    });

    // The authored city: every tile placed at (x, 0, z) with its quarter-turn.
    let windowIndex = 0;
    for (const tile of TILES) {
      this.spawn.gltf(this.assets.gltf(tile.id), {
        name: tile.id,
        tags: ["tile"],
        castShadow: tileCastsShadow(tile.id),
        receiveShadow: true,
        transform: {
          translation: [tile.x, 0, tile.z],
          rotation: tileRotation(tile.orientation),
        },
      });
      if (tileHasWindows(tile)) {
        for (const [column, floor] of windowPattern(tile)) {
          this.spawn.mesh({
            key: `window.glow.${windowIndex}`,
            name: "Glowing Window",
            tags: ["night-window"],
            mesh: mesh.plane({ size: WINDOW_SIZE }),
            material: material.standard({
              label: "Night Window Glow",
              baseColor: [1, 0.78, 0.32, 1],
              emissiveFactor: [3.8, 2.2, 0.5],
              roughness: 0.35,
              metallic: 0,
            }),
            castShadow: false,
            receiveShadow: false,
            transform: {
              translation: windowPosition(
                tile,
                WINDOW_COLUMNS[column],
                WINDOW_FLOORS[floor],
              ),
              rotation: windowRotation(tile),
            },
          });
          windowIndex += 1;
        }
      }
    }
    const garage = TILES.find((tile) => tile.id === "building-garage");
    if (garage !== undefined) {
      this.spawn.gltf(this.assets.gltf(GARAGE_TRUCK_ASSET_ID), {
        key: "prop.garage-truck",
        name: "Garage Truck",
        tags: ["prop", "vehicle", "garage-truck"],
        materials: GLTF_FRONT_SIDE_MATERIALS,
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: garageTruckPosition(garage),
          rotation: garageTruckRotation(garage),
          scale: [GARAGE_TRUCK_SCALE, GARAGE_TRUCK_SCALE, GARAGE_TRUCK_SCALE],
        },
      });
      HEADLIGHT_LOCAL_POSITIONS.forEach(([localX, localY, localZ], index) => {
        const markerPosition = garageTruckLocalToWorld(
          garage,
          localX,
          localY,
          localZ,
        );
        this.spawn.light({
          key: `light.garage-truck.headlight.${index}`,
          name: "Garage Truck Headlight",
          tags: ["headlight", "garage-truck-headlight"],
          kind: "spot",
          color: [1, 0.88, 0.62, 1],
          intensity: HEADLIGHT_INTENSITY,
          transform: {
            translation: markerPosition,
            lookAt: garageTruckLocalToWorld(
              garage,
              localX,
              localY,
              localZ + HEADLIGHT_LOOK_AHEAD,
            ),
          },
          light: {
            range: HEADLIGHT_RANGE,
            innerConeAngle: HEADLIGHT_INNER_CONE,
            outerConeAngle: HEADLIGHT_OUTER_CONE,
          },
        });
        this.spawn.mesh({
          key: `debug.garage-truck.headlight.sphere.${index}`,
          name: "Garage Truck Headlight Debug Sphere",
          tags: ["debug", "headlight-marker", "garage-truck-headlight"],
          mesh: mesh.sphere({ radius: HEADLIGHT_MARKER_RADIUS, segments: 12 }),
          material: material.standard({
            label: "Garage Truck Headlight Debug Marker",
            baseColor: [1, 0.88, 0.62, 1],
            emissiveFactor: [4.5, 3.2, 1.1],
            roughness: 0.2,
            metallic: 0,
          }),
          castShadow: false,
          receiveShadow: false,
          transform: { translation: markerPosition },
        });
      });
    }

    // A warm downward spot light over each street-lamp tile. They start dark
    // and DayNightSystem ramps their intensity up as the sun sets.
    let lampIndex = 0;
    for (const tile of TILES) {
      if (tile.id !== "road-straight-lightposts") {
        continue;
      }
      for (const side of [-1, 1] as const) {
        const position = lampPosition(tile, side);
        this.spawn.light({
          key: `light.lamp.${lampIndex}`,
          name: "Street Lamp",
          kind: "spot",
          color: [1.0, 0.74, 0.4, 1],
          intensity: 0,
          light: {
            range: LAMP_RANGE,
            innerConeAngle: LAMP_INNER_CONE,
            outerConeAngle: LAMP_OUTER_CONE,
          },
          transform: {
            translation: position,
            lookAt: lampLookAt(tile, side),
          },
        });
        this.spawn.mesh({
          key: `debug.light.lamp.${lampIndex}`,
          name: "Street Lamp Debug Sphere",
          tags: ["debug", "light-marker"],
          mesh: mesh.sphere({ radius: LIGHT_MARKER_RADIUS, segments: 12 }),
          material: material.standard({
            label: "Street Lamp Debug Marker",
            baseColor: [1, 0.78, 0.32, 1],
            emissiveFactor: [3.2, 1.8, 0.35],
            roughness: 0.25,
            metallic: 0,
          }),
          castShadow: false,
          receiveShadow: false,
          transform: { translation: position },
        });
        lampIndex += 1;
      }
    }
  }
}
