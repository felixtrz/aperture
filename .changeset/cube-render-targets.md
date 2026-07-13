---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Cube render targets + scene-capture camera (parity plan B2) — the analog of
three.js `CubeCamera` + `WebGLCubeRenderTarget`.
`this.renderTargets.register({ id, size, dimension: "cube" })` registers a
square six-face cube target; a camera paired with it becomes a cube-capture
camera whose scheduled captures emit six 90-degree face views
(`ViewPacket.renderTargetFace`, world-axis aligned at the camera position),
each rendered into its own cube layer with per-face clear/load semantics.
Capture cost is opt-in and scheduled: `spawn.camera({ renderTarget, capture:
{ every: N } })` captures every N extracted frames (0 = on-demand only; a
never-captured probe always primes once), `this.renderTargets.capture(id)`
arms a one-shot capture, and the frame report exposes the cost as per-face
`renderTargets[].face` submissions plus `renderTargetCaptures` entries with a
cumulative `captureGeneration`. The captured cube feeds IBL through
`prepareWebGpuAppEnvironmentAssets` via the new `renderTargetSource` input:
the realized cube is prefiltered directly (irradiance + PMREM sample with a
`sourceFlipX` variant that unmirrors the capture's proper-winding X-mirror,
the three.js `flipEnvMap` convention), every completed capture re-versions
the derived resources (re-prefilter + eviction of superseded textures), and
the environment asset reports not-ready until the first capture completes.
Frames containing cube-capture faces select each target's own packed
view-uniform record before its submission, so the six faces and the main
camera render with their own matrices; frames without captures are untouched.
Direct `material.texture(...)` sampling of a cube target is rejected with
`webGpuApp.renderTargetCubeBindingUnsupported` (texture bindings are 2d-only)
— consume the probe as an environment map instead. Ships
`examples/reflective-probe` (mirror sphere reflecting a moving scene through
a periodically re-captured probe) with pixel-level e2e coverage of the
capture cadence and reflection motion.
