# Metallic-roughness dependency diagnostics plan audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_NORMAL_SCALE_VISUAL_PROOF_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_NORMAL_SCALE_VISUAL_PROOF_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Audit

The selected follow-up is concrete enough for one focused run:

- It has a single browser-facing scenario: unavailable
  `metallicRoughnessTexture` texture or sampler dependency.
- It can reuse the existing glTF fixture, source asset registration, and
  dependency status reporting paths.
- The expected behavior is explicit: JSON-safe diagnostics, no draw submission,
  and no raw GPU handles in status JSON.

Architecture fit:

- ECS remains authoritative because the scenario still authors entities through
  mesh/material components and source assets.
- Render extraction remains the boundary because the failure should stop before
  draw submission rather than giving the renderer fallback material state.
- WebGPU ownership remains intact because no source material or status JSON
  exposes raw texture, sampler, bind group, or buffer handles.
- The task does not require binary GLB loading, IBL, shadows, custom material
  source APIs, or app-level non-built-in rendering.

## Recommendation

Implement `task-1536` after tracker alignment. Keep the patch scoped to
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts` unless the fixture exposes a focused
defect in an existing dependency diagnostic path.

## Validation

Documentation-only audit; covered by final formatting/check validation.
