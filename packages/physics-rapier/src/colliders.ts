import RAPIER from "@dimforge/rapier3d-compat";
import {
  PhysicsMaterialCombineRule,
  type PhysicsColliderDescriptor,
  type PhysicsCommand,
} from "@aperture-engine/physics";
import { quat } from "./math.js";
import { colliderShapeRotation } from "./shapes.js";
import type {
  RapierBodyEntry,
  RapierColliderEntry,
  RapierColliderMatch,
} from "./types.js";

export function colliderDesc(
  collider: PhysicsColliderDescriptor,
): RAPIER.ColliderDesc {
  const shape = collider.shape;
  let desc: RAPIER.ColliderDesc;

  switch (shape.kind) {
    case "box":
      desc = RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
      break;
    case "sphere":
      desc = RAPIER.ColliderDesc.ball(shape.radius);
      break;
    case "capsule":
      desc = RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
      break;
    case "cylinder":
      desc = RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
      break;
    case "cone":
      desc = RAPIER.ColliderDesc.cone(shape.halfHeight, shape.radius);
      break;
    case "convexHull":
    case "trimesh":
    case "heightfield":
      throw new Error(
        `Rapier backend does not support '${shape.kind}' colliders in this slice.`,
      );
  }

  if (collider.offsetTranslation !== undefined) {
    desc.setTranslation(...collider.offsetTranslation);
  }
  const rotation = colliderShapeRotation(collider);

  if (rotation !== null) {
    desc.setRotation(quat(rotation));
  }
  if (collider.sensor !== undefined) {
    desc.setSensor(collider.sensor);
  }
  if (collider.density !== undefined) {
    desc.setDensity(collider.density);
  }
  if (collider.friction !== undefined) {
    desc.setFriction(collider.friction);
  }
  if (collider.restitution !== undefined) {
    desc.setRestitution(collider.restitution);
  }
  if (collider.frictionCombine !== undefined) {
    desc.setFrictionCombineRule(
      coefficientCombineRule(collider.frictionCombine),
    );
  }
  if (collider.restitutionCombine !== undefined) {
    desc.setRestitutionCombineRule(
      coefficientCombineRule(collider.restitutionCombine),
    );
  }
  if (collider.collisionGroups !== undefined) {
    desc.setCollisionGroups(collider.collisionGroups);
  }
  if (collider.solverGroups !== undefined) {
    desc.setSolverGroups(collider.solverGroups);
  }
  desc.setActiveEvents(
    RAPIER.ActiveEvents.COLLISION_EVENTS |
      RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
  );
  desc.setContactForceEventThreshold(0);

  return desc;
}

export function coefficientCombineRule(
  rule: PhysicsMaterialCombineRule,
): RAPIER.CoefficientCombineRule {
  switch (rule) {
    case PhysicsMaterialCombineRule.Average:
      return RAPIER.CoefficientCombineRule.Average;
    case PhysicsMaterialCombineRule.Min:
      return RAPIER.CoefficientCombineRule.Min;
    case PhysicsMaterialCombineRule.Multiply:
      return RAPIER.CoefficientCombineRule.Multiply;
    case PhysicsMaterialCombineRule.Max:
      return RAPIER.CoefficientCombineRule.Max;
  }
}

export function collidersForCommand(
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): readonly PhysicsColliderDescriptor[] {
  return (
    command.colliders ??
    (command.collider === undefined ? [] : [command.collider])
  );
}

export function primaryCollider(
  entry: RapierBodyEntry,
): RapierColliderEntry | null {
  return entry.colliders[0] ?? null;
}

export function colliderCount(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
): number {
  return [...bodies.values()].reduce(
    (total, entry) => total + entry.colliders.length,
    0,
  );
}

export function colliderEntries(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
): readonly RapierColliderMatch[] {
  return [...bodies.values()]
    .sort((left, right) => left.entity.localeCompare(right.entity))
    .flatMap((body) =>
      body.colliders
        .slice()
        .sort((left, right) => left.entity.localeCompare(right.entity))
        .map((collider) => ({ body, collider })),
    );
}

export function colliderMatchForCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  collider: RAPIER.Collider,
): RapierColliderMatch | null {
  return colliderMatchForHandle(bodies, collider.handle);
}

export function entityForCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  collider: RAPIER.Collider,
): string | null {
  return colliderMatchForCollider(bodies, collider)?.body.entity ?? null;
}

export function colliderKeyFor(
  colliders: readonly PhysicsColliderDescriptor[],
): string {
  return colliders.length === 0 ? "none" : JSON.stringify(colliders);
}

export function colliderMatchForHandle(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  handle: number,
): RapierColliderMatch | null {
  for (const entry of bodies.values()) {
    for (const collider of entry.colliders) {
      if (collider.collider.handle === handle) {
        return { body: entry, collider };
      }
    }
  }

  return null;
}

export function compareColliderMatches(
  left: RapierColliderMatch,
  right: RapierColliderMatch,
): number {
  return (
    left.body.entity.localeCompare(right.body.entity) ||
    left.collider.entity.localeCompare(right.collider.entity)
  );
}
