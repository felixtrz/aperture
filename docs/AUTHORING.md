# Authoring Aperture Apps

The default Aperture app is a Vite app with an `aperture.config.ts` file and
worker-discovered ECS systems. The Vite plugin owns browser bootstrap, worker
bundling, asset preload, render extraction, snapshot transport, WebGPU
submission, resize, input forwarding, command forwarding, and diagnostics.

You should be able to see a primitive mesh or GLB without calling
`createWebGpuApp()`, `createExtractionApp()`, `stepAndExtract()`, posting render
snapshots, registering renderer-side assets, or writing a main-thread scene
graph.

## First App Shape

Normal browser apps use this shape:

- `vite.config.ts`: installs the Aperture Vite plugin.
- `aperture.config.ts`: declares mode, canvas, systems, assets, render defaults,
  input actions, signals, and diagnostics.
- `src/systems/*.system.ts`: default-export ECS system classes that run in the
  simulation worker.
- `index.html`: contains the configured canvas.

`index.ts` is not required for the first scene.

```html
<canvas id="aperture"></canvas>
```

## CLI Templates

`@aperture-engine/cli` can scaffold app roots without a separate create package:

```sh
npx @aperture-engine/cli create my-app
npx @aperture-engine/cli create viewer --template glb-viewer
npx @aperture-engine/cli create game --template game
```

Available templates:

- `minimal`: primitive cube, setup/spin systems, input action, signal, AI
  adapter files, and render quality defaults.
- `glb-viewer`: local `public/assets/sample-cube.glb`, blocking GLB asset
  manifest entry, setup system, orbit system, stable `viewer.sampleCube` key,
  and deterministic priorities.
- `game`: local GLB collectible asset, player movement input actions, score and
  goal signals, camera follow, collectible/goal state, and deterministic
  priorities.

Generated apps include `.mcp.json`, `.codex/config.toml`, Claude/Cursor/Copilot
adapter files, and scripts for `dev`, `build`, and `typecheck`.

## Vite Config

```ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [aperture()],
});
```

`@aperture-engine/vite-plugin` is the canonical plugin import. The root
`@aperture-engine/app` entry does not export the plugin because Vite plugin code
is Node/build-time code. `@aperture-engine/app/vite` re-exports the same plugin
as an optional convenience subpath, but this guide uses the canonical package.

## Aperture Config

```ts
import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
    decal: asset.texture("/assets/decal.png", { preload: "manual" }),
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: input.button([input.pointer("primary")]),
      jump: input.button([input.key("Space"), input.gamepadButton("south")]),
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
        }),
        input.gamepadStick("left"),
      ]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "warn",
  },
});
```

Asset preload policies:

- `blocking`: loaded before the first simulation tick.
- `background`: starts immediately and exposes readiness signals to systems.
- `manual`: registered in the manifest and loaded when a system or command
  requests it.

Headless apps use the same config shape with `mode: "headless"` and no canvas.
The same system files can run in browser and headless mode.

Generated browser apps default to 4x MSAA when `render.sampleCount` is omitted.
Use `sampleCount: 1` to opt out for performance-sensitive apps. Canvas backing
size follows device pixel ratio capped by `render.maxPixelRatio`, which defaults
to `2`; use `render.pixelRatio` when an app needs an exact fixed backing-scale
policy. Generated diagnostics report the CSS size, backing size, effective pixel
ratio, aspect ratio, and MSAA state.

## Setup System

Scene setup is ECS startup work in a worker system, not mutation of a
main-thread app object.

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });

    this.spawn.light({
      key: "light.key",
      name: "key-light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      tags: ["interactive", "crate"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      tags: ["asset", "robot"],
      transform: { translation: [1, 0, 0] },
    });
  }
}
```

`name` is a debugging label. `key` is optional app-authored identity when a
globally unique stable lookup is useful. `tags` are optional discovery metadata
for tools and diagnostics. The canonical runtime identity remains
`{ index, generation }`.

## Primitive And GLB Spawning

Use `this.spawn.mesh(...)` for built-in primitives and
`this.spawn.gltf(...)` for config-declared GLB assets:

```ts
this.spawn.mesh({
  key: "level.floor",
  name: "floor",
  mesh: mesh.plane({ size: [6, 6] }),
  material: material.standard({ baseColor: [0.85, 0.88, 0.9, 1] }),
  transform: {
    rotationEulerDegrees: [-90, 0, 0],
  },
});

