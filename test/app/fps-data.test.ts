import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { createNoFetchGlbSourceLoaderReport } from "@aperture-engine/render";
import {
  CLOUDS,
  ENEMIES,
  FPS_ALL_RENDER_LAYER_MASK,
  FPS_INPUT_COMMAND_CHANNEL,
  FPS_RENDER_AMBIENT_COLOR,
  FPS_RENDER_AMBIENT_INTENSITY,
  FPS_RENDER_BACKGROUND_COLOR,
  FPS_RENDER_SUN_ROTATION,
  FPS_WEAPON_VIEW_POSITION,
  FPS_WEAPON_LAYER_MASK,
  FPS_WORLD_LAYER_MASK,
  LEVEL_INSTANCES,
  LEVEL_COLLIDERS,
  PLAYER_BODY_COLLIDER_OFFSET,
  PLAYER_BODY_EYE_OFFSET,
  PLAYER_BODY_HALF_HEIGHT,
  PLAYER_BODY_RADIUS,
  PLAYER_BODY_START,
  PLAYER_EYE_HEIGHT,
  PLAYER_START,
  PLATFORM_LARGE_GRASS_DECORATIONS,
  SOURCE_CLOUD_RANDOM_MAX,
  SOURCE_CLOUD_RANDOM_MIN,
  SOURCE_ENEMY_ATTACK_DAMAGE,
  SOURCE_ENEMY_ATTACK_DISTANCE,
  SOURCE_ENEMY_ATTACK_INTERVAL,
  SOURCE_ENEMY_HITBOX_OFFSET,
  SOURCE_ENEMY_HITBOX_RADIUS,
  SOURCE_ENEMY_HOVER_AMPLITUDE,
  SOURCE_ENEMY_HOVER_RATE,
  SOURCE_ENEMY_HOVER_VELOCITY,
  SOURCE_ENEMY_MUZZLE_OFFSETS,
  SOURCE_ENEMY_MUZZLE_ROLL_RANGE,
  SOURCE_ENEMY_RAYCAST_TARGET,
  SOURCE_ENV_AMBIENT_COLOR,
  SOURCE_ENV_AMBIENT_INTENSITY,
  SOURCE_ENV_BACKGROUND_COLOR,
  SOURCE_GAMEPAD_LOOK_SENSITIVITY,
  SOURCE_LOOK_LERP_RATE,
  SOURCE_LOOK_PITCH_LIMIT,
  SOURCE_MOUSE_SENSITIVITY,
  SOURCE_MOVEMENT_LERP_RATE,
  SOURCE_PLAYER_CAPSULE_HALF_HEIGHT,
  SOURCE_PLAYER_CAPSULE_HEIGHT,
  SOURCE_PLAYER_CAPSULE_RADIUS,
  SOURCE_PLAYER_CAMERA_CULL_MASK,
  SOURCE_PLAYER_CAMERA_FOV,
  SOURCE_PLAYER_COLLIDER_CENTER_Y,
  SOURCE_PLAYER_HEAD_Y,
  SOURCE_PLAYER_ROOT_Y,
  SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT,
  SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT,
  SOURCE_RESET_BODY_HOLD_FRAMES,
  SOURCE_SKY_ENERGY_MULTIPLIER,
  SOURCE_SUN_ROTATION,
  SOURCE_SUN_SHADOW_STRENGTH,
  SOURCE_WEAPON_CAMERA_CULL_MASK,
  SOURCE_WEAPON_CAMERA_ITEM_FOV,
  SOURCE_WEAPON_CONTAINER_INITIAL_POSITION,
  SOURCE_WEAPON_CONTAINER_OFFSET,
  SOURCE_WEAPON_MODEL_POSITION,
  SOURCE_WEAPON_MODEL_SCALE,
  SOURCE_WEAPON_MUZZLE_POSITION,
  SOURCE_WEAPON_SHOT_KICK,
  SOURCE_WEAPON_SWITCH_DROP_OFFSET,
  SOURCE_WEAPON_SWITCH_HIDE_DURATION,
  SOURCE_WEAPON_SWITCH_RAISE_RATE,
  SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE,
  SOURCE_WEAPON_VIEW_POSITION,
  ENEMY_MUZZLE_OFFSETS,
  WEAPONS,
  platformLargeGrassDecorationKey,
  sourceLevelColliderMeshId,
} from "../../fps/src/lib/fps-data.js";
import type { FpsInputCommand } from "../../fps/src/lib/fps-data.js";

