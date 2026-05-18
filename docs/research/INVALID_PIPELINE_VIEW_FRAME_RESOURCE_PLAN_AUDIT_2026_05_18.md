# Invalid Pipeline View Frame Resource Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1371` plan to add a generic frame-resource-set regression for an
invalid pipeline view.

## References Inspected

- `docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and pins the
early generic frame-resource failure branch that precedes layout lookup and
resource creation.

Boundary checks:

- ECS authority and render extraction are untouched; the regression uses
  synthetic queued frame-resource items after extraction.
- WebGPU ownership is preserved because pipeline validity and bind group layout
  access are renderer-owned readiness conditions.
- The test should keep diagnostics JSON-safe and avoid exposing raw device,
  pipeline, buffer, texture, or bind group handles.
- The slice does not select app-level non-built-in material activation or add a
  new material family.

## Recommendation

Implement `task-1373` as planned in
`test/webgpu/queued-material-frame-resource-set.test.ts`. Only change
implementation code if the regression exposes a localized defect.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
