# Material-Family Extensibility Boundary Before Route Migration Audit

Date: 2026-05-18

## Scope

Audit what must change before app-level non-built-in material routing can be
implemented safely.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_ROUTE_DETERMINISM_AUDIT_2026_05_18.md`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`

## Findings

App-level non-built-in material routing should not start as an implementation
task yet. The current route helpers are generic enough for tests and
diagnostics, but the public and app-facing material contracts remain closed
around built-in material families.

Contracts that must be decided before route migration:

- `MaterialKind` is a closed source-asset union. Opening it affects material
  validation, prepared-resource descriptions, pipeline keys, and user APIs.
- `MaterialQueueFamily` aliases `MaterialKind`, so queue items cannot honestly
  model registered third-party families without casts.
- `materialQueueFamilyFromPipelineKey()` parses only the built-in family set,
  so custom pipeline keys are rejected before app routing.
- `QueuedBuiltInAppResourceSet` is intentionally named and typed around built-in
  adapters, even though lower-level collectors and summaries are generic.
- `QUEUED_BUILT_IN_MATERIAL_ADAPTERS` wires fixed unlit, matcap, and standard
  frame-resource creation paths.
- A real route extension needs a source material asset contract, validation,
  dependency readiness, prepared-resource adapter, pipeline specialization,
  app diagnostics, and WebGPU frame-resource behavior.

## Recommended Shape

The next route-oriented task should be a planning note or decision draft, not a
type-boundary experiment yet.

Recommended future route task:

```md
### task-next — Plan material-family extensibility contract

Category: `docs-tooling`
Package/write-scope: `docs/research`, `docs/DECISIONS.md` only if the plan
requires an accepted architecture decision.
Reference anchor: this audit, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/types.ts`,
`packages/render/src/rendering/material-queue.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.

Acceptance criteria:

- Propose how built-in material kinds and future registered material-family
  strings should coexist.
- Identify which contracts stay closed for source assets and which become
  registry-driven route keys.
- Decide whether the change needs a decision record before implementation.
- Do not implement app-level non-built-in rendering.
```

Until that plan exists, continue narrow StandardMaterial/glTF fidelity work.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
