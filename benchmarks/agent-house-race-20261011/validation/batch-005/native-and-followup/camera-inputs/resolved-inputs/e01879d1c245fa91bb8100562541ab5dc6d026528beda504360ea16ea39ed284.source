import { v3 } from "./scalars.js";
// Canonical converters from any vector-like input to a plain, JSON-serializable
// tuple. These replace the many ad-hoc `tuple3` / `tuple4` helpers that used to
// live in the render, webgpu, and app layers — all math (including this kind of
// value reshaping) now flows through the math package.
export function toVec2Tuple(value) {
    return [v2(value, 0), v2(value, 1)];
}
export function toVec3Tuple(value) {
    return [v3(value, 0), v3(value, 1), v3(value, 2)];
}
export function toVec4Tuple(value) {
    return [v4(value, 0), v4(value, 1), v4(value, 2), v4(value, 3)];
}
function v2(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Vec2Like is missing numeric value at index ${index}.`);
    }
    return value;
}
function v4(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Vec4Like is missing numeric value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=tuples.js.map