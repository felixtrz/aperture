# Minimal StandardMaterial Shadow Shader Sampling Plan — 2026-05-19

## Goal

Select the smallest shader-side slice after the GLTF scene has:

- a finished shadow command buffer with queue submission deferred,
- live shadow matrix buffer and depth texture/view resources,
- a comparison shadow sampler,
- a live StandardMaterial group 5 shadow bind group,
- JSON-safe receiver binding readiness.

## Reference Anchors

Local anchors inspected:

- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-receiver-binding-readiness.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`

Reference patterns inspected:

- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
- `references/three.js/src/renderers/webgl/WebGLProgram.js`

Common pattern:

- Render caster depth first.
- Bind receiver-side shadow matrix, depth texture, and comparison sampler.
- Project receiver world position into shadow space.
- Apply a visibility factor to direct lighting only.

## Candidate A — Hard Directional Shadow Factor

Add group 5 bindings to the base StandardMaterial WGSL path and apply a simple
single-tap comparison result to directional-light contribution.

Pros:

- Smallest visible shader slice.
- Uses the resources already proven by receiver binding readiness.
- Keeps IBL and PCF filtering out of the first shadow-sampling task.

Cons:

- Needs one StandardMaterial pipeline layout/binding update.
- Requires careful clip-space and UV bounds handling for stable browser proof.

## Candidate B — Metadata And Pipeline-Key Readiness First

Add shader metadata, pipeline-key, and layout readiness for a future shadowed
StandardMaterial variant, but keep WGSL unchanged.

Pros:

- Lowest runtime risk.
- Extends the existing diagnostic pattern.

Cons:

- Does not prove real receiver sampling.
- Adds another status-only step after the receiver binding report already
  established the resource boundary.

## Candidate C — PCF Or Bias-Focused Shadow Sampling

Implement multi-sample PCF and bias controls before first visible proof.

Pros:

- Closer to a production-quality shadow result.

Cons:

- Too broad for the first shader task.
- Mixes filtering, bias policy, shader binding, and visual proof in one slice.

## Selection

Select Candidate A as `task-1876`: implement a minimal hard directional shadow
factor for StandardMaterial receivers.

Acceptance criteria for the selected task:

- Add group 5 shadow bindings to the StandardMaterial shader path used by the
  GLTF scene.
- Project receiver world position through the directional shadow matrix and
  sample the shadow depth texture with the comparison sampler.
- Apply the resulting factor to directional light only; ambient and emissive
  terms remain unshadowed.
- Keep filtering to a single tap and keep bias minimal/data-derived.
- Update diagnostics so `shadow.receiverBinding` remains JSON-safe and the
  shader-sampling phase no longer claims to be deferred once the shader path is
  active.
- Add targeted shader metadata/pipeline tests and a GLTF browser assertion that
  confirms the receiver sampling path is active. Pixel-proof hardening can
  follow in `task-1877`.
