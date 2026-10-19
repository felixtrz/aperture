# Fitted profile props

A utility vehicle and an instrument housing built with public app/ECS APIs. Both
use the same small [profile/panel recipe](src/panels.ts); the vehicle adds real
wheel-well recesses and independently tapered cabin sections. Copy the helpers
with your own dimensions and section arrays. The models are worked authoring
examples, not packaged vehicle assets.

Start with [the concise profile guide](../../docs/FITTED_PROP_PROFILES.md).
[vehicle.ts](src/vehicle.ts) exposes its measured example inputs near the top;
[housing.ts](src/housing.ts) shows a shorter nonvehicle use. Each fitted window
shares its precise boundary with the surrounding painted surface. The example
keeps the standard worker/main split, linear material colors, daylight IBL,
shadow-casting sun, shadow receiver, subtle AO/bloom and 4x MSAA.

From the repository root after building packages:

```sh
node node_modules/vite/bin/vite.js build examples/fitted-props \
  --config examples/fitted-props/vite.config.ts

node packages/cli/dist/bin/aperture.js headless \
  examples/fitted-props/aperture.headless.config.ts \
  --out /tmp/fitted-props.bundle.json --render-width 1200 --render-height 900 \
  --asset-mode strict
node packages/cli/dist/bin/aperture.js render /tmp/fitted-props.bundle.json \
  --backend dawn --out /tmp/fitted-props.png
```

Dawn needs a provisioned adapter; see [the Dawn runbook](../../docs/DAWN_NODE_RENDERING.md).
Cloud browser captures must use the approved `render:cloud` / `runVerifiedScene`
lifecycle in [the cloud runbook](../../docs/CLOUD_LOCAL_RENDERING.md).

Run the focused topology, normal, window-boundary and wheel-clearance checks:

```sh
pnpm exec vitest run test/mesh/fitted-props.test.ts
```
