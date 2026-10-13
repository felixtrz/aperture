import type { Mat4, Mat4Like } from "./types.js";

// A determinant has 24 signed products of four entries. Allow for column
// normalization, the products, the minor subtractions and the final summation.
// This bounds cancellation at double precision, not the condition number of
// the original matrix or the precision of the eventual Float32 inverse.
const DETERMINANT_ROUNDOFF = 32 * Number.EPSILON;

/** Checked, allocation-free inverse for the nullable public wrapper. */
export function checkedInverseMat4(matrix: Mat4Like, out: Mat4): Mat4 | null {
  // Cache every input before writing so overlapping typed-array views work.
  const m00 = matrix[0]!;
  const m01 = matrix[1]!;
  const m02 = matrix[2]!;
  const m03 = matrix[3]!;
  const m10 = matrix[4]!;
  const m11 = matrix[5]!;
  const m12 = matrix[6]!;
  const m13 = matrix[7]!;
  const m20 = matrix[8]!;
  const m21 = matrix[9]!;
  const m22 = matrix[10]!;
  const m23 = matrix[11]!;
  const m30 = matrix[12]!;
  const m31 = matrix[13]!;
  const m32 = matrix[14]!;
  const m33 = matrix[15]!;
  const s0 = Math.max(
    Math.abs(m00),
    Math.abs(m01),
    Math.abs(m02),
    Math.abs(m03),
  );
  const s1 = Math.max(
    Math.abs(m10),
    Math.abs(m11),
    Math.abs(m12),
    Math.abs(m13),
  );
  const s2 = Math.max(
    Math.abs(m20),
    Math.abs(m21),
    Math.abs(m22),
    Math.abs(m23),
  );
  const s3 = Math.max(
    Math.abs(m30),
    Math.abs(m31),
    Math.abs(m32),
    Math.abs(m33),
  );

  // A zero column is singular; NaN/Infinity (including missing entries) cannot
  // produce a usable inverse. Check before normalizing or touching the output.
  if (
    !(s0 > 0 && s1 > 0 && s2 > 0 && s3 > 0) ||
    !Number.isFinite(Math.max(s0, s1, s2, s3))
  ) {
    return null;
  }

  // Normalize independently: changing an axis's units must not determine
  // invertibility. Using the product of the original scales would overflow or
  // underflow, even for a diagonal matrix with a perfectly usable inverse.
  const a00 = m00 / s0;
  const a01 = m01 / s0;
  const a02 = m02 / s0;
  const a03 = m03 / s0;
  const a10 = m10 / s1;
  const a11 = m11 / s1;
  const a12 = m12 / s1;
  const a13 = m13 / s1;
  const a20 = m20 / s2;
  const a21 = m21 / s2;
  const a22 = m22 / s2;
  const a23 = m23 / s2;
  const a30 = m30 / s3;
  const a31 = m31 / s3;
  const a32 = m32 / s3;
  const a33 = m33 / s3;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  // Bound the underlying 24 products, not just the six products of already
  // subtracted minors: cancellation inside a minor matters just as much.
  const p00 = Math.abs(a00 * a11) + Math.abs(a01 * a10);
  const p01 = Math.abs(a00 * a12) + Math.abs(a02 * a10);
  const p02 = Math.abs(a00 * a13) + Math.abs(a03 * a10);
  const p03 = Math.abs(a01 * a12) + Math.abs(a02 * a11);
  const p04 = Math.abs(a01 * a13) + Math.abs(a03 * a11);
  const p05 = Math.abs(a02 * a13) + Math.abs(a03 * a12);
  const p06 = Math.abs(a20 * a31) + Math.abs(a21 * a30);
  const p07 = Math.abs(a20 * a32) + Math.abs(a22 * a30);
  const p08 = Math.abs(a20 * a33) + Math.abs(a23 * a30);
  const p09 = Math.abs(a21 * a32) + Math.abs(a22 * a31);
  const p10 = Math.abs(a21 * a33) + Math.abs(a23 * a31);
  const p11 = Math.abs(a22 * a33) + Math.abs(a23 * a32);
  const magnitude =
    p00 * p11 + p01 * p10 + p02 * p09 + p03 * p08 + p04 * p07 + p05 * p06;
  if (
    determinant === 0 ||
    Math.abs(determinant) <= DETERMINANT_ROUNDOFF * magnitude
  ) {
    return null;
  }

  // A = normalized * diag(scales), so undo scaling on the inverse's ROWS.
  // Round before validating/writing: finite doubles can overflow Float32.
  const o00 = Math.fround(
    (a11 * b11 - a12 * b10 + a13 * b09) / determinant / s0,
  );
  const o01 = Math.fround(
    (a02 * b10 - a01 * b11 - a03 * b09) / determinant / s1,
  );
  const o02 = Math.fround(
    (a31 * b05 - a32 * b04 + a33 * b03) / determinant / s2,
  );
  const o03 = Math.fround(
    (a22 * b04 - a21 * b05 - a23 * b03) / determinant / s3,
  );
  const o10 = Math.fround(
    (a12 * b08 - a10 * b11 - a13 * b07) / determinant / s0,
  );
  const o11 = Math.fround(
    (a00 * b11 - a02 * b08 + a03 * b07) / determinant / s1,
  );
  const o12 = Math.fround(
    (a32 * b02 - a30 * b05 - a33 * b01) / determinant / s2,
  );
  const o13 = Math.fround(
    (a20 * b05 - a22 * b02 + a23 * b01) / determinant / s3,
  );
  const o20 = Math.fround(
    (a10 * b10 - a11 * b08 + a13 * b06) / determinant / s0,
  );
  const o21 = Math.fround(
    (a01 * b08 - a00 * b10 - a03 * b06) / determinant / s1,
  );
  const o22 = Math.fround(
    (a30 * b04 - a31 * b02 + a33 * b00) / determinant / s2,
  );
  const o23 = Math.fround(
    (a21 * b02 - a20 * b04 - a23 * b00) / determinant / s3,
  );
  const o30 = Math.fround(
    (a11 * b07 - a10 * b09 - a12 * b06) / determinant / s0,
  );
  const o31 = Math.fround(
    (a00 * b09 - a01 * b07 + a02 * b06) / determinant / s1,
  );
  const o32 = Math.fround(
    (a31 * b01 - a30 * b03 - a32 * b00) / determinant / s2,
  );
  const o33 = Math.fround(
    (a20 * b03 - a21 * b01 + a22 * b00) / determinant / s3,
  );

  // Finite Float32 values cannot overflow a double sum. Also reject complete
  // underflow of a row/column (e.g. the inverse of diag(1e100)); isolated tiny
  // terms may legitimately round to zero. This is not a conditioning test.
  if (
    !Number.isFinite(
      o00 +
        o01 +
        o02 +
        o03 +
        o10 +
        o11 +
        o12 +
        o13 +
        o20 +
        o21 +
        o22 +
        o23 +
        o30 +
        o31 +
        o32 +
        o33,
    ) ||
    (o00 === 0 && o01 === 0 && o02 === 0 && o03 === 0) ||
    (o10 === 0 && o11 === 0 && o12 === 0 && o13 === 0) ||
    (o20 === 0 && o21 === 0 && o22 === 0 && o23 === 0) ||
    (o30 === 0 && o31 === 0 && o32 === 0 && o33 === 0) ||
    (o00 === 0 && o10 === 0 && o20 === 0 && o30 === 0) ||
    (o01 === 0 && o11 === 0 && o21 === 0 && o31 === 0) ||
    (o02 === 0 && o12 === 0 && o22 === 0 && o32 === 0) ||
    (o03 === 0 && o13 === 0 && o23 === 0 && o33 === 0)
  ) {
    return null;
  }

  out[0] = o00;
  out[1] = o01;
  out[2] = o02;
  out[3] = o03;
  out[4] = o10;
  out[5] = o11;
  out[6] = o12;
  out[7] = o13;
  out[8] = o20;
  out[9] = o21;
  out[10] = o22;
  out[11] = o23;
  out[12] = o30;
  out[13] = o31;
  out[14] = o32;
  out[15] = o33;
  return out;
}
