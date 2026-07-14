import {
  LocalTransform,
  Parent,
  WorldTransform,
  composeTrsMatrix,
  decomposeTrsMatrix,
  identityMat4,
  invertMat4,
  multiplyMat4,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  transformVector,
  type EcsWorld,
  type Entity,
  type Mat4,
  type Vec3Like,
} from "@aperture-engine/simulation";
import { Pickable, createPickable } from "@aperture-engine/render";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { material, mesh } from "../systems/spawn/descriptors.js";
import type { SpawnCommands } from "../systems/spawn/types.js";
import type { HierarchyAccess } from "../systems/hierarchy.js";
import type { CameraAccess } from "../systems/cameras.js";
import type {
  InteractionAccess,
  InteractionUnsubscribe,
} from "../interaction/access.js";
import type { PointerInteractionEvent } from "../interaction/pointer-events.js";
import {
  rayPlaneIntersection,
  signedAngleOnPlane,
  snapToIncrement,
  type GizmoVec3,
} from "./gizmo-math.js";

// H2: a reusable ROTATE gizmo built entirely from ECS entities (no renderer
// overlay), joining the translate gizmo. It spawns three axis-ring Pickable tori
// parented to the target (world-preserving setParent) and world-aligns them so
// each ring's plane normal is a world axis. On drag of a ring it projects the
// pointer ray onto the ring's axis-plane through the target's world position,
// measures the signed angle swept from the drag-start radial direction to the
// current one, optionally snaps it (`snapAngle`), and composes that incremental
// rotation about the (parent-local) world axis with the drag-start rotation —
// written back to the target's LocalTransform rotation quaternion. The angle
// projection is guarded against the degenerate case where the ray is nearly
// parallel to the ring plane (edge-on). Headless/worker-safe: pure math + ECS
// writes, no DOM.

const DEFAULT_SIZE = 2;
const DEFAULT_THICKNESS = 0.08;
const DEFAULT_LAYER_MASK = 2;
const DEFAULT_TAG = "gizmo";
const AXIS_DIRECTION_EPSILON = 1e-9;

/** The subset of the system context the gizmo needs (ApertureSystemContext satisfies it). */
export interface RotateGizmoContext {
  readonly world: EcsWorld;
  readonly spawn: Pick<SpawnCommands, "mesh">;
  readonly hierarchy: Pick<HierarchyAccess, "setParent">;
  readonly interaction: Pick<InteractionAccess, "onDrag">;
  readonly cameras: Pick<CameraAccess, "main">;
}

export interface RotateGizmoOptions {
  /** The entity the gizmo rotates (its LocalTransform rotation is written). */
  readonly target: EcsEntityRef;
  /** Ring radius (distance of the ring from the target center). */
  readonly size?: number;
  /** Ring tube thickness. */
  readonly thickness?: number;
  /** Pickable layer mask for the handles (so callers can exclude them). */
  readonly layerMask?: number;
  /** Tag applied to each handle entity. */
  readonly tag?: string;
  /**
   * Snap the applied angle to the nearest multiple of this many radians. `0` or
   * `undefined` disables snapping (free rotation).
   */
  readonly snapAngle?: number;
}

export interface RotateGizmoHandles {
  readonly x: EcsEntityRef;
  readonly y: EcsEntityRef;
  readonly z: EcsEntityRef;
}

export interface RotateGizmo {
  readonly target: EcsEntityRef;
  readonly handles: RotateGizmoHandles;
  /**
   * Re-align the axis rings to the WORLD axes at the target's current world
   * position, so a rotated/scaled target keeps world-aligned rings. Call once
   * per frame after the target moves; it is a no-op for an unrotated, unit-scale
   * target.
   */
  sync(world: EcsWorld): void;
  /** Unsubscribe the drag handlers and destroy the handle entities. */
  dispose(): void;
}

interface RingSpec {
  readonly name: "x" | "y" | "z";
  readonly axis: GizmoVec3;
  /**
   * Orientation of the torus so its ring-plane normal points along `axis`. The
   * Aperture torus is generated in the XZ plane (ring-plane normal +Y), so the
   * Y ring is identity and the X/Z rings rotate that default normal onto their
   * world axis.
   */
  readonly orientation: readonly [number, number, number, number];
  readonly color: readonly [number, number, number, number];
}

