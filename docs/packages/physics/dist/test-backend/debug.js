import { createPhysicsAabbDebugLines, } from "../backend.js";
import { colliderCenter } from "./bodies.js";
import { addScaled, cloneVec3, finitePositive, normalize, normalizeQuat, rotateVec3ByQuat, subtract, transformLocalPoint, transformLocalVector, } from "./math.js";
export function broadphaseAabbDebugLines(bodies, options) {
    return createPhysicsAabbDebugLines(bodies.flatMap((body) => body.colliders.map((collider) => {
        const radius = collider.radius;
        const center = colliderCenter(body, collider);
        return {
            min: [center[0] - radius, center[1] - radius, center[2] - radius],
            max: [center[0] + radius, center[1] + radius, center[2] + radius],
        };
    })), options.broadphaseAabbColor);
}
export function contactNormalDebugLines(bodies, options) {
    const lines = [];
    const length = finitePositive(options.contactNormalLength, 0.35);
    const color = options.contactNormalColor ?? [1, 0.2, 0.12, 1];
    for (let left = 0; left < bodies.length; left += 1) {
        for (let right = left + 1; right < bodies.length; right += 1) {
            const leftBody = bodies[left];
            const rightBody = bodies[right];
            if (leftBody === undefined || rightBody === undefined) {
                continue;
            }
            for (const leftCollider of leftBody.colliders) {
                for (const rightCollider of rightBody.colliders) {
                    const delta = subtract(colliderCenter(rightBody, rightCollider), colliderCenter(leftBody, leftCollider));
                    const separation = Math.hypot(delta[0], delta[1], delta[2]);
                    const contactDistance = leftCollider.radius + rightCollider.radius;
                    if (separation > contactDistance + 0.0001) {
                        continue;
                    }
                    const normal = normalize(delta);
                    const point = addScaled(colliderCenter(leftBody, leftCollider), normal, leftCollider.radius);
                    lines.push({
                        from: point,
                        to: addScaled(point, normal, length),
                        color,
                    });
                }
            }
        }
    }
    return lines;
}
export function bodyStateDebugLines(bodies, options) {
    const length = finitePositive(options.bodyStateMarkerLength, 0.25);
    const activeColor = options.activeBodyColor ?? [0.2, 1, 0.45, 1];
    const sleepingColor = options.sleepingBodyColor ?? [0.65, 0.7, 0.78, 1];
    return bodies.map((body) => ({
        from: cloneVec3(body.transform.translation),
        to: addScaled(body.transform.translation, [0, 1, 0], length),
        color: body.sleeping ? sleepingColor : activeColor,
    }));
}
export function jointFrameDebugLines(joints, bodies, options) {
    const lines = [];
    const frameColor = options.jointFrameColor ?? [0.9, 0.45, 1, 1];
    const axisColor = options.jointAxisColor ?? [0.2, 0.95, 1, 1];
    const basisColors = fixedJointFrameBasisColors();
    const axisLength = finitePositive(options.jointFrameLength, 0.4);
    for (const joint of joints) {
        const bodyA = bodies.get(joint.descriptor.bodyARef);
        const bodyB = bodies.get(joint.descriptor.bodyBRef);
        if (bodyA === undefined || bodyB === undefined) {
            continue;
        }
        const anchorA = transformLocalPoint(bodyA.transform, joint.descriptor.anchorA);
        const anchorB = transformLocalPoint(bodyB.transform, joint.descriptor.anchorB);
        const axis = normalize(transformLocalVector(bodyA.transform, jointAxis(joint.descriptor)));
        lines.push({
            from: anchorA,
            to: anchorB,
            color: frameColor,
        });
        lines.push({
            from: anchorA,
            to: addScaled(anchorA, axis, axisLength),
            color: axisColor,
        });
        if (joint.descriptor.kind === "fixed") {
            lines.push(...fixedJointFrameBasisDebugLines(bodyA.transform, anchorA, joint.descriptor.frameA ?? [0, 0, 0, 1], axisLength, basisColors), ...fixedJointFrameBasisDebugLines(bodyB.transform, anchorB, joint.descriptor.frameB ?? [0, 0, 0, 1], axisLength, basisColors));
        }
    }
    return lines;
}
function fixedJointFrameBasisDebugLines(transform, anchor, frame, length, colors) {
    const basis = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    return basis.map((axis, index) => {
        const localAxis = rotateVec3ByQuat(axis, normalizeQuat(frame));
        const worldAxis = normalize(transformLocalVector(transform, localAxis));
        return {
            from: anchor,
            to: addScaled(anchor, worldAxis, length),
            color: colors[index] ?? [1, 1, 1, 1],
        };
    });
}
function fixedJointFrameBasisColors() {
    return [
        [1, 0.25, 0.25, 1],
        [0.35, 1, 0.35, 1],
        [0.25, 0.55, 1, 1],
    ];
}
function jointAxis(descriptor) {
    return normalize(rotateVec3ByQuat(descriptor.axis, normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1])));
}
//# sourceMappingURL=debug.js.map