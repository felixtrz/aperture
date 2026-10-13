// Aperture in-house vec4 kernel (also the storage for RGBA colors).
import { allocVec4 } from "./alloc.js";
export function create(x = 0, y = 0, z = 0, w = 0) {
    const d = allocVec4();
    d[0] = x;
    d[1] = y;
    d[2] = z;
    d[3] = w;
    return d;
}
export function set(x, y, z, w, dst) {
    const d = allocVec4(dst);
    d[0] = x;
    d[1] = y;
    d[2] = z;
    d[3] = w;
    return d;
}
export function copy(vIn, dst) {
    const v = vIn;
    const d = allocVec4(dst);
    d[0] = v[0];
    d[1] = v[1];
    d[2] = v[2];
    d[3] = v[3];
    return d;
}
export function add(aIn, bIn, dst) {
    const a = aIn;
    const b = bIn;
    const d = allocVec4(dst);
    d[0] = a[0] + b[0];
    d[1] = a[1] + b[1];
    d[2] = a[2] + b[2];
    d[3] = a[3] + b[3];
    return d;
}
export function subtract(aIn, bIn, dst) {
    const a = aIn;
    const b = bIn;
    const d = allocVec4(dst);
    d[0] = a[0] - b[0];
    d[1] = a[1] - b[1];
    d[2] = a[2] - b[2];
    d[3] = a[3] - b[3];
    return d;
}
export { subtract as sub };
export function scale(vIn, k, dst) {
    const v = vIn;
    const d = allocVec4(dst);
    d[0] = v[0] * k;
    d[1] = v[1] * k;
    d[2] = v[2] * k;
    d[3] = v[3] * k;
    return d;
}
export function dot(aIn, bIn) {
    const a = aIn;
    const b = bIn;
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
export function lengthSq(vIn) {
    const v = vIn;
    const x = v[0];
    const y = v[1];
    const z = v[2];
    const w = v[3];
    return x * x + y * y + z * z + w * w;
}
export function length(v) {
    return Math.sqrt(lengthSq(v));
}
export { length as len };
export function normalize(vIn, dst) {
    const v = vIn;
    const d = allocVec4(dst);
    const x = v[0];
    const y = v[1];
    const z = v[2];
    const w = v[3];
    const lenSq = x * x + y * y + z * z + w * w;
    const s = lenSq > 0 ? 1 / Math.sqrt(lenSq) : 1;
    d[0] = x * s;
    d[1] = y * s;
    d[2] = z * s;
    d[3] = w * s;
    return d;
}
//# sourceMappingURL=vec4.js.map