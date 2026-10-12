---
"@aperture-engine/webgpu": patch
---

Resolve single-shadow owner parameters together before directional sampling and
pass the resolved strength through the sampler. Preserve the existing clustered
spot helper contract, shadow settings and fallback values.
