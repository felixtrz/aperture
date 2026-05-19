# Receiver Shadow Projection Proof Audit — 2026-05-19

## Scope

Audited the StandardMaterial receiver shadow path after `task-1882` refined the
first visible receiver proof from a global activation term into a projected
receiver sampling path.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/RECEIVER_SHADOW_SAMPLING_BOUNDARY_AUDIT_2026_05_19.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/directional-shadow-matrix-computation.ts`
- `test/e2e/gltf-scene.spec.ts`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/engine/src/scene/renderer/shadow-renderer.js`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Findings

Ownership remains aligned with the North Star:

- ECS state still contains only authoring/extraction inputs: transforms, lights,
  shadow request metadata, mesh handles, and material handles.
- Shadow depth textures, comparison samplers, matrix buffers, bind groups,
  render pipelines, command buffers, and queue submission stay in
  `@aperture-engine/webgpu`.
- The app facade derives `standard|shadowMap|...` routing from ready
  renderer-owned receiver resources; it does not make ECS or render snapshots
  own GPU handles.
- Public status and Playwright assertions remain JSON-safe: they inspect stable
  keys, route summaries, counts, command-buffer status, and pixels, not raw
  WebGPU objects.

The refined proof is a better projection boundary, but not final shadow quality:

- The shader now normalizes projected shadow depth before compare sampling,
  applies an explicit depth bias, and clamps comparison inputs to valid shadow
  texture coordinates.
- The visible proof still relies on a bounded projected receiver envelope in
  addition to the single-tap compare. This keeps the GLTF fixture deterministic
  while the shadow map and receiver region are still minimal.
- The envelope is renderer-local WGSL behavior, not hidden scene state, but it
  is not a strict caster-depth-only silhouette.
- The next quality step needs debug visibility into projected receiver/caster
  coverage so the proof can move from "projected receiver attenuation" to
  "depth compare identifies caster occlusion."

## Recommendation

Next narrow task: add receiver shadow projection debug/status proof. It should
surface JSON-safe information or test-only pixel evidence for projected UV/depth
coverage of the GLTF receiver and caster, then tighten the shader/test so the
visible difference comes from strict depth comparison instead of the projected
receiver envelope.

Acceptance criteria for the follow-up:

- Keep the combined group 3 light/shadow bind group and app route unchanged.
- Add JSON-safe diagnostics or a test-only visual/debug mode proving receiver
  and caster coverage in shadow projection space.
- Reduce or remove the projected envelope once the e2e fixture can assert a
  deterministic caster-depth compare difference.
- Preserve the `disable-shadow-receiver=1` versus enabled Playwright proof and
  no WebGPU validation warnings.
