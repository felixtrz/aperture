import { mat4 as wgpuMat4 } from "/aperture/worker-modules/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { mat4 } from "./constructors.js";
import { assertFiniteNumber, assertFinitePositive } from "./scalars.js";
export function makePerspective(fovyRadians, aspect, near, far, out = mat4()) {
    assertFinitePositive(fovyRadians, "fovyRadians");
    assertFinitePositive(aspect, "aspect");
    assertFinitePositive(near, "near");
    assertFinitePositive(far, "far");
    if (near >= far) {
        throw new RangeError("Expected near to be less than far.");
    }
    return wgpuMat4.perspective(fovyRadians, aspect, near, far, out);
}
export function makeOrthographic(left, right, bottom, top, near, far, out = mat4()) {
    assertFiniteNumber(left, "left");
    assertFiniteNumber(right, "right");
    assertFiniteNumber(bottom, "bottom");
    assertFiniteNumber(top, "top");
    assertFinitePositive(near, "near");
    assertFinitePositive(far, "far");
    if (left === right) {
        throw new RangeError("Expected left and right to describe a non-zero width.");
    }
    if (bottom === top) {
        throw new RangeError("Expected bottom and top to describe a non-zero height.");
    }
    if (near >= far) {
        throw new RangeError("Expected near to be less than far.");
    }
    return wgpuMat4.ortho(left, right, bottom, top, near, far, out);
}
//# sourceMappingURL=projection.js.map