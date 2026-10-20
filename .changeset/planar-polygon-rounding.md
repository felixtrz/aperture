---
"@aperture-engine/render": patch
---

Accept planar polygon faces whose small Float32 coordinate rounding exceeds the
ordinary coplanarity check, when bounded precision and orientation checks confirm
the source plane remains usable. Preserve authored vertex positions and reject
bent source faces, unstable rounding, and invalid boundary or hole topology.
