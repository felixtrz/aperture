---
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/cli": patch
"@aperture-engine/shader": patch
---

Add explicit generated-app frame capture and renderer snapshot capture with GPU completion and a presentation hold through readback. Restore prior simulation cadence on release and defer canvas resize while a capture is held. Preserve SSAO in portable render bundles, expose rendering phase timings, and accelerate validated typed-array decoding with platform base64 APIs while retaining the portable fallback.
