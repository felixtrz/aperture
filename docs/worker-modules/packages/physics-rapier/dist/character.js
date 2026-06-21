import { colliderMatchForHandle, entityForCollider } from "./colliders.js";
import { normalizeVec3, vec, vec3 } from "./math.js";
import { queryAllowsCollider } from "./queries.js";
import { finitePositive } from "./util.js";
export function configureCharacterController(controller, settings) {
    controller.setUp(vec(normalizeVec3(settings?.up ?? [0, 1, 0])));
    controller.setSlideEnabled(settings?.slide !== false);
    controller.setApplyImpulsesToDynamicBodies(settings?.applyImpulsesToDynamicBodies === true);
    if (settings?.characterMass !== undefined) {
        controller.setCharacterMass(settings.characterMass === null ||
            !Number.isFinite(settings.characterMass)
            ? null
            : settings.characterMass);
    }
    if (settings?.maxSlopeClimbAngle !== undefined &&
        Number.isFinite(settings.maxSlopeClimbAngle)) {
        controller.setMaxSlopeClimbAngle(settings.maxSlopeClimbAngle);
    }
    if (settings?.minSlopeSlideAngle !== undefined &&
        Number.isFinite(settings.minSlopeSlideAngle)) {
        controller.setMinSlopeSlideAngle(settings.minSlopeSlideAngle);
    }
    if (settings?.snapToGroundDistance !== undefined &&
        Number.isFinite(settings.snapToGroundDistance) &&
        settings.snapToGroundDistance > 0) {
        controller.enableSnapToGround(settings.snapToGroundDistance);
    }
    else {
        controller.disableSnapToGround();
    }
    if (settings?.autostep !== undefined && settings.autostep !== false) {
        controller.enableAutostep(finitePositive(settings.autostep.maxHeight, 0.1), finitePositive(settings.autostep.minWidth, 0.1), settings.autostep.includeDynamicBodies === true);
    }
    else {
        controller.disableAutostep();
    }
}
export function characterCollisions(controller, bodies) {
    const collisions = [];
    for (let index = 0; index < controller.numComputedCollisions(); index += 1) {
        const collision = controller.computedCollision(index);
        if (collision === null) {
            continue;
        }
        collisions.push({
            entity: collision.collider === null
                ? null
                : entityForCollider(bodies, collision.collider),
            translationDeltaApplied: vec3(collision.translationDeltaApplied),
            translationDeltaRemaining: vec3(collision.translationDeltaRemaining),
            timeOfImpact: collision.toi,
            point: vec3(collision.witness1),
            normal: normalizeVec3(vec3(collision.normal1)),
        });
    }
    return collisions.sort((left, right) => left.timeOfImpact - right.timeOfImpact ||
        (left.entity ?? "").localeCompare(right.entity ?? ""));
}
export function characterFilterAllowsCollider(bodies, collider, options) {
    const entry = colliderMatchForHandle(bodies, collider.handle);
    return (entry !== null && queryAllowsCollider(entry.body, entry.collider, options));
}
//# sourceMappingURL=character.js.map