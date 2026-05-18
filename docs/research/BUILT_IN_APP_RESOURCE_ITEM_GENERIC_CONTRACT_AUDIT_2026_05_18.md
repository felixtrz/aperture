# Built-In App Resource Item Generic Contract Audit - 2026-05-18

## Scope

Audit `task-1462`, which made the built-in app resource item a specialization
of the generic queued material app resource item.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

`QueuedBuiltInAppResourceItem` is now a type specialization of
`QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>`.
That removes a duplicated field list while preserving the built-in material
asset and adapter types.

The built-in collector still produces the same derived route items from
extracted snapshots, prepared mesh/material stores, source asset registry
entries, and route adapters. It does not query ECS directly, own source
material data, or create GPU resources.

The public diagnostics shape is unchanged. No route family was renamed, no
family-specific diagnostics field was added, and the app still supports only
registered built-in app resource adapters for rendering.

## Validation

- `pnpm exec prettier --check packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. After that, consider returning to
StandardMaterial/glTF fidelity; the immediate generic item/set duplication has
been cleaned up.
