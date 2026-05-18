# Built-In Wrapper Generic Boundary Compatibility Audit

Date: 2026-05-18

## Scope

Audit the built-in wrapper compatibility tests after the generic app route item
helper.

This checks whether built-in arrays remain a compatibility surface, whether app
diagnostics naming stayed stable, and whether the test-only fake material route
leaked into product-facing APIs.

## References Inspected

- `docs/research/BUILT_IN_ROUTE_MIGRATION_ON_GENERIC_APP_BOUNDARY_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `docs/ARCHITECTURE.md`

## Findings

The compatibility tests pin the right boundary:

- Built-in route items now assert generic route item fields, including
  `queueItem`, `prepareRoute`, `adapter`, `draw`, source keys, and prepared
  mesh/material resource keys.
- `prepareRoute` is explicitly checked against the queue item family, pipeline
  key, frame, source version, and prepared resource keys.
- App diagnostics tests assert the public `routedResourceSet` field remains the
  summary surface and that `standardResourceSet` /
  `customPreviewResourceSet` fields are absent.

The built-in arrays remain transitional:

- `unlit`, `matcap`, and `standard` arrays still exist only in built-in
  frame-resource outputs for current app callers.
- The generic route item helper does not copy those arrays or expose them as a
  future-family pattern.
- The test-only `custom-preview` route still has no app route, material asset,
  shader, example, GLB mapping, or compatibility array.

## Boundary Check

No architecture drift was found:

- ECS remains authoritative; the route item helper carries derived queue/source
  data only.
- WebGPU still owns frame-resource preparation and backend resources.
- Public diagnostics expose summaries, not raw route items or raw bucket maps.
- No WebGL fallback or scene graph behavior was introduced.

## Readiness

The generic app route boundary is ready for a planning task that defines real
material-family route migration criteria.

Do not jump directly into a product material family yet. The criteria should
first decide:

- how a real material adapter is registered at app level;
- which diagnostics must exist before app routing accepts it;
- how prepared-resource contracts stay renderer-owned;
- how compatibility wrappers remain built-in-only.

## Outcome

No corrective code change was needed. Built-in wrapper compatibility is pinned,
and the next step should be route migration criteria rather than shader or PBR
feature work.
