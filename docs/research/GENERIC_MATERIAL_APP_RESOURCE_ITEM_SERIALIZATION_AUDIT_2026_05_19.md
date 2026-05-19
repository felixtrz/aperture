# Generic Material App Resource Item Serialization Audit — 2026-05-19

## Result

`task-1774` added a JSON-safe
`queuedMaterialAppResourceItemToJsonValue` helper. It serializes route identity
plus source/prepared mesh and material keys for any material family.

## Checks

- Output is family-agnostic and does not special-case built-in material
  families.
- Output omits raw `mesh`, `material`, `adapter`, `draw`, GPU objects, app
  caches, and source payload bytes.
- The test uses a test-only material family and verifies raw source fields do
  not leak into JSON.
- No public custom material source APIs, app-owned adapter facades, IBL,
  shadows, binary GLB loading, or WebGL fallback were added.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts`

## Recommendation

Proceed with tracker/backlog alignment after this generic contract slice, then
choose between emissive transformed texture status hardening and another small
generic material-family contract follow-up.
