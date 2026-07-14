import {
  LocalTransform,
  WorldTransform,
  composeTrsMatrix,
  decomposeTrsMatrix,
  identityMat4,
  invertMat4,
  multiplyMat4,
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
  closestPointParamOnAxis,
  guardScale,
  inPlaneRightAxis,
  rayPlaneIntersection,
  scaleFactorFromDelta,
  snapToIncrement,
  type GizmoVec3,
} from "./gizmo-math.js";

// H2: a reusable SCALE gizmo built entirely from ECS entities (no renderer
// overlay), joining the translate + rotate gizmos. It spawns three axis-handle
// Pickable boxes (one per world axis) plus an optional uniform center handle,
// parented to the target and world-aligned. Dragging an axis handle reuses the
// translate gizmo's closest-point-on-axis projection to turn pointer motion into
// an axis-parameter delta, maps that delta to a multiplicative scale factor, and
// writes the target's LocalTransform scale along that axis only; the uniform
// handle measures horizontal pointer displacement on the camera-facing drag
// plane and scales all three axes together. Scale snapping (`snapIncrement`)
// quantizes the resulting scale, and every write is clamped to a small positive
// minimum so a drag can never produce a non-positive/degenerate scale. The
// projections are guarded against degenerate (parallel) frames. Headless/worker-
// safe: pure math + ECS writes, no DOM.

const DEFAULT_SIZE = 2;
const DEFAULT_THICKNESS = 0.3;
const DEFAULT_LAYER_MASK = 2;
const DEFAULT_TAG = "gizmo";

/** The subset of the system context the gizmo needs (ApertureSystemContext satisfies it). */
export interface ScaleGizmoContext {
  readonly world: EcsWorld;
  readonly spawn: Pick<SpawnCommands, "mesh">;
  readonly hierarchy: Pick<HierarchyAccess, "setParent">;
  readonly interaction: Pick<InteractionAccess, "onDrag">;
  readonly cameras: Pick<CameraAccess, "main">;
}

export interface ScaleGizmoOptions {
  /** The entity the gizmo scales (its LocalTransform scale is written). */
  readonly target: EcsEntityRef;
  /** Handle length along its axis (the reference distance for the scale factor). */
  readonly size?: number;
  /** Handle cross-section thickness. */
  readonly thickness?: number;
  /** Pickable layer mask for the handles (so callers can exclude them). */
  readonly layerMask?: number;
  /** Tag applied to each handle entity. */
  readonly tag?: string;
  /** Also spawn a center handle that scales all three axes uniformly. */
  readonly uniform?: boolean;
  /**
   * Snap the resulting scale to the nearest multiple of this increment. `0` or
   * `undefined` disables snapping (free scaling).
   */
  readonly snapIncrement?: number;
}

export interface ScaleGizmoHandles {
  readonly x: EcsEntityRef;
  readonly y: EcsEntityRef;
  readonly z: EcsEntityRef;
  /** Present only when `uniform: true` was requested. */
  readonly uniform?: EcsEntityRef;
}

export interface ScaleGizmo {
  readonly target: EcsEntityRef;
  readonly handles: ScaleGizmoHandles;
  /**
   * Re-align the handles to the WORLD axes at the target's current world
   * position (unit scale), so a rotated/scaled target keeps a world-aligned
   * gizmo. Call once per frame after the target moves.
   */
  sync(world: EcsWorld): void;
  /** Unsubscribe the drag handlers and destroy the handle entities. */
  dispose(): void;
}

type HandleName = "x" | "y" | "z" | "uniform";

interface HandleSpec {
  readonly name: HandleName;
  readonly uniform: boolean;
  /** World axis (unit) for an axis handle; `[0,0,0]` for the uniform handle. */
  readonly axis: GizmoVec3;
  readonly color: readonly [number, number, number, number];
}

const AXES: readonly HandleSpec[] = [
  { name: "x", uniform: false, axis: [1, 0, 0], color: [0.9, 0.2, 0.2, 1] },
  { name: "y", uniform: false, axis: [0, 1, 0], color: [0.2, 0.85, 0.3, 1] },
  { name: "z", uniform: false, axis: [0, 0, 1], color: [0.25, 0.45, 1, 1] },
];

