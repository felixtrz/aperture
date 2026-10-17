# Three.js authoring journal

- startAt: 2026-10-17T03:19:42Z
- 03:19:42 UTC: Started independent Three.js WebGPU authoring; reading protocol and reference.
- 03:23:21 UTC: Initial capture passed native WebGPU verification (first attempt). Roof/wall-cap/paver authored triangle winding made those front-sided surfaces disappear; changing procedural material sides resolves the author's geometry issue. Main architecture and vegetation present.
- Initial image is too flat and bright. Refining illumination, camera breathing room and pond treatment next. Three.js built and rendered promptly; native WebGPU fallback explicitly disabled using renderer._getFallback = null because WebGPURenderer defaults to allowing WebGL.
- 03:25:23 UTC: Second capture `forms` passed. Queue wait was 74.6 seconds; while queued, read Three.js native reflector and AO APIs. Roof/caps/paving now visible.
- Raising the camera, enlarging the pond, making stone bridge parapets more solid, adding moss beds, and introducing native planar reflection plus GTAO/denoise. Three.js r186 has removed PCFSoftShadowMap filtering; changed to supported PCFShadowMap with radius rather than the old constant.
- 03:27:24 UTC: Third capture failed at the verification gate. GTAO generated textureGather(texture_depth_multisampled_2d, ...) WGSL, which WebGPU rejects. No screenshot was produced. Workaround: explicitly set scene pass samples:0 and use FXAA after tone mapping. Native planar reflection itself produced no reported validation error. No framework or shared files modified.
