# WebGPU Prepared Material Facade Summary Handoff Plan - 2026-05-17

## Scope

Plan the smallest handoff from WebGPU-private prepared built-in material cache
summaries toward renderer-independent prepared material facade summaries.

This is a planning slice only. It does not change app reports or move backend
resource ownership.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/engine/src/framework/stats.js`
- `references/three.js/src/renderers/common/Info.js`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Current State

WebGPU app reports currently expose `resourceReuse.preparedMaterialCache` from
the WebGPU-private `PreparedBuiltInMaterialStore`.

That summary is intentionally backend-local:

- Counts prepared material cache entries by built-in material family.
- Does not expose raw GPU buffers, bind groups, textures, samplers, or cache
  maps.
- Reflects backend prepared material resource lifetime, including older entries
  retained after source version changes.

The render package now exposes `preparedMaterialStoreSummaryToJsonValue()` for
renderer-independent prepared material facade entries:

- Counts entries by material family.
- Lists JSON-safe prepared metadata by source material key/version.
- Includes logical material and bind-group resource keys, pipeline keys, and
  dependency counts.
- Does not include source material objects, raw backend handles, or internal
  store maps.

## Reference Pattern

PlayCanvas and three.js expose aggregate resource/frame counters rather than raw
backend objects in public stats surfaces. Bevy keeps source assets and prepared
render assets separate and lets render stages inspect prepared-resource
readiness through render-side resources.

Aperture should combine those ideas:

```text
RenderSnapshot material handles
  -> renderer-independent PreparedMaterialStore summary
  -> WebGPU-private prepared built-in material cache summary
  -> app frame report JSON
```

The two summaries answer different questions and should not be merged
prematurely.

## Proposed Handoff

1. Keep the existing WebGPU `preparedMaterialCache` summary as the backend cache
   lifetime counter.
2. Add a separate render-facade material summary only after the WebGPU app route
   prepares `PreparedMaterialStore` entries as part of its render-world/material
   queue path.
3. Name the future report field distinctly, for example
   `preparedMaterialFacade`, to avoid implying that renderer-independent
   descriptors own backend resources.
4. Populate the future field from `preparedMaterialStoreSummaryToJsonValue()`
   after snapshot material preparation, before backend frame-resource creation.
5. Keep texture/sampler resource counters separate from both material summaries.

## Non-Goals

- Do not replace the WebGPU-private cache summary with the facade summary.
- Do not store WebGPU buffers, bind groups, textures, samplers, or app cache
  objects in `PreparedMaterialStore`.
- Do not expose internal `Map` keys or raw backend handles through app JSON.
- Do not make the render package import WebGPU.

## Follow-Up Task Shape

```md
### task-next - Add WebGPU app prepared material facade summary

Category: `webgpu-render`
Package/write-scope: WebGPU app report path and focused app tests.
Reference anchor:
`WEBGPU_PREPARED_MATERIAL_FACADE_SUMMARY_HANDOFF_PLAN_2026_05_17.md`,
`preparedMaterialStoreSummaryToJsonValue`, current WebGPU prepared material
cache summary, and Bevy render asset summary patterns.

Acceptance criteria:

- WebGPU app reports include a separate JSON-safe prepared material facade
  summary when the app route has prepared renderer-independent material facade
  entries.
- Existing `preparedMaterialCache` backend counts remain unchanged and separate.
- Tests prove the facade summary omits source asset objects, raw GPU handles,
  texture/sampler cache maps, and internal `Map` state.
```