const UNIFORM: HandleSpec = {
  name: "uniform",
  uniform: true,
  axis: [0, 0, 0],
  color: [0.85, 0.85, 0.85, 1],
};

interface ScaleDragState {
  readonly uniform: boolean;
  readonly axis: GizmoVec3;
  /** Target world position at drag start (axis-line anchor / plane point). */
  readonly anchor: GizmoVec3;
  /** Target LocalTransform scale at drag start. */
  readonly startScale: readonly [number, number, number];
  /** Drag distance that maps to a doubling of the axis (factor 2). */
  readonly referenceLength: number;
  /** Fixed camera-facing plane normal (uniform handle only). */
  readonly planeNormal: GizmoVec3 | null;
  /** In-plane horizontal axis for displacement (uniform handle only). */
  readonly planeRight: GizmoVec3 | null;
  /** Parameter at drag start (null until a non-degenerate frame establishes it). */
  startParam: number | null;
}

export function createScaleGizmo(
  context: ScaleGizmoContext,
  options: ScaleGizmoOptions,
): ScaleGizmo {
  const target = options.target;
  const size = options.size ?? DEFAULT_SIZE;
  const thickness = options.thickness ?? DEFAULT_THICKNESS;
  const layerMask = options.layerMask ?? DEFAULT_LAYER_MASK;
  const tag = options.tag ?? DEFAULT_TAG;
  const snapIncrement = options.snapIncrement;
  const half = size / 2;

  const specs: HandleSpec[] = [...AXES];
  if (options.uniform === true) {
    specs.push(UNIFORM);
  }

  const unsubscribes: InteractionUnsubscribe[] = [];
  const handleRefs: Partial<Record<HandleName, EcsEntityRef>> = {};
  let active: ScaleDragState | null = null;

  for (const spec of specs) {
    const handleSize: [number, number, number] = spec.uniform
      ? [thickness * 1.5, thickness * 1.5, thickness * 1.5]
      : [
          spec.axis[0] !== 0 ? size : thickness,
          spec.axis[1] !== 0 ? size : thickness,
          spec.axis[2] !== 0 ? size : thickness,
        ];
    const offset = handleOffset(spec, half);

    const handle = context.spawn.mesh({
      key: `gizmo.scale.${spec.name}`,
      name: `ScaleHandle${spec.name.toUpperCase()}`,
      tags: [tag],
      mesh: mesh.box({ size: handleSize }),
      material: material.standard({ baseColor: spec.color, roughness: 0.5 }),
      transform: { translation: offset },
    });
    handle.addComponent(Pickable, createPickable({ enabled: true, layerMask }));

    const handleRef: EcsEntityRef = {
      index: handle.index,
      generation: handle.generation,
    };
    handleRefs[spec.name] = handleRef;

    context.hierarchy.setParent(handleRef, target);
    handle.getVectorView(LocalTransform, "translation").set(offset);

    const referenceLength = spec.uniform ? size : half;
    const captured = spec;
    unsubscribes.push(
      context.interaction.onDrag(handleRef, (event) => {
        handleDrag(
          context,
          target,
          captured,
          referenceLength,
          snapIncrement,
          event,
          {
            get: () => active,
            set: (next) => {
              active = next;
            },
          },
        );
      }),
    );
  }

  return {
    target,
    handles: {
      x: handleRefs.x as EcsEntityRef,
      y: handleRefs.y as EcsEntityRef,
      z: handleRefs.z as EcsEntityRef,
      ...(handleRefs.uniform === undefined
        ? {}
        : { uniform: handleRefs.uniform }),
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

      for (const spec of specs) {
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

        const offset = handleOffset(spec, half);
        const desiredWorld = composeTrsMatrix(
          [
            (col3[0] ?? 0) + offset[0],
            (col3[1] ?? 0) + offset[1],
            (col3[2] ?? 0) + offset[2],
          ],
          [0, 0, 0, 1],
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
      for (const ref of [
        handleRefs.x,
        handleRefs.y,
        handleRefs.z,
        handleRefs.uniform,
      ]) {
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
  get(): ScaleDragState | null;
  set(next: ScaleDragState | null): void;
}

function handleDrag(
  context: ScaleGizmoContext,
  target: EcsEntityRef,
  spec: HandleSpec,
  referenceLength: number,
  snapIncrement: number | undefined,
  event: PointerInteractionEvent,
  slot: ActiveSlot,
): void {
  if (event.type === "dragStart") {
    const resolved = resolveActiveEntity(context.world, target);
    if (!resolved.ok) {
      return;
    }
    const anchor = worldTranslation(resolved.entity);
    const startScale = localScale(resolved.entity);
    const ray = context.cameras.main.rayFromPointer(event.position);
    const origin = toTuple(ray.origin);
    const direction = toTuple(ray.direction);

    if (spec.uniform) {
      const planeNormal = direction;
      const planeRight = inPlaneRightAxis(planeNormal);
      slot.set({
        uniform: true,
        axis: spec.axis,
        anchor,
        startScale,
        referenceLength,
        planeNormal,
        planeRight,
        startParam: uniformParam(
          anchor,
          planeNormal,
          planeRight,
          origin,
          direction,
        ),
      });
      return;
    }

    slot.set({
      uniform: false,
      axis: spec.axis,
      anchor,
      startScale,
      referenceLength,
      planeNormal: null,
      planeRight: null,
      startParam: closestPointParamOnAxis(anchor, spec.axis, origin, direction),
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
  const origin = toTuple(ray.origin);
  const direction = toTuple(ray.direction);

  const param = state.uniform
    ? uniformParam(
        state.anchor,
        state.planeNormal,
        state.planeRight,
        origin,
        direction,
      )
    : closestPointParamOnAxis(state.anchor, state.axis, origin, direction);
  if (param === null) {
    // Degenerate this frame (ray ~parallel to the axis/plane) — skip.
    return;
  }
  if (state.startParam === null) {
    state.startParam = param;
    return;
  }

  const factor = scaleFactorFromDelta(
    param - state.startParam,
    state.referenceLength,
  );

  const resolved = resolveActiveEntity(context.world, target);
  if (!resolved.ok || !resolved.entity.hasComponent(LocalTransform)) {
    return;
  }

  const next: [number, number, number] = [
    state.startScale[0],
    state.startScale[1],
    state.startScale[2],
  ];
  if (state.uniform) {
    next[0] = scaledComponent(state.startScale[0], factor, snapIncrement);
    next[1] = scaledComponent(state.startScale[1], factor, snapIncrement);
    next[2] = scaledComponent(state.startScale[2], factor, snapIncrement);
  } else {
    const index = axisIndex(state.axis);
    next[index] = scaledComponent(
      state.startScale[index],
      factor,
      snapIncrement,
    );
  }
  resolved.entity.getVectorView(LocalTransform, "scale").set(next);
}

/** Apply the drag factor to a start component, snap the result, and guard it. */
function scaledComponent(
  startComponent: number,
  factor: number,
  snapIncrement: number | undefined,
): number {
  return guardScale(snapToIncrement(startComponent * factor, snapIncrement));
}

/** Signed horizontal displacement of the ray on the fixed camera-facing plane. */
function uniformParam(
  anchor: GizmoVec3,
  planeNormal: GizmoVec3 | null,
  planeRight: GizmoVec3 | null,
  origin: GizmoVec3,
  direction: GizmoVec3,
): number | null {
  if (planeNormal === null || planeRight === null) {
    return null;
  }
  const hit = rayPlaneIntersection(anchor, planeNormal, origin, direction);
  if (hit === null) {
    return null;
  }
  return (
    (hit[0] - anchor[0]) * planeRight[0] +
    (hit[1] - anchor[1]) * planeRight[1] +
    (hit[2] - anchor[2]) * planeRight[2]
  );
}

function handleOffset(
  spec: HandleSpec,
  half: number,
): [number, number, number] {
  return [spec.axis[0] * half, spec.axis[1] * half, spec.axis[2] * half];
}

function axisIndex(axis: GizmoVec3): 0 | 1 | 2 {
  if (axis[0] !== 0) {
    return 0;
  }
  return axis[1] !== 0 ? 1 : 2;
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();
  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

function worldTranslation(entity: Entity): GizmoVec3 {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

function localScale(entity: Entity): readonly [number, number, number] {
  const s = entity.getVectorView(LocalTransform, "scale");
  return [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1];
}

function toTuple(values: Vec3Like): GizmoVec3 {
  return [read(values, 0), read(values, 1), read(values, 2)];
}

function read(values: Vec3Like, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }
  return value;
}
