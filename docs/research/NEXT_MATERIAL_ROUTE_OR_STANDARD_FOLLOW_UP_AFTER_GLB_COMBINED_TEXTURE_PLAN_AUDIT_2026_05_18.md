# Next Material Route Or Standard Follow-Up After GLB Combined Texture Plan Audit — 2026-05-18

## Scope

Audited the `task-1429` plan selecting built-in app adapter registration
diagnostics as the next implementation slice.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The selected follow-up is concrete enough for one focused run: add
  deterministic diagnostics/validation around duplicate and missing built-in app
  resource adapter family registrations.
- The task preserves ECS authority because it is limited to WebGPU app resource
  adapter metadata and tests; it does not alter ECS authoring components,
  source assets, or extraction.
- The task preserves WebGPU ownership because it validates renderer-owned route
  adapter registration state and JSON-safe diagnostics rather than moving GPU
  resources into ECS.
- The task aligns with decision 0010: route family keys may be registry-driven,
  but unsupported or malformed routing must produce diagnostics instead of
  silent fallback.
- Scope boundaries are explicit: no active non-built-in rendering, no route key
  rename, no GLB viewer work, no IBL/shadows, and no broad PBR work.

## Recommendation

Add `task-1431` to the ready backlog and implement it next, followed by a small
audit/tracker cadence task if public status changes.
