# Real Material Family App Route Migration Criteria

Date: 2026-05-18

## Scope

Define criteria that must be true before Aperture adds product-facing
non-built-in material app routing.

This is not an implementation plan for a shader, material asset, GLB mapping,
or browser example.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BUILT_IN_WRAPPER_GENERIC_BOUNDARY_COMPATIBILITY_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `docs/ARCHITECTURE.md`

## Route Migration Criteria

A product-facing material family can enter app routing only when all of these
are true:

1. Source asset contract exists.
   - The material is represented as renderer-independent source data.
   - ECS components reference it through stable handles.
   - Unsupported fields produce structured diagnostics.

2. Queue contract exists.
   - The family produces `MaterialQueueItem` data through extraction/queueing,
     not through renderer-owned scene objects.
   - Pipeline key behavior is deterministic and documented.
   - Render phase and render-state implications are inspectable.

3. Prepare contract exists.
   - Source assets are prepared into renderer-owned WebGPU resources through an
     explicit adapter.
   - Texture/sampler dependencies have readiness diagnostics.
   - Resource keys are stable and JSON-safe.

4. App route contract exists.
   - The app route can create `QueuedMaterialAppResourceItem` values without a
     family-specific wrapper.
   - Public diagnostics use existing summary fields such as
     `routedResourceSet`.
   - Raw route items, bucket maps, GPU handles, and source asset payloads are
     not serialized.

5. Compatibility story is explicit.
   - Built-in `unlit`, `matcap`, and `standard` arrays stay compatibility
     surfaces, not a template for new families.
   - No `<family>ResourceSet` app diagnostics field is added without a decision
     record.

6. Verification exists.
   - Unit tests cover route, prepare, diagnostics, and summary behavior.
   - Browser/Playwright coverage is required when the family affects pixels.

## First Candidate Guidance

Do not add an arbitrary new family just because the generic route can carry one.
The material-family order remains:

1. `UnlitMaterial`
2. `MatcapMaterial`
3. `StandardMaterial`
4. `DebugNormalMaterial`
5. optional simple lit material later

Because Unlit, Matcap, Standard, and DebugNormal already exist in some form, the
next product-facing route work should probably be a cleanup/migration of an
existing family path, not a brand-new family. The best candidate is a
StandardMaterial route cleanup that reduces built-in special casing while
preserving current GLB/texture diagnostics.

## Non-Criteria

These are not sufficient reasons to add a product family:

- A test-only fake family passes generic route tests.
- A shader can be compiled.
- A browser example can be made visually interesting.
- A GLB field can be parsed but not rendered honestly.

## Recommended Follow-Up

Before implementation, audit these criteria against the architecture and medium
term goals. If the audit passes, plan a StandardMaterial route cleanup slice
that stays within route/preparation contracts and avoids new PBR shader scope.

## Outcome

A real material-family app route migration is not blocked by generic route item
shape anymore, but it still needs criteria-driven cleanup rather than a new
family feature.
