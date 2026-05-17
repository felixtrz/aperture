# App-Facade Readback Boundary Audit - 2026-05-17

## Scope

Audit the optional `WebGpuApp.render({ readbackSamples })` implementation added
for controlled app-facade browser examples.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_FACADE_CURRENT_TEXTURE_READBACK_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/frame-boundary.ts`
- `packages/webgpu/src/webgpu/current-texture-view.ts`
- `packages/webgpu/src/webgpu/clear-readback.ts`
- `examples/webgpu-readback.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `test/webgpu/frame-boundary-smoke.test.ts`
- `test/webgpu/frame-boundary-json.test.ts`
- `test/webgpu/frame-boundary-diagnostics.test.ts`

## Findings

- `readbackSamples` is opt-in on `WebGpuApp.render()`. Existing app render
  calls continue to omit readback work and report fields.
- The app facade does not expose the current texture, command encoder, queue,
  GPU buffers, bind groups, or backend cache maps. `assembleFrameBoundary()`
  owns the copy command while the current texture and encoder are already in
  scope, then `mapFrameBoundaryReadbackSamples()` returns decoded RGBA bytes.
- The public result is JSON-safe: sample ids, integer origins, format,
  bytes-per-row, and decoded pixel bytes on success; reason/message/`clearOk`
  on failure.
- Readback does not change render success. A frame can render successfully while
  readback reports unsupported texture format, missing buffer usage flags,
  missing map mode, unavailable copy support, or map failure.
- The controlled StandardMaterial browser example opts into COPY_SRC canvas
  usage when available and falls back to a JSON-safe readback failure when not.
- Existing screenshot assertions remain in place, so browser-visible coverage
  does not depend solely on readback availability.

## Boundary Check

Pass. The implementation keeps ECS authoritative and WebGPU resources
renderer-owned:

- ECS authoring still uses mesh/material/texture/sampler handles.
- Render extraction still produces snapshots and diagnostics before WebGPU
  work.
- Readback copies from the derived current texture after render command encoding
  and before command submission finish.
- No app-facing API returns raw WebGPU objects or mutable renderer state.

## Follow-Up

Use the new readback option in future controlled StandardMaterial texture
scenarios when exact samples improve test stability. The next ready task should
remain `task-1084`, planning the normal-map browser proof and its
missing-tangent negative path.

## Validation

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/frame-boundary-smoke.test.ts test/webgpu/frame-boundary-json.test.ts test/webgpu/frame-boundary-diagnostics.test.ts`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
