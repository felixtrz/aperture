# Next Renderer/Material Slice After Depth Resize — 2026-05-19

## Context

Depth attachment creation, app-level reporting, and resize reporting now have
unit/browser coverage. The next slice should avoid broad architecture changes
and keep improving the renderer/material spine through a narrow, verifiable
status or contract proof.

## Candidates

### A. Generic material-family contract slice

This remains strategically important, but the next useful contract should be
planned carefully because public custom material APIs and app-owned adapter
facades are still deferred by decision. A planning task is ready for this track.

### B. StandardMaterial/glTF transformed texture status hardening

The normal transform fixture is now pinned. Occlusion and emissive transform
fixtures still have the same broad matcher shape and can be hardened in the
same focused way without runtime changes.

### C. Diagnostics/tooling alignment

Tracker alignment already reflects depth work. A tooling-only update would be
premature unless another implementation changes status or recommended tasks.

## Selection

Select `task-1770`: tighten one remaining transformed texture fixture. Prefer
the occlusion transform scenario first because it covers a data texture and
occlusion-specific readiness slot while remaining test-only.

## Acceptance Reminder

Keep the change in `test/e2e/standard-gltf-texture.spec.ts`, preserve existing
pixel/readback and WebGPU validation guards, and avoid new runtime features.
