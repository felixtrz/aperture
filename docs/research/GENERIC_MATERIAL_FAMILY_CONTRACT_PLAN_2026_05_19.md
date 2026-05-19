# Generic Material-Family Contract Plan — 2026-05-19

## Context

Recent route work already proves that test-only non-built-in families can pass
through the generic adapter registry, prepare route, app resource item, route
report, and frame-resource summary contracts without public custom material
APIs. The remaining risk is that generic app resource items are still mostly
inspected structurally by tests, while agents need a stable JSON-safe contract
for the source/prepared key split.

## Reference Anchors

- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- Bevy material/render-asset pattern: source material extraction and prepared
  render assets remain separate, with render assets derived from source handles.

## Candidate Comparison

### A. Public custom material source APIs

Still deferred by Decision 0012. Too broad for the next slice.

### B. App-owned adapter facade registration

Still deferred by Decision 0011 and source validation work. Too much policy for
one implementation slice.

### C. JSON-safe generic app resource item serialization

Small and useful. It can expose only route identity plus source/prepared
mesh/material keys, omitting raw mesh/material objects, adapter instances, GPU
handles, and backend resources. This improves agent-readable diagnostics
without changing runtime routing or public custom material support.

## Selection

Update `task-1774` to implement a JSON-safe
`queuedMaterialAppResourceItemToJsonValue` helper and tests for a test-only
material family.

## Acceptance Reminder

The helper must be generic, family-agnostic, and backend-safe. It must not
serialize `mesh`, `material`, `adapter`, `draw`, raw GPU objects, app caches, or
source payload bytes.
