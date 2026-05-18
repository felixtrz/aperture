# Next Material Route Or Standard Follow-Up After Multi Texture Helper Plan - 2026-05-18

## Context

`task-1449` reduced repeated combined StandardMaterial browser assertions
without changing runtime behavior. The next slice should move the
renderer/material architecture spine forward again while preserving the current
GLB-shaped StandardMaterial browser coverage.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MULTI_TEXTURE_STANDARD_ASSERTION_HELPER_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

Common reference pattern: established engines keep renderer-side binding,
material, and resource bookkeeping centralized behind renderer-owned systems.
Aperture's version should keep source material authoring in ECS/assets while
making app diagnostics and route summaries generic over material-family strings
instead of growing one wrapper per family.

## Candidates

### Material Route Architecture

Route app diagnostics through the existing generic material frame-resource
summary helper instead of the built-in summary wrapper. The public diagnostics
field is already named `routedResourceSet`, and
`createQueuedMaterialFrameResourceSetSummary()` already accepts arbitrary family
strings. `app.ts` still imports `createQueuedBuiltInResourceSetSummary()` for
that public summary.

This is a small cleanup that reduces built-in coupling without adding
non-built-in rendering or changing compatibility arrays.

### StandardMaterial / glTF Fidelity

Add another combined browser fixture, such as base-color plus alpha-mask plus
emissive. This would add fidelity coverage, but the architecture focus still
points at generic route/prepared-resource contracts before more texture
combinations.

### Diagnostics / Tooling

Add more assertion helpers around the StandardMaterial browser file. Useful
later, but the highest-value repetition was just removed, and another test-only
cleanup would not advance the route spine.

## Selected Follow-Up

Select the material route architecture slice: route app diagnostics through the
generic material frame-resource summary helper.

Why:

- It is small and reviewable.
- It advances the existing material-family route migration criteria without
  activating product-facing custom material rendering.
- It keeps public diagnostics stable while reducing built-in-specific coupling
  in the app summary path.
- It does not touch StandardMaterial shader behavior, GLB loading, IBL, shadows,
  or source material asset contracts.

## Backlog Entry

```md
### task-1454 — Route app diagnostics through generic material summary

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`test/webgpu/webgpu-app.test.ts`, and targeted summary tests if needed.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `createQueuedBuiltInAppDiagnosticsSummary()` builds `routedResourceSet`
  through `createQueuedMaterialFrameResourceSetSummary()` or an equivalent
  generic material-family summary path.
- Existing public `routedResourceSet` JSON shape and built-in compatibility
  arrays remain unchanged.
- Built-in wrapper exports are either kept as explicit compatibility aliases or
  removed only if no public exports/tests/docs rely on them.
- Tests cover at least one app diagnostics summary route and any touched summary
  wrapper behavior.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.
```
