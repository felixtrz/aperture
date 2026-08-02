---
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
"@aperture-engine/particles": minor
"@aperture-engine/render": minor
"@aperture-engine/simulation": minor
"@aperture-engine/webgpu": minor
---

Restore the shipped 0.3.0 vendored engine delta into the repository. Particles:
per-burst `colorTint`/`sizeScale`/`speedScale`/`lifetimeScale` overrides,
`playbackTime` scrubbing, quarks-exact cone/point direction mode, post-tonemap
render stage for unlit VFX, texture-sheet random-between-two-curves frames,
sphere/mesh-impostor render modes, and global additive burst batching with
frozen-timeline reuse (no simulation or upload at `timeScale = 0`). Render:
packed snapshot codecs widened for the burst/tint payloads plus a packed
runtime-uniform codec so SharedArrayBuffer transport carries full frames.
Simulation: `defineComponent` is idempotent by id (structural schema equality;
schema changes get an explicit restart diagnostic) and `Enabled` state is
inherited through authoritative `Parent` chains for all packet types and
spatial indexing. CLI: headless configs load through a short-lived Vite SSR
module graph so long-lived MCP hosts observe app edits without a restart, and
the Node PNG decoder accepts indexed (color type 3) images at every legal bit
depth with `PLTE`/`tRNS` support.
