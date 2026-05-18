# Next Route Or Standard Follow-Up After Generic App Resource Set Plan - 2026-05-18

## Context

`task-1458` added `QueuedMaterialAppResourceSet<TItem>` and made
`QueuedBuiltInAppResourceSet` extend it. The next slice should decide whether to
continue the route cleanup or return to StandardMaterial/glTF browser fidelity.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_QUEUED_MATERIAL_APP_RESOURCE_SET_CONTRACT_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Candidates

### Material Route Architecture

Make `QueuedBuiltInAppResourceItem` extend
`QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>`
instead of duplicating the same route item fields. This follows directly from
the generic set contract and keeps the built-in collector as a compatibility
wrapper over generic route item contracts.

### StandardMaterial / glTF Fidelity

Add another combined browser fixture, such as base-color plus alpha-mask plus
emissive. This remains valuable, but the route item duplication is a smaller
cleanup that should be done before adding more route-dependent browser cases.

### Diagnostics / Tooling

Add an audit-only task around docs and public tracker wording. The tracker is
already current after `task-1460`, so a code cleanup is higher value.

## Selected Follow-Up

Select the material route architecture slice: make the built-in app resource
item extend the generic app resource item contract.

Why:

- It is a small type-boundary cleanup.
- It reduces duplicated route item field definitions.
- It preserves built-in app behavior while making future route migration easier
  to reason about.
- It does not add non-built-in rendering or change runtime shader behavior.

## Backlog Entry

```md
### task-1462 — Make built-in app resource item extend generic route item

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `QueuedBuiltInAppResourceItem` extends or aliases
  `QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>`.
- Existing built-in resource set collection behavior and diagnostics JSON shape
  remain unchanged.
- Tests cover the generic item contract and the built-in collector path.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.
```
