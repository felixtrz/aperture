import {
  AppEntityKey,
  LocalTransform,
  ScreenSpaceFraming,
  WorldTransform,
  createScreenSpaceFraming,
  createSystem,
  material,
  mesh,
  quatFromEulerYXZ,
} from "@aperture-engine/app/systems";
import {
  CAMERA_FOV_Y_DEGREES,
  CAMERA_PITCH,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  CITY_COMPOSITION_BOUNDS,
  CITY_HALF_EXTENT,
  CITY_YAW,
  TILES,
  cameraOffset,
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
const CITY_TRUCK_ASSET_ID = "vehicle-truck-red";
const CITY_TRUCK_WORLD_POSITION = [
  1.7677669529663689, -0.02, -0.3535533905932736,
] as const;
const CITY_TRUCK_SCALE = 1 / 6;
const CITY_TRUCK_WORLD_YAW = (3 * Math.PI) / 4;
const HEADLIGHT_LOCAL_POSITIONS = [
  [-0.42, 0.55, 1.24],
  [0.42, 0.55, 1.24],
] as const;
const HEADLIGHT_LOOK_AHEAD = 1.8;
const HEADLIGHT_INTENSITY = 10;
const HEADLIGHT_RANGE = 2.2;
const HEADLIGHT_INNER_CONE = Math.PI / 12;
const HEADLIGHT_OUTER_CONE = Math.PI / 5;
const HEADLIGHT_MARKER_RADIUS = 0.025;
const CITY_FRAMING_BOUNDS_INSET_MAX = [0, 3, 0] as const;
const SHOW_FRAMING_DEBUG_AABB = false;
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
type LandingCityTile = (typeof TILES)[number];
type Vec3 = readonly [number, number, number];
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

function tileYaw(tile: LandingCityTile): number {
  return (tile.orientation * Math.PI) / 2 + CITY_YAW;
}

function tileLocalToWorld(
  tile: LandingCityTile,
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

function lampPosition(tile: LandingCityTile, side: -1 | 1) {
  return tileLocalToWorld(tile, side * LAMP_SIDE_OFFSET, LAMP_HEIGHT, 0);
}

function lampLookAt(tile: LandingCityTile, side: -1 | 1) {
  const position = lampPosition(tile, side);
  return [position[0], LAMP_LOOK_AT_Y, position[2]] as const;
}

function cityTruckRotation() {
  return quatFromEulerYXZ(0, CITY_TRUCK_WORLD_YAW, 0);
}

function cityTruckLocalToWorld(localX: number, localY: number, localZ: number) {
  const root = CITY_TRUCK_WORLD_POSITION;
  const yaw = CITY_TRUCK_WORLD_YAW;
  const x = localX * CITY_TRUCK_SCALE;
  const y = localY * CITY_TRUCK_SCALE;
  const z = localZ * CITY_TRUCK_SCALE;
  return [
    root[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    root[1] + y,
    root[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
  ] as const;
}

function tileHasWindows(tile: LandingCityTile): boolean {
  return windowPattern(tile).length > 0;
}

function windowPattern(tile: LandingCityTile): readonly WindowSlot[] {
  return BUILDING_WINDOW_PATTERNS[tile.id] ?? [];
}

function windowPosition(tile: LandingCityTile, localX: number, localY: number) {
  return tileLocalToWorld(tile, localX, localY, WINDOW_WALL_OFFSET);
}

function windowRotation(tile: LandingCityTile) {
  const yaw = (tile.orientation * Math.PI) / 2 + CITY_YAW;
  return quatFromEulerYXZ(0, yaw, 0);
}

function cityFramingDebugBounds() {
  const { min, max } = CITY_COMPOSITION_BOUNDS;
  return {
    min,
    max: [
      max[0] - CITY_FRAMING_BOUNDS_INSET_MAX[0],
      max[1] - CITY_FRAMING_BOUNDS_INSET_MAX[1],
      max[2] - CITY_FRAMING_BOUNDS_INSET_MAX[2],
    ] as const,
  };
}

function framingDebugLinePositions(): readonly Vec3[] {
  const { min, max } = cityFramingDebugBounds();
  const nnn = [min[0], min[1], min[2]] as const;
  const xnn = [max[0], min[1], min[2]] as const;
  const xxn = [max[0], max[1], min[2]] as const;
  const nxn = [min[0], max[1], min[2]] as const;
  const nnz = [min[0], min[1], max[2]] as const;
  const xnz = [max[0], min[1], max[2]] as const;
  const xxz = [max[0], max[1], max[2]] as const;
  const nxz = [min[0], max[1], max[2]] as const;

  return [
    nnn,
    xnn,
    xnn,
    xnz,
    xnz,
    nnz,
    nnz,
    nnn,
    nxn,
    xxn,
    xxn,
    xxz,
    xxz,
    nxz,
    nxz,
    nxn,
    nnn,
    nxn,
    xnn,
    xxn,
    xnz,
    xxz,
    nnz,
    nxz,
  ];
}

// Builds the authored landing town once at startup: a fixed isometric camera, the
// sun + ambient (animated by daynight.system), every Kenney tile from the
// authored city, and warm spot lights over each street-lamp tile (lit in the
// evening by daynight.system).
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const renderProfile = this.startOptions.string("apertureRenderProfile");
    const shadowMapSize =
      renderProfile === "mobile" ? MOBILE_SHADOW_MAP_SIZE : SHADOW_MAP_SIZE;
    const citySubject = this.createEntity();
    citySubject.addComponent(AppEntityKey, {
      value: "landing-city.subject",
    });
    citySubject.addComponent(LocalTransform);
    citySubject.addComponent(WorldTransform);

    const cameraFocus = [0, 0, 0] as const;
    const cameraRigOffset = cameraOffset(CAMERA_START_YAW, CAMERA_ZOOM);
    const camera = this.spawn.camera({
      key: "camera.main",
      name: "Landing Camera",
      transform: {
        translation: [
          cameraFocus[0] + cameraRigOffset[0],
          cameraFocus[1] + cameraRigOffset[1],
          cameraFocus[2] + cameraRigOffset[2],
        ],
        lookAt: cameraFocus,
      },
      fovYDegrees: CAMERA_FOV_Y_DEGREES,
      camera: { clearColor: [0.28, 0.46, 0.82, 1] },
    });
    camera.addComponent(
      ScreenSpaceFraming,
      createScreenSpaceFraming({
        subject: citySubject,
        slot: "landing-city",
        yawRadians: CAMERA_START_YAW,
        pitchRadians: CAMERA_PITCH,
        boundsMin: CITY_COMPOSITION_BOUNDS.min,
        boundsMax: CITY_COMPOSITION_BOUNDS.max,
        boundsInsetMax: CITY_FRAMING_BOUNDS_INSET_MAX,
        paddingPx: 0,
        minDistance: 4,
        maxDistance: 80,
        smoothingRate: 5.5,
      }),
    );

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

    if (SHOW_FRAMING_DEBUG_AABB) {
      this.spawn.mesh({
        key: "debug.framing.aabb.lines",
        name: "Screen-Space Framing AABB",
        tags: ["debug", "framing-aabb"],
        mesh: mesh.lineList({
          label: "Screen-Space Framing AABB Lines",
          positions: framingDebugLinePositions(),
        }),
        material: material.unlit({
          label: "Framing AABB Debug Lines",
          baseColor: [0.06, 1, 1, 1],
          renderState: {
            depth: { test: false, write: false, compare: "always" },
          },
        }),
        castShadow: false,
        receiveShadow: false,
      });
    }

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
    this.spawn.gltf(this.assets.gltf(CITY_TRUCK_ASSET_ID), {
      key: "prop.garage-truck",
      name: "Garage Truck",
      tags: ["prop", "vehicle", "garage-truck"],
      materials: GLTF_FRONT_SIDE_MATERIALS,
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: CITY_TRUCK_WORLD_POSITION,
        rotation: cityTruckRotation(),
        scale: [CITY_TRUCK_SCALE, CITY_TRUCK_SCALE, CITY_TRUCK_SCALE],
      },
    });
    HEADLIGHT_LOCAL_POSITIONS.forEach(([localX, localY, localZ], index) => {
      const markerPosition = cityTruckLocalToWorld(localX, localY, localZ);
      this.spawn.light({
        key: `light.garage-truck.headlight.${index}`,
        name: "Garage Truck Headlight",
        tags: ["headlight", "garage-truck-headlight"],
        kind: "spot",
        color: [1, 0.88, 0.62, 1],
        intensity: HEADLIGHT_INTENSITY,
        transform: {
          translation: markerPosition,
          lookAt: cityTruckLocalToWorld(
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
