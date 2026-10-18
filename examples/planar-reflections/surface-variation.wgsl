// Optional standard-material surface hook. See SURFACES.md for compilation.
struct ApertureSurface {
  baseColor: vec3f,
  normal: vec3f,
  metallic: f32,
  roughness: f32,
  emissive: vec3f,
};

const SURFACE_CELL_SIZE: f32 = 0.5; // World units; must be positive.
const SURFACE_CONTRAST: f32 = 0.06; // At most +/-6% of the linear base color.

fn surfaceCellHash(cell: vec3i) -> u32 {
  let bits = bitcast<vec3u>(cell);
  var h = (bits.x * 1597334677u) ^ (bits.y * 3812015801u) ^ (bits.z * 2798796415u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = (h ^ (h >> 13u)) * 3266489917u;
  return h ^ (h >> 16u);
}

fn surfaceVariation(
  surface: ApertureSurface,
  uv: vec2f,
  worldPosition: vec3f,
  parameters: vec4f,
) -> ApertureSurface {
  // Rotate a tetrahedral lattice away from the common wall/ground axes.
  // Six tetrahedra occupy each cube; cbrt(1/6) keeps their mean volume at
  // SURFACE_CELL_SIZE cubed. A point selects one cell without a neighbor search.
  let q = worldPosition / SURFACE_CELL_SIZE;
  let p = vec3f(
    dot(q, vec3f(0.8, 0.0, 0.6)),
    dot(q, vec3f(-0.36, 0.8, 0.48)),
    dot(q, vec3f(-0.48, -0.6, 0.64)),
  ) * 0.550321208;
  let cell = vec3i(floor(p));
  let f = fract(p);
  // The ordering of the three coordinates selects one of six tetrahedra.
  // Packing the comparisons into low bits gives neighboring cubes unique IDs.
  let tetrahedron = vec3i(
    select(0, 1, f.x >= f.y),
    select(0, 1, f.y >= f.z),
    select(0, 1, f.x >= f.z),
  );
  let tone = f32(surfaceCellHash(cell * 2 + tetrahedron) & 16777215u) / 16777216.0;
  var result = surface;
  result.baseColor *= 1.0 + (tone * 2.0 - 1.0) * SURFACE_CONTRAST;
  return result;
}
