// The single-map directional path is orthographic. Keep this helper separate
// from the existing cascaded and perspective-spot algorithms: normalized depth
// ratios are not light-distance ratios for an orthographic projection.
export const STANDARD_SINGLE_MAP_DIRECTIONAL_PCSS_WGSL = `
// A fixed, centered disk is stable across frames and does not introduce a
// world/screen-position noise pattern. Search and filter have bounded work.
const DIRECTIONAL_PCSS_DISK: array<vec2f, 32> = array<vec2f, 32>(
  vec2f(0.12500000, 0.00000000),
  vec2f(-0.15964505, 0.14624794),
  vec2f(0.02443623, -0.27843827),
  vec2f(0.20122224, 0.26245878),
  vec2f(-0.36926756, -0.06531823),
  vec2f(0.34980247, -0.22251570),
  vec2f(-0.11700208, 0.43524190),
  vec2f(-0.22313565, -0.42963412),
  vec2f(0.48411512, 0.17679806),
  vec2f(-0.50364111, 0.20789573),
  vec2f(0.24278829, -0.51882448),
  vec2f(0.17941437, 0.57200130),
  vec2f(-0.54075701, -0.31337974),
  vec2f(0.63436952, -0.13946436),
  vec2f(-0.38714585, 0.55067513),
  vec2f(-0.08943965, -0.69019964),
  vec2f(0.54907176, 0.46275826),
  vec2f(-0.73887847, 0.03055494),
  vec2f(0.53895513, -0.53633233),
  vec2f(-0.03605819, 0.77979152),
  vec2f(-0.51281753, -0.61452679),
  vec2f(0.81235959, 0.10930183),
  vec2f(-0.68831064, 0.47890862),
  vec2f(0.18808606, -0.83606138),
  vec2f(0.43503327, 0.75919105),
  vec2f(-0.85044841, -0.27131624),
  vec2f(0.82610240, -0.38168026),
  vec2f(-0.35788820, 0.85515556),
  vec2f(-0.31940733, -0.88803376),
  vec2f(0.84990864, 0.44668816),
  vec2f(-0.94403465, 0.24884450),
  vec2f(0.53659581, -0.83452977),
);

fn sampleDirectionalPcssBilinear(shadowUv: vec2f, receiverDepth: f32, shadowMapSize: vec2f) -> f32 {
  // The shared comparison sampler deliberately remains nearest. Reconstruct
  // bilinear PCF here only, without changing hard or weighted-PCF semantics.
  let uv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let weights = fract(uv * shadowMapSize - vec2f(0.5));
  let comparisons = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth);
  return mix(
    mix(comparisons.w, comparisons.z, weights.x),
    mix(comparisons.x, comparisons.y, weights.x),
    weights.y,
  );
}

fn sampleDirectionalShadowPcss(shadowUv: vec2f, receiverDepth: f32, shadowMatrix: mat4x4f, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(shadowDimensions);
  let maxCoord = vec2i(shadowDimensions) - vec2i(1);
  // For P * rigidView, row-z length is 1/(far-near), while half
  // row-x length is 1/orthographicSpan. Translation (including light distance
  // and the near-plane origin) drops out. Their ratio converts a clip-depth
  // difference into separation as a fraction of the shadow-camera footprint.
  let depthScale = length(vec3f(shadowMatrix[0].z, shadowMatrix[1].z, shadowMatrix[2].z));
  let footprintScale = 0.5 * length(vec3f(shadowMatrix[0].x, shadowMatrix[1].x, shadowMatrix[2].x));
  if (!(depthScale > 0.000001 && depthScale < 1000000.0) ||
      !(footprintScale > 0.000001 && footprintScale < 1000000.0)) {
    return sampleDirectionalShadowPcf3x3(shadowUv, receiverDepth, 0.0);
  }
  // Radius is an artistic maximum in shadow texels, not an angular emitter
  // size. Keep the previous non-hard minimum of one and cap work/extent at 16.
  let maxRadius = clamp(filterRadiusTexels, 1.0, 16.0);
  var blockerSum = 0.0;
  var blockerCount = 0.0;
  // Include the center, so a small blocker under the receiver is never missed
  // merely because all disk taps lie away from the contact point.
  for (var sampleIndex = 0u; sampleIndex <= 32u; sampleIndex = sampleIndex + 1u) {
    var offset = vec2f(0.0);
    if (sampleIndex < 32u) {
      offset = DIRECTIONAL_PCSS_DISK[sampleIndex] * maxRadius;
    }
    let coord = clamp(vec2i(shadowUv * shadowMapSize + offset), vec2i(0), maxCoord);
    let occluderDepth = textureLoad(directionalShadowMap, coord, 0);
    if (occluderDepth < receiverDepth) {
      blockerSum = blockerSum + occluderDepth;
      blockerCount = blockerCount + 1.0;
    }
  }
  if (blockerCount == 0.0) {
    return 1.0;
  }
  let averageBlockerDepth = blockerSum / blockerCount;
  // The artistic response reaches the authored maximum at separation/span
  // = 1/12. Unlike receiver/blocker depth division, this is invariant to
  // equivalent near/far and light-distance changes in the orthographic camera.
  let separation = max(receiverDepth - averageBlockerDepth, 0.0) * footprintScale / depthScale;
  let variableRadius = maxRadius * clamp(separation * 12.0, 0.0, 1.0);
  var visibility = 0.0;
  for (var sampleIndex = 0u; sampleIndex < 32u; sampleIndex = sampleIndex + 1u) {
    let sampleUv = shadowUv + DIRECTIONAL_PCSS_DISK[sampleIndex] * variableRadius / shadowMapSize;
    visibility = visibility + sampleDirectionalPcssBilinear(sampleUv, receiverDepth, shadowMapSize);
  }
  return visibility * (1.0 / 32.0);
}
`;
