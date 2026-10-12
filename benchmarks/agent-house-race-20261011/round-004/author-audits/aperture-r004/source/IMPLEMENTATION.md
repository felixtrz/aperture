# Mediterranean house scene

The scene is authored during initialization of an Aperture simulation-worker ECS system. The normal generated worker, extraction snapshot, source-asset mirror and native WebGPU renderer remain in use. The application uses manual cadence and exposes the required benchmark adapter; no animation loop runs after registration.

The geometry contains a two-story ivory stucco house with full-depth window and door openings, inset dark-framed window panes, interior curtain and pot shapes, a panelled door, porch lamp, two porch posts, steps, tiled gable and porch roofs, gutters, downpipes, and a capped chimney. Individually curved clay tile shells overlap along both roof slopes. The garden includes layered stone-block walls and gate piers, a rounded mailbox, stone paving, potted plants, shrubs, olive leaf blades, cypress trees, grass and lavender. A triangulated curved asphalt ribbon has two sidewalks, curbs and broken center markings. The blue hatchback includes a contoured body, cabin glazing, pillars, hatch roof, mirrors, door seams and handles, grille, lights, trim, four tires, and alloy wheels with spokes. Distant triangulated hills provide a restrained background.

All visible geometry is published as ordinary static source meshes from the worker, batched by material. Seed 94173 gives deterministic scene generation. Repeated parts are submitted as real triangles. Source textures for stucco, stone, asphalt, lawn and clay use deterministic generated pixel arrays. Tangent streams are authored for the normal-mapped surfaces. ACES, exposure 1, 4x MSAA, pixel ratio 1, the native default environment, a warm shadow-casting directional sun, ambient fill and shadow receivers are configured.

The adapter updates the actual worker camera through semantic requests. renderFrame awaits the requested worker extraction and native submission, without an added queue fence. inspectGeometry derives owned position, normal and actual world/instance matrix arrays from the public inspectRenderedGeometry API, retaining the actual submitted ranges. Disposal releases the generated app and worker.

Validation:
- pnpm run build succeeds and produces /work/dist.
- Two fresh headless processes extract 53 mesh draws with zero extraction diagnostics.
- All 53 materials and all generated texture assets validate.
- Both fresh processes produce geometry digest 7a046bba04e653c5def32232f250d614a24dc6540164d3de58188e99c4dcbd12.
- Authored source geometry contains 368927 triangles, 1106781 vertices and 35813232 vertex-stream bytes.
- Previews 1 and 2 completed native rendering and geometry preflight successfully.
- Preview 3 was blocked by the coordinator's disk-capacity error. The final surface textures, foliage refinements, hatchback proportions, tangents and road placement therefore have local initialization/extraction and build validation but no final canvas preview.

The scene is a detailed stylized reconstruction rather than a photoreal replica. The landscape is simplified, glass is opaque reflective PBR, and the visible roof tiles and vegetation are explicit geometry rather than imported assets.
