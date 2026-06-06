import type RAPIER from "@dimforge/rapier3d-compat";
import type {
  PhysicsEvent,
  PhysicsEventKind,
  PhysicsVec3,
} from "@aperture-engine/physics";
import { colliderMatchForHandle, compareColliderMatches } from "./colliders.js";
import { normalizeVec3, vec3 } from "./math.js";
import type {
  RapierBodyEntry,
  RapierContactEventData,
  RapierContactManifold,
  RapierEventPair,
} from "./types.js";

export function collectRapierEvents(options: {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;
  readonly bodies: ReadonlyMap<string, RapierBodyEntry>;
  readonly activePairs: Map<string, RapierEventPair>;
  readonly fixedStep: number;
  readonly fixedDelta: number;
}): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const changedPairs = new Set<string>();

  options.eventQueue.drainCollisionEvents(
    (handle1: number, handle2: number, started: boolean) => {
      const pair = eventPairForColliderHandles(
        options.bodies,
        handle1,
        handle2,
      );

      if (pair === null) {
        return;
      }

      changedPairs.add(pair.key);

      if (started) {
        options.activePairs.set(pair.key, pair);
        events.push(
          physicsEvent(
            pair,
            pair.trigger ? "triggerEnter" : "collisionStart",
            options.fixedStep,
            pair.trigger
              ? undefined
              : contactEventData(options.world, options.bodies, pair),
          ),
        );
        return;
      }

      const activePair = options.activePairs.get(pair.key) ?? pair;
      options.activePairs.delete(pair.key);
      events.push(
        physicsEvent(
          activePair,
          activePair.trigger ? "triggerExit" : "collisionEnd",
          options.fixedStep,
        ),
      );
    },
  );

  options.eventQueue.drainContactForceEvents(
    (forceEvent: RAPIER.TempContactForceEvent) => {
      const event = contactForcePhysicsEvent(
        forceEvent,
        options.bodies,
        options.fixedStep,
        options.fixedDelta,
      );

      if (event !== null) {
        events.push(event);
      }
    },
  );

  for (const pair of options.activePairs.values()) {
    if (!changedPairs.has(pair.key)) {
      events.push(
        physicsEvent(
          pair,
          pair.trigger ? "triggerStay" : "collisionStay",
          options.fixedStep,
          pair.trigger
            ? undefined
            : contactEventData(options.world, options.bodies, pair),
        ),
      );
    }
  }

  return events.sort(comparePhysicsEvents);
}

export function eventPairForColliderHandles(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  handle1: number,
  handle2: number,
): RapierEventPair | null {
  const first = colliderMatchForHandle(bodies, handle1);
  const second = colliderMatchForHandle(bodies, handle2);

  if (first === null || second === null) {
    return null;
  }

  const [a, b] =
    compareColliderMatches(first, second) <= 0
      ? [first, second]
      : [second, first];

  return {
    key: `${a.body.entity}|${a.collider.entity}|${b.body.entity}|${b.collider.entity}`,
    entityA: a.body.entity,
    entityB: b.body.entity,
    colliderA: a.collider.entity,
    colliderB: b.collider.entity,
    colliderAHandle: a.collider.collider.handle,
    colliderBHandle: b.collider.collider.handle,
    trigger: a.collider.collider.isSensor() || b.collider.collider.isSensor(),
  };
}

export function physicsEvent(
  pair: RapierEventPair,
  kind: PhysicsEventKind,
  fixedStep: number,
  contact?: RapierContactEventData,
): PhysicsEvent {
  return {
    kind,
    frame: fixedStep,
    fixedStep,
    substep: 0,
    entityA: pair.entityA,
    entityB: pair.entityB,
    colliderA: pair.colliderA,
    colliderB: pair.colliderB,
    ...(contact === undefined
      ? {}
      : {
          point: contact.point,
          normal: contact.normal,
        }),
  };
}

export function contactForcePhysicsEvent(
  event: RAPIER.TempContactForceEvent,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  fixedStep: number,
  fixedDelta: number,
): PhysicsEvent | null {
  const pair = eventPairForColliderHandles(
    bodies,
    event.collider1(),
    event.collider2(),
  );

  if (pair === null || pair.trigger) {
    return null;
  }

  const force = vec3(event.totalForce());
  const normal = normalizeVec3(vec3(event.maxForceDirection()));
  const forceMagnitude = event.totalForceMagnitude();
  const maxForceMagnitude = event.maxForceMagnitude();
  const impulse = forceMagnitude * fixedDelta;

  if (
    !force.every(Number.isFinite) ||
    !normal.every(Number.isFinite) ||
    !Number.isFinite(forceMagnitude) ||
    !Number.isFinite(maxForceMagnitude) ||
    !Number.isFinite(impulse)
  ) {
    return null;
  }

  return {
    ...physicsEvent(pair, "contactForce", fixedStep),
    normal,
    force,
    forceMagnitude,
    maxForceMagnitude,
    impulse,
  };
}

export function contactEventData(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  pair: RapierEventPair,
): RapierContactEventData | undefined {
  const colliderA = colliderMatchForHandle(bodies, pair.colliderAHandle);
  const colliderB = colliderMatchForHandle(bodies, pair.colliderBHandle);

  if (colliderA === null || colliderB === null) {
    return undefined;
  }

  let contact: RapierContactEventData | undefined;

  world.contactPair(
    colliderA.collider.collider,
    colliderB.collider.collider,
    (manifold: RapierContactManifold, flipped: boolean) => {
      if (contact !== undefined) {
        return;
      }

      const rawNormal = manifold.normal();
      const normal: PhysicsVec3 = flipped
        ? [-rawNormal.x, -rawNormal.y, -rawNormal.z]
        : [rawNormal.x, rawNormal.y, rawNormal.z];

      for (
        let contactIndex = 0;
        contactIndex < manifold.numSolverContacts();
        contactIndex += 1
      ) {
        const rawPoint = manifold.solverContactPoint(contactIndex);
        const point: PhysicsVec3 = [rawPoint.x, rawPoint.y, rawPoint.z];
        const normalized = normalizeVec3(normal);

        if (point.every(Number.isFinite) && normalized.every(Number.isFinite)) {
          contact = {
            point,
            normal: normalized,
          };
          return;
        }
      }
    },
  );

  return contact;
}

export function comparePhysicsEvents(
  left: PhysicsEvent,
  right: PhysicsEvent,
): number {
  return (
    left.fixedStep - right.fixedStep ||
    left.substep - right.substep ||
    left.kind.localeCompare(right.kind) ||
    left.entityA.localeCompare(right.entityA) ||
    left.entityB.localeCompare(right.entityB) ||
    left.colliderA.localeCompare(right.colliderA) ||
    left.colliderB.localeCompare(right.colliderB)
  );
}
