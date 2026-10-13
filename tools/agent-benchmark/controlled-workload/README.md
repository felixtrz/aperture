# Controlled renderer workload

This new version compares two adapters over the same indexed geometry, normal
and UV streams, texture pixels, material factors and independent transforms. It
diagnoses renderer costs separately from the independent authoring competition;
historical rounds remain unchanged.

The common scene is a small town square with four buildings, roofs, windows,
columns, fountain, crates, trees and low-relief terrain. Both engines may reuse
geometry/materials and instance repeated props. Aperture keeps simulation, ECS
and extraction on its real worker; Three.js uses `WebGPURenderer` and public
`InstancedMesh`. Inspections read the renderer's actual retained arrays/matrices.
View-frustum culling is disabled on both so the individual ECS entities and
Three's grouped instances submit equal main-scene instance coverage.

The recipe matches fairness-v2: 1024×768, DPR 1, 4× MSAA, ACES exposure 1, a
constant ambient fill, a single warm sun, solid sky, no IBL or optional effects.
The sun uses one 2048² PCF map with fixed 38-unit coverage. Both engines reuse
static shadows after the first frame. Shadow bias sign follows each backend's
convention; public radius/strength/bias match, but PCF shader samples and BRDF
implementations can differ. Review images and actual native submitted coverage
before reporting an engine advantage. Sources being equal is necessary, not
sufficient, evidence.

Variants are declared before timing, with no selection by outcome:

| Variant          | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `baseline`       | Balanced shared opaque town-square scene with static shadows   |
| `no-shadows`     | Same geometry, materials and camera with shadows disabled      |
| `no-textures`    | Same geometry and camera with albedo texture sampling disabled |
| `dense-geometry` | Increased curved tessellation and terrain density              |
| `many-objects`   | Increased repeated prop counts                                 |
| `many-materials` | Increased distinct standard materials                          |

CPU-only preparation requires already built Aperture packages and an existing
Three.js package. It does not install dependencies, launch browsers, or measure
frames. Supply absolute paths and a new output directory outside scratch:

```sh
node tools/agent-benchmark/controlled-workload/prepare.mjs \
  /absolute/new-controlled-pair \
  /absolute/existing/three-package \
  baseline \
  /absolute/aperture-checkout
```

The equivalent API is
`prepareControlledWorkload({ outputRoot, apertureRoot, threeRoot, variant, build: true })`.
`build: false` prepares source and the canonical manifest without requiring
engine dependencies. It is intended for offline inspection and tests.

Preparation produces `canonical-manifest.json`, `provenance.json`, shared
`workload.json`, and `{aperture,three}/source`, `dist`, `build-inputs.json`, and
`resolved-inputs`. Exact used build inputs are retained by hash, including
worker modules. Both source trees contain identical canonical JSON and scene
generator bytes. The manifest hashes each typed geometry stream and texture,
as well as settings, transforms and material factors, and reports budgets.
`production-buffer-parity.json` additionally checks byte equality of actual
Aperture mesh-asset streams and Three `BufferGeometry` attributes and indices.
Both use the same compact index type. GPU upload and draw inspection is still
required; this offline check never initializes a GPU.

Run each generated `dist` through the existing `runAttemptV2` API or
`tools/agent-benchmark/run-v2.mjs` inside the established cleanup lifecycle.
Only that approved route should launch Chromium here. Root supervision owns
the runtime and serializes timing slots. Use all declared workload categories
for a broad conclusion, retain failed attempts, alternate engine order, and
report software SwiftShader results as such.
