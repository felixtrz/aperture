import {
  Camera,
  Light,
  LightKind,
  Material,
  Mesh,
  createBoxMeshAsset,
  createCamera,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createLight,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  replayGltfEcsAuthoringCommands,
  type CameraInput,
  type GltfEcsCommandReplayReport,
  type LightInput,
  type MaterialAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  DebugMetadata,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type LocalTransformInput,
  type MaterialHandle,
  type MeshHandle,
  type Vec3Like,
  type Vec4Like,
} from "@aperture-engine/simulation";
import {
  type SystemAssetAccess,
  type SystemGltfAssetHandle,
  type SystemGltfLoadedScene,
} from "./systems-assets.js";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  registerApertureAppComponents,
} from "./systems-components.js";
import {
  formatReportDiagnostics,
  type SystemDiagnostics,
} from "./systems-diagnostics.js";
import { ApertureSystemError } from "./systems-error.js";

export interface SpawnMetadata {
  readonly name?: string;
  readonly key?: string;
  readonly tags?: readonly string[];
}

export interface SystemTransformInput extends LocalTransformInput {
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  readonly lookAt?: Vec3Like;
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  readonly illuminance?: number;
  readonly intensity?: number;
  readonly light?: LightInput;
}

export interface PrimitiveMeshDescriptor {
  readonly kind: "box" | "sphere" | "capsule" | "plane" | "cylinder" | "cone";
  readonly options: Record<string, unknown>;
}

export interface StandardMaterialDescriptor {
  readonly kind: "standard";
  readonly options: StandardMaterialOptions;
}

export interface StandardMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly roughness?: number;
  readonly metallic?: number;
  readonly label?: string;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: StandardMaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
}

export interface SpawnGltfOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
}

export interface SpawnCommands {
  camera(options?: SpawnCameraOptions): Entity;
  light(options?: SpawnLightOptions): Entity;
  mesh(options: SpawnMeshOptions): Entity;
  gltf(handle: SystemGltfAssetHandle, options?: SpawnGltfOptions): Entity;
}

