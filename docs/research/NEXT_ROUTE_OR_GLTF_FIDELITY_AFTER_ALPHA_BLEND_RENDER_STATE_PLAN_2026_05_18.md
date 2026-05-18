# Next Route Or glTF Fidelity After Alpha Blend Render-State Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after glTF
`alphaMode: "BLEND"` browser render-state coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLTF_ALPHA_BLEND_RENDER_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_BLEND_RENDER_STATE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add another route/prepared-resource regression around transparent
StandardMaterial queues.

Why defer:

- The new alpha-blend fixture already pins the transparent material queue phase
  and the deterministic blend pipeline key through app diagnostics.
- A route-only regression would not prove additional material behavior unless it
  also exercises actual translucent texture pixels.
- The larger generic app-level non-built-in adapter route remains important, but
  it still needs a focused source/prepared-resource contract selection before
  app rendering should depend on it.

### StandardMaterial / glTF Fidelity Candidate

Add a browser regression for glTF alpha blending with a translucent base-color
texture sample.

Why now:

- The current `alpha-blend` fixture verifies render-state mapping and queue
  routing, but its base-color texture is fully opaque.
- The existing alpha-mask texture bytes already provide an opaque texel and a
  translucent texel that can be reused to verify alpha blend output without new
  assets or shader features.
- This is a narrow follow-up that proves the renderer consumes the blend render
  state in the WebGPU color target, rather than only publishing the intended
  pipeline key.

Expected scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- Implementation files only if the regression exposes a focused defect.

### Diagnostics / Tooling Candidate

Add tracker-only alignment or a helper-only JSON-safe assertion for the current
alpha-blend fixture.

Why defer:

- Tracker/backlog alignment has already been updated after alpha-blend
  render-state coverage.
- The existing alpha-blend fixture already asserts JSON-safe route and
  render-state summaries.
- Proving translucent pixel/readback behavior adds more confidence than another
  tooling-only pass.

## Selected Follow-Up

Select the StandardMaterial / glTF fidelity candidate.

### task-1358 Selection

Category: `render-bridge`

Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
browser regression exposes a focused defect.

Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_RENDER_STATE_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/render/src/materials/pipeline-key.ts`,
`packages/webgpu/src/webgpu/material-render-state.ts`,
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and Bevy material/render-state
patterns in `references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add an `alpha-blend-texture` glTF browser fixture that authors
  `alphaMode: "BLEND"` with a base-color texture containing a translucent texel.
- Assert the mapped render state remains `alphaMode: "blend"` with alpha
  blending and disabled depth writes.
- Assert the app emits the transparent material queue phase and the
  `standard|baseColorTexture|blend|back|less|alpha` pipeline key.
- Assert screenshot or readback sampling distinguishes the translucent blended
  pixel from both clear color and the fully opaque source texel.
- Run the targeted Playwright test for the new alpha-blend texture fixture plus
  `node --check examples/standard-gltf-texture.js`.

## Recommendation

Audit this plan next. If the audit confirms the scope, implement the translucent
alpha-blend texture browser regression as the next focused slice.
