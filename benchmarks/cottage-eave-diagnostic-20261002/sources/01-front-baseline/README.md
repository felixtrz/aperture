# Aperture procedural cottage, revision 2

The single allowed self-review revision. Initial author source and parent immutable copies remain unchanged. This revised source has not been rendered by the author.

## Serve contract

Serve this complete directory at `/` or a path prefix. Serve the pinned engine's `/packages/` and `/node_modules/` at the same origin. Delegate `/worker-modules/` to `createExamplesRequestHandler(repoRoot)` exported by the engine's `scripts/serve-examples.mjs`; it performs the official native-worker import rewriting. No bundling, build or installation is required. Serve MJS as `text/javascript`, with consistent COOP `same-origin` and COEP `require-corp` headers.

Entrypoint: `index.html?view=front&edit=base`. Views: `front`, `rear`, `side`. Edits: `base`, `roof`, `bench`, `trees`. Each is a genuinely rebuilt procedural scene with a fixed camera. Capture 800 x 800, DPR 1, only through the approved `pnpm run render:cloud` / `runVerifiedScene` route. Ready global: `__COTTAGE_READY__`.

## Changes after the author's own first render

Camera and target moved together down 0.90 world Y. Base thickness is 1.05 with top Y=0. The neutral backdrop follows the underside. The house, window and path assembly moved by [-0.38, 0, -0.95]. Both tiered trees are 4.30 high, at X/Z [-3.18,-1.22] and [3.13,-1.15]. Bench center is [2.75,0,2.13], base seat width 2.20. Side walls end at the facades' inner surfaces. Front and rear facades are continuous native polygon extrusions; the front has a true doorway notch and a separate inset-window hole. This removes overlapping coplanar front panels.

A custom neutral daylight ambient fill and a higher directional sun replace default IBL, controlling shaded-side contrast while retaining physically lit standard materials. PCSS, a six-texel filter, lower shadow opacity and smaller bias soften shadows. The sun is higher to reduce long shadows. Cream and orange material colors are warmer. ACES, MSAA and subtle bloom remain.

## Editable geometry and reports

`part-data.mjs` exports `buildCottage({view,edit})` and `cottageReport({view,edit})`; they run without browser, writes or engine dependencies. The returned parts are native box, triangle-list or polygon-extrusion descriptions with deterministic world bounds. `cottage-scene.mjs` creates each one as an authoritative app-facade ECS entity in the simulation worker. Main-thread readiness requires its authored report plus a successfully submitted WebGPU frame.

Runtime exports: `__COTTAGE_PARTS__` is the worker's final report, `__COTTAGE_SPEC__` is the main thread's deterministic report, and `__COTTAGE_READY__` includes counts, native backend identity, diagnostics and shadow data. Public parameters and opening bounds are world-space; native mesh coordinates remain local to their reported centers.

The roof edit scales the rise above fixed eaves by 1.30. Roof halves, fitted gables and wall tops are rebuilt. Eave X/Y and depth remain fixed. Bench edit multiplies seat/back-slat widths by 1.25 while keeping leg/support attachment insets. Tree edit shifts the left/right assemblies by -0.60/+0.60 on world X. All four path slabs, trunk/crown parts, seat/back slats and four legs are real separate geometry. No image textures, downloaded meshes, animation or random geometry are used.
