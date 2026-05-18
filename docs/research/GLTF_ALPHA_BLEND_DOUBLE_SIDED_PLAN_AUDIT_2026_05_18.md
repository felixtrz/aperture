# glTF Alpha Blend Double-Sided Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1361` plan to add a browser regression for glTF
`alphaMode: "BLEND"` with `doubleSided: true`.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_TEXTURE_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and covers a
remaining glTF render-state branch without broadening architecture.

Boundary checks:

- The slice stays in source glTF material fixture data and browser verification.
- ECS remains authoritative; the example should continue to author entities,
  transforms, mesh/material handles, lights, and visibility through the app
  facade.
- WebGPU remains backend-owned; the test should inspect JSON-safe report fields
  and a screenshot/readback sample only.
- The Bevy-aligned material concept is preserved: material alpha mode and
  double-sided authoring drive queue selection and pipeline specialization from
  extracted render data.

Risk notes:

- This should not claim complete transparent sorting or two-sided lighting. It
  only needs to prove no-cull render-state mapping and visible backface output
  for a single scalar-color plane.

## Recommendation

Implement `task-1363` as planned. Keep the scope limited to
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts` unless the regression exposes a small
localized defect.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
