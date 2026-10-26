---
"@aperture-engine/webgpu": patch
"@aperture-engine/render": patch
"@aperture-engine/math": patch
---

Draw the highest-`priority` procedural sky when several match a view (ties
keep extraction order) instead of the first one, and document
`ProceduralSkyInput` fields — notably that `horizonPosition` is mostly a
screen-space height. Document that `hexColor()` does not linearize sRGB.
