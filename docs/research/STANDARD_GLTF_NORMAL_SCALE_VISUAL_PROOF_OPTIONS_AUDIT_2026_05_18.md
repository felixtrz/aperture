# Standard glTF Normal Scale Visual Proof Options Audit - 2026-05-18

## Scope

Audit narrow options for proving `normalTexture.scale` changes rendered output
after browser mapping coverage landed.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Option A - Add a scalar control mesh inside the glTF fixture

Add a second mesh/material pair to the `normal-map-scale` scenario so the
readback compares a scalar-lit control sample against the reduced-scale normal
sample in the same frame.

Pros:

- Stays in the glTF-shaped example and keeps the proof close to the mapped
  `normalTexture.scale` source.
- Avoids cross-page lighting and cache differences.

Risks:

- The glTF texture fixture currently assumes one mesh/material status path, so
  the status shape and sample helpers would need careful, narrow extension.

## Option B - Reuse the Standard texture control layout pattern

Mirror `standard-texture-control` by adding side-by-side scalar and normal-scale
samples for the glTF fixture, keeping one status object but adding explicit
control/readback samples.

Pros:

- Reuses a proven browser pattern that already creates deterministic
  normal-map deltas.
- Keeps validation ergonomic: one scenario, one screenshot, two readback
  samples.

Risks:

- Requires a small fixture shape change, but it can remain local to the example
  and e2e test.

## Option C - Change only light rotation or normal texel values

Try to tune the existing single-plane scenario until full-scale and
reduced-scale readbacks diverge.

Pros:

- Smallest code diff if it works.

Risks:

- Already proved brittle during `task-1527`; several reasonable light/normal
  combinations still collapsed to identical ambient samples.
- It would be harder for the next agent to reason about than an explicit
  control sample.

## Recommendation

Select Option B. Add a deterministic scalar-vs-normal comparison inside the
glTF normal-scale browser scenario, modeled on the Standard texture control
example. Keep the implementation local to `examples/standard-gltf-texture.js`
and `test/e2e/standard-gltf-texture.spec.ts`; do not alter shader logic unless
the fixture proves a focused defect.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
