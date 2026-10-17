# WGSL materials in an ECS app

Keep scene and material state in simulation. Compiled shader artifacts, parameter
values and buffer bytes are data assets that cross the worker boundary. The
renderer owns shader modules, pipelines and GPU allocations.

## Extend the standard material

A standard extension retains Aperture lighting, IBL, fog and tone mapping. It can
provide three named WGSL hooks, declared using the public
`STANDARD_MATERIAL_EXTENSION_WGSL` contract from `@aperture-engine/render`:

```wgsl
struct ApertureVertex { position: vec3f, normal: vec3f };
struct ApertureSurface {
  baseColor: vec3f, normal: vec3f, metallic: f32,
  roughness: f32, emissive: vec3f
};
```

Hook signatures are:

```wgsl
fn deform(v: ApertureVertex, uv: vec2f, p: vec4f) -> ApertureVertex;
fn surface(s: ApertureSurface, uv: vec2f, worldPosition: vec3f, p: vec4f)
  -> ApertureSurface;
fn opacity(uv: vec2f, p: vec4f) -> f32;
```

Compile a library containing the structures and hook implementations. A library
has no entry points or bindings. Use `// @import` for shared helpers. The
`examples/material-shaders` build script writes the public contract and compiles
the example into JSON so Node headless extraction and the browser worker consume
the identical artifact:

```sh
pnpm build
node scripts/build-material-example.mjs
pnpm exec vite examples/material-shaders --config examples/material-shaders/vite.config.ts
```

In a system, pass the compiled artifact to `material.standard()`:

```ts
const descriptor = material.standard({
  baseColor: [0.7, 0.8, 0.9, 1],
  roughness: 0.35,
  metallic: 0,
  extension: {
    shader: artifact,
    surface: "surface",
    deform: "deform",
    parameters: [phase, amplitude, paletteOffset, 0],
    previousParameters: [previousPhase, previousAmplitude, paletteOffset, 0],
  },
});
this.spawn.mesh({
  mesh: mesh.sphere(),
  material: descriptor,
  castShadow: true,
  receiveShadow: true,
});
```

For procedural cutout, supply `opacity` and author `alphaMode: 'mask'` plus a
cutoff through the standard material asset's render state. The complete example
registers `createStandardMaterialAsset()` with `this.assetsRegistry` and updates
its parameter vectors using `markReady(handle, nextAsset)` each simulation step.
Updating values reuses the pipeline. Keep `previousParameters` from the previous
simulation step when motion vectors are required; omission means no parameter
motion. Object and camera previous transforms remain engine-owned.

The engine uses the same deformation and opacity hooks in color, shadow/depth,
picking and motion variants. Return a correctly transformed normal from the
vertex hook. Author mesh bounds large enough to contain the entire deformation;
CPU visibility and shadow fitting use the ECS-authored bounds. Keep the daylight
environment, a shadow-casting sun and receiver, ACES, 4x MSAA and subtle bloom for
ordinary app rendering.

The initial extension contract supports rigid meshes and a fixed four-float
parameter vector. Skinning/morphing, alpha blending, deformation combined with
tangent-space normal textures, and textured alpha cutout report unsupported
variants. Opacity requires mask mode. Engine motion attachments currently require
single-sample rendering and a scene without sprite/sky packets; the existing
motion report identifies unsupported routes. The native motion regression uses
that supported route while the visual example uses the normal HDR/MSAA baseline.

## Fully authored materials

`createArtifactMaterialAsset()` adapts a compiled shader to the existing custom
material asset route. Supply explicit vertex/fragment entry points, render state,
resource declarations, one interleaved `vertexLayout`, and `enginePasses`:

```ts
const asset = createArtifactMaterialAsset({
  familyKey: "my-app/surface",
  label: "Custom surface",
  artifact,
  entryPoints: { vertex: "vs", fragment: "fs" },
  vertexLayout: {
    arrayStride: 32,
    stepMode: "vertex",
    attributes: [{ shaderLocation: 5, offset: 0, format: "float32x3" }],
  },
  enginePasses: {
    color: true,
    shadow: "none",
    picking: "none",
    motion: "none",
  },
  bindings: [
    {
      name: "parameters",
      binding: 0,
      kind: "uniform-buffer",
      visibility: ["fragment"],
      fields: {
        tint: { type: "vec3", default: [0.2, 0.4, 0.6] },
        alpha: { type: "float32", default: 1 },
      },
    },
  ],
});
```

The artifact must declare the corresponding binding at group 2. Group 0 binding
0 is the engine view uniform; group 1 binding 0 is read-only world transforms.
Reflection validates entries, binding kinds, visibility, access, textures,
samplers and uniform field types. Reflected byte offsets determine packing,
independently of JavaScript property order. The vertex stream must match the
specified stride, offsets and formats; locations may be remapped. Flat scalar,
float-vector and mat4 uniforms are supported by the custom-material adapter.
Use a source-buffer asset for more complex storage data.

Fully authored color shaders explicitly opt out of generated visibility in v1.
Set `castShadow: false`; requesting their shadow, picking or motion variants
produces a specific diagnostic. Use standard extensions for consistent generated
engine passes. The existing `material.customWgsl()` inline source and shader-asset
forms remain supported, including runtime uniforms, textures, samplers and
instance attributes. They retain their existing contract.

`createSourceBufferAsset(bytes)` and `createBufferHandle(id)` provide portable
storage inputs. Register the bytes in the source asset registry and reference the
handle in a `storage-buffer` declaration's `buffer` field. Version changes upload
new contents on the renderer's device. GPU objects and callbacks cannot enter the
worker asset payload.

## App passes and verification

Use `app.addGpuResource()`, `addRenderPass()` and `addComputePass()` for additional
renderer-owned work. Declare reads and every attachment explicitly. Both forward
and post-processing graphs resolve arbitrary targets, MRT, depth, MSAA resolve
and `id@previous`/`id@current` history. `ctx.view()`/`ctx.buffer()` enforce declared
access. `resetGpuHistory()` drains GPU work and clears owned history. Raw imports
use `importGpuBuffer()`/`importGpuTexture()` with an explicit device and completion
promise; ownership stays with the caller. `encode(ctx)` remains local and is never
serialized into a bundle.

`pnpm test:dawn` exercises actual color, cutout, pick IDs, changed ground shadows,
previous-deformation motion vectors, storage assets and both app graph routes.
The browser verifier checks the complete worker app and control events. The
shader workbench verifies imported-error locations and keeps its last valid
pipeline after a failed replacement.
