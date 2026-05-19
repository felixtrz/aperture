# Next Renderer/Material Slice After Depth — 2026-05-19

## Context

The app facade now owns a single `depth24plus` forward-pass depth attachment and
opaque built-in pipelines depth-test/write. The next slice should keep momentum
on the renderer/material spine without broadening into render graphs, IBL,
shadows, binary GLB loading, or public custom material APIs.

## Reference Anchors

- `docs/MEDIUM_LONG_TERM_GOALS.md`: prioritize StandardMaterial texture/glTF
  fidelity and generic material-family contracts before IBL/shadows.
- `docs/ARCHITECTURE.md`: ECS remains authoritative; WebGPU owns derived GPU
  resources only.
- `docs/DECISIONS.md`: custom material source APIs remain data-only and
  deferred.
- `references/three.js/build/three.webgpu.js`: texture transforms are material
  sampling inputs, not scene graph state.
- `references/engine/src/extras/exporters/gltf-exporter.js` and lit shader
  UV-transform chunks: texture offset/scale/rotation/UV channel metadata is
  tracked per texture slot.

## Candidates

### A. Generic material-family queue/prepared-resource contract

This advances the architecture spine directly, but it is larger than the
remaining safe window because source validation, route policy, and app facade
surface decisions are still intentionally deferred.

### B. StandardMaterial/glTF transformed texture status hardening

This is narrow, already scoped as `task-1765`, and follows the recent assertion
hardening track. Existing normal, occlusion, and emissive transform fixtures
already render successfully; the useful work is to pin exact JSON-safe
transform, slot, texCoord, readiness, and pipeline status so later renderer
changes cannot silently drop transform metadata.

### C. Diagnostics/tooling follow-up

Depth tracker alignment is complete and `pnpm run check` passes. Another
tooling-only task would add less value than hardening one real browser fidelity
fixture.

## Selection

Select `task-1765`: tighten one transformed texture status assertion. Start with
the normal texture transform fixture because it also requires a tangent mesh
layout, making it the highest-signal transformed-slot regression among the
ready options.

## Acceptance Reminder

Keep the change in `test/e2e/standard-gltf-texture.spec.ts` unless the tighter
assertion exposes an implementation defect. Preserve screenshot/readback and
WebGPU warning guards; do not add new material features.
