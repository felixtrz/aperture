---
"@aperture-engine/app": patch
---

Stage mesh and material descriptor conversion before asset publication and
clean up failed mesh-spawn entities. Ordinary metadata, geometry, material,
transform, and physics input failures preserve existing registry assets and
allow corrected input to retry the same entity key. Keep explicit handle
sharing, named asset replacement, and ready assets for mesh query subscribers.
