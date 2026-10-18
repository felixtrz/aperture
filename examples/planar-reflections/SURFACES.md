# Restrained surface color variation

`surface-variation.wgsl` is an optional standard-material extension for static
plaster, stone and cloth. It multiplies the existing **linear** `baseColor` by
0.94–1.06 using broad, irregular world-space cells. The result adds modest
polygonal color variation to otherwise uniform surfaces. It does not add mesh
facets, displacement, folds, chips or a changed silhouette; author those in the
geometry first.

The hook returns every other surface field unchanged. Normals, roughness,
metallic and emissive values stay authored, while Aperture continues to supply
PBR lighting, IBL, shadows, fog and tone mapping. It adds no normal-map noise,
specular sparkle, textures, bindings, time input or random simulation state.

## Attach it to selected materials

Import the portable compiled artifact in your ECS system. This recipe is
optional; the planar-reflections scene does not apply it automatically.

```ts
import { material, type ShaderArtifact } from "@aperture-engine/app/systems";
import surfaceShader from "../surface-variation.shader.json" with { type: "json" };

const plaster = material.standard({
  baseColor: [0.68, 0.42, 0.17, 1], // Linear RGB, as for any standard material.
  roughness: 0.95,
  metallic: 0,
  extension: {
    shader: surfaceShader as ShaderArtifact,
    surface: "surfaceVariation",
    parameters: [0, 0, 0, 0], // Required by the contract; unused by this recipe.
  },
});

this.spawn.mesh({
  key: "wall",
  mesh: wallMesh,
  material: plaster,
  castShadow: true,
  receiveShadow: true,
});
```

Keep any existing sRGB-to-linear palette conversion in the application. Do not
convert the color again in the hook or replace it with a procedural palette.
Alpha is unchanged. The example has one surface hook; a material that already
has one needs deliberate composition in WGSL, rather than a second `extension`
field. Leave water, glass, foliage and metals on their own materials.

## Edit constants and rebuild

`SURFACE_CELL_SIZE` is a positive distance in world units, not a frequency or
an object-relative scale. `SURFACE_CONTRAST` is the maximum fractional change to
linear albedo. The checked-in defaults are `0.5` and `0.06`; these starting
points assume roughly one world unit per meter:

| Surface      | Cell size | Contrast  | Suggested authored roughness |
| ------------ | --------- | --------- | ---------------------------- |
| Plaster      | 0.4–0.8   | 0.03–0.06 | 0.85–1.0                     |
| Stone        | 0.2–0.5   | 0.03–0.06 | 0.8–1.0                      |
| Static cloth | 0.3–0.7   | 0.02–0.04 | 0.9–1.0                      |

These are authoring suggestions, not material presets or runtime modes. For
different constants on separate materials, copy the WGSL under another name,
edit its constants and compile a separate artifact. Keep the contrast modest:
large differences turn the cells into a distracting mosaic. Preserve sensible
linear albedo headroom rather than clipping bright cells in the shader.

From the repository root, using the built public CLI:

```sh
node packages/cli/dist/bin/aperture.js shader build \
  examples/planar-reflections/surface-variation.wgsl \
  --out examples/planar-reflections/src/surface-variation.shader.json
node packages/cli/dist/bin/aperture.js shader inspect \
  examples/planar-reflections/src/surface-variation.shader.json
```

In an installed app use `aperture shader build` with the same arguments. The
compiler emits a portable, deterministic library artifact without entry points
or bindings. Both the browser worker and strict headless bundle consume that
same JSON; neither needs a runtime compiler. CPU compilation checks artifact
structure and reflection; a native frame also validates the assembled WGSL on
the device. The contract is documented in
[`docs/SHADER_MATERIALS.md`](../../docs/SHADER_MATERIALS.md).

## Scale and scope

The pattern is anchored to world coordinates. Scaling or moving a mesh changes
which cells it intersects, so it is suitable for static architecture and a
fixed cloth canopy, not a moving character's clothing. Adjacent meshes share
the field, and all orientations use the same 3D construction without projection
seams. Very large world coordinates can lose floating-point detail. Cells
smaller than a few screen pixels can alias; choose a larger world cell size or
remove the extension in distant views. The 27 candidate cells also add fragment
work, so use it selectively and check your target device.

Keep lighting, camera and geometry fixed when comparing it with the unextended
material. Inspect the full frame as well as a wall crop: the treatment should
support the existing form and palette. It cannot correct a weak silhouette,
missing construction detail, flat lighting or inaccurate scene proportions.
