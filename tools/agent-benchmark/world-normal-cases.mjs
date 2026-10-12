import { mat3, vec3 } from "gl-matrix";

const matrix = (a, b, c) => [...a, 0, ...b, 0, ...c, 0, 0, 0, 0, 1];
const diagonal = (x, y, z) => matrix([x, 0, 0], [0, y, 0], [0, 0, z]);
const unit = (value) => Array.from(vec3.normalize(vec3.create(), value));
const n = unit([1, 1, 0]),
  t = unit([1, -1, 0]);

// Expected nonsingular results use an independent matrix inverse implementation.
export const WORLD_NORMAL_CASES = [
  { id: "identity", world: diagonal(1, 1, 1), normal: n, tangent: t },
  { id: "nonuniform", world: diagonal(2, 1, 3), normal: n, tangent: t },
  {
    id: "shear",
    world: matrix([1, 0, 0], [0.7, 1, 0], [0.2, 0.3, 1]),
    normal: n,
    tangent: t,
  },
  { id: "mirrored", world: diagonal(-2, 1, 3), normal: n, tangent: t },
  {
    id: "tiny-uniform",
    world: diagonal(1e-20, 1e-20, 1e-20),
    normal: n,
    tangent: t,
  },
  {
    id: "huge-uniform",
    world: diagonal(1e20, 1e20, 1e20),
    normal: n,
    tangent: t,
  },
  {
    id: "rank-two",
    world: diagonal(0, 2, 3),
    normal: [1, 0, 0],
    tangent: [0, 1, 0],
    expectedNormal: [1, 0, 0],
    expectedOrientation: 1,
  },
  {
    id: "rank-one",
    world: diagonal(0, 2, 0),
    normal: n,
    tangent: t,
    expectedNormal: [0, 1, 0],
    expectedOrientation: 1,
  },
  {
    id: "collapsed",
    world: diagonal(0, 0, 0),
    normal: n,
    tangent: t,
    expectedNormal: n,
    expectedOrientation: 1,
  },
  {
    id: "zero-normal",
    world: diagonal(1, 1, 1),
    normal: [0, 0, 0],
    tangent: [1, 0, 0],
    expectedNormal: [0, 1, 0],
    expectedOrientation: 1,
  },
].map((entry) => {
  const inverseTranspose = mat3.normalFromMat4(mat3.create(), entry.world);
  const expectedNormal =
    entry.expectedNormal ??
    unit(vec3.transformMat3(vec3.create(), entry.normal, inverseTranspose));
  const determinant = mat3.determinant(
    mat3.fromMat4(mat3.create(), entry.world),
  );
  return {
    ...entry,
    expectedNormal,
    expectedOrientation:
      entry.expectedOrientation ?? (determinant < 0 ? -1 : 1),
  };
});

export function validateNormalReadback(values) {
  if (values.length !== WORLD_NORMAL_CASES.length * 8)
    throw new Error("Normal probe readback size differs");
  return WORLD_NORMAL_CASES.map((entry, index) => {
    const normal = values.slice(index * 8, index * 8 + 3),
      orientation = values[index * 8 + 3],
      tangent = values.slice(index * 8 + 4, index * 8 + 7);
    const delta = Math.max(
      ...normal.map((value, axis) =>
        Math.abs(value - entry.expectedNormal[axis]),
      ),
    );
    const dot = normal.reduce(
      (sum, value, axis) => sum + value * tangent[axis],
      0,
    );
    if (
      ![...normal, ...tangent, orientation].every(Number.isFinite) ||
      delta > 0.00005 ||
      orientation !== entry.expectedOrientation ||
      Math.abs(Math.hypot(...normal) - 1) > 0.00005 ||
      Math.abs(Math.hypot(...tangent) - 1) > 0.00005 ||
      Math.abs(dot) > 0.00005
    )
      throw new Error(
        `Native normal/tangent invariant failed: ${entry.id}: ${JSON.stringify({ normal, tangent, orientation, delta, dot })}`,
      );
    return {
      id: entry.id,
      normal,
      tangent,
      orientation,
      expectedNormal: entry.expectedNormal,
      expectedOrientation: entry.expectedOrientation,
      maxError: delta,
      orthogonalityError: Math.abs(dot),
    };
  });
}
