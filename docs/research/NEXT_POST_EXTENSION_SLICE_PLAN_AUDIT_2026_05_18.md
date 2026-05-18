# Next Post-Extension Slice Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1247` plan that selected invalid glTF render-state browser
diagnostic coverage as the next post-extension fidelity or route slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_POST_EXTENSION_FIDELITY_OR_ROUTE_SLICE_PLAN_2026_05_18.md`
- `docs/research/UNSUPPORTED_REQUIRED_GLTF_EXTENSION_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run.

`task-1251` stays in the same source glTF material mapping and
browser/status-propagation lane as the unsupported required extension fixture.
It should add one expected-failure scenario that proves invalid render-state
source data is diagnosed and does not become a misleading rendered material.

The task preserves architecture boundaries:

- ECS remains authoritative because the fixture still authors entities through
  the app facade and component helpers.
- Render extraction remains the boundary because invalid material registration
  should result in the existing missing-material extraction diagnostic rather
  than renderer-owned source repair.
- WebGPU remains backend-owned because the selected task does not add GPU
  resources, shader behavior, pipeline creation logic, or upload behavior.
- JSON-safe status remains the inspection surface; raw WebGPU handles and raw
  backend resource keys are not needed.

The selected follow-up is also small enough to validate directly with
`node --check examples/standard-gltf-texture.js` and a focused Playwright test.

## Recommendation

Implement `task-1251` after completing the current route-summary audit queue.
No backlog adjustment is needed beyond the task already added by `task-1247`.

Keep deferred:

- app-level non-built-in material-family migration;
- shader behavior changes;
- WebGPU upload changes;
- IBL and shadows;
- binary GLB loading and GLB viewer behavior.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
