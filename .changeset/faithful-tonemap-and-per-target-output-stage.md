---
"@aperture-engine/webgpu": patch
---

fix(webgpu): faithful AgX and Neutral tonemap operators (AI-90)

The shared output-stage `agx` and `neutral` tonemap operators now match their
three.js references. `agx` gains the `LINEAR_SRGB↔LINEAR_REC2020` transforms,
the AgX inset/outset matrices, and the final 2.2 power (previously only the
contrast polynomial ran, leaving highlights oversaturated); `neutral` gains the
Khronos PBR-neutral low-end black offset and the hue-preserving desaturation
mix. A new Dawn numeric gate (`pnpm run test:tonemap-numeric`) evaluates the
operator WGSL on the GPU and pins the reference values.
