# Generic Bucket Migration Audit

Date: 2026-05-18

## Scope

Audit the generic queued material frame-resource bucket migration after
`task-1173`.

This checks package boundaries, ECS/render ownership, diagnostics JSON safety,
and whether built-in compatibility arrays remain transitional rather than the
pattern for future material families.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARED_ROUTE_MIGRATION_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `docs/ARCHITECTURE.md`

## Findings

The generic bucket helper is scoped correctly:

- It lives in `@aperture-engine/webgpu`, where backend frame-resource grouping
  belongs.
- It imports no ECS world, app facade, canvas, device, queue, pipeline, bind
  group, buffer, texture, sampler, or asset registry APIs.
- Its public summary contains only `{ family, itemCount }` rows sorted by
  family.
- Tests assert the summary is deterministic and does not serialize raw WebGPU or
  app payload strings.

The built-in wrapper now writes through two surfaces:

- The generic `byFamily` bucket store groups successful frame resources by
  material family.
- The existing `unlit`, `matcap`, and `standard` arrays remain populated for
  current compatibility.

That preserves current callers while giving future families a generic
family-keyed path.

## Diagnostics Boundary

The generic bucket store can contain backend frame-resource objects. That is
acceptable because it is an internal WebGPU preparation structure, not a public
diagnostics payload.

Public diagnostics should use `byFamilySummary` or another plain summary shape,
not the raw `byFamily` map. This matters because frame-resource objects may
contain backend resource references even when `JSON.stringify()` on a `Map`
would hide them.

## Drift Check

No architecture drift was found:

- ECS remains authoritative; buckets are derived from queued render data.
- Rendering still prepares backend resources from extracted/render-world state.
- The generic helper does not create a scene graph or renderer-owned gameplay
  state.
- WebGPU resources remain backend-owned.
- Built-in compatibility arrays remain a compatibility surface and should not
  be copied for a future family.

## Follow-Up

The next smallest implementation step is to route any app diagnostics that need
family bucket counts through the generic summary output, while keeping the
public `routedResourceSet` name stable. This is already captured by
`task-1178`.

## Outcome

No corrective code change was needed. The migration is aligned with the
ECS-authoritative, WebGPU-only architecture, with one clear rule for future
work: diagnostics consume summaries, not raw bucket maps.
