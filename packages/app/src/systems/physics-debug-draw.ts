import type { EcsWorld } from "@aperture-engine/simulation";
import {
  PhysicsDebug,
  type PhysicsDebugOptions,
} from "@aperture-engine/physics";
import type { ApertureSystemContext } from "./context.js";

type MutablePhysicsDebugOptions = {
  -readonly [Key in keyof PhysicsDebugOptions]?: PhysicsDebugOptions[Key];
};

/**
 * Physics-debug re-plumb (E3 AC2). Each frame this routes the existing physics
 * debug geometry — collider wireframes, contact normals, body-state markers,
 * broadphase AABBs, joint frames — through the SAME immediate-mode debug-draw
 * overlay as every other debug primitive, instead of a bespoke physics render
 * path. When no `PhysicsDebug` component enables any channel (or physics is
 * off), nothing is emitted so the frame stays byte-identical.
 *
 * The physics backend was previously data-only (queryable via
 * `this.physics.debugGeometry()` and the `physics_debug_geometry` devtools
 * tool); it now composites onto the single overlay route.
 */
export function runPhysicsDebugDrawFrame(
  context: ApertureSystemContext,
  world: EcsWorld,
): void {
  if (!context.debugDraw.enabled) {
    return;
  }

  const options = physicsDebugOptionsFromWorld(world);

  if (options === null) {
    return;
  }

  const geometry = context.physics.debugGeometry(options);

  if (geometry.lines.length === 0) {
    return;
  }

  context.debugDraw.physics(geometry);
}

function physicsDebugOptionsFromWorld(
  world: EcsWorld,
): PhysicsDebugOptions | null {
  if (!world.hasComponent(PhysicsDebug)) {
    return null;
  }

  const query = world.queryManager.registerQuery({ required: [PhysicsDebug] });
  const options: MutablePhysicsDebugOptions = {};
  let any = false;

  for (const entity of query.entities) {
    if (entity.getValue(PhysicsDebug, "colliderWireframes") === true) {
      options.colliderWireframes = true;
      any = true;
    }
    if (entity.getValue(PhysicsDebug, "contactNormals") === true) {
      options.contactNormals = true;
      any = true;
    }
    if (entity.getValue(PhysicsDebug, "bodyStateMarkers") === true) {
      options.bodyStateMarkers = true;
      any = true;
    }
    if (entity.getValue(PhysicsDebug, "broadphaseAabbs") === true) {
      options.broadphaseAabbs = true;
      any = true;
    }
    if (entity.getValue(PhysicsDebug, "jointFrames") === true) {
      options.jointFrames = true;
      any = true;
    }
  }

  return any ? options : null;
}