this.spawn.gltf(this.assets.gltf("robot"), {
  key: "level.robot",
  transform: { translation: [1, 0, 0] },
});
```

The high-level GLB path hides loader reports, source asset transfer packages,
renderer-side registration, primitive material resolution, ECS command planning,
and ECS replay. Systems consume typed config handles and the generated runtime
mirrors render assets to WebGPU.

Current primitive descriptors include:

- `mesh.box({ size })`
- `mesh.sphere({ radius, segments? })`
- `mesh.capsule({ radius, depth, segments? })`
- `mesh.plane({ size, subdivisions? })`
- `mesh.cylinder({ radius, depth, segments? })`
- `mesh.cone({ radius, depth, segments? })`

### Standard Material Options

`material.standard()` exposes the renderer's full factor set, so PBR extension
authoring does not require glTF import or low-level asset construction. Beyond
`baseColor`, `roughness`, `metallic`, and `emissiveFactor`, the options accept
the glTF `KHR_materials_*` extension factors and render-state control:

```ts
material.standard({
  baseColor: [0.42, 0.72, 1, 1],
  metallic: 0,
  roughness: 0.02,
  // KHR_materials_transmission / _volume / _ior
  transmissionFactor: 0.9,
  ior: 1.31,
  thickness: 0.4,
  attenuationColor: [0.9, 0.95, 1],
  attenuationDistance: 2.5,
  // KHR_materials_clearcoat
  clearcoatFactor: 0.6,
  clearcoatRoughnessFactor: 0.25,
  // KHR_materials_sheen
  sheenColorFactor: [0.2, 0.1, 0.05],
  sheenRoughnessFactor: 0.35,
  // KHR_materials_iridescence
  iridescenceFactor: 0.5,
  iridescenceIor: 1.8,
  iridescenceThicknessMinimum: 200,
  iridescenceThicknessMaximum: 600,
  // Texture-strength scalars
  normalScale: 0.8,
  occlusionStrength: 0.9,
  renderState: {
    alphaMode: "blend",
    depth: { test: true, write: false, compare: "less" },
    blend: { preset: "alpha" },
    cullMode: "none",
  },
});
```

A non-zero extension factor enables the matching shader variant exactly like
the glTF import route (`clearcoatFactor > 0` selects the clearcoat variant, and
so on). Runtime mutation through `this.materials.set(handle, patch)` accepts
the same fields; patches that stay inside the active variant (for example
`clearcoatFactor: 0.2 -> 0.8`) keep the pipeline key stable and never
recompile, while a patch that crosses a variant boundary (enabling a factor
from zero) pays one pipeline build on the next prepared frame. The
`transmission-app` example renders the transmission scene entirely through
these options.

## Prefabs

Prefabs are serialized `ApertureSceneDocument` blueprints. Author the source
subtree in an ECS world, serialize it with `saveScene(world)`, register the
document through `this.prefabs.register(document)`, then instantiate it with
`this.spawn.prefab(handle, options)`.

```ts
import { saveScene } from "@aperture-engine/simulation";

const document = saveScene(templateWorld);
const cratePrefab = this.prefabs.register(document, { id: "crate.prefab" });

this.spawn.prefab(cratePrefab, {
  key: "crate.instance.1",
  transform: { translation: [0, 0, 0] },
});
```

Prefab instances are ordinary ECS subtrees. Instance options can override the
root transform, and `overrides` can patch component fields by prefab-local id
without mutating the registered blueprint.

## Custom WGSL Materials

Generated browser apps can author a data-only custom WGSL material from config
assets and worker systems. Systems never create WebGPU objects; they declare
shader source, render state, binding layouts, and JSON-safe uniform values. The
main-thread WebGPU app mirrors the source assets, compiles WGSL, creates
renderer-owned buffers/bind groups/pipelines, and submits the final frame.

Declare path-loaded shader source in `aperture.config.ts`:

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    water: asset.shader("/shaders/water.wgsl", { preload: "blocking" }),
  },
});
```

Use the shader handle from a worker system:

```ts
import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

export default class WaterSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.mesh({
      key: "water",
      mesh: mesh.plane({ size: [6, 3] }),
      material: material.customWgsl({
        familyKey: "app/water",
        label: "Water",
        shader: shader.asset(this.assets.shader("water")),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: {
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
          alphaMode: "blend",
        },
        bindings: [
          material.uniform("water", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              color: { type: EcsType.Vec4, default: [0.02, 0.46, 0.9, 1] },
              time: { type: EcsType.Float32, default: 0 },
            },
            values: {
              color: [0.02, 0.46, 0.9, 1],
              time: 0,
            },
          }),
        ],
      }),
    });
  }
}
```

Inline WGSL is available for tests and small demos:

```ts
material.customWgsl({
  familyKey: "example/tint",
  label: "Inline Tint",
  shader: shader.inlineWgsl(WGSL, { virtualPath: "inline-tint.wgsl" }),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
});
```

V1 custom WGSL shaders use fixed renderer groups:

- `@group(0) @binding(0)`: view uniform, renderer-owned. The layout is
  `{ viewProjection: mat4x4f, cameraPosition: vec4f }`.
- `@group(1) @binding(0)`: read-only storage array of world transforms,
  renderer-owned. Index with `@builtin(instance_index)`.
- `@group(2)`: custom material bindings declared by `material.customWgsl(...)`.
- `@group(3)`: renderer-owned. Bound only for `lighting: "lit"` materials
  (the lit contract below); unlit materials must leave it untouched.

Mesh vertex locations follow the built-in instance layout: `@location(0)`
position (`vec3f`), `@location(1)` normal (`vec3f`), and `@location(2)` UV
(`vec2f`). Use `runtimeUniformKey` on a group-2 uniform binding when per-frame
values should come from `this.spawn.runtimeUniform(...)`.

### Lit custom materials

Declare `lighting: "lit"` to opt a custom material into the renderer-owned
lit contract (parity plan A1): the renderer binds `@group(3)` with the
frame's packed lights, the directional shadow receiver resources, the active
environment's IBL textures, and the fog parameters — the SAME renderer-owned
resources StandardMaterial consumes — and prepends a WGSL contract header to
your module, so the shader calls `aperture*` helpers with zero app-side GPU
wiring:

```ts
material.customWgsl({
  familyKey: "app/lit-surface",
  label: "Lit Surface",
  lighting: "lit",
  shader: shader.asset(this.assets.shader("litSurface")),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
});
```

```wgsl
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  let shadow = apertureDirectionalShadow(input.worldPosition, normal);
  var color = vec3f(0.0);

  for (var i = 0u; i < apertureCountLights(); i = i + 1u) {
    var term = apertureEvaluateLightSurface(
      i, input.worldPosition, normal, viewDir, albedo, metallic, roughness);
    if (apertureLightKind(i) == APERTURE_LIT_LIGHT_KIND_DIRECTIONAL) {
      term = term * shadow;
    }
    color = color + term;
  }

  color = color + apertureSampleIblIrradiance(normal) * albedo * (1.0 - metallic);
  color = apertureApplyFog(color, input.worldPosition, view.cameraPosition.xyz);
  return vec4f(apertureLinearToSrgb(color), 1.0);
}
```

