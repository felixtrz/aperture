---
"@aperture-engine/webgpu": patch
---

Prepare constant sun, ambient, shadow and base-color UV rotation terms in the vertex stage for the admitted opaque sun/ambient render plan. Flat varyings preserve their values while avoiding repeated fragment calculations; numeric updates and general-layout fallback keep their existing behavior.