export const mesh = Object.freeze({
  box(
    options: {
      readonly size?: number | Vec3Like;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(
    options: {
      readonly radius?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(
    options: {
      readonly size?: number | readonly [number, number];
      readonly subdivisions?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
});

export function createSpawnCommands(options: {
  readonly world: EcsWorld;
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly assets: SystemAssetAccess;
}): SpawnCommands {
  return {
    camera(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "camera");
      addTransform(entity, input.transform);
      entity.addComponent(
        Camera,
        createCamera({
          ...(input.camera ?? {}),
          ...(input.fovYDegrees === undefined
            ? {}
            : { fovYRadians: (input.fovYDegrees * Math.PI) / 180 }),
        }),
      );
      return entity;
    },
    light(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "light");
      addTransform(entity, input.transform);
      entity.addComponent(
        Light,
        createLight({
          ...(input.light ?? {}),
          kind: input.kind ?? input.light?.kind ?? LightKind.Directional,
          ...(input.color === undefined ? {} : { color: input.color }),
          intensity:
            input.illuminance ?? input.intensity ?? input.light?.intensity ?? 1,
        }),
      );
      return entity;
    },
    mesh(input) {
      const entity = createEntityWithMetadata(options.world, input, "mesh");
      const meshHandle = resolveMeshHandle(options, input);
      const materialHandle = resolveMaterialHandle(options, input);

      addTransform(entity, input.transform);
      entity.addComponent(Mesh, { meshId: assetHandleKey(meshHandle) });
      entity.addComponent(Material, {
        materialId: assetHandleKey(materialHandle),
      });
      return entity;
    },
    gltf(handle, input = {}) {
      if (!handle.ready.value) {
        throw new ApertureSystemError(
          "aperture.spawn.gltfNotReady",
          `GLTF asset '${handle.id}' is not ready.`,
          "Use preload: 'blocking', wait for this.assets.gltf(id).ready, or call this.commands.requestAsset(id) before spawning.",
        );
      }

      const loadedScene = handle.scene.value;

      if (loadedScene === null) {
        const entity = createEntityWithMetadata(options.world, input, "gltf");
        addTransform(entity, input.transform);
        entity.addComponent(DebugMetadata, {
          tag: "gltf",
          note: handle.url,
        });
        entity.addComponent(AppEntitySource, {
          kind: "gltf",
          assetId: handle.id,
          gltfNodePath: "placeholder",
        });
        return entity;
      }

      const replay = replayGltfLoadedScene(options.world, loadedScene);
      const root = firstReplayRootEntity(loadedScene, replay);

      applyGltfSourceMetadata(options.world, loadedScene, replay);
      applySpawnMetadata(options.world, root, input, "gltf");
      writeTransform(root, input.transform);
      upsertDebugMetadata(root, {
        tag: "gltf",
        note: handle.url,
      });
      return root;
    },
  };
}

function applyGltfSourceMetadata(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): void {
  registerApertureAppComponents(world);

  for (const [entityKey, entity] of replay.entitiesByKey) {
    upsertAppEntitySource(entity, sourceFromGltfEntityKey(scene, entityKey));
  }
}

function sourceFromGltfEntityKey(
  scene: SystemGltfLoadedScene,
  entityKey: string,
): {
  readonly kind: string;
  readonly assetId: string;
  readonly gltfNodeIndex: number;
  readonly gltfNodePath: string;
} {
  const prefix = `${scene.assetId}:`;
  const localKey = entityKey.startsWith(prefix)
    ? entityKey.slice(prefix.length)
    : entityKey;

  if (localKey.startsWith("scene:")) {
    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: -1,
      gltfNodePath: localKey,
    };
  }

  const match = /^node:(\d+)(?::mesh:(\d+):primitive:(\d+))?$/u.exec(localKey);

  if (match !== null) {
    const nodeIndex = Number(match[1]);
    const meshIndex = match[2] === undefined ? null : Number(match[2]);
    const primitiveIndex = match[3] === undefined ? null : Number(match[3]);

    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: nodeIndex,
      gltfNodePath:
        meshIndex === null || primitiveIndex === null
          ? `nodes[${nodeIndex}]`
          : `nodes[${nodeIndex}].mesh[${meshIndex}].primitives[${primitiveIndex}]`,
    };
  }

  return {
    kind: "gltf",
    assetId: scene.assetId,
    gltfNodeIndex: -1,
    gltfNodePath: localKey,
  };
}

function upsertAppEntitySource(
  entity: Entity,
  value: {
    readonly kind: string;
    readonly assetId: string;
    readonly gltfNodeIndex: number;
    readonly gltfNodePath: string;
  },
): void {
  if (entity.hasComponent(AppEntitySource)) {
    entity.setValue(AppEntitySource, "kind", value.kind);
    entity.setValue(AppEntitySource, "assetId", value.assetId);
    entity.setValue(AppEntitySource, "gltfNodeIndex", value.gltfNodeIndex);
    entity.setValue(AppEntitySource, "gltfNodePath", value.gltfNodePath);
    return;
  }

  entity.addComponent(AppEntitySource, value);
}

function replayGltfLoadedScene(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
): GltfEcsCommandReplayReport {
  const replay = replayGltfEcsAuthoringCommands({
    world,
    plan: scene.commandPlan,
  });

  if (!replay.valid) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfReplayFailed",
      `GLTF ECS commands could not be replayed. ${formatReportDiagnostics(
        replay.diagnostics,
      )}`,
      "Check the loaded glTF scene command plan diagnostics.",
    );
  }

  return replay;
}

function firstReplayRootEntity(
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): Entity {
  const rootKey = scene.commandPlan.rootEntityKeys[0];
  const root =
    rootKey === undefined
      ? undefined
      : (replay.entitiesByKey.get(rootKey) ??
        replay.entitiesByKey.values().next().value);

  if (root === undefined) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfRootMissing",
      "GLTF scene replay did not create a root entity.",
      "Check the loaded glTF scene traversal report.",
    );
  }

  return root;
}

function createEntityWithMetadata(
  world: EcsWorld,
  metadata: SpawnMetadata,
  fallbackName: string,
): Entity {
  const entity = world.createEntity();

  applySpawnMetadata(world, entity, metadata, fallbackName);
  return entity;
}

