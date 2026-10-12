---
"@aperture-engine/webgpu": patch
---

Fix StandardMaterial motion-vector shader compilation by removing entry-only IO attributes from the internal color helper while preserving builtin inputs on the public fragment entry and forwarding their named values. Fragment signature parsing now respects nested attributes, parameter types and comments.
