import { rotateVec3ByQuat } from "../math.js";
export { multiplyQuat, normalizeQuat, rotateVec3ByQuat } from "../math.js";
export function cloneVec3(values) {
    return [values[0], values[1], values[2]];
}
export function addScaled(a, b, scale) {
    return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}
export function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function scale(a, value) {
    return [a[0] * value, a[1] * value, a[2] * value];
}
export function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function transformLocalPoint(transform, point) {
    const rotated = transformLocalVector(transform, point);
    return [
        rotated[0] + transform.translation[0],
        rotated[1] + transform.translation[1],
        rotated[2] + transform.translation[2],
    ];
}
export function transformLocalVector(transform, value) {
    const rotated = rotateVec3ByQuat(value, transform.rotation);
    return [rotated[0], rotated[1], rotated[2]];
}
export function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
export function normalize(value) {
    const length = Math.hypot(value[0], value[1], value[2]);
    if (length === 0) {
        return [0, 1, 0];
    }
    return [value[0] / length, value[1] / length, value[2] / length];
}
export function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
export function finiteNonNegative(value) {
    return value !== undefined && Number.isFinite(value) && value >= 0
        ? value
        : 0;
}
//# sourceMappingURL=math.js.map