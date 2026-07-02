---
"@aperture-engine/app": minor
"@aperture-engine/particles": minor
"@aperture-engine/render": minor
"@aperture-engine/runtime": minor
"@aperture-engine/ui": minor
"@aperture-engine/cli": patch
---

Introduce a provisional app feature resolver with deterministic dependency
ordering, rollback, reverse-order disposal, and typed diagnostics. Wrap app
physics installation in that resolver while preserving existing `physics`
config sugar and headless CLI/MCP flows. Add `features` config support for
worker-safe feature descriptors.

Add `@aperture-engine/particles` as the pure particle-domain package and move
`ParticleSimulationSpace` plus `ParticleEmitterInput` behind compatibility
exports from render, runtime, and app system barrels. Add
`@aperture-engine/particles/app` with a structural `particlesFeature()`
descriptor for app composition.

Move the UI DOM input bridge behind `@aperture-engine/ui/browser` so the UI root
entry remains headless-clean for worker and CLI/MCP composition. Add
`@aperture-engine/ui/app` with a structural `uiFeature()` descriptor for app
composition.
