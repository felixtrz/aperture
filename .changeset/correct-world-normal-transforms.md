---
"@aperture-engine/webgpu": patch
---

Correct world-space normals under nonuniform scale and shear, preserve normal-map tangent handedness under mirrored transforms, and use finite fallbacks for singular matrices. Standard, matcap, and debug-normal materials share the correction without changing render snapshot or buffer bindings.
