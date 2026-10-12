// Non-executable base-material fragment sketch; final actual call tails must
// be preserved after all source composition. Eligibility is narrow (plan.md).
let lightDir = directionalLightDirection(lightIndex);
let candidateNoL = max(dot(normal, lightDir), 0.0);
var candidateSampleShadow = !(candidateNoL <= 0.0);
if (!candidateSampleShadow) {
  // Preserve exported-shader raw-buffer NaN strength behavior as well as the
  // finite packing contract; a discarded 0*NaN cannot be replaced by zero.
  let candidateStrength = directionalShadowStrengthValue();
  candidateSampleShadow = candidateStrength != candidateStrength;
}
var shadowFactor = 1.0;
if (candidateSampleShadow) {
  shadowFactor = sampleDirectionalShadowFactor(input.worldPosition, normal);
}
// Existing evaluateDirectLight call, its authoritative normal, and all actual
// lobe/context arguments remain intact; substitute lightDir for its identical
// directionalLightDirection(lightIndex) argument, multiply by shadowFactor.
