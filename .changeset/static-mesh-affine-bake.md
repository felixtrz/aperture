---
"@aperture-engine/render": patch
---

Add an owned, validated affine bake for static triangle-list mesh assets that preserves compatible indexed layouts for existing mesh merging. Correct normals, tangent bases, mirrored winding and bounds without mutating source buffers. Accept packed Float32Array positions, normals and UVs, plus explicit tangents, in the existing triangle-list factory and app descriptor.
