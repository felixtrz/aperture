# Procedural car with fitted surfaces

A public app/ECS/worker example using `mesh.polygons()` for a tapered body with
integrated window surrounds. No imported model, texture, Three.js renderer or
browser-only geometry API is needed. Paint and opaque glass partition a closed
surface; wheels and fixtures remain separate physical parts.

The reusable recipe is [src/car.ts](src/car.ts). The complete authoring guide is
[Polygon surface authoring](../../docs/POLYGON_SURFACE_AUTHORING.md).

From the repository root after building packages:

```sh
node node_modules/vite/bin/vite.js build examples/procedural-car \
  --config examples/procedural-car/vite.config.ts

node packages/cli/dist/bin/aperture.js headless \
  examples/procedural-car/aperture.headless.config.ts \
  --out /tmp/car.bundle.json --render-width 1200 --render-height 900 \
  --asset-mode strict
node packages/cli/dist/bin/aperture.js render /tmp/car.bundle.json \
  --backend dawn --out /tmp/car.png
```

Dawn needs a provisioned adapter/driver; see the repository's Dawn runbook.
In the managed cloud environment, use the required `render:cloud` /
`runVerifiedScene` lifecycle wrapper for browser captures. The generated browser
app supports explicit frame capture at time zero and demand rendering.

The example uses flat geometry, linear material colors, daylight environment,
sun shadows, subtle AO/bloom and 4x MSAA. Geometry, materials and lighting can be
changed independently. This recipe demonstrates the fitted construction workflow;
it is not a claim of parity with every Three.js modeling or rendering feature.
