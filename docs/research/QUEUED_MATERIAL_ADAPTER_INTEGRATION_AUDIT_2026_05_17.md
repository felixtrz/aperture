# Queued Material Adapter Integration Audit - 2026-05-17

## Scope

Audited `task-0643` after the WebGPU app queue route started dispatching
built-in material resource preparation through an internal adapter contract.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/e2e/standard-queue-phases.spec.ts`

## Findings

- The adapter contract is internal to `packages/webgpu/src/webgpu/app.ts`.
  Nothing public was exported from `@aperture-engine/render`, so WebGPU
  textures, samplers, buffers, bind groups, and pipelines remain backend-owned.
- The queue route still starts from `RenderSnapshot.meshDraws` and
  `MaterialQueueItem` ordering. The adapter is attached only to the internal
  app resource item after the source mesh/material assets are resolved.
- Unsupported material families and unsupported phases still produce JSON-safe
  app diagnostics before WebGPU submission.
- The optimized multi-unlit shared-mesh path remains separate, as planned, so
  this slice does not regress that reuse-specific route.
- Pipeline-scoped bind-group resource keys are still applied after each
  adapter-created frame resource. This preserves the auto-layout fix for
  StandardMaterial opaque, alpha-test, and transparent pipelines.
- No central scene graph or renderer-owned gameplay state was introduced. The
  app route remains a convenience orchestration layer over extracted snapshots
  and WebGPU-owned resources.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts test/e2e/materials-showcase.spec.ts`
- `pnpm run check:boundaries`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run format:check`

## Result

No architecture drift was found. The adapter implementation matches the generic
queue contract plan for the first implementation slice and is narrow enough to
continue iterating toward a generic material-family route.

The next renderer/material architecture work should focus on reducing the
remaining single-family route duplication and moving prepared material/resource
lifetime reporting closer to the queue-driven path without weakening the
optimized multi-unlit reuse path.