describe("Starter Kit FPS source data", () => {
  it("derives player body/capsule data from the source Player scene", () => {
    expect(SOURCE_PLAYER_ROOT_Y).toBe(0.5);
    expect(SOURCE_PLAYER_HEAD_Y).toBe(1);
    expect(SOURCE_PLAYER_COLLIDER_CENTER_Y).toBe(0.55);
    expect(SOURCE_PLAYER_CAPSULE_RADIUS).toBe(0.3);
    expect(SOURCE_PLAYER_CAPSULE_HEIGHT).toBe(1);
    expect(SOURCE_PLAYER_CAMERA_FOV).toBe(80);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK).toBe(1_048_573);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK).toBe(1_047_554);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK & 1).toBe(1);
    expect(SOURCE_PLAYER_CAMERA_CULL_MASK & 2).toBe(0);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK & 1).toBe(0);
    expect(SOURCE_WEAPON_CAMERA_CULL_MASK & 2).toBe(2);
    expect(FPS_WORLD_LAYER_MASK).toBe(1);
    expect(FPS_WEAPON_LAYER_MASK).toBe(2);
    expect(FPS_ALL_RENDER_LAYER_MASK).toBe(3);
    expect(FPS_INPUT_COMMAND_CHANNEL).toBe("fps.input");

    const shootCommand = {
      kind: "button",
      action: "shoot",
      pressed: true,
    } satisfies FpsInputCommand;
    expect(shootCommand).toEqual({
      kind: "button",
      action: "shoot",
      pressed: true,
    });

    const lookCommand = {
      kind: "look",
      x: -10,
      y: 3,
    } satisfies FpsInputCommand;
    expect(lookCommand).toEqual({
      kind: "look",
      x: -10,
      y: 3,
    });

    expect(SOURCE_PLAYER_CAPSULE_HALF_HEIGHT).toBeCloseTo(0.2, 10);
    expect(PLAYER_BODY_RADIUS).toBe(SOURCE_PLAYER_CAPSULE_RADIUS);
    expect(PLAYER_BODY_HALF_HEIGHT).toBeCloseTo(
      SOURCE_PLAYER_CAPSULE_HALF_HEIGHT,
      10,
    );
    expect(PLAYER_BODY_COLLIDER_OFFSET).toEqual([0, 0.55, 0]);
    expect(PLAYER_BODY_EYE_OFFSET).toBe(1);
    expect(PLAYER_BODY_START).toEqual([0, 0.5, 0]);
    expect(PLAYER_EYE_HEIGHT).toBe(1.5);
    expect(PLAYER_START).toEqual([0, 1.5, 0]);
  });

  it("derives player look constants from the source Player script", () => {
    expect(SOURCE_MOUSE_SENSITIVITY).toBe(700);
    expect(SOURCE_MOVEMENT_LERP_RATE).toBe(10);
    expect(SOURCE_GAMEPAD_LOOK_SENSITIVITY).toBe(0.075);
    expect(SOURCE_LOOK_LERP_RATE).toBe(25);
    expect(SOURCE_LOOK_PITCH_LIMIT).toBeCloseTo(Math.PI / 2, 10);
    expect(SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT).toBe(26);
    expect(SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT).toBeCloseTo(26 / 700, 10);
    expect(SOURCE_RESET_BODY_HOLD_FRAMES).toBe(3);
  });

  it("derives player weapon view data from the source Player scene and Weapon resources", () => {
    expect(SOURCE_WEAPON_CONTAINER_INITIAL_POSITION).toEqual([1.2, -1, -2.25]);
    expect(SOURCE_WEAPON_CONTAINER_OFFSET).toEqual([1.2, -1.1, -2.75]);
    expect(SOURCE_WEAPON_MODEL_POSITION).toEqual([0, 0, 0]);
    expect(SOURCE_WEAPON_MODEL_SCALE).toEqual([1, 1, 1]);
    expect(SOURCE_WEAPON_VIEW_POSITION).toEqual([1.2, -1.1, -2.75]);
    expect(FPS_WEAPON_VIEW_POSITION).toEqual([2.75, -1.2, -2.75]);
    expect(SOURCE_WEAPON_MUZZLE_POSITION).toEqual([0.1, -0.4, 1.5]);
    expect(SOURCE_WEAPON_CAMERA_ITEM_FOV).toBe(40);
    expect(SOURCE_WEAPON_VIEWMODEL_MOVE_SCALE).toBeCloseTo(1 / 30, 10);
    expect(SOURCE_WEAPON_SHOT_KICK).toBe(0.25);
    expect(SOURCE_WEAPON_SWITCH_DROP_OFFSET).toBe(1);
    expect(SOURCE_WEAPON_SWITCH_HIDE_DURATION).toBe(0.1);
    expect(SOURCE_WEAPON_SWITCH_RAISE_RATE).toBe(10);

    expect(WEAPONS.map((weapon) => weapon.position)).toEqual([
      [2.75, -1.2, -2.75],
      [2.75, -1.2, -2.75],
    ]);
    expect(WEAPONS.map((weapon) => weapon.rotationEulerDegrees)).toEqual([
      [0, 180, 0],
      [0, 180, 0],
    ]);
    expect(WEAPONS.map((weapon) => weapon.scale)).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(WEAPONS.map((weapon) => weapon.muzzlePosition)).toEqual([
      [0.1, -0.4, 1.5],
      [0.1, -0.4, 1.5],
    ]);
  });

  it("keeps cloud hover data inside the source cloud random range", () => {
    expect(SOURCE_CLOUD_RANDOM_MIN).toBe(0.1);
    expect(SOURCE_CLOUD_RANDOM_MAX).toBe(2);
    expect(CLOUDS).toHaveLength(11);
    expect(new Set(CLOUDS.map((cloud) => cloud.key)).size).toBe(CLOUDS.length);

    for (const cloud of CLOUDS) {
      expect(cloud.hoverVelocity).toBeGreaterThanOrEqual(
        SOURCE_CLOUD_RANDOM_MIN,
      );
      expect(cloud.hoverVelocity).toBeLessThanOrEqual(SOURCE_CLOUD_RANDOM_MAX);
      expect(cloud.hoverRate).toBeGreaterThanOrEqual(SOURCE_CLOUD_RANDOM_MIN);
      expect(cloud.hoverRate).toBeLessThanOrEqual(SOURCE_CLOUD_RANDOM_MAX);
    }
  });

  it("derives enemy scene and script constants from the source Enemy files", () => {
    expect(SOURCE_ENEMY_HITBOX_OFFSET).toEqual([0, 0.25, 0]);
    expect(SOURCE_ENEMY_HITBOX_RADIUS).toBe(0.75);
    expect(SOURCE_ENEMY_RAYCAST_TARGET).toEqual([0, 0, 5]);
    expect(SOURCE_ENEMY_ATTACK_DISTANCE).toBe(5);
    expect(SOURCE_ENEMY_ATTACK_INTERVAL).toBe(0.25);
    expect(SOURCE_ENEMY_ATTACK_DAMAGE).toBe(5);
    expect(SOURCE_ENEMY_HOVER_VELOCITY).toBe(1);
    expect(SOURCE_ENEMY_HOVER_RATE).toBe(5);
    expect(SOURCE_ENEMY_HOVER_AMPLITUDE).toBeCloseTo(0.2, 10);
    expect(SOURCE_ENEMY_MUZZLE_OFFSETS).toEqual([
      [-0.45, 0.3, 0.4],
      [0.45, 0.3, 0.4],
    ]);
    expect(ENEMY_MUZZLE_OFFSETS).toBe(SOURCE_ENEMY_MUZZLE_OFFSETS);
    expect(SOURCE_ENEMY_MUZZLE_ROLL_RANGE).toBeCloseTo(Math.PI / 4, 10);
  });

  it("derives supported environment and sun values from the source main scene", () => {
    expect(SOURCE_ENV_BACKGROUND_COLOR).toEqual([
      0x5c / 0xff,
      0x64 / 0xff,
      0x76 / 0xff,
      1,
    ]);
    expect(SOURCE_ENV_AMBIENT_COLOR).toEqual([
      0xa9 / 0xff,
      0xb1 / 0xff,
      0xc5 / 0xff,
      1,
    ]);
    expect(SOURCE_ENV_AMBIENT_INTENSITY).toBe(1);
    expect(SOURCE_SKY_ENERGY_MULTIPLIER).toBe(0.5);
    expect(SOURCE_SUN_SHADOW_STRENGTH).toBe(0.75);
    expect(SOURCE_SUN_ROTATION[0]).toBeCloseTo(0.22707267, 8);
    expect(SOURCE_SUN_ROTATION[1]).toBeCloseTo(-0.76437232, 8);
    expect(SOURCE_SUN_ROTATION[2]).toBeCloseTo(-0.35643233, 8);
    expect(SOURCE_SUN_ROTATION[3]).toBeCloseTo(0.48695873, 8);
    expect(FPS_RENDER_BACKGROUND_COLOR).toEqual([0.36, 0.39, 0.46, 1]);
    expect(FPS_RENDER_AMBIENT_COLOR).toEqual([0.66, 0.69, 0.77, 1]);
    expect(FPS_RENDER_SUN_ROTATION).toEqual(SOURCE_SUN_ROTATION);
    expect(FPS_RENDER_AMBIENT_INTENSITY).toBe(1.1);
  });

  it("keeps platform-large-grass child decorations from the source packed scene", () => {
    expect(PLATFORM_LARGE_GRASS_DECORATIONS).toHaveLength(3);
    expect(
      PLATFORM_LARGE_GRASS_DECORATIONS.map((decoration) =>
        platformLargeGrassDecorationKey(
          "level.platform-large-grass.0",
          decoration,
        ),
      ),
    ).toEqual([
      "level.platform-large-grass.0.grass.0",
      "level.platform-large-grass.0.grass-small.0",
      "level.platform-large-grass.0.grass.1",
    ]);

    expect(PLATFORM_LARGE_GRASS_DECORATIONS[0]).toMatchObject({
      assetId: "grass",
      position: [-1.57788, 0.5, 1.72158],
    });
    expect(PLATFORM_LARGE_GRASS_DECORATIONS[2]).toMatchObject({
      assetId: "grass",
      yawDegrees: -38.5,
    });
  });

  it("keeps level platform and wall transforms aligned with the source main scene", () => {
    const sourceInstances = extractSourceSceneInstances(
      readStarterKitSource("scenes/main.tscn"),
      "Level",
      SOURCE_LEVEL_KEY_BY_NODE,
    );
    expect(sourceInstances).toHaveLength(LEVEL_INSTANCES.length);

    const apertureInstances = new Map(
      LEVEL_INSTANCES.map((instance) => [instance.key, instance]),
    );
    for (const source of sourceInstances) {
      const aperture = apertureInstances.get(source.key);
      expect(aperture).toBeDefined();
      expect(aperture?.assetId).toBe(source.assetId);
      expectVec3Close(aperture?.position, source.position);
      expectYawClose(aperture?.yawDegrees, source.yawDegrees);
    }
  });

  it("keeps enemy positions aligned with the source main scene", () => {
    const sourceEnemies = extractSourceSceneInstances(
      readStarterKitSource("scenes/main.tscn"),
      "Enemies",
      SOURCE_ENEMY_KEY_BY_NODE,
    );
    expect(sourceEnemies).toHaveLength(ENEMIES.length);

    const apertureEnemies = new Map(ENEMIES.map((enemy) => [enemy.key, enemy]));
    for (const source of sourceEnemies) {
      const aperture = apertureEnemies.get(source.key);
      expect(aperture).toBeDefined();
      expectVec3Close(aperture?.position, source.position);
    }
  });

  it("uses source GLB mesh primitives for static level colliders", () => {
    expect(LEVEL_COLLIDERS).toHaveLength(13);
    expect(sourceLevelColliderMeshId("platform")).toBe(
      "mesh:platform:mesh:0:primitive:0",
    );
    expect(new Set(LEVEL_COLLIDERS.map((collider) => collider.meshId))).toEqual(
      new Set([
        "mesh:platform-large-grass:mesh:0:primitive:0",
        "mesh:platform:mesh:0:primitive:0",
        "mesh:wall-low:mesh:0:primitive:0",
        "mesh:wall-high:mesh:0:primitive:0",
      ]),
    );

    expect(
      LEVEL_COLLIDERS.find(
        (collider) => collider.key === "level.platform.0.collider",
      ),
    ).toMatchObject({
      position: [-2.5, 0, 6.5],
      meshId: "mesh:platform:mesh:0:primitive:0",
    });
    expect(
      LEVEL_COLLIDERS.find(
        (collider) => collider.key === "level.platform-large-grass.0.collider",
      ),
    ).toMatchObject({
      position: [0, -0.5, 0],
      meshId: "mesh:platform-large-grass:mesh:0:primitive:0",
    });
  });

  it("keeps cooked platform collider mesh bounds covering source collision shapes", () => {
    expectAssetColliderBoundsMatchSourceShape({
      assetId: "platform",
      sourceScene: "objects/platform.tscn",
    });
    expectAssetColliderBoundsMatchSourceShape({
      assetId: "platform-large-grass",
      sourceScene: "objects/platform_large_grass.tscn",
    });
  });
});

