# Next Route Or glTF Fidelity After Alpha Blend Texture Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after translucent glTF
alpha-blend texture pixel coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLTF_ALPHA_BLEND_TEXTURE_PIXEL_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_BLEND_TEXTURE_PIXEL_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Start real app-level non-built-in material adapter rendering.

Why defer:

- This remains the main route architecture gap, but it needs a source asset and
  prepared-resource adapter contract selection before implementation.
- The current run has already accumulated a coherent alpha-blend fidelity group;
  starting a broader adapter contract now would mix a larger architecture slice
  into the same diff.

### StandardMaterial / glTF Fidelity Candidate

Add a browser regression for `alphaMode: "BLEND"` plus `doubleSided: true`.

Why now:

- The current alpha-blend fixtures prove blend render-state mapping and
  translucent pixels for the default back-face culling case.
- Existing alpha-mask backface coverage proves `doubleSided: true` maps to no
  culling for `MASK`, but not for transparent `BLEND`.
- A narrow scalar-color backface fixture can pin that glTF double-sided
  transparent materials map to `cullMode: "none"` and remain on the transparent
  queue without introducing broader transparency sorting.

Expected scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- Implementation files only if the regression exposes a focused defect.

### Diagnostics / Tooling Candidate

Add a tracker-only or report-shape audit for alpha blending.

Why defer:

- Tracker/backlog alignment has already been updated after alpha-blend texture
  coverage.
- A browser fixture that pins the remaining double-sided branch adds more
  confidence than another tooling-only update.

## Selected Follow-Up

Select the StandardMaterial / glTF fidelity candidate.

### task-1363 Selection

Category: `render-bridge`

Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
browser regression exposes a focused defect.

Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_TEXTURE_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/render/src/materials/pipeline-key.ts`,
`packages/webgpu/src/webgpu/material-render-state.ts`,
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and Bevy material/render-state
patterns in `references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add an `alpha-blend-double-sided` glTF browser fixture that authors
  `alphaMode: "BLEND"` and `doubleSided: true`.
- Assert the mapped render state uses `alphaMode: "blend"`, `cullMode: "none"`,
  disabled depth writes, and alpha blending.
- Assert the app emits the transparent material queue phase and the
  `standard|blend|none|less|alpha` pipeline key for the scalar-color material.
- Assert a rotated backface sample renders instead of clear.
- Run the targeted Playwright test plus `node --check
examples/standard-gltf-texture.js`.

## Recommendation

Audit this plan next. If the audit confirms the scope, implement the
alpha-blend double-sided browser regression as the next focused slice.
