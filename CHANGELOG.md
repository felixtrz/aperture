# Changelog

## 0.3.0

Prepare the Aperture 0.3.0 fixed-package release. Highlights include the Node-native headless route and render bundle loop, provisional feature composition, particle/UI package foundations, Shuriken-style particle modules, issue #59-#76 fixes, packed-engine validation hardening, and regenerated reference assets.

## 0.1.0 — Initial public release

First public release of Aperture: a WebGPU-only, ECS-native 3D runtime where the
simulation is authoritative and rendering is a derived view. All
`@aperture-engine/*` packages are versioned in lockstep at `0.1.0`.

Highlights:

- **Simulation** (`@aperture-engine/simulation`) — ECS world, assets, transforms.
- **Render** (`@aperture-engine/render`) — authoring components, extraction, and
  the per-frame `RenderSnapshot` contract.
- **WebGPU backend** (`@aperture-engine/webgpu`) — materials (unlit, standard,
  matcap, custom WGSL), shadows (CSM), image-based lighting, area lights,
  post-processing, picking, sprites, text, UI, and GPU particles.
- **Audio** (`@aperture-engine/audio`) — main-thread Web Audio realization of the
  authoritative simulation: pooled spatial voice graph, submix buses, ducking,
  streaming music, and a full autoplay/suspend/resume lifecycle.
- **Physics** (`@aperture-engine/physics`, `@aperture-engine/physics-rapier`).
- **Runtime / App / CLI / Vite plugin** — the metaframework, project scaffolding,
  and worker-system discovery for building games.
