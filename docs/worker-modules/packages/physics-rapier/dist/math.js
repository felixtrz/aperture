import { multiplyQuat as multiplyPhysicsQuat, normalizeQuat as normalizePhysicsQuat, rotateVec3ByQuat as rotatePhysicsVec3ByQuat, } from "/aperture/worker-modules/packages/physics/dist/index.js";
export function addScaledVec3(origin, direction, scale) {
    return [
        origin[0] + direction[0] * scale,
        origin[1] + direction[1] * scale,
        origin[2] + direction[2] * scale,
    ];
}
export function addVec3(left, right) {
    return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}
export function cloneVec3(value) {
    return [value[0], value[1], value[2]];
}
export function subtractVec3(left, right) {
    return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}
export function distanceVec3(left, right) {
    return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
export function normalizeVec3(value) {
    const length = Math.hypot(value[0], value[1], value[2]);
    if (length === 0) {
        return [0, 1, 0];
    }
    return [value[0] / length, value[1] / length, value[2] / length];
}
export function vec3(value) {
    return [value.x, value.y, value.z];
}
export function colliderLocalPointToWorld(collider, point) {
    const rotated = rotateVec3(vec3(point), collider.rotation());
    const translation = collider.translation();
    return [
        rotated[0] + translation.x,
        rotated[1] + translation.y,
        rotated[2] + translation.z,
    ];
}
export function colliderLocalVectorToWorld(collider, value) {
    return rotateVec3(vec3(value), collider.rotation());
}
export function bodyLocalPointToWorld(body, point) {
    const rotated = bodyLocalVectorToWorld(body, point);
    const translation = body.translation();
    return [
        rotated[0] + translation.x,
        rotated[1] + translation.y,
        rotated[2] + translation.z,
    ];
}
export function bodyLocalVectorToWorld(body, value) {
    return rotateVec3(value, body.rotation());
}
function rotateVec3(value, rotation) {
    return rotateVec3ByQuat(value, [
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
    ]);
}
export function rotateVec3ByQuat(value, rotation) {
    return rotatePhysicsVec3ByQuat(value, rotation);
}
export function normalizeQuat(value) {
    return normalizePhysicsQuat(value);
}
export function multiplyQuat(left, right) {
    return multiplyPhysicsQuat(left, right);
}
export function vec(value) {
    return { x: value[0], y: value[1], z: value[2] };
}
export function quat(value) {
    return { x: value[0], y: value[1], z: value[2], w: value[3] };
}
export function quatFromRapierRotation(rotation) {
    return [rotation.x, rotation.y, rotation.z, rotation.w];
}
//# sourceMappingURL=math.js.map