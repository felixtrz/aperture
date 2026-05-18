# Next Follow-Up Plan After GLB Combined Base Color Occlusion Emissive Audit - 2026-05-18

## Scope

Audited the selected follow-up from
`NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The selected helper extraction is concrete enough for one focused run and has
  a single write scope.
- It preserves ECS authority, render extraction, and WebGPU-only backend
  ownership because it only refactors browser test assertions.
- It is a better next step than another combined texture fixture because the
  recent tests now repeat mapping/readiness/resource assertion structure.

## Recommendation

Implement `task-1449` next.
