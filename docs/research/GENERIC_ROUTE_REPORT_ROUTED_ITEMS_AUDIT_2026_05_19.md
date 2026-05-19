# Generic Route Report Routed Items Audit — 2026-05-19

## Result

`task-1780` extends generic app route report diagnostics with a JSON-safe
`routedItems` list. Each entry is produced by
`queuedMaterialAppResourceItemToJsonValue` and carries route identity plus
source/prepared mesh and material keys.

## Checks

- Existing route report summary fields and diagnostic counts are preserved.
- The routed item details are family-agnostic and tested with a test-only
  material family.
- Diagnostic JSON omits raw mesh/material assets, adapter instances, draw
  packets, GPU handles, app caches, and source payload bytes.
- No public custom material source APIs, app-owned adapter facades, IBL,
  shadows, binary GLB loading, or WebGL fallback were added.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`

## Recommendation

Align the public tracker/backlog, then decide whether to continue generic route
contract hardening or return to StandardMaterial/glTF fidelity work.