const RINGS: readonly RingSpec[] = [
  {
    name: "x",
    axis: [1, 0, 0],
    orientation: quatTuple(quatFromAxisAngle([0, 0, 1], -Math.PI / 2)),
    color: [0.9, 0.2, 0.2, 1],
  },
  {
    name: "y",
    axis: [0, 1, 0],
    orientation: [0, 0, 0, 1],
    color: [0.2, 0.85, 0.3, 1],
  },
  {
    name: "z",
    axis: [0, 0, 1],
    orientation: quatTuple(quatFromAxisAngle([1, 0, 0], Math.PI / 2)),
    color: [0.25, 0.45, 1, 1],
  },
];

interface RotateDragState {
  readonly axis: GizmoVec3;
  /** Target world position at drag start (the ring plane point). */
  readonly anchor: GizmoVec3;
  /** Target LocalTransform rotation quaternion at drag start. */
  readonly startRotation: readonly [number, number, number, number];
  /** Radial direction in the ring plane at drag start (null until established). */
  startDir: GizmoVec3 | null;
}

export function createRotateGizmo(
  context: RotateGizmoContext,
  options: RotateGizmoOptions,
): RotateGizmo {
  const target = options.target;
  const size = options.size ?? DEFAULT_SIZE;
  const thickness = options.thickness ?? DEFAULT_THICKNESS;
  const layerMask = options.layerMask ?? DEFAULT_LAYER_MASK;
  const tag = options.tag ?? DEFAULT_TAG;
  const snapAngle = options.snapAngle;

  const unsubscribes: InteractionUnsubscribe[] = [];
  const handleRefs: Partial<Record<"x" | "y" | "z", EcsEntityRef>> = {};
  let active: RotateDragState | null = null;

  for (const spec of RINGS) {
    const handle = context.spawn.mesh({
      key: `gizmo.rotate.${spec.name}`,
      name: `RotateHandle${spec.name.toUpperCase()}`,
      tags: [tag],
      mesh: mesh.torus({
        radius: size,
        tube: thickness,
        radialSegments: 16,
        tubularSegments: 48,
      }),
      material: material.standard({ baseColor: spec.color, roughness: 0.5 }),
      transform: { rotation: spec.orientation },
    });
    handle.addComponent(Pickable, createPickable({ enabled: true, layerMask }));

    const handleRef: EcsEntityRef = {
      index: handle.index,
      generation: handle.generation,
    };
    handleRefs[spec.name] = handleRef;

    // Parent to the target (world-preserving), then pin the ring orientation so
    // it sits world-aligned at the target regardless of the target's pose.
    context.hierarchy.setParent(handleRef, target);
    handle.getVectorView(LocalTransform, "rotation").set(spec.orientation);

    const axis = spec.axis;
    unsubscribes.push(
      context.interaction.onDrag(handleRef, (event) => {
        handleDrag(context, target, axis, snapAngle, event, {
          get: () => active,
          set: (next) => {
            active = next;
          },
        });
      }),
    );
  }

  return {
    target,
    handles: {
      x: handleRefs.x as EcsEntityRef,
      y: handleRefs.y as EcsEntityRef,
      z: handleRefs.z as EcsEntityRef,
    },
    sync(world) {
      const resolvedTarget = resolveActiveEntity(world, target);
      if (
        !resolvedTarget.ok ||
        !resolvedTarget.entity.hasComponent(WorldTransform)
      ) {
        return;
      }
      const targetWorld = readWorldMatrix(resolvedTarget.entity);
      const inverseTargetWorld = invertMat4(targetWorld);
      if (inverseTargetWorld === null) {
        return;
      }
      const col3 = resolvedTarget.entity.getVectorView(WorldTransform, "col3");

      for (const spec of RINGS) {
        const ref = handleRefs[spec.name];
        if (ref === undefined) {
          continue;
        }
        const resolvedHandle = resolveActiveEntity(world, ref);
        if (
          !resolvedHandle.ok ||
          !resolvedHandle.entity.hasComponent(LocalTransform)
        ) {
          continue;
        }

        const desiredWorld = composeTrsMatrix(
          [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0],
          spec.orientation,
          [1, 1, 1],
        );
        const handleLocal = decomposeTrsMatrix(
          multiplyMat4(inverseTargetWorld, desiredWorld),
        );
        if (handleLocal === null) {
          continue;
        }
        const entity = resolvedHandle.entity;
        entity
          .getVectorView(LocalTransform, "translation")
          .set(handleLocal.translation);
        entity
          .getVectorView(LocalTransform, "rotation")
          .set(handleLocal.rotation);
        entity.getVectorView(LocalTransform, "scale").set(handleLocal.scale);
      }
    },
    dispose() {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
      for (const ref of [handleRefs.x, handleRefs.y, handleRefs.z]) {
        if (ref === undefined) {
          continue;
        }
        const resolved = resolveActiveEntity(context.world, ref);
        if (resolved.ok) {
          resolved.entity.destroy();
        }
      }
    },
  };
}

