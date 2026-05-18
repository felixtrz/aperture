# Built-In Route Migration On Generic App Boundary Plan

Date: 2026-05-18

## Scope

Plan the smallest built-in route migration slice after the generic app route
item helper and audit.

The goal is compatibility coverage, not a real new material family.

## References Inspected

- `docs/research/GENERIC_APP_ROUTE_ITEM_HELPER_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`

## Current State

`collectQueuedBuiltInAppResourceSet()` now creates routed built-in items through
`createQueuedMaterialAppResourceItem()`. The built-in collector still owns the
app-specific work it should own for now:

- indexing source mesh/material assets from the registry and snapshot;
- writing the material queue from prepared mesh/material facade keys;
- translating generic prepare-route diagnostics into app route diagnostics;
- preserving the built-in resource-set shape consumed by app orchestration.

The public app report JSON remains stable because app diagnostics still expose
`routedResourceSet`, and frame resources still provide `unlit`, `matcap`, and
`standard` compatibility arrays.

## Smallest Implementation Slice

The next implementation should add compatibility tests rather than more
abstraction.

Recommended test coverage:

- Assert a collected built-in item includes the generic route item fields:
  `queueItem`, `prepareRoute`, `adapter`, `draw`, source mesh/material keys, and
  backend mesh/material keys.
- Assert the item's `prepareRoute` matches the queue item family, pipeline key,
  source version, frame, mesh resource key, and material resource key.
- Assert no family-specific diagnostics field is produced by the built-in route
  collector.
- Assert app diagnostics still expose the public `routedResourceSet` field and
  not a renamed or family-specific field.

This can be done in `test/webgpu/queued-built-in-app-resource-set.test.ts` and
`test/webgpu/app-diagnostics-summary.test.ts` without changing app runtime
behavior.

## Compatibility Rules

Keep stable:

- `collectQueuedBuiltInAppResourceSet()` as the built-in app entry point.
- `QueuedBuiltInAppResourceSet` as the compatibility return type.
- `unlit`, `matcap`, and `standard` frame-resource arrays.
- Public app diagnostics field `routedResourceSet`.

Avoid:

- Introducing a real non-built-in app route before registration rules are
  explicit.
- Adding `customPreview` arrays or diagnostics fields.
- Moving asset registry indexing into generic WebGPU helpers.
- Serializing raw route items or raw bucket maps into public app diagnostics.

## Follow-Up After Tests

After the compatibility tests land, audit whether the built-in wrapper still
looks transitional. If it does, the next planning step can define criteria for
real material-family app route migration.

## Outcome

The built-in route has already crossed the generic app route item seam. The next
safe step is to pin that behavior with tests before any broader route
registration work.
