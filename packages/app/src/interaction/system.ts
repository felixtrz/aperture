import { Pickable, PickablePrecision } from "@aperture-engine/render";
import type { ApertureSystemContext } from "../systems/context.js";
import type { InteractionRuntime } from "./access.js";

// M7-T8: the per-frame interaction driver. The app frame loop (advanced.ts) invokes
// this AFTER the spatial picking index is refreshed and BEFORE the user systems
// update, so registered pointer handlers fire each frame in a deterministic order.
// It consumes the already-forwarded primary pointer (no DOM listeners), casts the
// camera ray (M7-T7) and the spatial picking ray (M1-T8), and feeds the result to
// the interaction state machine. Headless/worker-safe.

const MAX_PICK_DISTANCE = 1000;

export function runInteractionFrame(
  context: ApertureSystemContext,
  time: number,
): void {
  const pointer = context.input.pointer.primary;
  const position = pointer.position.value;
  const pressed = pointer.pressed.value;

  const runtime = context.interaction as InteractionRuntime;

  let hitEntity = null;
  let worldPoint: readonly [number, number, number] | null = null;

  if (context.cameras.active.length > 0) {
    const ray = context.cameras.main.rayFromPointer(position);
    const hit = context.spatial.raycastFirst(ray, {
      source: "bounds",
      maxDistance: MAX_PICK_DISTANCE,
      // Honor an app-configured interaction layer mask (e.g. to exclude a
      // gizmo/overlay layer from the scene interaction). null = all layers.
      ...(runtime.pickLayerMask === null
        ? {}
        : { layerMask: runtime.pickLayerMask }),
    });
    if (hit !== null) {
      hitEntity = hit.entity.ref;
      worldPoint = hit.point;

      // The bounds hit point is the AABB entry, not the mesh surface. When the
      // hit entity opts into visual-mesh precision, refine the reported world
      // point against its triangle mesh (single-entity query, negligible cost).
      const target = hit.entity.entity;
      if (
        target.hasComponent(Pickable) &&
        target.getValue(Pickable, "precision") === PickablePrecision.VisualMesh
      ) {
        const refined = context.spatial.raycastFirst(ray, {
          source: "visual-mesh",
          query: { entities: new Set([target]) },
          fallback: "bounds",
          maxDistance: MAX_PICK_DISTANCE,
        });
        if (refined !== null) {
          worldPoint = refined.point;
        }
      }
    }
  }

  runtime.processFrame({
    position,
    pressed,
    time,
    hitEntity,
    worldPoint,
  });
}