interface ActiveSlot {
  get(): RotateDragState | null;
  set(next: RotateDragState | null): void;
}

function handleDrag(
  context: RotateGizmoContext,
  target: EcsEntityRef,
  axis: GizmoVec3,
  snapAngle: number | undefined,
  event: PointerInteractionEvent,
  slot: ActiveSlot,
): void {
  if (event.type === "dragStart") {
    const resolved = resolveActiveEntity(context.world, target);
    if (!resolved.ok) {
      return;
    }
    const anchor = worldTranslation(resolved.entity);
    const startRotation = localRotation(resolved.entity);
    const ray = context.cameras.main.rayFromPointer(event.position);
    const hit = rayPlaneIntersection(
      anchor,
      axis,
      toTuple(ray.origin),
      toTuple(ray.direction),
    );
    slot.set({
      axis,
      anchor,
      startRotation,
      startDir: hit === null ? null : sub(hit, anchor),
    });
    return;
  }

  if (event.type === "dragEnd") {
    slot.set(null);
    return;
  }

  if (event.type !== "drag") {
    return;
  }

  const state = slot.get();
  if (state === null) {
    return;
  }
  const ray = context.cameras.main.rayFromPointer(event.position);
  const hit = rayPlaneIntersection(
    state.anchor,
    state.axis,
    toTuple(ray.origin),
    toTuple(ray.direction),
  );
  if (hit === null) {
    // Degenerate this frame (ray ~parallel to the ring plane) — skip the update.
    return;
  }
  const currentDir = sub(hit, state.anchor);
  if (state.startDir === null) {
    state.startDir = currentDir;
    return;
  }

  const angle = snapToIncrement(
    signedAngleOnPlane(state.axis, state.startDir, currentDir),
    snapAngle,
  );

  const resolved = resolveActiveEntity(context.world, target);
  if (!resolved.ok || !resolved.entity.hasComponent(LocalTransform)) {
    return;
  }

  // The swept angle is about a WORLD axis; LocalTransform.rotation lives in the
  // target's PARENT space. Rotating about a world axis by θ, expressed in
  // parent-local space, is a rotation about the same axis mapped into the
  // parent's frame — so convert the world axis through the parent inverse and
  // premultiply the drag-start rotation.
  const localAxis = worldAxisToParentLocal(resolved.entity, state.axis);
  const delta = quatFromAxisAngle(localAxis, angle);
  const next = quatNormalize(
    quatMultiply(delta, [
      state.startRotation[0],
      state.startRotation[1],
      state.startRotation[2],
      state.startRotation[3],
    ]),
  );
  resolved.entity
    .getVectorView(LocalTransform, "rotation")
    .set([next[0], next[1], next[2], next[3]]);
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();
  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

function resolveParent(entity: Entity): Entity | null {
  if (!entity.hasComponent(Parent)) {
    return null;
  }
  const parent = entity.getValue(Parent, "entity");
  return parent === null || parent === undefined ? null : parent;
}

function worldAxisToParentLocal(
  entity: Entity,
  worldAxis: GizmoVec3,
): GizmoVec3 {
  const parent = resolveParent(entity);
  if (parent === null || !parent.hasComponent(WorldTransform)) {
    return worldAxis;
  }
  const inverseParentWorld = invertMat4(readWorldMatrix(parent));
  if (inverseParentWorld === null) {
    return worldAxis;
  }
  const local = transformVector(inverseParentWorld, worldAxis);
  const len = Math.hypot(local[0] ?? 0, local[1] ?? 0, local[2] ?? 0);
  if (len <= AXIS_DIRECTION_EPSILON) {
    return worldAxis;
  }
  return [(local[0] ?? 0) / len, (local[1] ?? 0) / len, (local[2] ?? 0) / len];
}

function worldTranslation(entity: Entity): GizmoVec3 {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

function localRotation(
  entity: Entity,
): readonly [number, number, number, number] {
  const r = entity.getVectorView(LocalTransform, "rotation");
  return [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 1];
}

function sub(a: GizmoVec3, b: GizmoVec3): GizmoVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function toTuple(values: Vec3Like): GizmoVec3 {
  return [read(values, 0), read(values, 1), read(values, 2)];
}

function quatTuple(
  values: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
}

function read(values: Vec3Like, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }
  return value;
}
