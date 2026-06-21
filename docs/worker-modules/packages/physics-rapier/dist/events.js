import { buildColliderHandleIndex, compareColliderMatches, } from "./colliders.js";
import { normalizeVec3, vec3 } from "./math.js";
export function collectRapierEvents(options) {
    const events = [];
    const changedPairs = new Set();
    // Index the body store once per step so each collider-handle lookup below is
    // O(1) instead of an O(bodies x colliders) scan repeated per contact pair.
    const handleIndex = buildColliderHandleIndex(options.bodies);
    options.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        const pair = eventPairForColliderHandles(handleIndex, handle1, handle2);
        if (pair === null) {
            return;
        }
        changedPairs.add(pair.key);
        if (started) {
            options.activePairs.set(pair.key, pair);
            events.push(physicsEvent(pair, pair.trigger ? "triggerEnter" : "collisionStart", options.fixedStep, pair.trigger
                ? undefined
                : contactEventData(options.world, handleIndex, pair)));
            return;
        }
        const activePair = options.activePairs.get(pair.key) ?? pair;
        options.activePairs.delete(pair.key);
        events.push(physicsEvent(activePair, activePair.trigger ? "triggerExit" : "collisionEnd", options.fixedStep));
    });
    options.eventQueue.drainContactForceEvents((forceEvent) => {
        const event = contactForcePhysicsEvent(forceEvent, handleIndex, options.fixedStep, options.fixedDelta);
        if (event !== null) {
            events.push(event);
        }
    });
    for (const pair of options.activePairs.values()) {
        if (!changedPairs.has(pair.key)) {
            events.push(physicsEvent(pair, pair.trigger ? "triggerStay" : "collisionStay", options.fixedStep, pair.trigger
                ? undefined
                : contactEventData(options.world, handleIndex, pair)));
        }
    }
    return events.sort(comparePhysicsEvents);
}
function eventPairForColliderHandles(handleIndex, handle1, handle2) {
    const first = handleIndex.get(handle1) ?? null;
    const second = handleIndex.get(handle2) ?? null;
    if (first === null || second === null) {
        return null;
    }
    const [a, b] = compareColliderMatches(first, second) <= 0
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
function physicsEvent(pair, kind, fixedStep, contact) {
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
function contactForcePhysicsEvent(event, handleIndex, fixedStep, fixedDelta) {
    const pair = eventPairForColliderHandles(handleIndex, event.collider1(), event.collider2());
    if (pair === null || pair.trigger) {
        return null;
    }
    const force = vec3(event.totalForce());
    const normal = normalizeVec3(vec3(event.maxForceDirection()));
    const forceMagnitude = event.totalForceMagnitude();
    const maxForceMagnitude = event.maxForceMagnitude();
    const impulse = forceMagnitude * fixedDelta;
    if (!force.every(Number.isFinite) ||
        !normal.every(Number.isFinite) ||
        !Number.isFinite(forceMagnitude) ||
        !Number.isFinite(maxForceMagnitude) ||
        !Number.isFinite(impulse)) {
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
function contactEventData(world, handleIndex, pair) {
    const colliderA = handleIndex.get(pair.colliderAHandle) ?? null;
    const colliderB = handleIndex.get(pair.colliderBHandle) ?? null;
    if (colliderA === null || colliderB === null) {
        return undefined;
    }
    let contact;
    world.contactPair(colliderA.collider.collider, colliderB.collider.collider, (manifold, flipped) => {
        if (contact !== undefined) {
            return;
        }
        const rawNormal = manifold.normal();
        const normal = flipped
            ? [-rawNormal.x, -rawNormal.y, -rawNormal.z]
            : [rawNormal.x, rawNormal.y, rawNormal.z];
        for (let contactIndex = 0; contactIndex < manifold.numSolverContacts(); contactIndex += 1) {
            const rawPoint = manifold.solverContactPoint(contactIndex);
            const point = [rawPoint.x, rawPoint.y, rawPoint.z];
            const normalized = normalizeVec3(normal);
            if (point.every(Number.isFinite) && normalized.every(Number.isFinite)) {
                contact = {
                    point,
                    normal: normalized,
                };
                return;
            }
        }
    });
    return contact;
}
function comparePhysicsEvents(left, right) {
    return (left.fixedStep - right.fixedStep ||
        left.substep - right.substep ||
        left.kind.localeCompare(right.kind) ||
        left.entityA.localeCompare(right.entityA) ||
        left.entityB.localeCompare(right.entityB) ||
        left.colliderA.localeCompare(right.colliderA) ||
        left.colliderB.localeCompare(right.colliderB));
}
//# sourceMappingURL=events.js.map