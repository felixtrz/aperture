# Queued Built-In Helper Composition Regression Audit

Date: 2026-05-17

Task: `task-1035`

## Scope

This audit covers the targeted app regression added after the queued built-in
route helper extractions:

- texture/sampler dependency preparation helper;
- frame-resource option helper;
- generic adapter append helper.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/webgpu-app.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`

## Findings

The regression remains inside the WebGPU app boundary and does not alter runtime
behavior. It tightens an existing mixed built-in app test so the successful
helper-composed route still proves:

- unlit, matcap, and StandardMaterial resources render together from ECS-authored
  entities;
- first-frame creation and second-frame reuse counts remain stable;
- successful frames continue to omit default
  `webGpuApp.frameResourceRoute` diagnostics;
- successful frames continue to omit default material queue route diagnostics.

Existing missing-light coverage still proves failed StandardMaterial frame
resource preparation returns a JSON-safe `webGpuApp.frameResourceRoute`
diagnostic without submitting GPU commands.

## Boundary Check

- ECS remains the authoring source of truth. The test authors entities,
  components, assets, and lights through the app facade; it does not install a
  renderer-owned scene graph.
- Rendering remains derived from extracted queue and prepared resource state.
  The assertions inspect reports and resource reuse counters, not mutable source
  state owned by WebGPU.
- The route diagnostics policy is unchanged: successful route reports remain
  omitted by default, while failure diagnostics include route context.
- The helper extractions do not change source material ownership, texture/sampler
  asset ownership, or backend resource lifetime ownership.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "reuses unlit, standard, and matcap app resource cache slots|standardFrameResources.missingLights|routes scalar and textured StandardMaterial queue items"`

Result: passed.

## Follow-Up

The next useful implementation slice is not a larger route composition helper.
Prefer a narrow typed summary or diagnostics task only when a concrete consumer
needs it. Keep broad route orchestration in `prepareQueuedBuiltInFrameResources()`
until another repeated pattern appears.
