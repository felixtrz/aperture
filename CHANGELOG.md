# Changelog

## Unreleased

Agent-tooling hardening driven by a forensic audit of downstream AI-agent
sessions (see `docs/AGENT_STUMBLE_FIXES.md`):

- **math**: published declarations no longer reference an unshipped
  `kernel/storage.js` (consumers with `skipLibCheck: false` compile again);
  new checked tuple constructors `vec2Tuple`/`vec3Tuple`/`vec4Tuple`/
  `quatTuple`/`colorTuple`/`mat4Tuple` and the `Mat4Tuple` type.
- **cli**: `command_dispatch` parses JSON-string payloads into structured
  values with a `commandPayloadCoerced` diagnostic; `reference_*` MCP tools
  warm the corpus on demand (typed `aperture.reference.notWarmed` error,
  structured fallback diagnostics); `ecs_step` gains
  `untilQuiescent`/`maxFrames` with a deterministic quiescence report; new
  `viewport_pick` tool for deterministic bounds-ray picking; the MCP server
  advertises connect-time `instructions` describing the sanctioned loop.
- **webgpu**: shared-snapshot decoding no longer fails with
  `Unknown snapshot packet handle id` when a SharedArrayBuffer frame outpaces
  its registry message — frames decode with the newest registry and
  transient lag is skipped and reported via
  `webGpuApp.sharedSnapshotRegistryLag`.
- **cli**: `aperture render` / `frame_capture` run Chromium in new headless
  mode by default (verified byte-identical output to headed renders), so
  on-demand renders no longer pop a browser window;
  `APERTURE_RENDER_HEADLESS=0` forces a headed window for debugging.
- **review hardening** (adversarial Codex review of the above): registry
  epoch reset on worker restart (prefix-validated snapshots, no silent
  stale-registry decodes); typed `SnapshotPacketRegistryMissError` so packet
  corruption surfaces instead of being skipped as lag; `viewport_pick`
  honors the clamped viewport ∩ scissor rectangle
  (`aperture.headless.pickOutsideView`); headed
  `ecs_step { untilQuiescent }` returns
  `aperture.mcp.untilQuiescentHeadlessOnly` instead of silently stepping
  once; stale `aperture render` help text updated.

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
