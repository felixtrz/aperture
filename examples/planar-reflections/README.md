# Section lofts and planar reflections

A worker-authored ECS scene with a faceted skiff, an arched canopy, daylight and
real scene reflections. Two distinct props use `mesh.loft()`; semantic parts
remain editable. No image textures or imported models are used.

A continuous `mesh.tube()` mooring line and endpoint-aligned
`mesh.extrudeBetween()` braces demonstrate connected parts without manual Euler
alignment. See [architectural recipes](../../docs/CONNECTED_PARTS.md) for short
roof tiles and matching arch boundaries.

```sh
pnpm build
pnpm exec vite examples/planar-reflections --config examples/planar-reflections/vite.config.ts
aperture headless examples/planar-reflections/aperture.headless.config.ts --out /tmp/reflections.bundle.json --asset-mode strict --render-width 960 --render-height 720
aperture render /tmp/reflections.bundle.json --backend dawn --adapter software --out /tmp/reflections.png
```

Read [the agent workflow](../../docs/AGENT_VISUAL_WORKFLOW.md) for the geometry
contract, lighting recipe, portable imports, limitations and iteration sequence.
`src/props.ts` contains reusable section profiles; `aperture.config.ts` enables
the mirrored scene view. Camera frustum culling is disabled to retain offscreen
reflectors. Rendering never mutates simulation state.

The landing rock uses `mesh.icosphere` with zero subdivisions, demonstrating a
closed faceted primitive through the same browser and portable Dawn paths.

Two additional pure geometry recipes are available for authoring other scenes:
[fitted roof courses and caps](ROOF.md) and [closed, branch-oriented foliage](FOLIAGE.md).
They return mesh descriptors; your systems supply layout, materials and ECS entities.
