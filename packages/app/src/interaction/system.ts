import type { EcsWorld } from "@aperture-engine/simulation";
import {
  Pickable,
  PickablePrecision,
  extractUiLayout,
  hitTestUiLayout,
  type RenderDiagnostic,
} from "@aperture-engine/render";
import type { ApertureSystemContext } from "../systems/context.js";
import type { InteractionRuntime } from "./access.js";
import { runUiScrollFrame } from "./ui-scroll.js";

// M7-T8: the per-frame interaction driver. The app frame loop (advanced.ts)
// invokes this AFTER the spatial picking index is refreshed from same-frame
// update + fixed-step physics writeback, so registered pointer handlers fire
// each frame against the ECS state that will be extracted for rendering.
// It consumes the already-forwarded primary pointer (no DOM listeners), casts the
// camera ray (M7-T7) and the spatial picking ray (M1-T8), and feeds the result to
// the interaction state machine. It also drives the AI-47 UiScroll wheel/drag
// mapping against the same extracted UI layout, so this frame's scroll
// mutation lands in ECS before the renderer extracts. Headless/worker-safe.

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
  const uiDiagnostics: RenderDiagnostic[] = [];
  const uiLayout = extractUiLayout(context.world as EcsWorld, uiDiagnostics, 0);

  // AI-47: map this frame's wheel delta + active pointer drag onto the
  // hovered UiScroll node (clamped, worker-side ECS mutation only).
  runUiScrollFrame(context, uiLayout.nodes);

  const uiHit = hitTestUiLayout({
    nodes: uiLayout.nodes,
    hitRegions: uiLayout.hitRegions,
    position,
  });

  if (uiHit !== null) {
    hitEntity = uiHit.entity;
    worldPoint = [uiHit.point.x, uiHit.point.y, 0];
  }

  if (
    (uiHit === null || !uiHit.blocksInput) &&
    context.cameras.active.length > 0
  ) {
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

  // A slow frame can drain a complete press+release pair at once (the
  // end-of-frame `pressed` sample never reads true). Replay it as a down then
  // an up at the same position so the click still fires; the state machine's
  // zero-movement discrimination keeps it a click, never a drag.
  if (
    !pressed &&
    pointer.pressedThisFrame.value &&
    pointer.releasedThisFrame.value
  ) {
    runtime.processFrame({
      position,
      pressed: true,
      time,
      hitEntity,
      worldPoint,
    });
  }

  runtime.processFrame({
    position,
    pressed,
    time,
    hitEntity,
    worldPoint,
  });
}