Helpers (fragment stage, StandardMaterial math parity):
`apertureCountLights()`, `apertureEvaluateLight(index, worldPos, normal,
viewDir)` (white-dielectric convenience), `apertureEvaluateLightSurface(...,
baseColor, metallic, roughness)` (exact Lambert+GGX for ambient/directional/
point/spot; rect-area is a diffuse-only approximation),
`apertureDirectionalShadow(worldPos, normal)` (1.0 when the frame has no
directional shadow resources; all filter modes evaluate as 3x3 PCF in v1),
`apertureSampleIblIrradiance(normal)`, `apertureSampleIblSpecular(reflectDir,
roughness)`, `apertureEnvironmentBrdf(roughness, nDotV)` (split-sum
scale/bias), `apertureApplyFog(color, worldPos, cameraPos)`, and
`apertureLinearToSrgb(color)` (matches the StandardMaterial sRGB output
stage on default browser apps).

Rules and behavior:

- Your WGSL must NOT declare `@group(3)` — the renderer owns it and prepends
  the header (`customMaterialSource.litReservedBindGroup` rejects it) — and
  must not redeclare `aperture*` symbols.
- Bindings without a frame resource fall back to renderer-owned stand-ins
  (zeroed buffers, 1x1 black textures), so the same shader works with or
  without lights, shadows, or an environment; `apertureLitParams` counts and
  flags are authoritative.
- The pipeline key gains a `lit:v1` contract-version segment ONLY when
  `lighting: "lit"`; absent/`"unlit"` materials keep byte-identical keys and
  behavior. A future contract layout change bumps the version instead of
  colliding with cached pipelines (`DECISIONS.md` 0024).
- The full binding table lives in
  [`LIGHT_SHADER_WGSL_CONTRACT.md`](./LIGHT_SHADER_WGSL_CONTRACT.md). See
  `examples/lit-custom-material.html` for a lit custom sphere reproducing the
  StandardMaterial response next to a reference sphere.

### Storage-buffer bindings

Group-2 read-only storage bindings are backed by renderer-independent
`BufferAsset` sources (asset kind `"buffer"`): a typed element schema
(`f32`/`vec2f`/`vec4f`/`u32`/`i32`; `vec3f` is rejected because its WGSL
storage-array stride is 16 bytes, not 12 — use `vec4f`), an element count, and
optional initial typed-array data (absent data zero-initializes the GPU
buffer). Register one from a worker system with `this.buffers.register(...)`
and bind it with `material.storage(...)`:

```ts
export default class GrassSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const bendParams = this.buffers.register({
      id: "grass.bend",
      elementType: "vec4f",
      elementCount: 64,
      data: new Float32Array(64 * 4),
    });

    this.spawn.mesh({
      key: "grass",
      mesh: mesh.plane({ size: [0.1, 0.9] }),
      material: material.customWgsl({
        familyKey: "app/grass",
        label: "Grass",
        shader: shader.asset(this.assets.shader("grass")),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        bindings: [
          material.storage("bendParams", {
            binding: 0,
            visibility: ["vertex"],
            buffer: bendParams,
            runtimeBufferKey: "grass.bend",
          }),
        ],
      }),
    });
  }

  override update(_delta: number, time: number): void {
    // Dynamic ranges follow the RuntimeUniform pattern: keyed packets applied
    // renderer-side with queue.writeBuffer — zero pipeline rebuilds.
    this.spawn.runtimeBuffer({
      bufferKey: "grass.bend",
      values: computeBendValues(time), // flat element components
      elementOffset: 0, // in elements, not bytes
    });
  }
}
```

In WGSL the binding is an array of the element type, typically indexed by
`@builtin(instance_index)` alongside the group(1) world transforms:
`@group(2) @binding(0) var<storage, read> bendParams: array<vec4f>;`. The
buffer handle joins the material's asset dependencies, so readiness gating and
diagnostics behave like texture/sampler bindings. Re-registering the same
buffer id publishes a new source version (full re-upload); `runtimeBuffer`
packets update ranges of the existing GPU buffer without touching the asset.
When a storage binding declares `runtimeBufferKey` but no matching
`spawn.runtimeBuffer(...)` entity exists yet, the buffer simply keeps its
source-asset contents. See `examples/storage-buffer-grass.html` for a complete
instanced-grass field driven this way.

### Shadow-casting displacement

By default a custom-WGSL mesh casts shadows through the renderer's shared
position-only caster pipeline, so vertex displacement applied by your main
vertex entry does not reach the shadow map — the silhouette stays the
undisplaced mesh (the same gap three.js closes with
`customDepthMaterial`/`castShadowPositionNode`). Declare an optional
`entryPoints.shadowVertex` to opt the material into a per-material caster
pipeline whose vertex stage is compiled from the SAME WGSL module:

```ts
material.customWgsl({
  familyKey: "app/flag",
  label: "Wind Flag",
  shader: shader.asset(this.assets.shader("flag")),
  entryPoints: {
    vertex: "vs_main",
    fragment: "fs_main",
    shadowVertex: "shadow_vs",
  },
  bindings: [
    material.uniform("flagParams", {
      binding: 0,
      visibility: ["vertex"],
      fields: { time: { type: EcsType.Float32 } },
      runtimeUniformKey: "flag.time",
    }),
  ],
});
```

The shadow caster pass binds a different, documented contract (mirroring the
built-in position-only caster):

