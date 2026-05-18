# Next Route Or Standard Follow-Up After Built-In Item Generic Contract Plan - 2026-05-18

## Context

`task-1462` completed the immediate generic route item/set cleanup by making the
built-in app resource item a specialization of the generic route item contract.
The next slice should decide whether to keep cleaning route types or return to
StandardMaterial/glTF fidelity.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BUILT_IN_APP_RESOURCE_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`
- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Material Route Architecture

Continue with another built-in wrapper cleanup. The immediate duplicate
item/set definitions have been addressed, so the next route task would need
more careful design around product-facing non-built-in rendering or app facade
adapter migration.

### StandardMaterial / glTF Fidelity

Add a combined browser fixture for base-color plus alpha-mask plus emissive.
This exercises an existing alpha path with an additional rendered texture slot,
uses the newly extracted multi-texture assertion helper, and keeps GLB material
mapping honest without adding new PBR systems.

### Diagnostics / Tooling

Add another route cleanup audit or tracker-only note. The tracker is current,
and the StandardMaterial helper extraction was specifically done to make the
next combined browser fixture less repetitive.

## Selected Follow-Up

Select the StandardMaterial/glTF fidelity slice: add combined base-color,
alpha-mask, and emissive browser coverage.

Why:

- The immediate generic route item/set cleanup is complete enough for now.
- The multi-texture helper was created to support this kind of combined fixture.
- The task stays within existing StandardMaterial texture, alpha-mask, and
  emissive behavior instead of adding IBL, shadows, binary GLB loading, or new
  material families.
- It should verify both JSON-safe status and browser pixels/readback.

## Backlog Entry

```md
### task-1466 — Add combined alpha-mask emissive StandardMaterial browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and targeted docs only if the fixture changes public status.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped StandardMaterial browser scenario with base-color,
  alpha-mask, and emissive textures.
- Assert glTF texture/sampler mappings, readiness slots, resource counts,
  alpha-mask render-state status, and the combined pipeline key.
- Keep screenshot/readback assertions scenario-specific and verify masked versus
  visible pixels where practical.
- Keep app-level non-built-in material rendering, binary GLB loading, IBL,
  shadows, route renames, and broad PBR work deferred.
- Run targeted Playwright coverage for the new scenario and the full
  `standard-gltf-texture.spec.ts` file.
```
