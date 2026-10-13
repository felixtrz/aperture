/** Shared by lit and diagnostic normal shaders; no snapshot/binding ABI change. */
export const WORLD_NORMAL_TRANSFORM_WGSL = `
fn apertureUnitVectorOr(value: vec3f, fallback: vec3f) -> vec3f {
  let scale = max(max(abs(value.x), abs(value.y)), abs(value.z));
  // Scaling first avoids squared-length underflow/overflow. The upper bound
  // rejects infinities; component equality explicitly rejects NaNs.
  if (all(value == value) && scale > 0.0 && scale <= 3.402823466e38f) {
    let scaled = value / scale;
    return scaled * inverseSqrt(dot(scaled, scaled));
  }
  return fallback;
}

fn apertureScaledWorldLinear(world: mat4x4f) -> mat3x3f {
  let a = world[0].xyz;
  let b = world[1].xyz;
  let c = world[2].xyz;
  let largest = max(abs(a), max(abs(b), abs(c)));
  let scale = max(max(largest.x, largest.y), largest.z);
  if (all(a == a) && all(b == b) && all(c == c) &&
      scale > 0.0 && scale <= 3.402823466e38f) {
    return mat3x3f(a / scale, b / scale, c / scale);
  }
  // A collapsed or non-finite world matrix has no inverse. Keep a finite,
  // deterministic local-space normal rather than emitting normalize(0)/NaN.
  return mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));
}

fn apertureWorldOrientation(world: mat4x4f) -> f32 {
  let linear = apertureScaledWorldLinear(world);
  let determinant = dot(linear[0], cross(linear[1], linear[2]));
  return select(1.0, -1.0, determinant < 0.0);
}

fn apertureTransformWorldNormal(world: mat4x4f, normal: vec3f) -> vec3f {
  let linear = apertureScaledWorldLinear(world);
  let a = cross(linear[1], linear[2]);
  let b = cross(linear[2], linear[0]);
  let c = cross(linear[0], linear[1]);
  let determinant = dot(linear[0], a);
  // Cofactor/determinant is inverse-transpose. Normalization removes the
  // determinant magnitude, but its sign remains essential for mirrored worlds.
  // For rank-two singular matrices a nonzero cofactor still gives a geometric
  // normal; rank-one/zero cases use the explicit finite forward/local fallback.
  let cofactorNormal = mat3x3f(a, b, c) * normal;
  let orientedNormal = cofactorNormal * select(1.0, -1.0, determinant < 0.0);
  let scale = max(max(abs(orientedNormal.x), abs(orientedNormal.y)), abs(orientedNormal.z));
  if (all(orientedNormal == orientedNormal) && scale > 0.0 && scale <= 3.402823466e38f) {
    let scaled = orientedNormal / scale;
    return scaled * inverseSqrt(dot(scaled, scaled));
  }
  // WGSL function arguments are eager: supplying these as apertureUnitVectorOr's
  // fallback would normalize both vectors for every valid cofactor normal.
  // Keep the same finite test and arithmetic, but compute fallbacks only when
  // needed. Test the cofactor rather than the determinant to retain rank-two
  // geometric normals. This helper has no derivative-dependent operations.
  let localFallback = apertureUnitVectorOr(normal, vec3f(0.0, 1.0, 0.0));
  return apertureUnitVectorOr(linear * normal, localFallback);
}

fn apertureTransformWorldTangent(world: mat4x4f, tangent: vec3f) -> vec3f {
  let localFallback = apertureUnitVectorOr(tangent, vec3f(1.0, 0.0, 0.0));
  return apertureUnitVectorOr(apertureScaledWorldLinear(world) * tangent, localFallback);
}

fn apertureOrthogonalTangent(normal: vec3f, tangent: vec3f) -> vec3f {
  let axis = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(normal.x) > 0.9);
  let fallback = apertureUnitVectorOr(cross(axis, normal), vec3f(0.0, 0.0, 1.0));
  return apertureUnitVectorOr(tangent - normal * dot(tangent, normal), fallback);
}
`;
