# StandardMaterial Route Prepared Resource Cleanup Plan

Date: 2026-05-18

## Scope

Select one cleanup target after completing `TEXCOORD_0` transform support for
the currently rendered StandardMaterial texture slots.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_EMISSIVE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`

## Selected Cleanup Target

Add a focused regression around StandardMaterial app resource reuse and
diagnostics after the expanded transform uniform layout.

The recent transform slices increased the StandardMaterial uniform payload to
208 bytes. The app resource reuse path already keys reuse on material source
version and writes updated buffer data, but there is no focused regression that
connects the larger transform-capable uniform with app-level reuse and generic
diagnostics.

## Implementation Scope For `task-1216`

Add targeted tests only unless a bug is found:

- Verify StandardMaterial app rendering with a transformed texture still reports
  generic `routedResourceSet` diagnostics and direct-light readiness without raw
  GPU handles.
- Verify the second frame reuses the StandardMaterial material buffer, light
  buffers, mesh buffers, and bind groups through the existing app cache path.
- Verify the packed StandardMaterial uniform byte length is the documented
  208-byte size.

Likely write scope:

- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`

## Non-Goals

Do not add:

- new route types;
- new app diagnostics fields;
- transformed `TEXCOORD_1`;
- IBL or shadows;
- binary GLB viewer work;
- a new material family.

## Follow-Up

If the regression passes without code changes, audit it with `task-1217` and
then choose between transformed UV1 planning and prepared-resource lifetime
cleanup.
