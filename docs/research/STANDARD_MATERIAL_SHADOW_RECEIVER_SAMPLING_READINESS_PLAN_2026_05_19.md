# StandardMaterial Shadow Receiver Sampling Readiness Plan — 2026-05-19

## Goal

Select the smallest next implementation slice after shadow command-buffer
finish/submission is available in the GLTF scene status.

Reference anchors inspected:

- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-shadow-binding-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-pipeline-key-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material.ts`
- `packages/webgpu/src/webgpu/shadow-pass-command-buffer-submission-report.ts`
- `examples/gltf-scene.js`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Candidate A — Receiver Binding Readiness Only

Add a receiver-side readiness report proving each StandardMaterial draw can see:

- the live shadow matrix buffer,
- the live shadow depth texture view,
- the live shadow sampler,
- the StandardMaterial shadow group 5 bind group,
- the shadow command-buffer submission status.

Pros:

- Small, diagnostic-first, and aligned with the existing incremental bridge.
- Keeps WGSL lighting changes out of the first receiver task.
- Gives the GLTF browser fixture a stable status surface before pixel proof.

Cons:

- Does not yet produce visible shadows.

## Candidate B — Minimal WGSL Shadow Factor

Thread group 5 into the StandardMaterial shader and apply a hard directional
shadow factor in the fragment path.

Pros:

- Moves directly toward visible receiver shadow pixels.
- Exercises real bind groups and shader sampling.

Cons:

- Higher risk: touches shader IO, pipeline layouts, binding order, status
  expectations, and browser pixels in one step.
- Needs careful handling of bias, projection, and comparison sampling to avoid
  unstable e2e results.

## Candidate C — Submit Shadow Pass Before Sampling

Enable queue submission for the finished shadow command buffer while keeping
receiver sampling deferred.

Pros:

- Narrows the remaining gap to shader sampling.
- Proves the command-buffer submission helper's submitted path in browser.

Cons:

- Submission alone is not user-visible and may add ordering concerns with the
  forward pass before the receiver shader is ready.

## Selection

Select Candidate A as `task-1874`: bind StandardMaterial receiver shadow
resources into a JSON-safe readiness report.

Acceptance criteria for the selected task:

- Add a typed receiver shadow binding readiness report in `packages/webgpu`.
- Report per-StandardMaterial receiver access to the live shadow matrix buffer,
  shadow depth view, shadow sampler, and group 5 bind group.
- Include command-buffer submission status as an input and report the submitted
  GLTF shadow command buffer.
- Expose the report in `examples/gltf-scene.js` and assert it in the GLTF
  Playwright fixture.
- Keep WGSL receiver shadow sampling and visible shadow pixel proof deferred.

## Follow-Up

After receiver binding readiness is stable, the next implementation should plan
and add the minimal WGSL shadow factor with a deterministic GLTF browser proof.
