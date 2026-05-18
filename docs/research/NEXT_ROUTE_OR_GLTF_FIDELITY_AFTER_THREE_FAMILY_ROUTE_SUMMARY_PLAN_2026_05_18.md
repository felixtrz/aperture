# Next Route Or glTF Fidelity After Three-Family Route Summary Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after app-level three-family
unlit/standard/matcap route summary coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/THREE_FAMILY_APP_ROUTE_SUMMARY_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_THREE_FAMILY_ROUTE_SUMMARY_AUDIT_2026_05_18.md`
- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_APP_LEVEL_MIXED_ROUTE_SUMMARY_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add another app-level route summary regression around a route edge that is not
currently pinned, such as a successful StandardMaterial-only frame with a
non-default render-state pipeline key.

Why defer:

- The recent two-family and three-family route summary tests already pin the
  successful built-in family grouping path.
- Adding another route-summary-only test would mostly repeat the same app
  diagnostics surface unless it first introduces a meaningful glTF/material
  fidelity case.
- App-level non-built-in material routing remains the larger architecture
  direction, but it needs a source asset and prepared-resource adapter contract
  selection rather than another narrow summary assertion.

### StandardMaterial / glTF Fidelity Candidate

Add a browser regression for glTF `alphaMode: "BLEND"` render-state mapping.

Why now:

- Existing browser coverage verifies opaque texture paths and `MASK` alpha
  behavior, including double-sided mask and texture mask cases.
- `packages/render/src/materials/gltf-material.ts` already maps `BLEND` to a
  StandardMaterial render state with disabled depth writes and alpha blending,
  and unit coverage exists for the mapper, but the app-facing glTF fixture does
  not yet prove the browser path publishes that render state and pipeline key.
- This is a narrow fidelity slice that advances the glTF metallic-roughness
  track without adding IBL, shadows, binary GLB loading, or a broader material
  architecture change.
- It also strengthens route confidence because the selected fixture should flow
  through the existing StandardMaterial route with a distinct render-state
  pipeline key.

Expected scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- Implementation files only if the regression exposes a focused defect.

### Diagnostics / Tooling Candidate

Add tracker-only alignment or another JSON-safe diagnostic helper audit.

Why defer:

- The public tracker was just aligned after the three-family route summary
  regression.
- A tooling-only update would add less product confidence than pinning an
  untested glTF render-state branch through the browser fixture.
- Tracker/backlog alignment should follow the implementation and audit rather
  than precede another concrete slice.

## Selected Follow-Up

Select the StandardMaterial / glTF fidelity candidate.

### task-1353 Selection

Category: `render-bridge`

Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
browser regression exposes a focused defect.

Reference anchor:
`packages/render/src/materials/gltf-material.ts`,
`packages/render/src/materials/pipeline-key.ts`,
`packages/webgpu/src/webgpu/material-render-state.ts`,
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and Bevy material/render-state
patterns in `references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add an `alpha-blend` glTF browser fixture that authors a StandardMaterial
  source with `alphaMode: "BLEND"`.
- Assert the published status records the source render state and mapped render
  state with `alphaMode: "blend"`, `depth.write: false`, `cullMode: "back"`,
  and alpha blending.
- Assert the app creates the expected StandardMaterial resources and emits a
  deterministic pipeline key for the blend render state.
- Assert the successful path remains JSON-safe and has no route failure
  diagnostics.
- Run the targeted Playwright test for the new alpha-blend fixture plus
  `node --check examples/standard-gltf-texture.js`.

## Recommendation

Audit this plan next. If the audit confirms the scope, implement the alpha
blend glTF browser render-state regression as the next focused slice.
