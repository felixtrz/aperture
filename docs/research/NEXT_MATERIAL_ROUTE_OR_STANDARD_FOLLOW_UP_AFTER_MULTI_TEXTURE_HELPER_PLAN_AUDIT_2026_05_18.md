# Next Material Route Or Standard Follow-Up After Multi Texture Helper Plan Audit - 2026-05-18

## Scope

Audit the `task-1452` selected follow-up plan:
`task-1454 — Route app diagnostics through generic material summary`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`
- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`

## Findings

The selected follow-up is concrete enough for one focused run. It has a narrow
write scope, a single diagnostics-summary call site, and clear regression
expectations.

The task preserves the architecture invariants:

- ECS remains authoritative because the change is downstream of extraction and
  prepared app resource routing.
- Render extraction remains the boundary; no renderer code will query or mutate
  ECS state.
- WebGPU ownership remains in `@aperture-engine/webgpu`; the summary helper
  reports derived route/resource state and does not expose raw GPU handles.
- JSON-safe diagnostics remain the public surface through `routedResourceSet`.

The task also respects Decision 0010. It makes family summaries more generic
without opening source material kinds or adding product-facing custom material
rendering.

## Risk Notes

- Keep `queued-built-in-resource-set-summary.ts` as a compatibility wrapper if
  exported docs/tests still rely on it. Removing it would make the slice larger
  than necessary.
- Preserve the existing `routedResourceSet` JSON shape in app diagnostics.
- Do not add a new diagnostics field for any material family.

## Recommendation

Implement `task-1454` next. Targeted validation should include the app
diagnostics tests and the queued built-in/generic summary tests touched by the
cleanup.
