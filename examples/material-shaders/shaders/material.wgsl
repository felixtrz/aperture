// @import "./aperture-material.wgsl"
// @import "../../shader-workbench/shaders/palette.wgsl"

fn deformSurface(vertex: ApertureVertex, uv: vec2f, parameters: vec4f) -> ApertureVertex {
  let phase = vertex.position.x * 2.5 + parameters.x;
  let height = sin(phase) * parameters.y;
  let slope = cos(phase) * 2.5 * parameters.y;
  return ApertureVertex(vertex.position + vec3f(0.0, height, 0.0), normalize(vec3f(vertex.normal.x - slope * vertex.normal.y, vertex.normal.y, vertex.normal.z)));
}

fn paintSurface(surface: ApertureSurface, uv: vec2f, worldPosition: vec3f, parameters: vec4f) -> ApertureSurface {
  var result = surface;
  result.baseColor = aperturePalette(uv.x * 0.35 + parameters.z);
  result.roughness = 0.36;
  result.metallic = 0.05;
  return result;
}

fn cutoutSurface(uv: vec2f, parameters: vec4f) -> f32 {
  return select(1.0, 0.0, abs(uv.x - 0.5) < parameters.w);
}