interface SourceSceneInstance {
  readonly key: string;
  readonly assetId: string;
  readonly position: readonly [number, number, number];
  readonly yawDegrees?: number | undefined;
}

const SOURCE_LEVEL_KEY_BY_NODE: Readonly<Record<string, string>> = {
  "wall-low": "level.wall-low.0",
  "wall-low3": "level.wall-low.1",
  platform: "level.platform.0",
  platform2: "level.platform.1",
  platform3: "level.platform.2",
  platform4: "level.platform.3",
  "wall-high": "level.wall-high.0",
  "wall-high2": "level.wall-high.1",
  "platform-large-grass": "level.platform-large-grass.0",
  "platform-large-grass2": "level.platform-large-grass.1",
  "platform-large-grass3": "level.platform-large-grass.2",
  "platform-large-grass5": "level.platform-large-grass.3",
  "platform-large-grass4": "level.platform-large-grass.4",
};

const SOURCE_ENEMY_KEY_BY_NODE: Readonly<Record<string, string>> = {
  "enemy-flying": "enemy.0",
  "enemy-flying2": "enemy.1",
  "enemy-flying3": "enemy.2",
  "enemy-flying4": "enemy.3",
};

const SOURCE_COLLIDER_HORIZONTAL_PADDING_TOLERANCE = 0.151;

