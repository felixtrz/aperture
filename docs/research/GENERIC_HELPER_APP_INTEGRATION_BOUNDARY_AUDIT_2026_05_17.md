# Generic Helper App Integration Boundary Audit

Date: 2026-05-17

Task: `task-1018`

## Scope

Audited the app integration slice from `task-1017`:

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`

Reference context:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_BUILT_IN_FRAME_RESOURCE_HELPER_APP_INTEGRATION_PLAN_2026_05_17.md`

## Findings

### Source Ownership

Pass. The app still receives extracted snapshots and prepared facade resource
keys from the existing route. The new append-only helper only appends already
created WebGPU frame resources into family buckets. It does not read or mutate
ECS state, source material assets, source mesh assets, or render-world objects.

### Resource Creation Semantics

Pass. `prepareQueuedBuiltInFrameResources()` still calls the existing
family-specific `adapter.createFrameResources()` exactly once per queued item.
The new helper handles only the successful append step, avoiding accidental
double creation of buffers or bind groups.

### Report Shape And Allocation Policy

Pass. The integration does not add successful frame-resource route shells to
default app reports. Existing failure diagnostics and successful-frame output
remain covered by targeted app tests.

### Facade / Backend Separation

Pass. Prepared facade keys, backend resource buckets, and backend cache
summaries remain separate. The helper returns a compact status shell for tests
and future routing work, but app integration does not expose raw resources.

## Follow-Up

No corrective changes are required.

Recommended next task: `task-1019 — Document prepared lifetime alignment summary
boundaries`.