- `@group(0) @binding(0)`: uniform struct whose first member is the active
  shadow pass's light `viewProjection: mat4x4f` (one caster pass per
  directional cascade / point face / spot map).
- `@group(0) @binding(1)`: read-only storage array of caster world transforms
  (`array<mat4x4f>`), indexed with `@builtin(instance_index)`.
- `@group(1)`: reserved — the renderer binds it empty.
- `@group(2)`: the material's OWN bindings, exactly as in the main pass
  (uniform/texture/sampler/storage all resolve to the same GPU resources, so a
  `runtimeUniformKey` time value drives both passes with one write). Bindings
  the caster entry reads must include `"vertex"` visibility.
- Vertex input: `@location(0) position: vec3f` (the mesh POSITION stream only)
  plus `@builtin(instance_index)`; output is `@builtin(position) vec4f`. The
  pipeline is depth-only — no fragment stage runs.

Because the main pass uses `@group(0) @binding(0)` for the view uniform, your
module declares BOTH sets of bindings; that is valid WGSL as long as no single
entry point statically uses two variables on the same binding point. Keep the
displacement in a shared function so the silhouette matches the mesh:

```wgsl
fn displace(world: vec3f, time: f32) -> vec3f { /* shared wave */ }

@vertex fn vs_main(/* main contract */) -> VertexOutput { /* uses displace() */ }

@vertex
fn shadow_vs(
  @location(0) position: vec3f,
  @builtin(instance_index) i: u32,
) -> @builtin(position) vec4f {
  let world = shadowWorldTransforms[i] * vec4f(position, 1.0);
  return shadowPassMatrix.viewProjection * vec4f(displace(world.xyz, params.time), 1.0);
}
```

Materials without `shadowVertex` keep today's shared caster (byte-identical
pipeline keys, zero behavior change). Caster pipelines are cached per material
(create/reuse counters surface as `resourceReuse.customShadowCasterPipelines*`
and `report.shadow.resourceReuse.customWgslPipelines*`), and failures
(`customWgslMaterial.shadowCaster*` diagnostics — missing entry point, module
or pipeline creation errors) fall back to the shared position-only caster so
the mesh still casts an undisplaced shadow. Instance attributes are not
available to the caster entry point. See `examples/shadow-displacement.html`
for a wind-displaced flag whose shadow silhouette waves with the mesh.

### Multiple render targets (MRT)

A custom material may declare N color targets (parity plan B3), turning its
draw into a single-pass MRT write — the classic custom G-buffer. The
declaration is data-only: index = the fragment `@location`, target 0 is the
pass color the camera renders into (always the `"swapchain"` sentinel), and
every extra target pairs a facade render-target handle whose realized color
texture the frame attaches at that location:

```ts
const normalTarget = this.renderTargets.register({
  id: "gbuffer.normal",
  width: 256,
  height: 256,
  format: "rgba8unorm",
});
const idTarget = this.renderTargets.register({
  id: "gbuffer.id",
  width: 256,
  height: 256,
  format: "rgba8unorm",
});

material.customWgsl({
  familyKey: "app/gbuffer",
  label: "GBuffer Material",
  shader: { kind: "inline-wgsl", code: gbufferWgsl },
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
  colorTargets: [
    { format: "swapchain" }, // @location(0): the camera's own target
    { format: "rgba8unorm", renderTarget: normalTarget }, // @location(1)
    { format: "rgba8unorm", writeMask: "rgb", renderTarget: idTarget }, // @location(2)
  ],
  // ...bindings...
});
```

The fragment entry must output exactly `@location(0..N-1)` (typically a
struct return); mismatches between the outputs and the declaration are
rejected at validation with `customMaterialSource.colorTargetMismatch` —
before any pipeline exists, never as a device error. Each entry takes a
`format` (the render-target format set; `"swapchain"` resolves to the pass
color format) and an optional `writeMask` (`"all"` | `"rgb"` | `"alpha"` |
`"none"`). The `color-targets:` pipeline-key segment participates only when
declared, so materials without `colorTargets` keep byte-identical keys.

MRT semantics and constraints:

- **Camera pairing.** Render the material through a camera paired with a
  facade render target whose size matches the extra targets (all attachments
  of one pass share dimensions); scope its meshes to that camera with render
  layers. The extra targets clear to transparent black at the start of the
  MRT pass and always store.
- **One material family per pass.** A pass hosting MRT draws cannot mix in
  single-target pipelines (background, other materials); incompatible hosts
  render empty with `webGpuApp.customWgslColorTargetsPassIncompatible`. MRT
  materials run on the single-custom-material route — a scene mixing them
  with built-in materials is rejected with
  `webGpuApp.customWgslColorTargetsRouteUnsupported`.
- **Realization checks.** Extra targets must be registered, 2d,
  single-sample, and format-matched to their declaration
  (`webGpuApp.customWgslColorTarget*` diagnostics); MRT requires a
  single-sample app (no `{ msaa: 4 }`).
