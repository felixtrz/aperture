# Generic Material Route Helper Consolidation Plan

Date: 2026-05-17

Task: `task-1060`

## Goal

Decide whether another small helper extraction is justified before broader
material-family routing work.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Current State

The WebGPU app route path now has:

- built-in material queue adapters;
- prepare-route result helpers;
- frame-resource route shell summaries;
- grouped route summary health;
- generic built-in frame-resource append helper;
- app-local scratch for queue route reports.

The remaining specialized code is mostly orchestration inside `app.ts`, where
the app coordinates caches, pipeline lookup, texture/sampler dependencies,
layout creation, view uniforms, frame resources, and family buckets.

## Decision

Do not extract another orchestration helper yet.

The current app route loop still owns enough app/backend-specific context that a
larger extraction would mainly move complexity sideways. The next helper should
only be added when one of these becomes concrete:

- a second non-built-in material family needs the same route path;
- successful-frame optional route summaries need scratch-backed app exposure;
- allocation profiling shows repeated setup/report work in the hot path;
- frame-resource resource creation needs a testable adapter boundary not already
  covered by `appendQueuedBuiltInFrameResourceViaAdapter()`.

## Immediate Follow-Up

Use the next audit/refill task to update tracker/backlog/completed status and
then steer toward StandardMaterial/glTF fidelity or prepared-resource lifetime
work. Avoid broad route orchestration extraction until a specific duplication or
diagnostics need appears.

## Non-Goals

- Do not move `prepareQueuedBuiltInFrameResources()` out of `app.ts` in this
  slice.
- Do not add successful route summaries to default app reports.
- Do not generalize beyond built-in material families without a concrete second
  family.
- Do not add app report fields for route grouping by default.
