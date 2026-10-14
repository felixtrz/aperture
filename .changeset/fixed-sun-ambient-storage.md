---
"@aperture-engine/webgpu": patch
---

Use fixed storage array lengths for admitted opaque standard materials with one ambient light and one PCF sun. Preserve packed light data and lighting features, retain explicit binding layouts, and fall back to dynamic arrays when the scene or layout admission does not support the fixed contract.

On that route, evaluate the Schlick Fresnel fifth power using multiplication.
