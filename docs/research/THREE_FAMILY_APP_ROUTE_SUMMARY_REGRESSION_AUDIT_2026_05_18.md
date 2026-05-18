# Three-Family App Route Summary Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1348` three-family app route summary regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_APP_LEVEL_MIXED_ROUTE_SUMMARY_PLAN_2026_05_18.md`
- `docs/research/THREE_FAMILY_APP_ROUTE_SUMMARY_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. The regression satisfies the selected acceptance criteria and stays on the
app diagnostics summary surface.

What is now pinned:

- a successful unlit/standard/matcap app frame has no material queue route
  report and no frame-resource route diagnostic;
- `diagnosticsSummary.materialQueue` reports deterministic opaque phase,
  family, and phase/family counts for all three built-in families;
- `diagnosticsSummary.routedResourceSet` reports deterministic family,
  pipeline, and family/pipeline counts for all three built-in families;
- the mixed StandardMaterial route still emits a ready direct-light summary;
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

Run tracker/backlog alignment next. After this, a future planning slice can
reasonably return to StandardMaterial/glTF fidelity diagnostics because the
successful built-in route summary path is pinned for two-family and three-family
cases.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "reuses unlit, standard, and matcap app resource cache slots"`