function readStarterKitSource(relativePath: string): string {
  return readFileSync(
    new URL(
      `../../references/Starter-Kit-FPS/${relativePath}`,
      import.meta.url,
    ),
    "utf8",
  );
}

function readFpsAssetBytes(relativePath: string): Uint8Array {
  return readFileSync(
    new URL(`../../fps/public/${relativePath}`, import.meta.url),
  );
}

function expectAssetColliderBoundsMatchSourceShape(input: {
  readonly assetId: string;
  readonly sourceScene: string;
}): void {
  const sourceBounds = extractPackedVector3ArrayBounds(
    readStarterKitSource(input.sourceScene),
  );
  const report = createNoFetchGlbSourceLoaderReport({
    source: readFpsAssetBytes(`models/${input.assetId}.glb`),
    createMeshAssets: true,
  });
  const meshConstruction =
    report.glbImportReport.importReport?.meshConstruction;
  const mesh = meshConstruction?.meshes[0]?.mesh;

  expect(meshConstruction?.valid).toBe(true);
  expect(mesh?.label).toBe("mesh:gltf:mesh:0:primitive:0");
  expectRuntimeColliderBoundsCoverSourceShape(mesh?.localAabb, sourceBounds);
}

function extractPackedVector3ArrayBounds(sceneSource: string): {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
} {
  const packed = sceneSource.match(/data = PackedVector3Array\(([^)]+)\)/)?.[1];
  if (packed === undefined) {
    throw new Error("Missing PackedVector3Array collision shape data.");
  }
  const values = packed.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.length % 3 !== 0 ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Invalid PackedVector3Array collision shape data.");
  }

  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (let i = 0; i < values.length; i += 3) {
    for (const axis of [0, 1, 2] as const) {
      const value = values[i + axis]!;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }

  return { min, max };
}

