import { mat4 as kmat4, quat as kquat, vec3 as kvec3 } from "./kernel/index.js";
import { EPSILON } from "./constants.js";
import { mat4, quat, vec3 } from "./constructors.js";
const MATRIX_DECOMPOSITION_TOLERANCE = 1e-4;
export function composeTransform(out, translation, rotation, scale) {
    return composeTrsMatrix(translation, rotation, scale, out);
}
export function composeTrsMatrix(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], out = mat4()) {
    return kmat4.composeTRS(translation, rotation, scale, out);
}
export function multiplyMat4(a, b, out = mat4()) {
    return kmat4.multiply(a, b, out);
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
    const determinant = kmat4.determinant(matrix);
    const signedScaleX = determinant < 0 ? -scaleX : scaleX;
    const rotationMatrix = mat4();
    writeNormalizedColumn(rotationMatrix, matrix, 0, signedScaleX);
    writeNormalizedColumn(rotationMatrix, matrix, 1, scaleY);
    writeNormalizedColumn(rotationMatrix, matrix, 2, scaleZ);
    const translation = vec3(read(matrix, 12), read(matrix, 13), read(matrix, 14));
    const rotation = quat();
    const scale = vec3(signedScaleX, scaleY, scaleZ);
    kquat.fromMat(rotationMatrix, rotation);
    kquat.normalize(rotation, rotation);
    if (!matrixApproximatelyEqual(composeTrsMatrix(translation, rotation, scale), matrix)) {
        return null;
    }
    return { translation, rotation, scale };
}
export function invertMat4(matrix, out = mat4()) {
    const determinant = kmat4.determinant(matrix);
    if (Math.abs(determinant) <= EPSILON) {
        return null;
    }
    return kmat4.inverse(matrix, out);
}
export function transformPoint(matrix, point, out = vec3()) {
    return kvec3.transformMat4(point, matrix, out);
}
export function transformVector(matrix, vector, out = vec3()) {
    return kvec3.transformMat4Upper3x3(vector, matrix, out);
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