function applySpawnMetadata(
  world: EcsWorld,
  entity: Entity,
  metadata: SpawnMetadata,
  fallbackName: string,
): void {
  registerApertureAppComponents(world);

  if (!entity.hasComponent(Enabled)) {
    entity.addComponent(Enabled, { value: true });
  }

  if (metadata.name !== undefined) {
    upsertName(entity, metadata.name);
  } else if (!entity.hasComponent(Name)) {
    entity.addComponent(Name, { value: fallbackName });
  }

  if (metadata.key !== undefined) {
    assertUniqueKey(world, metadata.key);
    if (entity.hasComponent(AppEntityKey)) {
      entity.setValue(AppEntityKey, "value", metadata.key);
    } else {
      entity.addComponent(AppEntityKey, { value: metadata.key });
    }
  }

  if (metadata.tags !== undefined) {
    const valuesJson = JSON.stringify([...metadata.tags]);
    if (entity.hasComponent(AppEntityTags)) {
      entity.setValue(AppEntityTags, "valuesJson", valuesJson);
    } else {
      entity.addComponent(AppEntityTags, { valuesJson });
    }
  }
}

function upsertName(entity: Entity, value: string): void {
  if (entity.hasComponent(Name)) {
    entity.setValue(Name, "value", value);
    return;
  }

  entity.addComponent(Name, { value });
}

function upsertDebugMetadata(
  entity: Entity,
  value: { readonly tag: string; readonly note: string },
): void {
  if (entity.hasComponent(DebugMetadata)) {
    entity.setValue(DebugMetadata, "tag", value.tag);
    entity.setValue(DebugMetadata, "note", value.note);
    return;
  }

  entity.addComponent(DebugMetadata, value);
}

function assertUniqueKey(world: EcsWorld, key: string): void {
  const query = world.queryManager.registerQuery({
    required: [AppEntityKey],
    where: [{ component: AppEntityKey, key: "value", op: "eq", value: key }],
  });

  if (query.entities.size > 0) {
    throw new ApertureSystemError(
      "aperture.entityKey.duplicate",
      `Entity key '${key}' is already in use.`,
      "Use globally unique app keys or omit key and rely on { index, generation } identity.",
    );
  }
}

function addTransform(entity: Entity, input: SystemTransformInput = {}): void {
  writeTransform(entity, input);
}

function writeTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  const localInput: LocalTransformInput = {
    translation: input.translation,
    rotation: input.rotation ?? rotationFromTransformInput(input),
    scale: input.scale,
  };
  const root = createRootTransform(localInput);
  const parent = createParentInput(input.parent ?? null);
  const local = {
    translation: root.local.translation ?? [0, 0, 0],
    rotation: root.local.rotation ?? [0, 0, 0, 1],
    scale: root.local.scale ?? [1, 1, 1],
  } as const;
  const world = {
    col0: root.world.col0 ?? [1, 0, 0, 0],
    col1: root.world.col1 ?? [0, 1, 0, 0],
    col2: root.world.col2 ?? [0, 0, 1, 0],
    col3: root.world.col3 ?? [0, 0, 0, 1],
  } as const;

  if (entity.hasComponent(LocalTransform)) {
    entity.getVectorView(LocalTransform, "translation").set(local.translation);
    entity.getVectorView(LocalTransform, "rotation").set(local.rotation);
    entity.getVectorView(LocalTransform, "scale").set(local.scale);
  } else {
    entity.addComponent(LocalTransform, local);
  }

  if (entity.hasComponent(Parent)) {
    entity.setValue(Parent, "entity", parent.entity);
  } else {
    entity.addComponent(Parent, parent);
  }

  if (entity.hasComponent(WorldTransform)) {
    entity.getVectorView(WorldTransform, "col0").set(world.col0);
    entity.getVectorView(WorldTransform, "col1").set(world.col1);
    entity.getVectorView(WorldTransform, "col2").set(world.col2);
    entity.getVectorView(WorldTransform, "col3").set(world.col3);
  } else {
    entity.addComponent(WorldTransform, world);
  }
}

function createParentInput(parent: Entity | null): {
  readonly entity: Entity | null;
} {
  return { entity: parent };
}

function rotationFromTransformInput(
  input: SystemTransformInput,
): readonly [number, number, number, number] | undefined {
  if (input.rotationEulerDegrees !== undefined) {
    return quatFromEulerDegrees(input.rotationEulerDegrees);
  }

  if (input.lookAt !== undefined && input.translation !== undefined) {
    return quatLookAt(input.translation, input.lookAt);
  }

  return undefined;
}

