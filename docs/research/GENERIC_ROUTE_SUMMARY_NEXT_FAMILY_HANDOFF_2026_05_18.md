# Generic Route Summary Next-Family Handoff

Date: 2026-05-18

## Scope

Summarize what a future non-built-in material family should reuse from the
current material queue route, frame-resource, and diagnostics summary contracts.

This is a handoff note for the next material-family migration slices; it is not
a request to add a new material family yet.

## References Inspected

- `docs/research/GENERIC_QUEUED_RESOURCE_SUMMARY_MIGRATION_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARED_ROUTE_MIGRATION_PLAN_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Contracts To Reuse

A future material family should plug into the same generic route concepts as the
built-in families:

- Queue items carry plain render data: material family, render phase, pipeline
  key, source mesh key, source material key, and adapter hooks.
- Adapter hooks prepare texture/sampler dependencies and create frame-resource
  options without owning ECS state.
- Frame-resource creation returns backend resource keys and diagnostics, not raw
  WebGPU handles in public summaries.
- App diagnostics keep the public `routedResourceSet` field until there is a
  deliberate compatibility decision to rename it.
- Summary helpers accept plain items and return deterministic JSON-safe bucket
  arrays by family, pipeline, and family-plus-pipeline.

This matches the architecture boundary: render extraction produces render data,
the WebGPU backend owns GPU preparation, and app-facing diagnostics stay
serializable.

## Compatibility Wrappers

Wrappers that should remain for now:

- `queued-built-in-resource-set-summary.ts`, because it keeps existing built-in
  call sites stable while delegating to the generic summary helper.
- Built-in frame-resource arrays for `unlit`, `matcap`, and `standard`, because
  current app and tests still consume those arrays directly.
- Public `routedResourceSet` diagnostics naming, because examples and tests now
  pin that field as the app-level route summary.

Wrappers that should not be copied for new material families:

- A parallel `collectQueued<Family>AppResourceSet()` wrapper with its own
  summary shape.
- Hard-coded per-family frame-resource bucket arrays beyond the current
  compatibility surface.
- App-route report sections that expose a new family-specific resource-set
  field when the generic `routedResourceSet` buckets already describe family and
  pipeline counts.

## Next Material-Family Requirements

Before a non-built-in family is introduced, the route path should support:

- A generic bucket store keyed by material family, while still mirroring built-in
  resources into the compatibility arrays.
- Deterministic bucket summaries that can cover multiple families without
  requiring new app diagnostics fields.
- Tests proving the generic bucket store and diagnostics summaries do not
  serialize `GPUDevice`, `GPUBuffer`, `GPUTexture`, bind group, app, world, or
  source asset payloads.

## Follow-Up

The concrete next implementation slice remains `task-1173`: add generic queued
material frame-resource buckets. The follow-up diagnostics slice is now
`task-1176`: add generic bucket diagnostics summary coverage once the bucket
store exists.

## Outcome

New material families should use generic queue route and frame-resource
contracts first. Built-in compatibility wrappers can stay as transitional
adapters, but they should not become the template for future family-specific app
routes.
