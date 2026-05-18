# Next Material Route Or Standard Follow-Up After App Adapter Validation Diagnostics Plan - 2026-05-18

## Context

The built-in app resource adapter registry now has deterministic validation for
duplicate and missing families, and app frame diagnostics surface the default
validation report as JSON-safe data. The next implementation slice should keep
the route spine stable while advancing visible StandardMaterial coverage or the
material-family extensibility boundary.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BUILT_IN_APP_ADAPTER_VALIDATION_APP_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_AUDIT_2026_05_18.md`

## Candidates

### Material Route Architecture

Add the first app-level non-built-in material adapter render path. This would
advance the generic route boundary, but it is still too large for the next
focused slice because it needs app-facing adapter injection, resource
preparation, pipeline-layout access, and frame-resource ownership decisions.

### StandardMaterial / glTF Fidelity

Add browser coverage for a GLB-shaped StandardMaterial that combines
base-color, metallic-roughness, and normal textures in one material. This keeps
the existing built-in route, verifies multiple texture/sampler dependencies and
bind-group slots together, and exercises a realistic glTF material without
changing the app route API.

### Diagnostics / Tooling

Expose the built-in app adapter validation section in the browser fixture status
for one existing route. This is low risk, but it mostly duplicates the app-level
JSON tests and does not advance visible material fidelity.

## Selected Follow-Up

Select the StandardMaterial/glTF fidelity slice: add combined base-color,
metallic-roughness, and normal texture browser coverage.

Why:

- It is a vertical browser-visible slice with bounded files.
- It uses the existing WebGPU-only built-in route.
- It checks that multiple prepared texture/sampler resources coexist without
  expanding the material-route architecture.
- It supports the roadmap goal of richer StandardMaterial texture/resource
  coverage before broad PBR or IBL work.

## Backlog Entry

Add `task-1441` after the selected-plan audit:

```md
### task-1441 — Add combined base-color metallic-roughness normal GLB browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color,
  metallic-roughness, and normal textures active together.
- Verify JSON-safe material status reports all three texture/sampler mappings
  and readiness slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and materially different from a
  base-color-only or untextured control.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.
```
