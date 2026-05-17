# Prepared Resource Lifetime Summary Cleanup Plan

Date: 2026-05-17

Task: `task-1013`

## Context

Aperture has several adjacent lifetime/readiness summary surfaces:

- Renderer-independent prepared facade summary:
  `createRenderWorldPreparedResourceSummary()`.
- WebGPU retained backend resource summary:
  `createRenderResourceSummaryReport()`.
- WebGPU lifecycle/inspection reports:
  `createRenderResourceLifecycleReport()` and
  `createRenderResourceInspectionReport()`.
- Prepared mesh/material backend cache summaries and eviction helpers tracking
  `lastUsedFrame`.

These are intentionally separate, but the next cleanup should make their
boundary easier to inspect when a material or mesh appears prepared in the
facade while a backend cache entry is stale, missing, or pending destruction.

## Reference Anchors Inspected

- Aperture:
  - `packages/render/src/rendering/render-world-prepared-resource-summary.ts`
  - `packages/webgpu/src/webgpu/resource-lifecycle.ts`
  - `packages/webgpu/src/webgpu/resource-summary.ts`
  - `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
  - `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
  - `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- Bevy:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

Common pattern: source/prepared asset state and backend retained resources need
separate inspection, with explicit lifecycle reports rather than implicit
ownership transfer.

## Smallest Cleanup Slice

Add targeted tests or a small helper that verifies prepared facade summary
counts can be compared with WebGPU backend resource inspection counts without
combining them.

Suggested helper shape:

```ts
createPreparedResourceLifetimeAlignmentSummary({
  facade,
  backend,
});
```

Where:

- `facade` is a `RenderWorldPreparedResourceSummary`.
- `backend` is a `RenderResourceSummaryReport`.

The output should be compact and JSON-safe:

- facade prepared mesh/material counts;
- backend mesh/material resource counts;
- backend stale/missing/pending-destroy counts;
- warning diagnostics only when facade prepared entries exist while backend
  inspection reports stale or missing resources.

This should live in `@aperture-engine/webgpu`, because it references backend
resource summaries. It must not pull WebGPU cache details into
`@aperture-engine/render`.

## Non-Goals

- Do not change eviction policy.
- Do not mutate caches.
- Do not merge backend cache reports into render facade summaries.
- Do not expose raw resources, cache maps, or GPU handles.
- Do not alter successful app-frame report shape.

## Implementation Follow-Up

Add a new ready task:

```md
### task-1014 — Add prepared resource lifetime alignment summary

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted tests, and tracker
files if resource lifetime status changes.
Reference anchor:
Plan from `task-1013`,
`packages/render/src/rendering/render-world-prepared-resource-summary.ts`,
`packages/webgpu/src/webgpu/resource-summary.ts`, and
`packages/webgpu/src/webgpu/resource-lifecycle.ts`.

Acceptance criteria:

- Helper compares prepared facade counts with backend resource summary counts
  without merging ownership.
- Helper warns when facade prepared entries coexist with backend stale/missing
  resource inspection counts.
- JSON output is handle-safe and omits raw resources/cache maps.
- Targeted tests pass.
```
