# App-Level Mixed Built-In Route Summary Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1341` plan selecting app-level mixed built-in route summary
coverage.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_MIXED_BUILT_IN_ROUTE_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and is the
right next step after the internal mixed built-in wrapper regression.

The plan is appropriately narrow because it:

- extends existing successful mixed built-in app tests instead of adding a new
  rendering path;
- asserts JSON-safe app diagnostics summary output, not raw backend resources;
- does not require source asset schema changes, ECS component changes, render
  extraction changes, shader changes, WebGPU upload changes, or draw submission
  changes;
- keeps app-level non-built-in material routing, binary GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

Boundary checks:

- ECS remains authoritative because the app test authors renderability through
  ECS components and typed assets.
- Rendering remains derived from snapshots and queued resources; the renderer
  does not query ECS.
- WebGPU resources remain backend-owned and must be omitted from JSON
  diagnostics.

## Recommendation

Implement `task-1343` as planned. Prefer extending an existing mixed built-in
app test with `diagnosticsSummary` assertions rather than creating a separate
fixture.

## Validation

Documentation-only audit; covered by final formatting and diff checks.
