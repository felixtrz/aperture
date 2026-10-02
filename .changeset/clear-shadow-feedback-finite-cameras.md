---
"@aperture-engine/render": patch
"@aperture-engine/webgpu": patch
"@aperture-engine/app": patch
"@aperture-engine/cli": patch
---

Preserve successful shadow warnings and caster identities through renderer and CLI status, with compact per-pass requested, included, ready, encoded, and actually submitted draw counts. Cached shadow maps report zero new submissions. Reject non-finite camera projection values and non-positive aspect for both projection kinds using field-specific authoring diagnostics before spawn, extraction, or ray construction.
