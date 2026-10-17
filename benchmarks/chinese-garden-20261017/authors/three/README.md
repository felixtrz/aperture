# Three.js Chinese garden

Procedural 1200 × 900 Chinese garden diorama authored with Three.js 0.186.1 and its native WebGPURenderer. No image textures, imported scene assets, image generation, or WebGL rendering are used. All geometry is authored in `src/main.js` with a deterministic random seed and fixed orthographic camera.

The scene includes a raised masonry base, plaster boundary walls and open circular moon gate, curved pavilion roof and timber lattice, stone stairs and furniture, arched bridge, reflective jade pond, pines, bamboo, faceted hollow scholar rocks, low planting, paving, gravel, and lotus pads/flowers.

Rendering uses ACES tone mapping, a shadowed warm directional sun, hemisphere fill, native planar water reflection, GTAO, denoising and FXAA. The renderer's automatic WebGL fallback is explicitly disabled. Completion is signalled only after scene rendering and `device.queue.onSubmittedWorkDone()`.

## Reproduction

From `/workspace/aperture`, the only approved capture route is:

```sh
node benchmarks/chinese-garden-20261017/shared/capture.mjs three reproduce
```

The frozen trial has used all six capture attempts. Its immutable evidence and capture cap must be retained; reproduction should be performed as a coordinator-managed fresh trial. Do not launch a browser directly. The shared harness handles Vite build, serialized browser access, native WebGPU verification, screenshots and cleanup.

Final retained image: `../../evidence/three/final/render.png`.
Final proof: `../../evidence/three/final/report.json`.

## Friction and limitations

- The first hand-authored roof and paving had reversed triangle winding; making the procedural surfaces double-sided corrected the author's geometry issue.
- Three.js r186 retains the PCFSoftShadowMap constant but its WebGPU filter was removed. The final scene uses supported PCFShadowMap filtering.
- GTAO with inherited multisampled scene depth produced invalid WGSL (`textureGather` on `texture_depth_multisampled_2d`) in the third capture. Explicit `samples: 0` on the scene pass, with FXAA after tone mapping, resolved this without engine changes.
- Native reflection and denoised AO worked after that correction. Final verification reports no errors and zero WebGL attempts.
- Composition and landmark proportions approximate the reference. Pines, plant clusters and roof panels retain a more geometric treatment; some stonework near the pavilion is crowded.

See `journal.md` and `result.json` for the frozen authoring record.
