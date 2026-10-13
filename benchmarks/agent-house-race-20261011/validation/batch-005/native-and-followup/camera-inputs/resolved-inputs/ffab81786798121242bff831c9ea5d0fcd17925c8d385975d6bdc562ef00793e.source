// Aperture in-house vec2 kernel.
import { allocVec2 } from "./alloc.js";
export function create(x = 0, y = 0) {
    const d = allocVec2();
    d[0] = x;
    d[1] = y;
    return d;
}
export function set(x, y, dst) {
    const d = allocVec2(dst);
    d[0] = x;
    d[1] = y;
    return d;
}
export function copy(vIn, dst) {
    const v = vIn;
    const d = allocVec2(dst);
    d[0] = v[0];
    d[1] = v[1];
    return d;
}
export function add(aIn, bIn, dst) {
    const a = aIn;
    const b = bIn;
    const d = allocVec2(dst);
    d[0] = a[0] + b[0];
    d[1] = a[1] + b[1];
    return d;
}
export function subtract(aIn, bIn, dst) {
    const a = aIn;
    const b = bIn;
    const d = allocVec2(dst);
    d[0] = a[0] - b[0];
    d[1] = a[1] - b[1];
    return d;
}
export { subtract as sub };
export function scale(vIn, k, dst) {
    const v = vIn;
    const d = allocVec2(dst);
    d[0] = v[0] * k;
    d[1] = v[1] * k;
    return d;
}
export function dot(aIn, bIn) {
    const a = aIn;
    const b = bIn;
    return a[0] * b[0] + a[1] * b[1];
}
export function lengthSq(vIn) {
    const v = vIn;
    const x = v[0];
    const y = v[1];
    return x * x + y * y;
}
export function length(v) {
    return Math.sqrt(lengthSq(v));
}
export { length as len };
export function normalize(vIn, dst) {
    const v = vIn;
    const d = allocVec2(dst);
    const x = v[0];
    const y = v[1];
    const lenSq = x * x + y * y;
    const s = lenSq > 0 ? 1 / Math.sqrt(lenSq) : 1;
    d[0] = x * s;
    d[1] = y * s;
    return d;
}
//# sourceMappingURL=vec2.js.map