function expectRuntimeColliderBoundsCoverSourceShape(
  runtime:
    | {
        readonly min: readonly [number, number, number];
        readonly max: readonly [number, number, number];
      }
    | undefined,
  source: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
): void {
  expect(runtime).toBeDefined();

  for (const axis of [0, 2] as const) {
    expect(runtime?.min[axis]).toBeLessThanOrEqual(source.min[axis] + 0.0001);
    expect(runtime?.max[axis]).toBeGreaterThanOrEqual(
      source.max[axis] - 0.0001,
    );
    expect(source.min[axis] - (runtime?.min[axis] ?? 0)).toBeLessThanOrEqual(
      SOURCE_COLLIDER_HORIZONTAL_PADDING_TOLERANCE,
    );
    expect((runtime?.max[axis] ?? 0) - source.max[axis]).toBeLessThanOrEqual(
      SOURCE_COLLIDER_HORIZONTAL_PADDING_TOLERANCE,
    );
  }

  expect(runtime?.min[1]).toBeCloseTo(source.min[1], 4);
  expect(runtime?.max[1]).toBeCloseTo(source.max[1], 4);
}

function extractSourceSceneInstances(
  sceneSource: string,
  parent: string,
  keyByNodeName: Readonly<Record<string, string>>,
): readonly SourceSceneInstance[] {
  const resources = extractExtResources(sceneSource);
  const instances: SourceSceneInstance[] = [];
  let current:
    | {
        readonly name: string;
        readonly parent: string;
        readonly resourceId: string;
        transform: readonly number[] | undefined;
      }
    | undefined;

  const flushCurrent = () => {
    if (current === undefined) return;
    if (current.parent !== parent) return;

    const key = keyByNodeName[current.name];
    if (key === undefined) return;

    const sourcePath = resources.get(current.resourceId);
    if (sourcePath === undefined) {
      throw new Error(`Missing source resource '${current.resourceId}'.`);
    }

    const transform = current.transform ?? IDENTITY_TRANSFORM_3D;
    instances.push({
      key,
      assetId: sourceAssetId(sourcePath),
      position: [transform[9] ?? 0, transform[10] ?? 0, transform[11] ?? 0],
      yawDegrees: sourceLevelYawDegrees(transform),
    });
  };

  for (const line of sceneSource.split(/\r?\n/)) {
    const header = parseNodeHeader(line);
    if (header !== undefined) {
      flushCurrent();
      current = header;
      continue;
    }

    const transform = parseTransform3d(line);
    if (transform !== undefined && current !== undefined) {
      current.transform = transform;
    }
  }
  flushCurrent();

  return instances;
}

