# Material-Family Extensibility Contract Plan

Date: 2026-05-18

## Scope

Plan how built-in material kinds and future registered material-family route
keys should coexist before app-level non-built-in material routing starts.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_FAMILY_EXTENSIBILITY_BOUNDARY_BEFORE_ROUTE_MIGRATION_AUDIT_2026_05_18.md`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`

## Current Boundary

The lower-level queued material adapter registry already accepts arbitrary string
families, but the render/app contracts are still built-in-specific:

- `MaterialKind` is a closed source asset union.
- `MaterialQueueFamily` aliases `MaterialKind`.
- `materialQueueFamilyFromPipelineKey()` only accepts built-in families.
- `QueuedBuiltInAppResourceSet` and `QUEUED_BUILT_IN_MATERIAL_ADAPTERS` are
  intentionally fixed to unlit, matcap, and standard app resources.
- `debug-normal` is a source material kind but does not currently have an
  app-level frame-resource route.

## Proposed Contract

Keep source material assets closed for now. Do not turn `MaterialAsset` into an
arbitrary custom-material union until there is a real public material-family API
and a decision record for plugin/custom-shader scope.

Introduce route-family openness at the queue/adapter boundary instead:

- Add an owned `MaterialFamilyKey = MaterialKind | (string & {})` or equivalent
  route key type in the render queue layer.
- Keep built-in source assets typed as `MaterialKind`.
- Keep built-in material factories and validation closed.
- Let pipeline-family parsing return a string route key when the first pipeline
  segment is syntactically valid, while diagnostics still reject malformed or
  empty keys.
- Let app/resource adapters decide whether a route key is supported through
  registered adapter tables.
- Keep built-in app resource helpers named as built-in compatibility wrappers
  until a real generic app resource set replaces them.

This keeps ECS/source authoring honest while allowing route diagnostics and
future adapter registration to reason about non-built-in family keys.

## Decision Need

This should get a decision record before implementation if the public
`MaterialQueueFamily` type or pipeline-family parsing accepts arbitrary route
keys. The decision should explicitly say:

- source material kinds remain closed until a custom material source API exists;
- route family keys may be registry-driven strings;
- WebGPU app rendering only supports families with registered backend adapters;
- unsupported route keys produce diagnostics rather than fallback rendering.

## Implementation Sequence

1. Add the decision record.
2. Add a tiny type-boundary test for route-family keys without changing app
   rendering.
3. Update `materialQueueFamilyFromPipelineKey()` to parse valid family strings
   and keep diagnostics for malformed keys.
4. Keep app-level support restricted to registered built-in adapters until a
   separate implementation task adds a real non-built-in route.
5. Add status/reporting tests that prove unsupported custom route keys remain
   diagnostic-only.

## Non-Goals

- Do not add app-level non-built-in rendering in the type-boundary task.
- Do not add arbitrary custom shaders or shader graph behavior.
- Do not loosen source material validation before a public source-material
  contract exists.
- Do not add IBL, shadows, binary GLB loading, or GLB viewer behavior.

## Selected Follow-Up

Add a decision-record task before implementation.

### task-next — Add material-family route key decision

Category: `docs-tooling`
Package/write-scope: `docs/DECISIONS.md`, `docs/research`, and backlog only.
Reference anchor: this plan, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/types.ts`,
`packages/render/src/rendering/material-queue.ts`, and
`packages/webgpu/src/webgpu/queued-material-adapter.ts`.

Acceptance criteria:

- Record whether route-family keys can be registry-driven strings while source
  material kinds remain closed.
- State that unsupported route keys remain diagnostics-only without fallback
  rendering.
- Add one concrete implementation follow-up for the type-boundary test.
- Do not implement app-level non-built-in rendering.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
