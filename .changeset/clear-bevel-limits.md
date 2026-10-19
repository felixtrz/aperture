---
"@aperture-engine/render": patch
"@aperture-engine/app": patch
---

Include the supplied numeric bevel, box dimensions and exclusive upper limit in
beveled-box validation errors. The facade and direct render constructor keep
their existing accepted inputs and generated geometry; invalid bevels are not
silently clamped.
