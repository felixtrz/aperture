---
"@aperture-engine/webgpu": patch
---

Share a typed standard render plan across shader generation, binding layouts and frame resources. Specialize ordinary lighting from the extracted light order, use explicit layouts for the supported sun/ambient path, and preserve general storage fallbacks when resource contracts require them.

Correct transmission bindings for shadow and environment lighting, and render its scene-color producer before HDR scene draws with matching attachments and owned resource lifetimes.

The render-plan implementation is experimental: controlled SwiftShader measurements did not establish a speed benefit over the prior shader specialization. Small-light uniforms remain disabled, and the measured shadow-facing shortcut was rejected.
