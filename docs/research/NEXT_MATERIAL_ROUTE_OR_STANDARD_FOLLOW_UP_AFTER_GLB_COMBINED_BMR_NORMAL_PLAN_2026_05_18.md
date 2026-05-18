# Next Material Route Or Standard Follow-Up After GLB Combined BMR Normal Plan - 2026-05-18

## Context

The StandardMaterial browser fixture now covers base-color,
metallic-roughness, and normal textures together. The next slice should either
continue realistic glTF material combinations or move toward generic app-level
material adapters.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_COMBINED_BASE_COLOR_METALLIC_ROUGHNESS_NORMAL_BROWSER_COVERAGE_AUDIT_2026_05_18.md`

## Candidates

### Material Route Architecture

Start app-level non-built-in material adapter rendering. This remains important,
but it is too broad for the immediate next task because it needs app API shape,
pipeline layout/resource ownership, and render report behavior decisions.

### StandardMaterial / glTF Fidelity

Add a GLB-shaped browser fixture combining base-color, occlusion, and emissive
textures. This complements the metallic/normal path by covering another common
multi-texture material combination, including one lighting-independent emissive
contribution and one occlusion dependency.

### Diagnostics / Tooling

Add a shared assertion helper for multi-texture StandardMaterial browser status.
This would reduce test repetition, but it should follow one more concrete
coverage slice so the helper is shaped by actual repeated patterns.

## Selected Follow-Up

Select the StandardMaterial/glTF fidelity slice: combined base-color, occlusion,
and emissive texture browser coverage.

Why:

- It is a bounded vertical slice in the existing fixture and E2E file.
- It exercises multiple StandardMaterial texture slots without changing app
  route architecture.
- It keeps browser-visible validation ahead of broader PBR/IBL work.

## Backlog Entry

Add `task-1444` after the selected-plan audit:

```md
### task-1444 — Add combined base-color occlusion emissive GLB browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BMR_NORMAL_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color, occlusion, and
  emissive textures active together.
- Verify JSON-safe status reports all texture/sampler mappings and readiness
  slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and reflect the combined
  StandardMaterial texture route.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.
```
