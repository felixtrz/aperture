import { mat4 as wgpuMat4, quat as wgpuQuat, vec2 as wgpuVec2, vec3 as wgpuVec3, vec4 as wgpuVec4, } from "/aperture/worker-modules/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { read } from "./scalars.js";
export function vec2(x = 0, y = 0) {
    return wgpuVec2.create(x, y);
}
export function vec3(x = 0, y = 0, z = 0) {
    return wgpuVec3.create(x, y, z);
}
export function vec4(x = 0, y = 0, z = 0, w = 0) {
    return wgpuVec4.create(x, y, z, w);
}
export function quat(x = 0, y = 0, z = 0, w = 1) {
    return wgpuQuat.create(x, y, z, w);
}
export function color(r = 1, g = 1, b = 1, a = 1) {
    return vec4(r, g, b, a);
}
export function mat4(values) {
    if (values === undefined) {
        return wgpuMat4.create();
    }
    return wgpuMat4.set(read(values, 0, "Mat4Like"), read(values, 1, "Mat4Like"), read(values, 2, "Mat4Like"), read(values, 3, "Mat4Like"), read(values, 4, "Mat4Like"), read(values, 5, "Mat4Like"), read(values, 6, "Mat4Like"), read(values, 7, "Mat4Like"), read(values, 8, "Mat4Like"), read(values, 9, "Mat4Like"), read(values, 10, "Mat4Like"), read(values, 11, "Mat4Like"), read(values, 12, "Mat4Like"), read(values, 13, "Mat4Like"), read(values, 14, "Mat4Like"), read(values, 15, "Mat4Like"));
}
export function quatIdentity() {
    return wgpuQuat.identity();
}
export function identityMat4(out = mat4()) {
    return wgpuMat4.identity(out);
}
export function identityTransformValues() {
    return {
        translation: vec3(0, 0, 0),
        rotation: quatIdentity(),
        scale: vec3(1, 1, 1),
    };
}
//# sourceMappingURL=constructors.js.map