# Next Route Or Standard Follow-Up After Generic Summary Routing Plan - 2026-05-18

## Context

`task-1454` made app diagnostics use the generic material frame-resource summary
helper directly. The next slice should continue reducing built-in route coupling
without opening product-facing custom material rendering.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_SUMMARY_APP_DIAGNOSTICS_ROUTING_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Candidates

### Material Route Architecture

Add a generic `QueuedMaterialAppResourceSet` contract next to
`QueuedMaterialAppResourceItem`, then make `QueuedBuiltInAppResourceSet` use that
generic set shape. The current built-in app resource set is still the only set
type even though the item helper is already generic.

This is a narrow type-boundary cleanup. It gives future non-built-in route work
a named resource-set contract while preserving the built-in collector and
compatibility arrays.

### StandardMaterial / glTF Fidelity

Add the next combined StandardMaterial browser fixture, such as base-color plus
alpha-mask plus emissive. This is useful, but the latest route cleanup exposed a
small generic set boundary that should be resolved first.

### Diagnostics / Tooling

Add another dashboard or summary helper audit. The tracker is current, and the
next useful diagnostics move is to make the app route set contract itself more
generic.

## Selected Follow-Up

Select the material route architecture slice: add the generic queued material
app resource set contract.

Why:

- It is small and type-focused.
- It follows directly from the generic app item helper and generic summary
  routing.
- It supports future route migration without adding new source material kinds,
  shaders, or browser behavior.
- It should be verifiable with focused WebGPU unit tests and typecheck.

## Backlog Entry

```md
### task-1458 — Add generic queued material app resource set contract

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic `QueuedMaterialAppResourceSet` type or interface that carries
  generic queued material app resource items.
- Make `QueuedBuiltInAppResourceSet` use or alias that generic set shape while
  preserving its built-in item type.
- Add or update tests proving a fake non-built-in item can be grouped in the
  generic set without adding family-specific diagnostics fields or built-in
  compatibility arrays.
- Existing built-in app resource set and WebGPU app diagnostics tests continue
  to pass.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.
```
