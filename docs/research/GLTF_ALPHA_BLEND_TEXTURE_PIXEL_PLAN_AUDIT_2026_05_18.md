# glTF Alpha Blend Texture Pixel Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1356` plan to add a browser regression for translucent glTF
alpha-blend texture pixels.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_RENDER_STATE_PLAN_2026_05_18.md`
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

Pass. The selected follow-up is concrete enough for one focused run and builds
directly on the already-passing alpha-blend render-state fixture.

Boundary checks:

- The slice stays in source glTF material fixture data and browser verification;
  it does not require new ECS components, source asset contracts, shaders, or
  backend APIs unless the existing blend path is defective.
- ECS remains authoritative because the example continues to author mesh and
  material handles on entities and observes derived render reports.
- The WebGPU backend remains the owner of blend state and GPU resources; the
  test should inspect JSON-safe report fields and pixels/readback only.
- The Bevy-aligned material concept is preserved: source material alpha mode and
  texture data drive queue selection and pipeline specialization through
  extracted render data.

Risk notes:

- Exact blended pixel values can vary slightly across browsers and formats, so
  the test should compare distances against clear and opaque source colors
  rather than require a single exact RGBA tuple.
- The fixture should not claim complete transparency sorting; it should prove
  one translucent blended texture sample on the existing single-plane scene.

## Recommendation

Implement `task-1358` as planned. Keep the scope limited to
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts` unless the regression exposes a small
localized defect in material or WebGPU render-state mapping.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
