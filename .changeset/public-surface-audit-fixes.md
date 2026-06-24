---
"@aperture-engine/app": patch
"@aperture-engine/webgpu": patch
"@aperture-engine/vite-plugin": patch
"@aperture-engine/cli": patch
---

Fix generated app production builds, document and expose app-level physics helpers,
preserve resource and physics worker summaries between full status frames, and
ship scaffolded apps with an inline favicon plus Vite pre-bundling defaults.
Stabilize hard-filter spot shadow sampling by using a direct depth comparison
for zero-radius shadow maps.
