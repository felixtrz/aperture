# Frame-Resource Option Helper Boundary Audit

Date: 2026-05-17

Task: `task-1029`

## Scope

Audited the option-helper extraction from `task-1028`:

- `packages/webgpu/src/webgpu/app.ts`
- `docs/research/NEXT_GENERIC_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_PLAN_2026_05_17.md`

Reference context:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- Targeted WebGPU app route tests.

## Findings

### Resource Creation Order

Pass. The app still prepares texture/sampler dependencies first and calls
`adapter.createFrameResources()` once per queued item. The helper only packages
the existing frame-resource options.

### App Report Shape

Pass. No successful-frame route shell or new report field was added. Existing
targeted app route tests pass.

### Ownership Boundary

Pass. The helper does not read or mutate ECS/source material state. It passes
existing app/cache/snapshot/item/dependency/layout inputs to the existing
WebGPU-owned resource creation callback.

## Follow-Up

No corrective changes are required.

Recommended next task: `task-1030 — Plan texture/sampler dependency preparation
helper extraction`.
