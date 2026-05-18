# App-Level Mixed Built-In Route Summary Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1343` app-level mixed built-in route summary regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_MIXED_BUILT_IN_ROUTE_PLAN_2026_05_18.md`
- `docs/research/APP_LEVEL_MIXED_BUILT_IN_ROUTE_SUMMARY_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. The regression satisfies the selected acceptance criteria and stays on the
app diagnostics summary surface.

What is now pinned:

- a successful mixed unlit/matcap app frame has no material queue route report
  and no frame-resource route diagnostic;
- `diagnosticsSummary.materialQueue` reports deterministic phase, family, and
  phase/family counts for both built-in families;
- `diagnosticsSummary.routedResourceSet` reports deterministic family,
  pipeline, and family/pipeline counts for both built-in families;
- serialized diagnostics summary output omits raw GPU handles and source asset
  payload labels on the successful path.

Boundary checks:

- No source asset schemas, ECS components, render extraction contracts, shaders,
  WebGPU upload code, draw submission behavior, or public API shape changed.
- ECS remains authoritative; the test authors renderability through entities,
  typed assets, and render authoring components.
- WebGPU resources remain backend-owned and are only represented through
  JSON-safe summary fields.

## Recommendation

Run tracker/backlog alignment next. The next planning slice can compare a
StandardMaterial/glTF fidelity diagnostic against the next route-spine gap now
that app-level mixed built-in summary output is pinned.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "renders mixed unlit and matcap app resource sets"`
