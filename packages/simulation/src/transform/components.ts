import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "../ecs/index.js";
import {
  composeTrsMatrix,
  identityMat4,
  type Mat4Like,
  type QuatLike,
  type Vec3Like,
  type Vec4Like,
} from "@aperture-engine/math";

export interface LocalTransformInput {
  readonly translation?: Vec3Like;
  readonly rotation?: QuatLike;
  readonly scale?: Vec3Like;
}

export interface RootTransformInitialData {
  readonly local: ComponentInitialData<typeof LocalTransform>;
  readonly parent: ComponentInitialData<typeof Parent>;
  readonly world: ComponentInitialData<typeof WorldTransform>;
}

export function registerTransformComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(LocalTransform);
  world.registerComponent(Parent);
  world.registerComponent(WorldTransform);
  world.registerComponent(Children);
  return world;
}

export function registerMetadataComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Enabled);
  world.registerComponent(Name);
  world.registerComponent(DebugMetadata);
  return world;
}

export const LocalTransform = defineComponent(
  "aperture.transform.local",
  {
    translation: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    rotation: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    scale: { type: EcsType.Vec3, default: tuple3(1, 1, 1) },
  },
  "Authoritative ECS local transform using translation, x/y/z/w quaternion rotation, and scale.",
);

export const Parent = defineComponent(
  "aperture.transform.parent",
  {
    entity: { type: EcsType.Entity, default: null },
  },
  "Authoritative ECS transform parent. Null means this entity is a transform root.",
);

export const WorldTransform = defineComponent(
  "aperture.transform.world",
  {
    col0: { type: EcsType.Vec4, default: tuple4(1, 0, 0, 0) },
    col1: { type: EcsType.Vec4, default: tuple4(0, 1, 0, 0) },
    col2: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 0) },
    col3: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
  },
  "Derived ECS-owned world matrix stored as four Vec4 columns for extraction.",
);

export const Children = defineComponent(
  "aperture.transform.children",
  {
    // Ordered child entity list, stored as a JSON array of "index:generation"
    // ref strings (elics has no list/entity-array field type). Parent stays the
    // single source of truth for resolution (resolution.ts); Children is a
    // DERIVED convenience index kept consistent on every setParent mutation
    // (transform/hierarchy.ts). The generation in each ref makes stale entries
    // detectable, matching resolveActiveEntity semantics.
    refs: { type: EcsType.String, default: "[]" },
  },
  "Derived ordered child-entity index (JSON array of index:generation refs). Parent is authoritative; Children is kept consistent on setParent.",
);

export const Enabled = defineComponent(
  "aperture.metadata.enabled",
  {
    value: { type: EcsType.Boolean, default: true },
  },
  "General ECS enabled flag for systems that should ignore disabled entities.",
);

export const Name = defineComponent(
  "aperture.metadata.name",
  {
    value: { type: EcsType.String, default: "" },
  },
  "Human-readable entity label for diagnostics and tooling.",
);

export const DebugMetadata = defineComponent(
  "aperture.metadata.debug",
  {
    tag: { type: EcsType.String, default: "" },
    note: { type: EcsType.String, default: "" },
  },
  "Serializable debug metadata for diagnostics and agent handoff context.",
);

export function createLocalTransform(
  input: LocalTransformInput = {},
): ComponentInitialData<typeof LocalTransform> {
  return {
    translation: toTuple3(input.translation ?? [0, 0, 0]),
    rotation: toTuple4(input.rotation ?? [0, 0, 0, 1]),
    scale: toTuple3(input.scale ?? [1, 1, 1]),
  };
}

export function createParent(
  parent: Entity | null = null,
): ComponentInitialData<typeof Parent> {
  return { entity: parent };
}

export function createWorldTransform(
  matrix: Mat4Like = identityMat4(),
): ComponentInitialData<typeof WorldTransform> {
  return {
    col0: matColumn(matrix, 0),
    col1: matColumn(matrix, 1),
    col2: matColumn(matrix, 2),
    col3: matColumn(matrix, 3),
  };
}

export function createRootTransform(
  input: LocalTransformInput = {},
): RootTransformInitialData {
  const local = createLocalTransform(input);
  const matrix = composeTrsMatrix(
    local.translation,
    local.rotation,
    local.scale,
  );

  return {
    local,
    parent: createParent(null),
    world: createWorldTransform(matrix),
  };
}

function matColumn(
  matrix: Mat4Like,
  column: number,
): [number, number, number, number] {
  const offset = column * 4;
  return tuple4(
    read(matrix, offset),
    read(matrix, offset + 1),
    read(matrix, offset + 2),
    read(matrix, offset + 3),
  );
}

function toTuple3(values: Vec3Like): [number, number, number] {
  return tuple3(read(values, 0), read(values, 1), read(values, 2));
}

function toTuple4(values: Vec4Like): [number, number, number, number] {
  return tuple4(
    read(values, 0),
    read(values, 1),
    read(values, 2),
    read(values, 3),
  );
}

function tuple3(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

function tuple4(
  x: number,
  y: number,
  z: number,
  w: number,
): [number, number, number, number] {
  return [x, y, z, w];
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}