function extractExtResources(sceneSource: string): ReadonlyMap<string, string> {
  const resources = new Map<string, string>();
  const resourcePattern =
    /^\[ext_resource [^\]]*path="([^"]+)"[^\]]* id="([^"]+)"[^\]]*\]$/gm;
  for (const match of sceneSource.matchAll(resourcePattern)) {
    const [, sourcePath, id] = match;
    if (sourcePath !== undefined && id !== undefined) {
      resources.set(id, sourcePath);
    }
  }
  return resources;
}

function parseNodeHeader(line: string):
  | {
      readonly name: string;
      readonly parent: string;
      readonly resourceId: string;
      transform: readonly number[] | undefined;
    }
  | undefined {
  if (!line.startsWith("[node ")) return undefined;
  const name = line.match(/\bname="([^"]+)"/)?.[1];
  const parent = line.match(/\bparent="([^"]+)"/)?.[1];
  const resourceId = line.match(/\binstance=ExtResource\("([^"]+)"\)/)?.[1];
  if (name === undefined || parent === undefined || resourceId === undefined) {
    return undefined;
  }
  return { name, parent, resourceId, transform: undefined };
}

function parseTransform3d(line: string): readonly number[] | undefined {
  const transform = line.match(/^transform = Transform3D\(([^)]+)\)$/)?.[1];
  if (transform === undefined) return undefined;
  const values = transform.split(",").map((value) => Number(value.trim()));
  if (values.length !== 12 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid Transform3D line: ${line}`);
  }
  return values;
}

function sourceAssetId(sourcePath: string): string {
  const fileName = sourcePath.split("/").pop();
  if (fileName === undefined) {
    throw new Error(`Invalid source path '${sourcePath}'.`);
  }
  return fileName.replace(/\.tscn$/, "").replaceAll("_", "-");
}

function sourceLevelYawDegrees(
  transform: readonly number[],
): number | undefined {
  const degrees = normalizeYaw(
    (-Math.atan2(transform[2] ?? 0, transform[0] ?? 1) * 180) / Math.PI,
  );
  return Math.abs(degrees) < 0.001 ? undefined : degrees;
}

function normalizeYaw(value: number): number {
  let normalized = value;
  while (normalized <= -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  if (Math.abs(normalized) < 0.001) return 0;
  if (Math.abs(Math.abs(normalized) - 180) < 0.001) return 180;
  return normalized;
}

function expectVec3Close(
  actual: readonly number[] | undefined,
  expected: readonly [number, number, number],
): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(3);
  expect(actual?.[0]).toBeCloseTo(expected[0], 4);
  expect(actual?.[1]).toBeCloseTo(expected[1], 4);
  expect(actual?.[2]).toBeCloseTo(expected[2], 4);
}

function expectYawClose(
  actual: number | undefined,
  expected: number | undefined,
): void {
  expect(normalizeYaw(actual ?? 0)).toBeCloseTo(normalizeYaw(expected ?? 0), 4);
}

const IDENTITY_TRANSFORM_3D = Object.freeze([
  1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
]);
