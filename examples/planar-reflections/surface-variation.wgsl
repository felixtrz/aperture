// Optional standard-material surface hook. See SURFACES.md for compilation.
struct ApertureSurface {
  baseColor: vec3f,
  normal: vec3f,
  metallic: f32,
  roughness: f32,
  emissive: vec3f,
};

// Baked authoring choices: edit and recompile, with no runtime parameters.
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
  // A sparse 3D Voronoi field makes irregular polygonal color patches on a
  // surface. It needs no UV unwrap and continues across adjoining static meshes.
  let p = worldPosition / SURFACE_CELL_SIZE;
  let base = vec3i(floor(p));
  let local = fract(p);
  var nearest = 100.0;
  var tone = 0.5;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let offset = vec3i(x, y, z);
        let cell = base + offset;
        let h = surfaceCellHash(cell);
        let random = vec3f(vec3u(h, h >> 10u, h >> 20u) & vec3u(1023u)) / 1024.0;
        // Keep sites near cell centers; the 27 neighbors cover the nearest site.
        let delta = vec3f(offset) + vec3f(0.3) + 0.4 * random - local;
        let distanceSquared = dot(delta, delta);
        if (distanceSquared < nearest) {
          nearest = distanceSquared;
          tone = f32(surfaceCellHash(cell + vec3i(31, 73, 127)) & 16777215u) / 16777216.0;
        }
      }
    }
  }
  var result = surface;
  // Multiply the existing linear albedo; keep its hue and the PBR response.
  result.baseColor *= 1.0 + (tone * 2.0 - 1.0) * SURFACE_CONTRAST;
  return result;
}
