---
"@aperture-engine/webgpu": patch
---

Reuse shadow pipeline resources for repeated specialization keys within one
creation request, including calls without an external cache. Preserve each
material's descriptor and uniform binding while avoiding repeated shader,
layout, and pipeline creation for the same key. Creation counts now reflect
unique resources, and reuse counts include reuse within the current call.
