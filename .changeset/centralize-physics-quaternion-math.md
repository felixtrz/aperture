---
"@aperture-engine/physics": patch
"@aperture-engine/physics-rapier": patch
"@aperture-engine/app": patch
---

Centralize physics quaternion normalization, multiplication, vector rotation,
and slerp helpers in `@aperture-engine/physics`, then route Rapier integration,
the test backend, ECS sync, and app physics interpolation through the shared
degenerate-quaternion policy.