- **Consuming the targets.** Sample the extras like any facade render target
  (`material.texture(...)`), or read them from a user render pass that
  resolves them into scene color (see
  [User-pass render-target writes](#user-pass-render-target-writes)).

See `examples/gbuffer.html` for a complete custom G-buffer (albedo + normal +
object ID) resolved by a user pass into scene color.

Current limitations: WGSL only; no shader imports; no user-supplied WebGPU
objects or callbacks; and no arbitrary app-owned material adapter
registration. App-route custom WGSL supports group-2 uniform buffers,
read-only storage buffers, texture bindings, sampler bindings, existing
instance-attribute layouts, the opt-in group(3) lit contract
(`lighting: "lit"`), multi-target output declarations (`colorTargets`), and
mixed built-in/custom frames through the normal `createWebGpuApp()` path
(MRT materials excepted — they need the single-custom-material route).
Storage bindings are read-only in this slice (`access: "read"`); writable
storage arrives with the compute→draw plumbing (parity plan C1).

See [`recipes/custom-wgsl-material.md`](./recipes/custom-wgsl-material.md) for
a complete shader and material setup.

## Render Targets

Offscreen render targets are data-only source assets (parity plan B1): a
worker system registers one with `this.renderTargets.register(...)`, pairs a
camera with it, and samples its color texture from materials — no
`device.createTexture` or renderer objects in user code. The WebGPU backend
realizes (and owns) the GPU texture, keyed by handle + version.

```ts
class MinimapSystem extends createSystem({ priority: 0 }) {
  init(): void {
    const minimap = this.renderTargets.register({
      id: "minimap.rt",
      width: 256,
      height: 256,
      // format?: "swapchain" (default) | "rgba8unorm" | "bgra8unorm" | ...
      // msaa?: 1 (default) | 4    depth?: true    sampleable?: true
    });

    // Offscreen camera: LOWER priority renders before the main camera, so
    // materials sampling the target see this frame's content.
    this.spawn.camera({
      renderTarget: minimap, // or camera: { renderTargetId: "render-target:minimap.rt" }
      camera: { projection: "orthographic", priority: 0, layerMask: 1 },
      transform: { translation: [0, 20, 0], rotationEulerDegrees: [-90, 0, 0] },
    });
    this.spawn.camera({ camera: { priority: 1, layerMask: 1 | 2 } });

    // Sample the target's color texture: this.renderTargets.colorTexture(id)
    // returns a TextureHandle the renderer serves from the realized target.
    this.spawn.mesh({
      mesh: mesh.plane({ size: [1, 1] }),
      material: material.customWgsl({
        // ...shader with a texture binding at group(2)...
        bindings: [
          material.texture("minimapTexture", {
            binding: 0,
            visibility: ["fragment"],
            texture: this.renderTargets.colorTexture(minimap),
          }),
        ],
      }),
    });
  }
}
```

Key semantics:

- **Camera pairing.** `spawn.camera({ renderTarget })` accepts the handle or
  its id and fills `Camera.renderTargetId`. Views render in ascending camera
  `priority` order (ties by view id); give the offscreen camera a lower
  priority than any camera that samples its target, otherwise consumers see
  the previous frame's content (one-frame latency).
- **Sampling.** A texture handle whose id matches a registered render target
  resolves to the target's realized color texture — in custom-WGSL
  `material.texture(...)` bindings and in sprite `textureId` references. A
  texture source asset registered under the same id keeps precedence.
  Registering with `sampleable: false` drops `TEXTURE_BINDING` usage and
  sampling surfaces `webGpuApp.renderTargetNotSampleable`. Exclude sampling
  meshes from the target's own camera via render layers — a pass may not
  sample the texture it is rendering into.
- **Resize.** `this.renderTargets.resize(handle, { width, height })`
  republishes the same handle at a new size (a version bump): the renderer
  destroys the old texture and creates the new one; camera pairings and
  texture bindings keep working untouched.
- **Format.** `"swapchain"` (the default) follows the canvas format. A
  concrete format that differs from the app pipeline format fails the frame
  with `webGpuApp.renderTargetFormatMismatch` (offscreen views render through
  the same forward pipelines as the canvas).
- **MSAA and depth.** MSAA is app-level: declare `msaa: 4` on the target AND
  create the app with `{ msaa: 4 }`; the renderer then renders the target's
  view into a per-target MSAA color texture that resolves into the sampleable
  color texture (declaring `msaa: 4` without app MSAA fails loudly with
  `webGpuApp.renderTargetMsaaUnavailable`). Depth is renderer-owned per
  target; `depth: false` is not supported yet and is rejected at
  registration.

See `examples/minimap.html` for the complete overhead-camera + HUD-quad
setup, and `examples/render-to-texture.html` for the low-level route (a
`createWebGpuAppRenderTargetAsset` wrapping an app-owned texture, which
remains supported).

### Cube capture probes

`dimension: "cube"` turns a render target into a six-face capture probe
(parity plan B2). A camera paired with a cube target becomes a cube-capture
camera: on every scheduled capture, extraction emits six 90-degree square
face views (world-axis aligned at the camera's position — the entity rotation
is ignored, like three.js `CubeCamera`), and the renderer draws each face
into its own cube layer. Between captures the camera emits nothing, so an
idle probe costs nothing.

```ts
class ProbeSystem extends createSystem({ priority: 0 }) {
  init(): void {
    const probe = this.renderTargets.register({
      id: "probe.env",
      size: 128, // cube targets are square: one size instead of width/height
      dimension: "cube",
    });

    // Capture the six faces every 8 frames; capture: { every: 0 } disables
    // the schedule so the probe only captures on demand.
    this.spawn.camera({
      renderTarget: probe,
      capture: { every: 8 },
      camera: { near: 0.1, far: 50, layerMask: 2, priority: 0 },
      transform: { translation: [0, 1, 0] },
    });
  }

  update(): void {
    if (somethingMovedALot) {
      // One-shot capture on the next extracted frame (idempotent per frame).
      this.renderTargets.capture("probe.env");
    }
  }
}
```

Capture semantics:

- **Scheduling.** `capture: { every: N }` (or `camera: { captureEvery: N }`)
  captures on frames where `frame % N === 0`; the first extracted frame
  always primes a never-captured probe. `every: 0` is on-demand only.
  `this.renderTargets.capture(id)` arms every camera paired with the cube
  target for a one-shot capture. The frame report exposes the cost: each face
  pass appears in `report.renderTargets` with a `face` index (0-5), and
  `report.renderTargetCaptures` carries one entry per completed capture with
  the cumulative `captureGeneration`.
- **IBL consumption.** The captured cube feeds image-based lighting through
  the environment-asset orchestration (renderer tier):
  `prepareWebGpuAppEnvironmentAssets({ assets: [{ handle, diffuseResourceKey,
specularResourceKey, renderTargetSource: { renderTarget: "probe.env" } }] })`
  prefilters the realized cube into the diffuse irradiance + specular PMREM
  resources a standard material's environment light samples. Every completed
  capture bumps the target's capture generation, which re-versions the
  derived resources (the prefilter re-runs and superseded textures are
  destroyed). The environment asset stays `ready: false` until the probe's
  first capture completes.
- **Limitations.** Cube targets must be square and reject `msaa: 4`. Plain
  `material.texture(...)` bindings are 2d-only, so sampling a cube target
  directly is rejected with `webGpuApp.renderTargetCubeBindingUnsupported` —
  consume it as an environment map instead. Capture frames render through the
  per-target (multi-submit) route; built-in materials (standard, unlit,
  matcap, debug-normal) render with correct per-face matrices, while custom
  WGSL draws inside captured layers keep the frame's first view record. The
  captured cube stores the X-mirrored environment (proper face winding); the
  IBL prefilter kernels compensate (`sourceFlipX`), so prefiltered lighting
  is canonical.

See `examples/reflective-probe.html` for a mirror sphere lit by a
periodically re-captured probe of a moving scene.

### User-pass render-target writes

User render passes (`app.addRenderPass`) may write facade render targets
directly (parity plan B3), lifting the old scene-color-only restriction. A
pass's `writes` declare its color targets in declaration order — each write
carries a clear/load intent, the attached targets always store, and no depth
attachment is made (facade depth buffers belong to camera passes). Reads of
facade target ids resolve to the realized sampleable views, and the declared
read/write edges order the pass inside the frame graph — after the camera
node that rendered a read target this frame, before any later pass that reads
what it wrote:

```js
app.addRenderPass({
  name: "gbuffer-resolve",
  reads: ["gbuffer.albedo", "gbuffer.normal", "gbuffer.id"],
  writes: [{ handle: "scene-color", attachment: "load" }],
  encode(ctx) {
    const albedo = ctx.view("gbuffer.albedo"); // realized facade texture view
    // ...bind + fullscreen draw...
  },
});
```

Writing user targets instead of scene-color:

```js
app.addRenderPass({
  name: "blur-horizontal",
  reads: ["ping"],
  writes: [{ handle: "pong", attachment: "clear" }],
  encode(ctx) {
    /* sample ping, write pong */
  },
});
```

Semantics and constraints:

- **Scene-color or own targets, not both.** A pass writes either
  `"scene-color"` (drawn over the presented scene with LOAD, depth-tested)
  or one or more facade target ids; mixing the two is rejected with
  `webgpu.userPass.renderWriteMixedSceneAndTargets`.
- **Ping-pong works across frames.** A pass that reads target A and writes
  target B this frame reads B's stored contents next frame after swapping —
  facade targets are persistent graph resources.
- **Multiple writes are MRT.** Declaring several facade targets attaches them
  in order (`@location(0..N-1)` in the pass's own pipelines); all attachments
  of one pass must share dimensions
  (`webgpu.userPass.renderWriteSizeMismatch`).
- **Failures are loud skips.** Unregistered/not-realized targets skip the
  pass with `webgpu.userPass.renderWriteTargetUnavailable`; unresolvable
  reads warn with `webgpu.userPass.readTargetUnavailable`. Write cycles among
  user passes are rejected at frame-graph compile with the graph's cycle
  diagnostic, and the legacy (non-frame-graph) route reports user passes as
  skipped exactly as before.

See `examples/gbuffer.html` for the complete G-buffer resolve recipe.

## Runtime Systems

Systems map to EliCS systems and can query ECS components directly.

```ts
import {
  EcsType,
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinCrateSystem extends createSystem({
  priority: 100,
  queries: {
    crates: {
      required: [Name, LocalTransform],
      where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
    },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {
  override update(_delta: number, time: number): void {
    const speed = this.config.speed.value;

    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * speed));
    }
  }
}
```

Lower numeric `priority` runs earlier. Omit it to default to `0`. `priority` is
static registration metadata from the `createSystem({ ... })` descriptor; it is
not a runtime signal and does not appear in `this.config`. Fields declared under
`config` become runtime signals such as `this.config.speed.value`. System
modules default-export the class; the generated worker registers discovered
systems in priority order. The main-thread generated bootstrap receives
serializable manifest metadata, not live system classes.

`this.queries.<name>.entities` is a `Set<Entity>`. Iterate it with `for...of`,
test membership with `.has(entity)`, and use `.size` for counts.

Use negative priorities only for very early setup, keep ordinary gameplay near
`0` to `100`, and reserve larger values for late reactions such as camera follow
or UI/status synchronization.

## System Context Facades

Inside a system, `this` exposes the whole authoring surface. Everything is typed
and discoverable by autocomplete — you rarely need to import the lower-level
runtime packages directly.

| Accessor                                       | What it gives you                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `this.spawn`                                   | spawn cameras, lights, meshes, GLB, prefabs, particles, fog/sky, runtime uniforms, and non-rendered physics bodies; `this.spawn.animation(entity)` controls glTF animation |
| `this.queries`                                 | the ECS queries declared in `createSystem({ queries })` (`.entities` is a `Set<Entity>`)                                                                                   |
| `this.config`                                  | runtime signal fields declared in `createSystem({ config })` (`this.config.speed.value`)                                                                                   |
| `this.actions`                                 | typed input actions (narrow on `.kind`); `this.keyboard` / `this.gamepads` give raw edges                                                                                  |
| `this.signals`                                 | app signals declared in `aperture.config.ts`                                                                                                                               |
| `this.resources`                               | typed ECS resource store for non-entity state (`defineResource` + `resource.*`)                                                                                            |
| `this.assets`                                  | config-declared asset handles, readiness signals, and manual requests                                                                                                      |
| `this.commands`                                | worker-owned command channels (`drain`, `requestAsset`)                                                                                                                    |
| `this.spatial`                                 | synchronous raycast / overlap / closest-point queries over ECS data                                                                                                        |
| `this.cameras`                                 | camera access (`this.cameras.main.rayFromPointer(...)`)                                                                                                                    |
| `this.physics`                                 | rigid-body facade — see [Physics](#physics)                                                                                                                                |
| `this.audio`                                   | spatial audio (`loop`, `playOneShot`, `clip`)                                                                                                                              |
| `this.particles` / `this.trails`               | particle emitters / motion trails                                                                                                                                          |
| `this.hierarchy`                               | parent/child relationships                                                                                                                                                 |
| `this.materials` / `this.meshes` / `this.gltf` | runtime material / mesh / glTF-instance access                                                                                                                             |
| `this.renderTargets`                           | offscreen render targets (`register`, `resize`, `colorTexture`, cube-capture `capture`) — see [Render Targets](#render-targets)                                            |
| `this.prefabs`                                 | register and instantiate prefab blueprints                                                                                                                                 |
| `this.interaction` / `this.html`               | pointer interaction state / DOM HTML bridge                                                                                                                                |
| `this.fixedStep`                               | register fixed-step tasks                                                                                                                                                  |
| `this.effects`                                 | lifecycle-owned signal effects (`this.effects.watch(...)`)                                                                                                                 |
| `this.diagnostics`                             | structured diagnostics (`info` / `warn` / `error`)                                                                                                                         |

## Physics

Enable the Rapier rigid-body backend in `aperture.config.ts`. Setting `physics`
also turns on the fixed-step clock that drives it:

```ts
export default defineApertureConfig({
  // ...
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  // or simply: physics: true
});
```

Author bodies inline on a spawned mesh, or spawn a non-rendered body with
`this.spawn.physics(...)`. You do **not** need to import
`@aperture-engine/physics`: the `physics` helper namespace from
`@aperture-engine/app/systems` builds the descriptors, and every `type`/`kind`
is a plain string union.

```ts
import {
  createSystem,
  mesh,
  material,
  physics,
} from "@aperture-engine/app/systems";

// A rendered dynamic body:
this.spawn.mesh({
  key: "crate",
  mesh: mesh.box({ size: [1, 1, 1] }),
  material: material.standard(),
  transform: { translation: [0, 4, 0] },
  physics: {
    rigidBody: { type: "dynamic" }, // "static" | "dynamic" | "kinematicPosition" | "kinematicVelocity"
    collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
  },
});

// A static floor with the equivalent helper form:
this.spawn.physics({
  key: "floor",
  physics: physics.body({
    rigidBody: { type: "static" },
    collider: { shape: { kind: "box", halfExtents: [10, 0.5, 10] } },
  }),
});
```

### Who owns the transform

Physics is authoritative for the pose of any body it simulates, and writes that
pose back into `LocalTransform` every fixed step. This has one important
consequence:

> **Do not move a physics body by writing `LocalTransform` directly — the
> writeback overwrites it the same frame, with no error.**

- **Dynamic** bodies are driven by forces/impulses/velocity and gravity. Read
  their pose from `LocalTransform`; nudge them with `this.physics.applyImpulse`,
  `setLinearVelocity`, etc.
- **Kinematic** bodies are driven by _you_. Move them with
  `this.physics.setKinematicTarget(entity, { translation })` (rotation is
  optional — omit it to keep the current orientation). Spawn them with
  `rigidBody: { type: "kinematicPosition" }` and a `kinematicTarget`.

### Character controller

Drive a kinematic character with `this.physics.moveCharacter`, then commit the
collision-resolved result back to the body:

```ts
const result = this.physics.moveCharacter({
  entity: serializeEntityRef(body),
  desiredTranslation: [dx, dy, dz], // this frame's intended displacement
  settings: { snapToGroundDistance: 0.5, maxSlopeClimbAngle: Math.PI / 4 },
});
if (result !== null) {
  this.physics.setKinematicTarget(body, {
    translation: result.targetTranslation,
  });
  // result.grounded / result.collisions are available for jump + contact logic
}
```

`snapToGroundDistance` must exceed the rest gap between the collider and the
floor or `grounded` never latches; a small constant downward "stick" velocity
while grounded keeps the controller engaged.

## Input, Signals, And Effects

Use lifecycle-owned effects for ECS mutation driven by signals. Do not use raw
Preact `effect()` for arbitrary microtask-time ECS writes.

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SelectSystem extends createSystem({
  priority: 50,
}) {
  override init(): void {
    const select = this.actions.select;
    if (select.kind !== "button") {
      return;
    }

    this.effects.watch(
      select.pressed,
      (pressed) => {
        if (!pressed) {
          return;
        }

        this.signals.gameplayMode.value = "select";
        this.diagnostics.info("select.pressed", {
          pointer: this.input.pointer.primary.position.value,
        });
      },
      { phase: "input" },
    );
  }
}
```

Effects registered in `init()` are disposed on system destroy and flushed in
explicit simulation phases: `input` before system updates, `update` after system
updates, and `postUpdate` after interaction processing. Input actions are
forwarded from the generated browser bootstrap into worker-owned signals before
system effects run.
Use `this.actions.jump.down()` for one-frame button presses, `this.actions.move.x`
and `this.actions.move.y` for axis2d actions, `this.keyboard.down("KeyP")` for
direct keyboard edges, and `this.gamepads.primary?.down("south")` for direct
standard gamepad reads. The Vite plugin writes `.aperture/generated/aperture-env.d.ts`
so configured `input.button`, `input.axis1d`, and `input.axis2d` actions receive
kind-specific system types.

## Spatial Queries

Spatial queries are synchronous helpers over ECS-owned data in the
logic/simulation context. Bounds raycasts use `this.spatial.setBounds(...)`;
exact visual mesh raycasts use `this.spatial.setMeshes(...)` with
renderer-independent CPU mesh data and an optional mesh BVH. Both paths return
canonical entity references, and gameplay systems do not await raycasts.

```ts
const ray = this.cameras.main.rayFromPointer(
  this.input.pointer.primary.position.value,
);

const hit = this.spatial.raycastFirst(ray, {
  source: "visual-mesh",
  fallback: "bounds",
  maxDistance: 20,
});

this.signals.selectedEntity.value = hit?.entity.ref ?? null;
```

Use spatial queries from systems; do not move picking state into the renderer as
the source of truth.

## Commands And Manual Assets

Commands are the worker-owned path for browser UI, tools, or MCP-style bridges
to request simulation work. Browser code dispatches a serializable command
event; the generated bootstrap forwards it to the worker.

```ts
window.dispatchEvent(
  new CustomEvent("aperture:command", {
    detail: {
      channel: "asset.request",
      payload: { assetId: "decal" },
    },
  }),
);
```

A system drains the channel and requests the manual asset:

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class AssetCommandSystem extends createSystem({
  priority: 75,
}) {
  override update(): void {
    for (const command of this.commands.drain<{ assetId?: unknown }>(
      "asset.request",
    )) {
      if (typeof command.assetId !== "string") {
        this.diagnostics.warn("command.assetRequest.invalid", {
          suggestedFix:
            "Send { assetId: 'decal' } on the asset.request command channel.",
        });
        continue;
      }

      void this.commands.requestAsset(command.assetId).then(() => {
        this.diagnostics.info("command.assetRequest.ready", {
          asset: command.assetId,
          ready: this.assets.readiness(command.assetId).value,
        });
      });
    }
  }
}
```

Runtime asset requests should be expressed through systems and commands. User
code should not touch loader reports, transfer packages, snapshot transport, or
renderer-side registration.

## Diagnostics And Entity Lookup

Generated browser, worker, and headless statuses are JSON-safe. Systems can
publish diagnostics with stable codes:

```ts
if (this.assets.gltf("robot").error.value) {
  this.diagnostics.error("asset.robot.failed", {
    asset: "robot",
    suggestedFix: "Check the URL in aperture.config.ts.",
  });
}
```

Entity summaries use ECS identity plus optional app metadata:

```ts
{
  entity: { index: 12, generation: 0 },
  key: "level.robot",
  name: "robot",
  tags: ["asset", "robot"],
  componentIds: ["Name", "LocalTransform", "Mesh"],
  source: { assetId: "robot", gltfNodeIndex: 0 }
}
```

Tools should use `{ index, generation }` for follow-up operations and rerun
entity lookup when a generation-mismatch diagnostic says the reference is
stale.

The generated browser bridge exposes the same inspection path through
JSON-safe command channels for developer panels and MCP-style tools:

- `aperture.devtools.entity.find`
- `aperture.devtools.entity.get`
- `aperture.devtools.entity.setComponent`
- `aperture.devtools.entity.snapshot`
- `aperture.devtools.entity.diff`

Those commands are handled inside the generated simulation worker before normal
system command queues. They read or mutate only worker-owned ECS state, and the
browser observes the result through generated status such as `entityTools` and
`lastFailure`.

## Headless Mode

Headless mode uses the same system authoring shape:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
});
```

Headless tests can step the app through advanced helpers without importing DOM,
canvas, `navigator.gpu`, or WebGPU presentation code.

Browser config asset URLs such as `/assets/robot.glb` are served by Vite or the
generated app host. In Node/headless tests, provide an `assetLoader` when those
URLs need to resolve, or mark the asset `preload: "manual"` and inject ready
source assets through `app.context.assetsRegistry`.

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

const app = await createApertureApp({
  config: defineApertureConfig({
    mode: "headless",
    assets: {
      robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    },
  }),
  assetLoader: {
    async load(assetHandle) {
      if (assetHandle.id !== "robot") {
        return;
      }

      // Load or register the test fixture, then mark the handle ready.
    },
  },
});
```

## Advanced APIs

Programmatic app creation, manual stepping, manual worker transport, direct
render snapshot inspection, source asset transfer packages, renderer-side
registration, custom render hosts, and custom WebGPU orchestration remain
available as advanced paths.

Use these only when you are building generated bootstrap internals, tests,
tools, render-only consumers, or nonstandard loops:

```ts
import { createApertureApp } from "@aperture-engine/app/advanced";
import { createExtractionApp } from "@aperture-engine/runtime";
import { createWebGpuApp } from "@aperture-engine/webgpu";
```

Start with [`ADVANCED_ORCHESTRATION.md`](./ADVANCED_ORCHESTRATION.md) when you
need the worker/main split, manual snapshot posting, source asset transfer
packages, or direct WebGPU presentation control.
