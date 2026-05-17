# WebGPU Prepared Material Facade Summary Boundary Audit - 2026-05-17

## Scope

Audit the WebGPU app prepared material facade summary added to
`resourceReuse.preparedMaterialFacade`.

This audit checks ownership boundaries only. It does not change runtime code.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_PREPARED_MATERIAL_FACADE_SUMMARY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_APP_QUEUE_FACADE_KEY_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Result

No corrective source refactor is needed.

The current facade summary is renderer-independent metadata:

- It is produced by `preparedMaterialStoreSummaryToJsonValue()` in
  `@aperture-engine/render`.
- Its entries include source material key/version, material family, pipeline
  key, logical material resource key, logical bind-group resource key,
  dependency count, texture binding count, and diagnostic count.
- It does not include source material asset objects, WebGPU buffers, bind
  groups, textures, samplers, pipeline handles, cache maps, or internal `Map`
  state.

The WebGPU app keeps ownership split correctly:

- `resourceReuse.preparedMaterialFacade` reports renderer-independent prepared
  material descriptor state.
- `resourceReuse.preparedMaterialCache` reports WebGPU-private prepared
  material cache lifetime.
- `textureResources*` and `samplerResources*` counters remain separate backend
  resource counters.
- StandardMaterial light buffers and group-3 bind groups remain backend-owned.

## Validation

- `node scripts/check-package-boundaries.mjs` passed.
- Focused app tests now cover facade summary counts across material,
  texture, sampler, and transform/light-only frames.
- Focused app tests prove the facade summary stays JSON-safe and separate from
  backend cache counts.

## Drift Check

The audited shape matches the project invariants:

- ECS remains the source of truth.
- Rendering remains derived from snapshots and prepared render assets.
- GPU resources belong to the WebGPU backend.
- The render package still does not import WebGPU.
- The app facade remains orchestration over ECS, render extraction, and WebGPU
  submission rather than a hidden scene graph.

## Remaining Risk

The facade summary is currently populated after `renderWebGpuAppFrame()`. That
is sufficient for reporting, but the first WebGPU material queue pass still
uses app-local source asset resource keys instead of prepared facade keys.

The next implementation slice should route the first material queue pass through
`createPreparedMaterialQueueResourceKeyResolver()` while keeping WebGPU buffers,
bind groups, texture/sampler resources, pipelines, and light resources
backend-owned.
