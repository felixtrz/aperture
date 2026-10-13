import { vec3 as kvec3 } from "./kernel/index.js";
import { vec3 } from "./constructors.js";
import { v3 } from "./scalars.js";
export function vec3Add(a, b, out = vec3()) {
    out[0] = v3(a, 0) + v3(b, 0);
    out[1] = v3(a, 1) + v3(b, 1);
    out[2] = v3(a, 2) + v3(b, 2);
    return out;
}
export function vec3Subtract(a, b, out = vec3()) {
    out[0] = v3(a, 0) - v3(b, 0);
    out[1] = v3(a, 1) - v3(b, 1);
    out[2] = v3(a, 2) - v3(b, 2);
    return out;
}
export function vec3Scale(value, scale, out = vec3()) {
    out[0] = v3(value, 0) * scale;
    out[1] = v3(value, 1) * scale;
    out[2] = v3(value, 2) * scale;
    return out;
}
export function vec3AddScaled(a, b, scale, out = vec3()) {
    out[0] = v3(a, 0) + v3(b, 0) * scale;
    out[1] = v3(a, 1) + v3(b, 1) * scale;
    out[2] = v3(a, 2) + v3(b, 2) * scale;
    return out;
}
export function vec3Dot(a, b) {
    return v3(a, 0) * v3(b, 0) + v3(a, 1) * v3(b, 1) + v3(a, 2) * v3(b, 2);
}
export function vec3Cross(a, b, out = vec3()) {
    out[0] = v3(a, 1) * v3(b, 2) - v3(a, 2) * v3(b, 1);
    out[1] = v3(a, 2) * v3(b, 0) - v3(a, 0) * v3(b, 2);
    out[2] = v3(a, 0) * v3(b, 1) - v3(a, 1) * v3(b, 0);
    return out;
}
export function vec3Length(value) {
    return Math.hypot(v3(value, 0), v3(value, 1), v3(value, 2));
}
export function vec3LengthSq(value) {
    return vec3Dot(value, value);
}
export function vec3Distance(a, b) {
    return Math.hypot(v3(a, 0) - v3(b, 0), v3(a, 1) - v3(b, 1), v3(a, 2) - v3(b, 2));
}
export function vec3Normalize(value, out = vec3()) {
    return kvec3.normalize(value, out);
}
export function vec3ProjectOnPlane(value, normal, out = vec3()) {
    const normalizedNormal = vec3Normalize(normal);
    return vec3AddScaled(value, normalizedNormal, -vec3Dot(value, normalizedNormal), out);
}
//# sourceMappingURL=vector.js.map