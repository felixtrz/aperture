# Generic App Route Report Routed Item Serialization Audit - 2026-05-18

## Scope

Audit `task-1474`, which generalized app route report routed-item serialization
over `QueuedMaterialAppResourceItem`.

Reference anchors inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_TEXTURE_HELPER_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Findings

The new `queuedMaterialAppResourceItemToRouteRoutedItem()` helper serializes
only the JSON-safe report metadata already present on the generic queue item:

- `renderId`
- `drawIndex`
- `materialFamily`
- `renderPhase`

The built-in app resource set failure report now uses this generic helper
instead of a local built-in-specific converter. Existing route report shape is
preserved because the helper emits the same fields that the previous local
converter emitted.

The added test uses a test-only non-built-in material family and includes a
fake `rawGpuHandle` field on the source material. The routed report metadata
does not include the source material, adapter object, mesh asset, app object, or
GPU-shaped fields.

The change does not implement app-level custom material rendering. It only
removes a built-in-specific diagnostic serialization step from the route
contract path.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The public tracker should mention this as
another generic route-contract cleanup, but no render-pipeline behavior or
feature percentage needs to change.
