---
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
---

Add opt-in, bounded inspection of submitted static triangle meshes through the
browser app and WebGPU app facades. Results contain detached source positions,
normals and indices together with all submitted world and instance matrices.
Exact upload receipts preserve partial updates and explicitly report unavailable
or unsupported geometry without exposing mutable source registries.
