# Aperture Chinese garden

A deterministic, real 3D garden authored with the current Aperture 0.3.0 app facade. A discovered setup system runs in the generated simulation worker, creates ECS entities and procedural assets, and presents through extracted render snapshots. Geometry is grouped into material meshes; no images, imported scene meshes, or reference textures are used.

The scene includes a concave tiled pavilion roof, timber posts and geometric rails, stone podium and stairs, a circular opening cut through an extruded plaster wall, arched stone bridge, jade pool, jointed bamboo, two pines, scholar rocks, shrubs, stepping stones, and three lotus flowers. Lighting uses a warm shadowed sun, the default environment, ACES, SSAO, and subtle bloom. Static demand cadence avoids unnecessary continuous rendering.

## Retained final

- Capture label: `framed`
- Image: `../../evidence/aperture/framed/render.png`
- Verification: `../../evidence/aperture/framed/report.json`
- Capture timing: `../../evidence/aperture/framed/timing.json`
- Scene source: `src/systems/setup.system.ts`
- Canvas: 1200 × 900, deterministic fixed orthographic camera

## Reproduction

From `/workspace/aperture`, with the frozen benchmark dependencies and built Aperture packages:

```sh
node benchmarks/chinese-garden-20261017/shared/capture.mjs aperture reproduction
```

Use the approved shared capture entry point only. All six capture attempts for this trial are retained, so the command above requires a fresh capture allocation managed by the benchmark coordinator; the existing trial ledger deliberately rejects a seventh capture. The final source is also snapshotted alongside the image.

Build without launching a browser:

```sh
node node_modules/vite/bin/vite.js build benchmarks/chinese-garden-20261017/authors/aperture --config benchmarks/chinese-garden-20261017/authors/aperture/vite.config.mjs --outDir dist --emptyOutDir
```

The readiness script waits for a successful real rendered frame and the approved harness's GPU-completion hook before publishing `__APERTURE_RENDER_STATUS__`.

## Limits and friction

No engine blockers or modifications. The water is opaque stylized PBR with subtle real geometry wavelets; it does not reflect surrounding scene geometry. Foliage and rock detail, courtyard proportions, and roof detailing approximate the reference. Native triangle-list generation and polygon extrusion with holes were useful. Discovering a generated-app completion signal required reading the status/diagnostics APIs. Most iteration corrected authored geometry winding, a coplanar water/base overlap, and composition. Continuous-mode captures took roughly 81–89 seconds; demand-mode captures took 8–11 seconds, but scene revisions mean this is not a controlled performance comparison.
