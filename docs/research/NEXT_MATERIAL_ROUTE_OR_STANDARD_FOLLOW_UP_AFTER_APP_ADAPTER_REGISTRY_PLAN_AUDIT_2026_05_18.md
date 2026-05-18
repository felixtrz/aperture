# Next Material Route Or Standard Follow-Up After App Adapter Registry Plan Audit — 2026-05-18

## Scope

Audited the `task-1419` plan selecting GLB-derived metallic-roughness
`TEXCOORD_1` texture-transform browser coverage.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`
- Existing StandardMaterial GLB texture-transform browser fixtures

## Findings

- The selected follow-up is concrete enough for one focused run: one
  GLB-derived fixture, one browser/status regression, and targeted code fixes
  only if the fixture exposes a bug.
- The task advances the lit glTF proof point without pulling in GLB viewer work,
  IBL, shadows, broad PBR completeness, route renames, or non-built-in material
  rendering.
- ECS authority and render extraction boundaries remain intact because the
  fixture should author/load source assets through the existing app path and
  assert extracted JSON-safe status.
- WebGPU-only ownership remains intact; the selected task is browser/WebGPU
  verification for an existing StandardMaterial path.
- The backlog has at least five categorized, scoped ready tasks after this
  audit.

## Recommendation

Proceed with `task-1421`: add GLB metallic-roughness UV1 transform browser
coverage.
