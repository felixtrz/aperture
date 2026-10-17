# Street corner — Three.js WebGPU

Procedural recreation of the provided low-poly street-corner reference, authored with Three.js 0.186.1. The final verified capture is `finished` at `../../evidence/three/finished/render.png`.

The scene contains a three-storey cream corner café with two striped awnings, a sage-green bookshop, roof fittings, inset framed windows, a tiled sidewalk and raised base, L-shaped streets and zebra crossing, blue and mustard hatchbacks, two faceted trees, lamps, bench, café seating, chalkboard and planters. All geometry and shop lettering are authored procedurally. No imported meshes, image textures, reference billboard or image generation are used.

The fixed orthographic camera renders one still at 1200 × 900 and DPR 1. A seeded generator controls foliage and book variations. Lighting uses warm directional sunlight, hemisphere fill, supported PCF shadows and GTAO with denoising. The normal/depth prepass is single-sampled; the beauty pass retains MSAA. Denoising is materialized into its own texture pass, with a seeded noise texture. WebGPURenderer's automatic WebGL fallback is explicitly disabled. Readiness is set only after the verifier's GPU completion hook, and uncaptured GPU errors fail readiness.

From `/workspace/aperture`, reproduce using the approved route and an unused capture label:

```sh
node benchmarks/street-corner-20261017/shared/capture.mjs three reproduce
```

Five capture attempts were used: `first` passed; `refined` failed on multisampled GTAO depth; `ao-fixed` passed; `final` failed on inline denoise depth feedback; `finished` passed. The final proof reports native WebGPU, zero WebGL attempts and no GPU errors. Two additional standalone Vite builds were used for static validation. See `journal.md` for iterations and workarounds.

Known simplifications: café interiors are shallow silhouettes; foliage is a simple faceted canopy per tree; curb geometry is square; the road is a uniform material; shadows are more graphic than the softly rendered reference. No remaining execution blockers.
