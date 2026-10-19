---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": patch
---

Add informational directional-light geometry to lighting health reports: resolved
world and camera-relative directions, elevation, viewing-axis alignment and
horizontal-ground shadow displacement per unit height. Reports expose invalid
inputs explicitly and refresh when light or camera transforms change, without
changing rendering defaults, warnings or quality acceptance.
Keep material compatibility analysis cached independently when camera or light
motion refreshes the directional evidence.
