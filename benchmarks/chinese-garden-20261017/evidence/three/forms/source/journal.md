# Three.js authoring journal

- startAt: 2026-10-17T03:19:42Z
- 03:19:42 UTC: Started independent Three.js WebGPU authoring; reading protocol and reference.
- 03:23:21 UTC: Initial capture passed native WebGPU verification (first attempt). Roof/wall-cap/paver authored triangle winding made those front-sided surfaces disappear; changing procedural material sides resolves the author's geometry issue. Main architecture and vegetation present.
- Initial image is too flat and bright. Refining illumination, camera breathing room and pond treatment next. Three.js built and rendered promptly; native WebGPU fallback explicitly disabled using renderer._getFallback = null because WebGPURenderer defaults to allowing WebGL.
