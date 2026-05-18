# Three-Family App Route Summary Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1346` plan selecting three-family app route summary coverage.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_APP_LEVEL_MIXED_ROUTE_SUMMARY_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and extends
an existing successful app fixture rather than adding a new render path.

The plan is appropriately narrow because it:

- stays on the app diagnostics summary surface;
- covers all built-in material families in one already-rendering fixture;
- verifies StandardMaterial direct-light readiness remains present in mixed
  family summaries;
- does not require source asset schema changes, ECS component changes, render
  extraction changes, shader changes, WebGPU upload changes, draw submission
  changes, binary GLB loading, IBL, shadows, or app-level non-built-in material
  rendering.

Boundary checks:

- ECS remains authoritative because the app test authors renderability through
  ECS components and typed assets.
- Rendering remains derived from snapshots and prepared resources; the renderer
  does not query ECS.
- WebGPU resources remain backend-owned and must be omitted from JSON
  diagnostics.

## Recommendation

Implement `task-1348` as planned by extending the existing three-family app
route test with diagnostics summary assertions.

## Validation

Documentation-only audit; covered by final formatting and diff checks.
