import { bakeFailure } from "./bake-transform-types.js";

export type BakeVector3 = readonly [number, number, number];

export interface BakeAffineTransform {
  readonly matrix: readonly number[];
  readonly linear: readonly number[];
  readonly cofactors: readonly number[];
  readonly orientation: 1 | -1;
}

export function readBakeTransform(
  value: ArrayLike<number>,
): BakeAffineTransform {
  if (value == null || value.length !== 16) {
    bakeFailure({
      code: "meshBake.invalidTransform",
      path: "transform",
      message: "Provide exactly 16 column-major affine matrix values.",
    });
  }
  const matrix = Array.from(value);
  for (const [index, component] of matrix.entries()) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      bakeFailure({
        code: "meshBake.invalidTransform",
        path: `transform[${index}]`,
        message: "Matrix values must be finite numbers.",
      });
    }
  }
  if (
    matrix[3] !== 0 ||
    matrix[7] !== 0 ||
    matrix[11] !== 0 ||
    matrix[15] !== 1
  ) {
    bakeFailure({
      code: "meshBake.invalidTransform",
      path: "transform",
      message:
        "Only affine transforms with last row [0,0,0,1] are supported; remove perspective components.",
    });
  }
  const linear = [
    matrix[0]!,
    matrix[1]!,
    matrix[2]!,
    matrix[4]!,
    matrix[5]!,
    matrix[6]!,
    matrix[8]!,
    matrix[9]!,
    matrix[10]!,
  ];
  const scale = Math.max(...linear.map(Math.abs));
  if (scale === 0) {
    bakeFailure({
      code: "meshBake.singularTransform",
      path: "transform",
      message:
        "The linear transform is singular; use nonzero independent basis vectors.",
    });
  }
  const a = linear.map((component) => component / scale);
  const cofactors = [
    a[4]! * a[8]! - a[5]! * a[7]!,
    a[5]! * a[6]! - a[3]! * a[8]!,
    a[3]! * a[7]! - a[4]! * a[6]!,
    a[7]! * a[2]! - a[8]! * a[1]!,
    a[8]! * a[0]! - a[6]! * a[2]!,
    a[6]! * a[1]! - a[7]! * a[0]!,
    a[1]! * a[5]! - a[2]! * a[4]!,
    a[2]! * a[3]! - a[0]! * a[5]!,
    a[0]! * a[4]! - a[1]! * a[3]!,
  ];
  const determinant =
    a[0]! * cofactors[0]! + a[1]! * cofactors[1]! + a[2]! * cofactors[2]!;
  if (!Number.isFinite(determinant) || determinant === 0) {
    bakeFailure({
      code: "meshBake.singularTransform",
      path: "transform",
      message:
        "The linear transform is singular or cannot be resolved numerically; use independent, well-conditioned basis vectors.",
    });
  }
  return {
    matrix,
    linear: a,
    cofactors,
    orientation: determinant < 0 ? -1 : 1,
  };
}

export function multiplyBakeVector(
  matrix: readonly number[],
  vector: BakeVector3,
): BakeVector3 {
  return [
    matrix[0]! * vector[0] + matrix[3]! * vector[1] + matrix[6]! * vector[2],
    matrix[1]! * vector[0] + matrix[4]! * vector[1] + matrix[7]! * vector[2],
    matrix[2]! * vector[0] + matrix[5]! * vector[1] + matrix[8]! * vector[2],
  ];
}

export function normalizedBakeVector(
  vector: BakeVector3,
  path: string,
): BakeVector3 {
  const scale = Math.max(...vector.map(Math.abs));
  if (!Number.isFinite(scale) || scale === 0) {
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: path,
      message:
        "Direction must remain finite and nonzero; supply a valid normal/tangent and a nonsingular transform.",
    });
  }
  const scaled = vector.map((value) => value / scale);
  const length = Math.hypot(...scaled);
  return [
    scaled[0] === 0 ? 0 : scaled[0]! / length,
    scaled[1] === 0 ? 0 : scaled[1]! / length,
    scaled[2] === 0 ? 0 : scaled[2]! / length,
  ];
}

export function bakePosition(
  transform: BakeAffineTransform,
  p: BakeVector3,
  path: string,
): BakeVector3 {
  const m = transform.matrix;
  return [
    finiteBakeFloat(m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!, path),
    finiteBakeFloat(m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!, path),
    finiteBakeFloat(m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!, path),
  ];
}

export function bakeNormal(
  transform: BakeAffineTransform,
  n: BakeVector3,
  path: string,
): BakeVector3 {
  const cofactor = multiplyBakeVector(transform.cofactors, n);
  return normalizedBakeVector(
    [
      cofactor[0] * transform.orientation,
      cofactor[1] * transform.orientation,
      cofactor[2] * transform.orientation,
    ],
    path,
  );
}

export function orthogonalBakeTangent(
  tangent: BakeVector3,
  normal: BakeVector3,
  path: string,
): BakeVector3 {
  // Two cross products avoid subtracting nearly equal vectors in Gram-Schmidt.
  const bitangent: BakeVector3 = [
    tangent[1] * normal[2] - tangent[2] * normal[1],
    tangent[2] * normal[0] - tangent[0] * normal[2],
    tangent[0] * normal[1] - tangent[1] * normal[0],
  ];
  return normalizedBakeVector(
    [
      normal[1] * bitangent[2] - normal[2] * bitangent[1],
      normal[2] * bitangent[0] - normal[0] * bitangent[2],
      normal[0] * bitangent[1] - normal[1] * bitangent[0],
    ],
    path,
  );
}

export function finiteBakeFloat(value: number, path: string): number {
  const stored = Math.fround(value);
  if (!Number.isFinite(stored)) {
    bakeFailure({
      code: "meshBake.nonFiniteOutput",
      path: path,
      message:
        "Transformed values must fit finite float32 storage; reduce local coordinates or transform magnitude.",
    });
  }
  return stored;
}
