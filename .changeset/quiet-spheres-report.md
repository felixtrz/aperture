---
"@aperture-engine/app": patch
"@aperture-engine/render": patch
---

Report unsupported sphere options before mesh generation. The app facade and
raw sphere descriptors accept `radius` and `segments`; the direct render
factory accepts `label`, `radius`, `widthSegments`, and `heightSegments`.
Diagnostics list the accepted options for each API while preserving existing
defaults, numeric normalization, and mesh output for supported options.
