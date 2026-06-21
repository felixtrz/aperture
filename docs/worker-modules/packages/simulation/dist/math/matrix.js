import { mat4 as wgpuMat4, quat as wgpuQuat, vec3 as wgpuVec3, } from "/aperture/worker-modules/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js";
import { EPSILON } from "./constants.js";
import { mat4, quat, vec3 } from "./constructors.js";
const MATRIX_DECOMPOSITION_TOLERANCE = 1e-4;
export function composeTransform(out, translation, rotation, scale) {
    return composeTrsMatrix(translation, rotation, scale, out);
}
export function composeTrsMatrix(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], out = mat4()) {
    wgpuMat4.fromQuat(asWgpuQuatArg(rotation), out);
    wgpuMat4.scale(out, asWgpuVec3Arg(scale), out);
    return wgpuMat4.setTranslation(out, asWgpuVec3Arg(translation), out);
}
export function multiplyMat4(a, b, out = mat4()) {
    return wgpuMat4.multiply(asWgpuMat4Arg(a), asWgpuMat4Arg(b), out);
}
export function decomposeTrsMatrix(matrix) {
    if (!isAffineMat4(matrix)) {
        return null;
    }
    const scaleX = columnLength(matrix, 0);
    const scaleY = columnLength(matrix, 1);
    const scaleZ = columnLength(matrix, 2);
    if (scaleX <= EPSILON || scaleY <= EPSILON || scaleZ <= EPSILON) {
        return null;
    }
    const determinant = wgpuMat4.determinant(asWgpuMat4Arg(matrix));
    const signedScaleX = determinant < 0 ? -scaleX : scaleX;
    const rotationMatrix = mat4();
    writeNormalizedColumn(rotationMatrix, matrix, 0, signedScaleX);
    writeNormalizedColumn(rotationMatrix, matrix, 1, scaleY);
    writeNormalizedColumn(rotationMatrix, matrix, 2, scaleZ);
    const translation = vec3(read(matrix, 12), read(matrix, 13), read(matrix, 14));
    const rotation = quat();
    const scale = vec3(signedScaleX, scaleY, scaleZ);
    wgpuQuat.fromMat(asWgpuMat4Arg(rotationMatrix), rotation);
    wgpuQuat.normalize(rotation, rotation);
    if (!matrixApproximatelyEqual(composeTrsMatrix(translation, rotation, scale), matrix)) {
        return null;
    }
    return { translation, rotation, scale };
}
export function invertMat4(matrix, out = mat4()) {
    const matrixArg = asWgpuMat4Arg(matrix);
    const determinant = wgpuMat4.determinant(matrixArg);
    if (Math.abs(determinant) <= EPSILON) {
        return null;
    }
    return wgpuMat4.inverse(matrixArg, out);
}
export function transformPoint(matrix, point, out = vec3()) {
    return wgpuVec3.transformMat4(asWgpuVec3Arg(point), asWgpuMat4Arg(matrix), out);
}
export function transformVector(matrix, vector, out = vec3()) {
    return wgpuVec3.transformMat4Upper3x3(asWgpuVec3Arg(vector), asWgpuMat4Arg(matrix), out);
}
function asWgpuMat4Arg(value) {
    return value;
}
function asWgpuQuatArg(value) {
    return value;
}
function asWgpuVec3Arg(value) {
    return value;
}
function isAffineMat4(matrix) {
    for (let index = 0; index < 16; index += 1) {
        if (!Number.isFinite(read(matrix, index))) {
            return false;
        }
    }
    return (approximately(read(matrix, 3), 0) &&
        approximately(read(matrix, 7), 0) &&
        approximately(read(matrix, 11), 0) &&
        approximately(read(matrix, 15), 1));
}
function writeNormalizedColumn(out, matrix, column, scale) {
    const offset = column * 4;
    out[offset] = read(matrix, offset) / scale;
    out[offset + 1] = read(matrix, offset + 1) / scale;
    out[offset + 2] = read(matrix, offset + 2) / scale;
    out[offset + 3] = 0;
}
function columnLength(matrix, column) {
    const offset = column * 4;
    const x = read(matrix, offset);
    const y = read(matrix, offset + 1);
    const z = read(matrix, offset + 2);
    return Math.hypot(x, y, z);
}
function matrixApproximatelyEqual(left, right) {
    for (let index = 0; index < 16; index += 1) {
        if (!approximately(read(left, index), read(right, index))) {
            return false;
        }
    }
    return true;
}
function approximately(left, right) {
    const scale = Math.max(1, Math.abs(left), Math.abs(right));
    return Math.abs(left - right) <= MATRIX_DECOMPOSITION_TOLERANCE * scale;
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Mat4Like is missing numeric value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=matrix.js.map