# Material Showcase App-Path Audit — 2026-05-16

## Scope

Audit `examples/materials-showcase.*` after promotion from a direct WebGPU demo
shader to the built-in material/app-facade path for unlit, StandardMaterial, and
MatcapMaterial.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `packages/render/src/materials/types.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `examples/materials-showcase.html`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`

## Findings

- The showcase now creates a `createWebGpuApp()` instance and authors the scene
  through ECS-facing helpers: transforms, mesh handles, material handles,
  camera, lights, visibility, render layers, and the `SpinSystem`.
- Mesh, unlit, StandardMaterial, MatcapMaterial, texture, and sampler data are
  created as renderer-independent source assets. WebGPU buffers, textures,
  samplers, bind groups, pipelines, command encoding, and submission remain
  inside `@aperture-engine/webgpu`.
- The example imports `@aperture-engine/webgpu` explicitly alongside the
  retired umbrella package, matching the then-current architecture rule that
  the package remained headless-safe and did not re-export WebGPU backend APIs.
- The promoted path follows the same broad pattern as Bevy's source asset to
  render asset split: app-facing assets/components are authored outside the GPU
  backend, then prepared into renderer-owned resources after extraction.
- No central mutable scene graph was introduced. The small `scene` object in the
  example only holds handles and counters for status publication.
- Playwright now validates JSON-safe status, three built-in material families,
  draw counts, animation progress, and visible non-clear pixels for all three
  material regions.

## Corrective Work During Audit

- The app-facade visual layout changed the CSS-space cube positions, so the
  Playwright region sampler was tightened to the actual material bands. This
  keeps the pixel assertion focused on rendered cube pixels rather than stale
  direct-renderer positions.

## Follow-Ups

- Keep a small audit/refactor task after the next few material-route changes,
  because the app route still has narrow mixed-family paths instead of a generic
  material-family queue.
- Add coverage for StandardMaterial texture dependencies before treating mixed
  StandardMaterial frames as broader PBR coverage.
