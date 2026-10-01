---
"@aperture-engine/cli": patch
---

Correct the sample cube's inward triangle winding in the game and glb-viewer
scaffolds and their checked-in example assets. Preserve the GLB's positions,
material, and node transform while making its exterior front-facing under
back-face culling.
