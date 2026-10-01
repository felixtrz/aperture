import { bench, describe } from "vitest";
import { mat4 as glMat4 } from "gl-matrix";
import { mat4 as kernel } from "@aperture-engine/math/kernel";
import {
  composeTrsMatrix,
  invertMat4,
  mat4,
  quatFromAxisAngle,
  type Mat4,
  type Mat4Like,
} from "@aperture-engine/math";

// Non-gating compute-only comparison. Reuse output buffers for all competitors.
// The legacy implementation is intentionally retained here as a cost baseline,
// not a correctness reference: it rejects the tiny-scale case.
const BENCH = { time: 300, warmupTime: 100 } as const;
const rotation = quatFromAxisAngle([0.3, 0.7, -0.2], 0.9);
const normal = composeTrsMatrix([1.5, -2.25, 3.75], rotation, [1.25, 0.75, 2]);
const tiny = composeTrsMatrix(
  [1.5e-5, -2.25e-5, 3.75e-5],
  rotation,
  [1.25e-5, 0.75e-5, 2e-5],
);
const projective = glMat4.perspectiveZO(
  new Float32Array(16),
  1.1,
  1.6,
  0.01,
  10000,
);
const out = mat4();

function legacyInverse(matrix: Mat4Like, destination: Mat4): Mat4 | null {
  const determinant = kernel.determinant(matrix);
  return !Number.isFinite(determinant) || Math.abs(determinant) <= 1e-12
    ? null
    : kernel.inverse(matrix, destination);
}

for (const [name, matrix] of [
  ["normal TRS", normal],
  ["tiny TRS", tiny],
  ["projective", projective],
] as const) {
  describe(`invertMat4 checked wrapper: ${name}`, () => {
    bench(
      "scale-aware checked inverse",
      () => {
        invertMat4(matrix, out);
      },
      BENCH,
    );
    bench(
      "legacy absolute cutoff",
      () => {
        legacyInverse(matrix, out);
      },
      BENCH,
    );
    bench(
      "unchecked kernel",
      () => {
        kernel.inverse(matrix, out);
      },
      BENCH,
    );
    bench(
      "gl-matrix",
      () => {
        glMat4.invert(out, matrix);
      },
      BENCH,
    );
  });
}
