# Opaque Material Queue App Routing Plan — 2026-05-17

## Scope

Planning note for `task-0621`: replace the narrow mixed-family app routing
branches with consumption of the generic material-family queue introduced in
`task-0619`.

This is not a new architecture decision. It applies the existing
ECS-authoritative, snapshot-derived, WebGPU-only bridge described in
`docs/ARCHITECTURE.md`.

## Current Branch Point

`packages/webgpu/src/webgpu/app.ts` currently:

1. Extracts a `RenderSnapshot`.
2. Builds `WebGpuAppDrawResourceSetPlan` groups by source mesh/material key.
3. Attempts specialized collectors:
   - `collectMixedUnlitMatcapAppResourceSet`
   - `collectMixedStandardAppResourceSet`
   - `collectMixedAllBuiltInAppResourceSet`
4. Routes each shape into a specialized render function.
5. Falls back to a single-family/multi-unlit path.

The specialized render functions are safe but should not grow further. They
duplicate the role of a material queue: resolve source materials, prepare GPU
resources, map source handles to prepared resource keys, select pipelines, and
let `writeRenderFramePlanFromSnapshot()` encode commands.

## Target Shape

Add one opaque built-in queue route that:

1. Starts from `RenderSnapshot.meshDraws`.
2. Rejects unsupported material families early with JSON-safe diagnostics.
3. Prepares resources per queued material family:
   - unlit: existing unlit material buffer/bind-group frame resource helpers.
   - matcap: existing Matcap frame resource helpers.
   - standard: existing StandardMaterial frame resource helpers.
4. Builds prepared `meshResourceKeys` and `materialResourceKeys` maps keyed by
   source handle strings.
5. Calls `buildMaterialQueueFromSnapshot()` with resolvers backed by those maps.
6. Uses the queue diagnostics as the single missing-resource/unsupported-family
   report path.
7. Feeds all prepared mesh resources, pipelines, and bind groups to
   `writeRenderFramePlanFromSnapshot()`.

The first implementation can remain opaque-only and built-in-family-only. It
does not need to solve transparent sorting, generic prepared material
descriptors, or normal-map shading.

## Suggested Implementation Slices

Keep the `task-0621` patch vertical and reviewable:

1. Add an app-local queue resource collector for opaque built-in material queue
   items. It can reuse the existing per-family resource helpers and resource
   cache fields instead of designing a new cache.
2. Replace the `mixedUnlitMatcap`, `mixedStandard`, and `mixedAllBuiltIn`
   dispatch block with the generic queue route for multi-family opaque frames.
3. Leave the single-family/multi-unlit route in place only as a compatibility
   fallback until the queue route also covers its cache behavior.
4. Add tests that assert mixed unlit + Matcap + StandardMaterial frames produce
   material queue diagnostics/resources and no longer rely on collector-specific
   branch shapes.
5. Run focused app tests, material showcase Playwright, and `pnpm run check`.

## Constraints

- Do not move WebGPU resources into `@aperture-engine/render`.
- Do not make the render world authoritative over source materials or ECS
  state.
- Do not introduce a public mutable scene graph.
- Do not add another pairwise material-family branch.
- Do not use the queue to carry raw bind groups, pipelines, buffers, textures,
  or samplers; those remain WebGPU-owned resources referenced by stable keys.
