---
"@aperture-engine/webgpu": patch
---

Honor type-2 contact-hardening shadows for a single directional shadow map, including the directional owner in supported directional-plus-point scenes. Search blocker depths and use a bounded, bilinearly reconstructed disk filter whose radius grows with receiver–blocker separation. The orthographic radius response is independent of near/far origin and light-distance translations. Preserve hard and weighted-PCF modes, spot/point/cascade behavior, and existing depth bias.
