---
"@aperture-engine/render": patch
---

Remove the unused renderer-independent debug-normal and matcap material
preparation factory exports. Live material preparation for these materials is
covered by the WebGPU material GPU preparation path.
