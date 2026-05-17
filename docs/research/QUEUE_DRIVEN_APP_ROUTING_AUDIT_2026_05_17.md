# Queue-Driven App Routing Audit — 2026-05-17

## Scope

Audit for `task-0626` after `task-0621` replaced the narrow mixed-family app
routing branches in `createWebGpuApp.render()`.

Relevant implementation:

- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `test/webgpu/webgpu-app.test.ts`

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/OPAQUE_MATERIAL_QUEUE_APP_ROUTING_PLAN_2026_05_17.md`
- Bevy render phase queue/sort pattern in
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
- three.js render-list sorting in
  `references/three.js/src/renderers/common/RenderList.js`
- PlayCanvas layer sort modes in `references/engine/src/scene/layer.js`

## Result

Pass with follow-ups.

The WebGPU app facade now has one opaque built-in material queue route for
multi-resource frames instead of the previous `unlit+matcap`,
`standard+other`, and `unlit+matcap+standard` branch shapes. The route consumes
`writeMaterialQueueFromSnapshot()`, prepares WebGPU-owned resources per queue
item, resolves prepared mesh/material resource keys from source handles, and
feeds the existing render-frame plan.

## Checks

- ECS remains authoritative. The route starts from `RenderSnapshot.meshDraws`
  and source asset handles. It does not query renderer state as gameplay state.
- WebGPU resources remain backend-owned. The material queue carries stable keys
  and diagnostics only; raw pipelines, buffers, textures, samplers, and bind
  groups stay in `packages/webgpu`.
- No hidden scene graph was introduced. The app still renders extracted flat
  draw packets through `RenderWorld` readiness and frame planning.
- Pairwise branch growth was removed for mixed built-in materials. The
  optimized multi-unlit fallback remains scoped to same-mesh unlit materials.
- Queue diagnostics are JSON-safe. Unsupported queue families/phases and
  material-family mismatches are plain objects, and missing prepared resources
  use the renderer-independent queue diagnostics.
- Package boundaries remain valid. `@aperture-engine/render` does not import
  WebGPU; `@aperture-engine/webgpu` consumes render contracts.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts test/webgpu/render-frame-plan.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`

## Follow-Ups

- Reusable app-frame queue scratch maps/arrays were added after this audit in
  `task-0628`.
- Continue with generic prepared material descriptors (`task-0625`) so queue
  resource resolution can move from app-local family switches to a
  renderer-independent prepared-material contract.
- Unsupported family/phase app diagnostics received direct regression coverage
  after this audit in `task-0629`.
- Keep transparent and alpha-test app routing consumption deferred until
  render-state validation and phase-specific app consumption are planned in
  `task-0631`.
