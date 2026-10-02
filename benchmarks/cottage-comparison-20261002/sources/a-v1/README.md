# Aperture procedural cottage

Initial independent source submission. Engine/library files are unchanged. No render has been run by this author.

## Serve contract

Serve this directory at `/` (or a path prefix) and serve the pinned engine repository's `/packages/` and `/node_modules/` at the same origin. Delegate `/worker-modules/` to `createExamplesRequestHandler(repoRoot)` exported by the engine's `scripts/serve-examples.mjs`. That official handler rewrites package imports for native workers. These source files themselves require no bundling, build, Vite server or package installation. Set JS/MJS MIME to `text/javascript`. Use consistent COOP `same-origin` and COEP `require-corp` headers on HTML and assets.

Entrypoint: `index.html?view=front&edit=base`. Allowed views: `front`, `rear`, `side`. Allowed edits: `base`, `roof`, `bench`, `trees`. Invalid values fail explicitly. Each load constructs its own deterministic scene. Render at 800 × 800, DPR 1, only via the approved `pnpm run render:cloud` / `runVerifiedScene` route. Readiness global: `__COTTAGE_READY__`.

## Authoring and independent checks

`part-data.mjs` is an engine-independent authored parameter/geometry specification. `buildCottage({view,edit})` returns all editable mesh parts plus an analytic bounds/parameter report. `cottageReport` returns the report directly and can be imported in Node without producing files or launching a browser. `cottage-scene.mjs` translates every part into a native app-facade ECS mesh entity. The authoritative scene is created inside `worker.mjs`; `main.mjs` handles the renderer and only publishes readiness after a submitted successful WebGPU frame and the worker's authored report arrive.

Runtime exports: `__COTTAGE_PARTS__` is the report emitted by the worker after spawning; `__COTTAGE_SPEC__` is the same deterministic specification on the main thread; `__COTTAGE_READY__` includes the final render counts, diagnostics, shadow report and authored report.

The roof's rise above the fixed eave height is multiplied by 1.30. Both roof slopes and fitted gables are rebuilt from parameters. Eave height, eave X and roof depth stay fixed. Bench seat and back slat widths are multiplied by 1.25, with support rails, rear uprights and all four legs moved to preserve the same attachment inset. The trees edit offsets left and right tree assemblies by −0.60 and +0.60 world X. All path slabs, crown tiers, trunk facets, bench slats and wall sections are separate real geometry. The doorway is a wall opening into a modeled room. The blue pane sits behind a real window opening.

Flat-faceted crowns and trunks use explicit triangle lists with computed face normals. Roof and gables use closed polygon extrusions. No bitmap textures, reference-image surfaces, downloaded meshes, animation or random geometry are used. A large neutral matte floor receives genuine light/shadows and fills the background; default daylight IBL, a directional sun, ACES and a subtle bloom supply the lit baseline.
