# Mixed Material App Routing Audit — 2026-05-16

## Scope

Audited the `createWebGpuApp.render()` mixed material-family routes after
StandardMaterial, MatcapMaterial, and textured UnlitMaterial could participate
in two-resource-set app frames.

Focus areas:

- ECS/render ownership boundaries
- package dependency direction
- material-family pipeline and bind group routing
- dependency and resource failure diagnostics
- browser diagnostics coverage
- material showcase readiness

## Reference Anchors

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `examples/app-diagnostics.js`
- `test/webgpu/webgpu-app.test.ts`
- `test/e2e/app-diagnostics.spec.ts`

The Bevy pattern inspected here is still conceptual rather than copied:
material assets remain ECS-authored source data, renderer-side preparation
creates family-specific bind groups and pipelines, and draw routing is keyed by
prepared material/pipeline resources rather than a renderer-owned scene graph.

## Findings

- `packages/simulation`, `packages/render`, `packages/runtime`, and
  `packages/core` do not import `@aperture-engine/webgpu` or browser/WebGPU
  globals for this work. The only search hit outside `webgpu` is render-phase
  documentation text that names WebGPU submission.
- Mixed app rendering still starts from `RenderSnapshot` mesh/material handles
  and typed asset collection entries. ECS remains authoritative for authored
  transforms, visibility, mesh handles, material handles, cameras, and lights.
- Texture source bytes remain renderer-independent `TextureAsset.sourceData`;
  texture/sampler resource creation and `queue.writeTexture` stay inside
  `packages/webgpu`.
- Material dependency readiness blocks the whole app frame before submission
  when any mixed-frame material dependency is missing/loading/failed. The
  browser diagnostics example now proves a mixed-family material dependency
  failure instead of the older unsupported-resource-set diagnostic.
- Mixed-family bind group routing needed a correction during this audit:
  shared group 0/1 bind groups must be scoped to the pipeline family that
  created their layouts. `pipelineScopedBindGroups()` now adds the pipeline key
  to shared bind group lookup metadata and gives those resources unique
  app-frame keys, allowing the draw-list resolver to pick the correct shared
  groups per pipeline.
- Focused app tests cover:
  - unlit + StandardMaterial success and reuse
  - StandardMaterial + MatcapMaterial success
  - StandardMaterial missing-light resource failure
  - factor-only unlit + MatcapMaterial success and dependency failure
  - textured unlit + MatcapMaterial success, missing dependency failure, and
    texture/sampler reuse
- Browser diagnostics coverage checks JSON-safe mixed dependency failure data,
  failed material family/resource keys, successful mixed-family submission, and
  non-background pixels.

## Limitations

- Mixed app routes are still pairwise. They support two source resource sets in
  one frame, not all three built-in families together.
- `examples/materials-showcase.*` remains a direct WebGPU proof until a
  three-family app route can render unlit, StandardMaterial, and MatcapMaterial
  in the same app frame.
- StandardMaterial texture sampling remains deferred for the proof-point
  StandardMaterial path; ready texture dependencies can still surface resource
  diagnostics rather than active sampling.

## Result

No ECS/render/WebGPU ownership drift was found. The corrective bind-group
scoping keeps renderer-owned WebGPU layouts and bind groups in the backend while
preserving snapshot-driven draw routing.

## Follow-Ups

- Add a narrow three-family built-in material app route before promoting the
  material showcase onto app-facade material paths.
- Keep `task-0605` as the audit for the material showcase after that promotion
  lands.
