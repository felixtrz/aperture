# Bevy Bridge Package Audit — 2026-05-16

## Scope

This audit followed the implementation of typed asset collections, the
renderer-independent render asset preparation contract, runtime spawn helpers,
and the first `createWebGpuApp` facade.

## Reference Anchors

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- Bevy `crates/bevy_asset/src/assets.rs`
- Bevy `crates/bevy_render/src/render_asset.rs`
- Bevy `crates/bevy_mesh/src/components.rs`

## Findings

- Package direction still matches the architecture:
  - `@aperture-engine/simulation` imports no Aperture packages.
  - `@aperture-engine/render` imports simulation only.
  - `@aperture-engine/runtime` imports simulation and render only.
  - `@aperture-engine/core` re-exports simulation, render, and runtime.
  - `@aperture-engine/webgpu` imports simulation and render only; it does not
    import runtime or core.
- Render authoring still uses ECS `Mesh` and `Material` components with stable
  handles. No `MeshRenderer` component or scene-node source of truth was
  reintroduced.
- `createWebGpuApp` initializes WebGPU and consumes extracted snapshots/render
  world state. It does not query gameplay ECS from backend code after
  extraction, and it does not introduce a public mutable scene graph.
- Typed asset collections remain headless-safe and backed by `AssetRegistry`.
- The render asset preparation contract is renderer-independent and exposes
  prepared metadata/stores without raw WebGPU handles.

## Validation

- `pnpm run check` passed.

## Follow-Up

No corrective follow-up is required from this audit. Continue with the
StandardMaterial proof-point contract next.
