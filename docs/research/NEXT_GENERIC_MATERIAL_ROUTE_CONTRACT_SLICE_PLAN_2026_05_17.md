# Next Generic Material Route Contract Slice Plan

Date: 2026-05-17

Task: `task-1039`

## Context

The queued built-in app path now has generic contracts for material prepare
routing and frame-resource route shells, plus small helpers for appending valid
frame resources, option assembly, and texture/sampler dependency preparation.

The app orchestration is still intentionally owned by
`prepareQueuedBuiltInFrameResources()`.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Proven Pattern

The common pattern across Bevy and the current Aperture code is:

- source material/assets are prepared outside the final draw submission path;
- queue/phase routing carries compact keys and diagnostics, not raw source
  ownership;
- frame-resource preparation adapts backend-specific resource creation while
  keeping route diagnostics JSON-safe;
- the app/render graph owns orchestration, while material-family adapters own
  family-specific validation and resource construction.

## Recommendation

Do not extract a larger app route orchestrator yet. The next useful generic
contract slice should target reporting/scratch discipline for route outcomes,
because that is the remaining repeated shape across prepare routes and
frame-resource routes.

Recommended implementation:

- Add a compact helper that converts a successful or failed
  `QueuedMaterialFrameResourceRouteShell` into a JSON-safe summary item.
- Keep the helper out of default successful app reports.
- Use it in targeted tests to prove the shell summary can be inspected without
  exposing raw frame resources or backend handles.

This gives future diagnostics consumers a stable inspection shape without moving
resource creation or orchestration out of `prepareQueuedBuiltInFrameResources()`.

## Non-Goals

- Do not move the loop in `prepareQueuedBuiltInFrameResources()`.
- Do not add default successful route summaries to every app frame.
- Do not merge prepare-route and frame-resource-route responsibilities.
- Do not generalize beyond built-in material families until a second non-built-in
  family exists.

## Follow-Up Task

Add or keep the ready task:

```md
### task-1041 — Add next generic material-family route contract coverage

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted route/app tests, and
WebGPU typecheck.
Reference anchor:
Plan from `task-1039`, built-in material route adapters,
`queued-material-prepare-route.ts`, and `queued-material-frame-resource-route.ts`.

Acceptance criteria:

- Adds a compact JSON-safe frame-resource route shell summary helper.
- Does not add successful route summaries to default app reports.
- Targeted route/app tests and WebGPU typecheck pass.
```
