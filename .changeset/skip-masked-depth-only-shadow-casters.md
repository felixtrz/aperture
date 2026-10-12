---
"@aperture-engine/webgpu": patch
---

Skip canonical alpha-masked materials in depth-only shadow caster planning and report the existing unsupported-cutout diagnostic instead of casting their entire geometry as an opaque silhouette.
