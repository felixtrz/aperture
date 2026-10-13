import { mat4 as kmat4, quat as kquat, vec2 as kvec2, vec3 as kvec3, vec4 as kvec4, } from "./kernel/index.js";
import { read } from "./scalars.js";
export function vec2(x = 0, y = 0) {
    return kvec2.create(x, y);
}
export function vec3(x = 0, y = 0, z = 0) {
    return kvec3.create(x, y, z);
}
export function vec4(x = 0, y = 0, z = 0, w = 0) {
    return kvec4.create(x, y, z, w);
}
export function quat(x = 0, y = 0, z = 0, w = 1) {
    return kquat.create(x, y, z, w);
}
export function color(r = 1, g = 1, b = 1, a = 1) {
    return vec4(r, g, b, a);
}
export function mat4(values) {
    const out = kmat4.create();
    if (values === undefined) {
        return out;
    }
    for (let index = 0; index < 16; index += 1) {
        out[index] = read(values, index, "Mat4Like");
    }
    return out;
}
// Checked tuple constructors. TypeScript rejects a direct cast from
// `number[]` to a fixed-length tuple type (TS2352: "Target requires N
// element(s)"), which pushes callers toward `as unknown as` casts that skip
// length validation entirely. These converters are the sanctioned path from
// array-producing expressions (`.map()`, decoded JSON, GPU readbacks) into the
// `*Tuple` types: they validate the exact length at runtime and return a
// properly typed tuple.
export function vec2Tuple(values) {
    assertTupleLength(values, 2, "Vec2Tuple");
    return [read(values, 0, "Vec2Tuple"), read(values, 1, "Vec2Tuple")];
}
export function vec3Tuple(values) {
    assertTupleLength(values, 3, "Vec3Tuple");
    return [
        read(values, 0, "Vec3Tuple"),
        read(values, 1, "Vec3Tuple"),
        read(values, 2, "Vec3Tuple"),
    ];
}
export function vec4Tuple(values) {
    assertTupleLength(values, 4, "Vec4Tuple");
    return [
        read(values, 0, "Vec4Tuple"),
        read(values, 1, "Vec4Tuple"),
        read(values, 2, "Vec4Tuple"),
        read(values, 3, "Vec4Tuple"),
    ];
}
export function quatTuple(values) {
    assertTupleLength(values, 4, "QuatTuple");
    return [
        read(values, 0, "QuatTuple"),
        read(values, 1, "QuatTuple"),
        read(values, 2, "QuatTuple"),
        read(values, 3, "QuatTuple"),
    ];
}
export function colorTuple(values) {
    assertTupleLength(values, 4, "ColorTuple");
    return [
        read(values, 0, "ColorTuple"),
        read(values, 1, "ColorTuple"),
        read(values, 2, "ColorTuple"),
        read(values, 3, "ColorTuple"),
    ];
}
export function mat4Tuple(values) {
    assertTupleLength(values, 16, "Mat4Tuple");
    const out = new Array(16);
    for (let index = 0; index < 16; index += 1) {
        out[index] = read(values, index, "Mat4Tuple");
    }
    return out;
}
function assertTupleLength(values, expected, label) {
    if (values.length !== expected) {
        throw new RangeError(`${label} requires exactly ${expected} element(s), received ${values.length}.`);
    }
}
export function quatIdentity() {
    return kquat.identity();
}
export function identityMat4(out = mat4()) {
    return kmat4.identity(out);
}
export function identityTransformValues() {
    return {
        translation: vec3(0, 0, 0),
        rotation: quatIdentity(),
        scale: vec3(1, 1, 1),
    };
}
//# sourceMappingURL=constructors.js.map