function quatFromEulerDegrees(
  degrees: Vec3Like,
): readonly [number, number, number, number] {
  const x = (read3(degrees, 0) * Math.PI) / 180;
  const y = (read3(degrees, 1) * Math.PI) / 180;
  const z = (read3(degrees, 2) * Math.PI) / 180;
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

function quatLookAt(
  translation: Vec3Like,
  target: Vec3Like,
): readonly [number, number, number, number] {
  const dx = read3(target, 0) - read3(translation, 0);
  const dy = read3(target, 1) - read3(translation, 1);
  const dz = read3(target, 2) - read3(translation, 2);
  const length = Math.hypot(dx, dy, dz);

  if (length <= 1e-6) {
    return [0, 0, 0, 1];
  }

  const forward: [number, number, number] = [
    dx / length,
    dy / length,
    dz / length,
  ];
  let right = normalize3(cross3([0, 1, 0], negate3(forward)));

  if (right === null) {
    right = [1, 0, 0];
  }

  const up = cross3(negate3(forward), right);
  const back = negate3(forward);

  return quatFromBasis(right, up, back);
}

function negate3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [-value[0], -value[1], -value[2]];
}

function cross3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(
  value: readonly [number, number, number],
): [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 1e-6) {
    return null;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function quatFromBasis(
  right: readonly [number, number, number],
  up: readonly [number, number, number],
  back: readonly [number, number, number],
): readonly [number, number, number, number] {
  const m00 = right[0];
  const m01 = up[0];
  const m02 = back[0];
  const m10 = right[1];
  const m11 = up[1];
  const m12 = back[1];
  const m20 = right[2];
  const m21 = up[2];
  const m22 = back[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }

  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }

  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }

  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

function resolveMeshHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MeshHandle {
  if ("kind" in input.mesh && input.mesh.kind !== "mesh") {
    const id = `${input.key ?? input.name ?? "mesh"}.mesh`;
    const handle = createMeshHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      primitiveToMeshAsset(input.mesh),
    );
    return handle;
  }

  return input.mesh as MeshHandle;
}

function resolveMaterialHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MaterialHandle {
  if ("kind" in input.material && input.material.kind !== "material") {
    const id = `${input.key ?? input.name ?? "mesh"}.material`;
    const handle = createMaterialHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      materialDescriptorToAsset(input.material),
    );
    return handle;
  }

  return input.material as MaterialHandle;
}

function registerReadyAsset<TAsset>(
  registry: AssetRegistry,
  handle: MeshHandle | MaterialHandle,
  assetValue: TAsset,
): void {
  if (!registry.has(handle)) {
    registry.register(handle);
  }

  registry.markReady(handle, assetValue);
}

function primitiveToMeshAsset(
  descriptorValue: PrimitiveMeshDescriptor,
): MeshAsset {
  switch (descriptorValue.kind) {
    case "box": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size, size]
          : Array.isArray(size)
            ? size
            : [1, 1, 1];
      return createBoxMeshAsset({
        width: read3(tuple, 0),
        height: read3(tuple, 1),
        depth: read3(tuple, 2),
      });
    }
    case "sphere":
      return createSphereMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        widthSegments: numberOption(descriptorValue.options.segments, 32),
        heightSegments: numberOption(descriptorValue.options.segments, 16),
      });
    case "capsule":
      return createCapsuleMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 2),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "plane": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size]
          : Array.isArray(size)
            ? size
            : [1, 1];
      return createPlaneMeshAsset({
        width: read2(tuple, 0),
        height: read2(tuple, 1),
      });
    }
    case "cylinder":
      return createCylinderMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "cone":
      return createConeMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
  }
}

function materialDescriptorToAsset(
  descriptorValue: StandardMaterialDescriptor,
): MaterialAsset {
  return createStandardMaterialAsset({
    ...(descriptorValue.options.label === undefined
      ? {}
      : { label: descriptorValue.options.label }),
    ...(descriptorValue.options.baseColor === undefined
      ? {}
      : {
          baseColorFactor: new Float32Array([
            read4(descriptorValue.options.baseColor, 0),
            read4(descriptorValue.options.baseColor, 1),
            read4(descriptorValue.options.baseColor, 2),
            read4(descriptorValue.options.baseColor, 3),
          ]),
        }),
    ...(descriptorValue.options.roughness === undefined
      ? {}
      : { roughnessFactor: descriptorValue.options.roughness }),
    ...(descriptorValue.options.metallic === undefined
      ? {}
      : { metallicFactor: descriptorValue.options.metallic }),
  });
}

function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: Record<string, unknown>,
): PrimitiveMeshDescriptor {
  return Object.freeze({ kind, options: { ...options } });
}

function read2(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read3(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read4(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function numberOption(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
