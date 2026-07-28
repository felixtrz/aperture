---
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
"@aperture-engine/reference-assets": minor
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/vite-plugin": patch
---

Add source-faithful imported-model lighting ergonomics: a neutral studio HDR,
ECS light-rig and environment spawning, named material appearance presets,
lighting-health reports, accurate executable IBL readiness, and headless/headed
`asset_inspect` and `render_diagnose` tooling. New game and GLB-viewer projects
use the offline studio profile with ACES, exposure, sRGB output, and 4x MSAA.
Generated Vite apps prebundle the linked engine entries as one graph so ECS
component singletons are not duplicated during fresh dev-session startup.
