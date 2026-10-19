---
"@aperture-engine/gpu": patch
"@aperture-engine/webgpu": patch
---

Use standard render-pass timestamp descriptors for optional GPU profiling, including graph shadows, instead of obsolete command-encoder timestamp writes. Preserve measured zero durations, diagnose unavailable or invalid readbacks, release readback leases, and disclose partial pass coverage without implying whole-frame GPU time.
