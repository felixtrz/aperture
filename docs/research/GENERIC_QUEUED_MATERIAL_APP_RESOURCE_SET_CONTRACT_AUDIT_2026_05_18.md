# Generic Queued Material App Resource Set Contract Audit - 2026-05-18

## Scope

Audit `task-1458`, which added the generic queued material app resource set
contract.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Findings

The new `QueuedMaterialAppResourceSet<TItem>` is a plain typed collection of
derived route items. It does not own ECS state, source assets, browser state, or
raw GPU resources.

`QueuedBuiltInAppResourceSet` now aliases the generic set shape with
`QueuedBuiltInAppResourceItem`, preserving the built-in item type and existing
collector behavior. The built-in collector still receives extracted snapshots,
prepared mesh/material stores, and route adapters; it does not become a source
of authoritative gameplay state.

The fake-family test now builds a generic set around a test-only app resource
item and feeds that set into the generic routed-resource summary. The assertion
continues to prove there is no family-specific diagnostics field such as
`customPreviewResourceSet`, and no GPU/browser handles leak into JSON.

No app-level non-built-in material rendering, route rename, GLB loading, IBL,
shadow, shader, or source material contract was added.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run typecheck:test`
- `pnpm exec prettier --check packages/webgpu/src/webgpu/queued-material-app-resource-item.ts packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts test/webgpu/queued-material-app-resource-item.test.ts`

## Recommendation

Proceed to tracker/backlog alignment. The next substantive choice should decide
whether to continue one more built-in route cleanup slice or return to
StandardMaterial/glTF fidelity.
