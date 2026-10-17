// Shared by the standalone effect and the material-extension example.
fn aperturePalette(t: f32) -> vec3f {
  return vec3f(0.45, 0.5, 0.55) + vec3f(0.45, 0.4, 0.35) * cos(6.2831853 * (vec3f(t) + vec3f(0.0, 0.18, 0.35)));
}
