import { vec3 as kvec3 } from "./kernel/index.js";
import { EPSILON } from "./constants.js";
import { vec3 } from "./constructors.js";
import { v3 } from "./scalars.js";
export function intersectRayAabb(ray, aabb, maxDistance = Number.POSITIVE_INFINITY) {
    let tmin = 0;
    let tmax = maxDistance;
    for (let axis = 0; axis < 3; axis += 1) {
        const origin = v3(ray.origin, axis);
        const direction = v3(ray.direction, axis);
        const min = v3(aabb.min, axis);
        const max = v3(aabb.max, axis);
        if (Math.abs(direction) <= EPSILON) {
            if (origin < min || origin > max) {
                return null;
            }
            continue;
        }
        const inverseDirection = 1 / direction;
        let near = (min - origin) * inverseDirection;
        let far = (max - origin) * inverseDirection;
        if (near > far) {
            const swap = near;
            near = far;
            far = swap;
        }
        tmin = Math.max(tmin, near);
        tmax = Math.min(tmax, far);
        if (tmin > tmax) {
            return null;
        }
    }
    return rayHitAt(ray, tmin);
}
export function intersectRaySphere(ray, sphere, maxDistance = Number.POSITIVE_INFINITY) {
    const offset = kvec3.subtract(ray.origin, sphere.center);
    const direction = ray.direction;
    const a = kvec3.dot(direction, direction);
    if (a <= EPSILON) {
        return null;
    }
    const b = 2 * kvec3.dot(offset, direction);
    const c = kvec3.dot(offset, offset) - sphere.radius * sphere.radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
        return null;
    }
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const denominator = 2 * a;
    const first = (-b - sqrtDiscriminant) / denominator;
    const second = (-b + sqrtDiscriminant) / denominator;
    const distance = first >= 0 ? first : second;
    if (distance < 0 || distance > maxDistance) {
        return null;
    }
    return rayHitAt(ray, distance);
}
function rayHitAt(ray, distance) {
    return {
        distance,
        point: kvec3.addScaled(ray.origin, ray.direction, distance, vec3()),
    };
}
//# sourceMappingURL=ray.js.map