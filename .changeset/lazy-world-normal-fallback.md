---
"@aperture-engine/webgpu": patch
---

Defer world-normal fallback normalization until the cofactor normal is unusable. Standard, matcap, and debug-normal shaders preserve nonuniform scale, shear, mirrored transforms, and finite singular-matrix fallbacks without changing render snapshot or buffer bindings.
