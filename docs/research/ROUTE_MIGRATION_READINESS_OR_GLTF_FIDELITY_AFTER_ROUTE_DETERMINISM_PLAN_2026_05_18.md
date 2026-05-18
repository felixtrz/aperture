# Route Migration Readiness Or glTF Fidelity After Route Determinism Plan

Date: 2026-05-18

## Scope

Select the next narrow slice after deterministic queued material route summary
coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/ROUTE_SUMMARY_DIAGNOSTIC_CODE_SORTING_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`

## Candidates Compared

### App-level material route migration readiness audit

Audit whether the route-summary, prepared-resource, and diagnostic criteria are
now sufficient to start a narrow app-level non-built-in material route migration
slice.

Why this is preferred:

- Recent route-summary work now covers clean-after-failed reuse, stale-state
  reset, test-only non-built-in families, mixed-family aggregation, and
  deterministic diagnostic-code sorting.
- The missing decision is not another route-summary permutation; it is whether
  the app facade has enough readiness signals to safely route more material
  families without baking another family-specific path into the proof point.
- An audit keeps the next step bounded. It can identify a concrete migration
  slice or explicitly send the backlog back to StandardMaterial/glTF fidelity
  work without changing app routing prematurely.

### Narrow app-status route diagnostic

Expose one more queued route detail through browser app status, such as grouped
route summary totals or selected failure codes.

Why this is deferred:

- App status is public-facing behavior. It should follow the readiness audit so
  the exposed status shape serves the migration path instead of another isolated
  diagnostic fixture.
- The current unit summary surface is already deterministic enough to support a
  readiness checklist.

### StandardMaterial/glTF fidelity diagnostic

Return to a narrow glTF material diagnostic, for example an additional sampler,
color-space, texture dependency, or render-state edge case.

Why this is deferred for this slice:

- Recent browser fixtures already cover unsupported required material
  extensions, invalid render-state values, unresolved texture bindings, invalid
  texture-info values, invalid source no-work summaries, delayed dependencies,
  missing UV1, texture transform warnings, and color-space/format mismatch.
- More glTF fidelity work is still important, but the route architecture is now
  the sharper blocker for avoiding a permanent StandardMaterial-only app route.

## Selected Follow-Up

Select `task-1284 — Audit material route migration readiness after route summary
determinism`.

Category: `audit-refactor`

Package/write-scope: `docs/research`, `agent/BACKLOG.md` only unless a tiny
corrective test is required.

Reference anchor:

- this plan;
- `docs/ARCHITECTURE.md`;
- `docs/MEDIUM_LONG_TERM_GOALS.md`;
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`;
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`;
- recent route summary audits.

Acceptance criteria:

- List the route-summary criteria now covered and the route/prepared-resource
  criteria still missing before app-level non-built-in material routing.
- Recommend either a concrete app-level migration slice or a return to
  StandardMaterial/glTF fidelity work.
- Do not implement app-level non-built-in rendering in the audit.

## Deferred

- App-level non-built-in material rendering.
- IBL and shadows.
- Binary GLB loading and GLB viewer behavior.
- Broad material-family rewrites.
- Public material-family API changes.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
