# @aperture-engine/ui

Flexbox UI for the Aperture engine.

This package brings Aperture's UI to feature parity with in-scene UI libraries
such as `pmndrs/uikit`, while keeping Aperture's structural advantages
(WebGPU-native rendering, ECS authoring, worker-safe + deterministic layout, and
a renderer-independent snapshot boundary).

It provides:

- A **Yoga**-backed flexbox `LayoutEngine` with a retained, entity-keyed node
  tree, dirty-gated incremental relayout, and a `freeze` capability for static
  UI (a game-oriented feature in-scene UI libraries lack).
- A renderer-independent **layout style** model (the full flexbox property set:
  grow/shrink/basis, wrap, justify/align, gap, per-side padding/margin, inset,
  min/max sizing, percentages, aspect ratio, overflow).
- A bridge from Yoga measure functions to Aperture's deterministic MSDF text
  layout, so content-driven sizing (`width: auto`, wrapping, `aspectRatio`)
  works for text leaves.

See `docs/UI_PACKAGE_PLAN.md` for the full design and roadmap.

## Status

Under active development. The layout engine and style model are available; SDF
borders, text input, scrollbars, conditional/responsive styling, and prebuilt
kits land in subsequent milestones.

## Determinism

Yoga's layout is deterministic for a single pinned WASM build. UI layout is
downstream of the simulation (it does not feed the deterministic sim hash), so
replays on the same build are exact.
