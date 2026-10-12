---
"@aperture-engine/app": minor
---

Add typed color.srgbHex and color.linear helpers to the systems facade, with
explicit sRGB transfer, unchanged alpha, and actionable invalid-input diagnostics.
Allow CSS hex baseColor inputs in material.standard and material.unlit while
preserving linear numeric descriptors and low-level render contracts.
