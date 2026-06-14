---
"@aperture-engine/audio": minor
---

Add the `@aperture-engine/audio` package and the `audio-clip` asset kind — the
foundation of the spatial-audio subsystem. Ships the mockable `AudioBackend`
seam, a submix bus mixer (master `DynamicsCompressor` limiter + per-bus
`AnalyserNode` FFT taps) with click-free gain ramps, and the context lifecycle
(unlock/suspend/resume). Wired into the build, publish-readiness,
release-config, and package-boundary gates.
