# Receiver Shadow Strict Caster-Depth Blocker — 2026-05-19

## Scope

Audited whether the remaining projected receiver envelope in the
StandardMaterial shadow receiver shader can be removed immediately after adding
GLTF `shadow.projectionCoverage` records.

Reference anchors:

- `docs/research/RECEIVER_SHADOW_PROJECTION_PROOF_AUDIT_2026_05_19.md`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Findings

The current proof now has three validated pieces:

- The app routes `standard|shadowMap|...` through the browser-safe combined
  group 3 light/shadow bind group.
- The GLTF example submits the shadow command buffer before the forward frame
  that samples the shadow depth texture.
- `shadow.projectionCoverage` reports JSON-safe receiver and caster sample
  projection records with UV, depth, inside-projection flags, and projection
  distance.

The missing evidence is the actual submitted shadow depth value at those
projected sample coordinates. Without a JSON-safe depth readback or a debug
visualization that encodes sampled depth/compare results, the e2e test can prove
that receiver/caster samples project into the light frustum, but it cannot prove
that a specific receiver pixel is behind a caster in the submitted shadow map.

Because of that gap, fully removing the projected receiver envelope now would be
speculative. Earlier strict single-tap compare attempts produced no deterministic
receiver-pixel delta in the GLTF fixture. The current smaller envelope remains a
temporary proof stabilizer until the test can observe real shadow-depth
coverage.

## Recommendation

Next narrow task: add JSON-safe shadow-depth evidence for the GLTF projection
samples. The smallest useful slice is a test-only/debug readback or shader mode
that reports, per projected sample, the receiver compare depth, the sampled
shadow depth or compare result, and whether the sample is expected to be lit or
shadowed.

Acceptance criteria for the follow-up:

- Keep the combined group 3 route and submitted shadow command buffer unchanged.
- Add a JSON-safe `shadow.depthProbe` or equivalent debug proof keyed by the
  existing `shadow.projectionCoverage.records`.
- Use that proof to identify at least one receiver/caster pair whose strict
  compare should change visible pixels.
- Then remove or further reduce the projected envelope with Playwright coverage.
