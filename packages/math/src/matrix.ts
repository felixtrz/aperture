import { mat4 as kmat4, quat as kquat, vec3 as kvec3 } from "./kernel/index.js";
import { EPSILON, MAT4_SINGULARITY_EPSILON } from "./constants.js";
import { mat4, quat, vec3 } from "./constructors.js";
import type {
  Mat4,
  Mat4Like,
  QuatLike,
  TransformValues,
  Vec3,
  Vec3Like,
} from "./types.js";

const MATRIX_DECOMPOSITION_TOLERANCE = 1e-4;

export function composeTransform(
  out: Mat4,
  translation: Vec3Like,
  rotation: QuatLike,
  scale: Vec3Like,
): Mat4 {
  return composeTrsMatrix(translation, rotation, scale, out);
}

export function composeTrsMatrix(
  translation: Vec3Like = [0, 0, 0],
  rotation: QuatLike = [0, 0, 0, 1],
  scale: Vec3Like = [1, 1, 1],
  out: Mat4 = mat4(),
): Mat4 {
  return kmat4.composeTRS(translation, rotation, scale, out);
}

export function multiplyMat4(
  a: Mat4Like,
  b: Mat4Like,
  out: Mat4 = mat4(),
): Mat4 {
  return kmat4.multiply(a, b, out);
}

export function decomposeTrsMatrix(matrix: Mat4Like): TransformValues | null {
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

  const translation = vec3(
    read(matrix, 12),
    read(matrix, 13),
    read(matrix, 14),
  );
  const rotation = quat();
  const scale = vec3(signedScaleX, scaleY, scaleZ);

  kquat.fromMat(rotationMatrix, rotation);
  kquat.normalize(rotation, rotation);

  if (
    !matrixApproximatelyEqual(
      composeTrsMatrix(translation, rotation, scale),
      matrix,
    )
  ) {
    return null;
  }

  return { translation, rotation, scale };
}

export function invertMat4(matrix: Mat4Like, out: Mat4 = mat4()): Mat4 | null {
  const determinant = kmat4.determinant(matrix);

  if (
    !Number.isFinite(determinant) ||
    Math.abs(determinant) <= MAT4_SINGULARITY_EPSILON
  ) {
    return null;
  }

  return kmat4.inverse(matrix, out);
}

export function transformPoint(
  matrix: Mat4Like,
  point: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  return kvec3.transformMat4(point, matrix, out);
}

export function transformVector(
  matrix: Mat4Like,
  vector: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  return kvec3.transformMat4Upper3x3(vector, matrix, out);
}

function isAffineMat4(matrix: Mat4Like): boolean {
  for (let index = 0; index < 16; index += 1) {
    if (!Number.isFinite(read(matrix, index))) {
      return false;
    }
  }

  return (
    approximately(read(matrix, 3), 0) &&
    approximately(read(matrix, 7), 0) &&
    approximately(read(matrix, 11), 0) &&
    approximately(read(matrix, 15), 1)
  );
}

function writeNormalizedColumn(
  out: Mat4,
  matrix: Mat4Like,
  column: number,
  scale: number,
): void {
  const offset = column * 4;
  out[offset] = read(matrix, offset) / scale;
  out[offset + 1] = read(matrix, offset + 1) / scale;
  out[offset + 2] = read(matrix, offset + 2) / scale;
  out[offset + 3] = 0;
}

function columnLength(matrix: Mat4Like, column: number): number {
  const offset = column * 4;
  const x = read(matrix, offset);
  const y = read(matrix, offset + 1);
  const z = read(matrix, offset + 2);

  return Math.hypot(x, y, z);
}

function matrixApproximatelyEqual(left: Mat4Like, right: Mat4Like): boolean {
  for (let index = 0; index < 16; index += 1) {
    if (!approximately(read(left, index), read(right, index))) {
      return false;
    }
  }

  return true;
}

function approximately(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));

  return Math.abs(left - right) <= MATRIX_DECOMPOSITION_TOLERANCE * scale;
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(
      `Mat4Like is missing numeric value at index ${index}.`,
    );
  }

  return value;
}
