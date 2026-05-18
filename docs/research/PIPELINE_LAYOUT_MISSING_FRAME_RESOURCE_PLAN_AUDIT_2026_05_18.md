# Pipeline Layout Missing Frame Resource Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1366` plan to add a generic frame-resource-set regression for a
valid pipeline resource that lacks `getBindGroupLayout`.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and targets
an existing prepared-resource contract branch.

Boundary checks:

- ECS remains authoritative because the slice starts after render extraction and
  uses synthetic queued frame-resource items.
- Render extraction and source assets are unchanged; the test only verifies
  renderer-side resource preparation rejects an incomplete pipeline resource.
- WebGPU ownership is preserved because bind group layout access remains a
  renderer-owned pipeline capability, not source material or ECS state.
- The result should remain JSON-safe and should not expose raw pipeline, bind
  group, buffer, texture, or device handles.
- Reference engines keep pipeline and binding setup as renderer-owned concerns;
  Aperture's generic helper should therefore fail before creating frame
  resources when the pipeline cannot provide layouts.

Risk notes:

- This is not app-level non-built-in material activation.
- This does not add DebugNormalMaterial routing, GLB loading, IBL, shadows, or a
  new source asset contract.

## Recommendation

Implement `task-1368` as planned in
`test/webgpu/queued-material-frame-resource-set.test.ts`. Only change
implementation code if the regression exposes a localized bug.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
