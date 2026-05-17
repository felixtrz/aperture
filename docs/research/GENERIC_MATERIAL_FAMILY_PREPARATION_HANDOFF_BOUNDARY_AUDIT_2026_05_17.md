# Generic Material-Family Preparation Handoff Boundary Audit

Date: 2026-05-17

Task: `task-1012`

## Scope

Audited the generic built-in frame-resource adapter helper added in
`task-1011`:

- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARATION_HANDOFF_IMPLEMENTATION_PLAN_2026_05_17.md`

Reference context:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`

## Findings

### Source Ownership

Pass. `createQueuedBuiltInFrameResourceViaAdapter()` receives an already
selected app resource adapter and frame options. It does not read or mutate ECS
state, source material assets, source mesh assets, render snapshots, or render
world objects.

### Backend Cache Separation

Pass. The helper delegates concrete resource creation to the existing
family-specific adapter callback. It appends valid returned resources into the
existing per-family frame buckets and returns only a compact status shell. It
does not merge prepared facade resource keys with backend cache keys, resource
summary reports, or retained cache state.

### Report Shape And Handle Safety

Pass. The returned report includes `valid`, `status`, `family`, and diagnostics
only. It does not include raw frame resources. Tests verify successful reports
omit a `resources` field and do not contain GPU handles.

### Successful-Frame Policy

Pass. This is a helper/test slice only. It does not wire successful route shells
into default app reports and therefore preserves the existing successful-frame
report shape and allocation policy.

## Follow-Up

No corrective changes are required.

Recommended next task: `task-1013 — Plan prepared resource lifetime summary
cleanup`.
