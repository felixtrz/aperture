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

### Stencil (render state) — parity plan D1

Any material kind (built-in `standard`/`unlit`/`matcap`/`debug-normal` and
custom WGSL) can enable per-material stencil state through
`renderState.stencil`. It is the three.js `Material.stencilWrite` /
`stencilFunc` / `stencilRef` / `stencilFuncMask` / `stencilWriteMask` /
`stencilFail` / `stencilZFail` / `stencilZPass` surface. Build the sub-state
with `createStencilState` (ergonomic, three.js-shaped input; face shorthands
apply to both faces, `front`/`back` override per face, masks default to
`0xFFFFFFFF` and the reference to `0`):

```ts
import { createStencilState } from "@aperture-engine/render";

// A stencil MASK: stamp reference 1 wherever this draws.
material.unlit({
  renderState: {
    depth: { test: false, write: false, compare: "always" },
    stencil: createStencilState({
      compare: "always", // stencilFunc
      passOp: "replace", // stencilZPass — write the reference
      reference: 1, // stencilRef
    }),
  },
});

// Content revealed only where the mask wrote (stencilFunc "equal").
material.unlit({
  renderState: {
    stencil: createStencilState({ compare: "equal", reference: 1 }),
  },
});
```

Presence of `renderState.stencil` is the enable gate (like `stencilWrite:
true`); a material without it keeps byte-identical pipeline keys and the
depth-only attachment. The `stencil` state participates in the pipeline key as a
single sorted `stencil:…` feature token, so two materials that differ only in
stencil (including the reference) get distinct pipelines. `compare` reuses the
depth compare set (`always`/`equal`/`not-equal`/…); operations are `keep` /
`zero` / `replace` / `invert` / `increment-clamp` / `decrement-clamp` /
`increment-wrap` / `decrement-wrap`.

Order stencil draws with `withRenderOrder` (the opaque queue sorts by render
order before depth), so a mask writes before the content tests it in the same
pass. Two recipes ship as examples: `examples/stencil-portal` (a mask reveals a
scene view through a portal shape) and `examples/stencil-outline` (a mesh writes
stencil, a scaled copy draws only where stencil `!= ref`).

**Depth-stencil format is automatic.** WebGPU requires a pipeline's
`depthStencil.format` to match the pass's depth attachment. When _any_ material
in a frame enables stencil, Aperture selects the whole frame's scene depth
attachment as `depth24plus-stencil8` (and every pipeline in the pass follows);
frames with no stencil keep the depth-only `depth24plus` unchanged. The stencil
`reference` is applied at draw time via `setStencilReference`, so stencil frames
take the direct-encoder path (render bundles are skipped for them). Declaring
stencil on a target whose format has no stencil aspect raises the
`material.stencilRequiresStencilFormat` diagnostic and the pipeline is refused
rather than producing a device error.

## Clipping planes — parity plan D2

Aperture supports world-space clipping planes at two scopes, mirroring three.js:

- **Per-camera** (`renderer.clippingPlanes` analog): pass `clipPlanes` on the
  camera authoring input. `spawn.camera({ camera: { clipPlanes: [...] } })` (app)
  or `withCamera({ clipPlanes: [...] })` (runtime) attaches a `CameraClipPlanes`
  companion component. These planes apply to every draw the camera renders.
- **Per-material** (`Material.clippingPlanes` analog): set
  `renderState.clipPlanes` on any built-in material. They apply on top of the
  camera planes for draws using that material.

A plane is a world-space tuple `[nx, ny, nz, d]` with three.js `THREE.Plane`
semantics (`normal` = `(nx,ny,nz)`, `constant` = `d`): a fragment is **kept**
where `dot(worldPos, (nx,ny,nz)) + d >= 0` and discarded otherwise.

```ts
import { withCamera, withTransform } from "@aperture-engine/runtime";

// Keep only the world-space half where x >= 0; cut everything with x < 0 away.
app.spawn(
  withTransform({ translation: [0, 0, 4] }),
  withCamera({ clipPlanes: [[1, 0, 0, 0]] }),
);

// Per-material planes union with the camera's (camera planes first).
material.standard({
  renderState: { clipPlanes: [[0, 1, 0, -0.5]] }, // keep y >= 0.5
});
```

Camera and material planes **union** (camera first) and are capped at
`MAX_CLIP_PLANES` (**8**) total. Overflow drops the extras and emits a structured
diagnostic — `camera.clipPlanesExceedLimit` (from extraction) or
`material.clipPlanesExceedLimit` (from material validation) — rather than
crashing. Malformed planes (non-finite components) are silently dropped.

**Discard, not `clip_distances`.** WebGPU core WGSL has no `clip_distances`
builtin (it is an optional feature, absent on SwiftShader), so clipping is
implemented as a per-fragment `discard`: the built-in mesh shaders
(unlit/matcap/standard/debug-normal) get the discard loop injected automatically
when any view in the frame carries clip planes. A frame with no clip planes keeps
byte-identical pipeline keys, shaders, and pipelines. The primitive cutaway in
`examples/clipping-cutaway` cuts a symmetric box in half with a camera plane.

**group(0) / view-uniform contract (custom WGSL materials).** The active plane
count and the plane array live in the per-view uniform at `@group(0) @binding(0)`,
appended **after** the fog block (`clipPlaneCount: vec4f`, then
`clipPlanes: array<vec4f, 8>`); every pre-existing field offset (viewProjection,
cameraPosition, previousViewProjection, fog) is unchanged. Because the injection
only rewrites the built-in shaders, **custom WGSL materials are not
auto-clipped** — they keep declaring the smaller view struct and read valid data
(the grown uniform buffer is a strict superset). To honor clip planes in a custom
material, declare the extended view struct so you can read the appended clip
block, and run the same discard loop in your fragment entry.

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

### Compute→draw plumbing (writable buffers) — parity plan C1

A `BufferAsset` registered with `usage: "storage"` is WRITABLE: a compute pass
may write it on the GPU and the SAME realized buffer is consumable the same
frame as (a) a `material.storage(...)` binding AND (b) a buffer-backed
instance-attribute stream — with zero CPU copies (the GPU counterpart of
three.js WebGPU `storage().toAttribute()`). The renderer realizes one GPU buffer
per handle@version (`STORAGE | VERTEX | COPY_DST | COPY_SRC`) and shares it
across all three consumers; the frame graph orders compute-before-draw.

1. A worker system registers the writable buffer and spawns the instanced draw.
   The material reads the buffer as a storage binding AND declares an
   `instanceBuffer` — the per-instance vertex data at `@location(6+)` comes
   directly from the buffer (no per-entity `InstanceData`, no CPU pack):

   ```ts
   const flock = this.buffers.register({
     id: "boids.positions",
     elementType: "vec4f", // (posX, posY, velX, velY)
     elementCount: 160,
     usage: "storage", // WRITABLE — a compute pass writes it
     data: seedFlock(160), // deterministic seed (see determinism below)
   });

   const boidMaterial = material.customWgsl({
     familyKey: "example/boids",
     shader: { kind: "inline-wgsl", code: BOIDS_WGSL },
     entryPoints: { vertex: "vs_main", fragment: "fs_main" },
     bindings: [
       // (a) read the whole flock array read-only.
       material.storage("boids", {
         binding: 0,
         visibility: ["vertex"],
         buffer: flock,
       }),
     ],
     // (b) source slot-1 instance data (@location(6)) from the same buffer.
     instanceBuffer: {
       buffer: flock,
       attributes: defineInstanceAttributes([
         { name: "instanceState", format: "float32x4" },
       ]),
     },
   });
   ```

   The instance buffer's element byte-stride must match the declared attributes'
   packed stride (here `vec4f` = 16 bytes = one `float32x4`); rows are indexed by
   the draw's `firstInstance + instanceIndex` (spawn/packed order). A material
   sources its instance stream from EITHER `instanceAttributes` (CPU) OR
   `instanceBuffer` (GPU), never both.

2. The main thread registers a compute pass that WRITES the buffer id.
   `ctx.buffer(id)` resolves the exact realized GPUBuffer the draw consumes:

   ```ts
   const app = await startGeneratedBrowserApp({
     config,
     workerEntry,
     systemManifest,
   });
   const device = app.webgpu.app.initialization.device;
   const pipeline = device.createComputePipeline({
     /* boids integrator */
   });

   app.addComputePass({
     name: "boids-sim",
     writes: [{ handle: "boids.positions" }], // → ordered BEFORE the draw
     encode(ctx) {
       const boids = ctx.buffer("boids.positions"); // the shared GPU buffer
       const bindGroup = device.createBindGroup({
         layout: pipeline.getBindGroupLayout(0),
         entries: [{ binding: 0, resource: { buffer: boids } } /* params */],
       });
       ctx.setComputePipeline(pipeline);
       ctx.setBindGroup(0, bindGroup);
       ctx.dispatchWorkgroups(Math.ceil(160 / 64));
     },
   });
   ```

The scene node reads every writable-buffer id the frame's draws consume, so the
compute writer is ordered first (a mutual read/write is rejected as
`frameGraph.cyclicDependency`). The compute shader's WGSL, pipeline, and params
uniform are yours to own — the same raw-WebGPU escape hatch as any user pass.

Determinism: the boids SIMULATION runs on the GPU, whose float positions differ
across adapters and are never part of a determinism hash. What is
reproducible — the "60-frame determinism with a fixed seed" — is the CPU/ECS
authoring: identical seed bytes, entity/instance counts, and dispatch schedule.
See `examples/boids.html` for the complete GPU-flocking example.

### Indirect draws (GPU-driven culling) — parity plan C2

A user render pass can draw with vertex/instance counts read **on the GPU** from
an argument buffer instead of the CPU. The render sink gains
`ctx.drawIndirect(indirectBuffer, indirectOffset)` and
`ctx.drawIndexedIndirect(indirectBuffer, indirectOffset)` — the analog of
three.js WebGPU `IndirectStorageBufferAttribute` / indirect draw. This closes the
GPU-driven-culling loop: a compute pass culls instances and writes the survivor
count into a writable `BufferAsset`, and the same frame an indirect draw consumes
it — the CPU never sees or authors the drawn count.

A writable buffer (`usage: "storage"`) now realizes with `INDIRECT` added to its
usage (`STORAGE | VERTEX | COPY_DST | COPY_SRC | INDIRECT`), so one GPU buffer can
serve the compute writer AND the indirect-argument source. The 4x-u32 record at
`indirectOffset` is `[vertexCount, instanceCount, firstVertex, firstInstance]`
(indexed: `[indexCount, instanceCount, firstIndex, baseVertex, firstInstance]`);
the compute pass writes the `instanceCount` field with the survivor count.

```ts
// The compute pass writes the indirect args (instanceCount = survivors) AND a
// compacted instance buffer; declaring the writes orders it before the draw.
app.addComputePass({
  name: "gpu-cull",
  writes: [{ handle: "cull.args" }, { handle: "cull.instances" }],
  encode(ctx) {
    const args = ctx.buffer("cull.args"); // realized GPU buffer (INDIRECT usage)
    const instances = ctx.buffer("cull.instances");
    /* bind params + args + instances, dispatch — args[1] := survivor count */
  },
});

// The render pass consumes the compute-written count with a single indirect draw.
app.addRenderPass({
  name: "gpu-cull-draw",
  after: "gpu-cull", // ordered after the compute that fills the buffers
  reads: ["cull.args", "cull.instances"],
  writes: [{ handle: "scene-color", attachment: "load" }],
  encode(ctx) {
    const args = ctx.buffer("cull.args");
    /* setPipeline + setBindGroup(compacted instances) */
    ctx.drawIndirect(args, 0); // vertex + instance counts come from the GPU
  },
});
```

The drawn instance count is GPU-authoritative, so the renderer reads it back off
the argument buffer after the frame's submit and surfaces it in the frame report:

- Per pass: `renderTargets[*].graph.userPasses[i].indirectDraws.drawnInstanceCount`.
- Frame-wide aggregate: `report.userIndirectDraws.drawnInstanceCount` (summed
  across every user render pass that recorded an indirect draw).

A degraded path never encodes a device error — it drops the offending draw and
reports a structured `IndirectDrawFallbackReason` (in
`report.userIndirectDraws.fallbackReasons` and as a frame warning):
`indirect-buffer-unresolved` (the buffer id was missing / not ready),
`indirect-offset-misaligned` (the offset is not a 4-byte multiple),
`indirect-readback-unavailable` / `indirect-readback-failed` (the device could
not read the count back — the draw still runs, the count is just unknown).

Gotcha: the pipeline you build for the draw is yours to own, so its
`multisample.count` (and depth-stencil sample count) MUST match the route's
attachments. On the forward route MSAA is 4x by default; a single-sampled
indirect-draw pipeline mismatches and invalidates the whole command submit. Set
`render: { sampleCount: 1 }` (as `examples/gpu-culling` does) or build a 4x
pipeline. See `examples/gpu-culling.html` for the complete example.

### Data-described compute kernels — parity plan C3

`app.addComputePass({ encode })` (above) is the raw, full-control path: you hand
the engine a callback that builds a `GPUComputePipeline` + `GPUBindGroup` and
records the dispatch. For the common case, `app.addComputeKernelPass(...)` lets
you dispatch a WGSL kernel from **data** — a `ComputeKernelAsset` (WGSL source +
typed `bindings`, the SAME `material.customWgsl` binding union) plus a workgroup
count — and the engine builds the pipeline + bind group for you. You never touch
`createComputePipeline` / `createBindGroup` / `createBuffer`. This is the analog
of three.js TSL `wgslFn` / `computeShader` data-described compute.

```ts
import { createComputeKernelAsset } from "@aperture-engine/render";
import { createBufferHandle } from "@aperture-engine/simulation";

// A worker system registers the buffers (read-only input, writable output):
//   this.buffers.register({ id: "hist.pixels", elementType: "vec4f", ... });
//   this.buffers.register({ id: "hist.bins", elementType: "u32",
//     elementCount: 16, usage: "storage" });

const kernel = createComputeKernelAsset({
  label: "Luminance Histogram",
  shader: { kind: "inline-wgsl", code: histogramWgsl }, // or a ShaderHandle ref
  entryPoint: "main",
  bindings: [
    // Same declarations as material.storage / material.uniform, bound to @group(0).
    {
      name: "pixels",
      binding: 0,
      kind: "storage-buffer",
      visibility: ["compute"],
      buffer: createBufferHandle("hist.pixels"),
    },
    {
      name: "histogram",
      binding: 1,
      kind: "storage-buffer",
      visibility: ["compute"],
      buffer: createBufferHandle("hist.bins"),
    },
    {
      name: "params",
      binding: 2,
      kind: "uniform-buffer",
      visibility: ["compute"],
      fields: { pixelCount: { type: "uint32" }, binCount: { type: "uint32" } },
      values: { pixelCount: 64, binCount: 16 },
    },
  ],
});

app.addComputeKernelPass({ name: "histogram", kernel, workgroups: 1 });
```

- **Bindings** reuse the material union and resolve through the same wiring: a
  `storage-buffer` binding realizes its `BufferAsset` handle through C1's shared
  cache (so a compute kernel and a `material.storage(...)` binding referencing the
  same id bind the identical GPU buffer, zero-copy); a `uniform-buffer` binding is
  std140-packed from its `fields`/`values`; `texture`/`sampler` bindings resolve
  through the app texture/sampler caches. Bindings sit on `@group(0)`.
- **Workgroups** is a count (`4` → `[4, 1, 1]`) or a tuple (`[8, 2]` →
  `[8, 2, 1]`).
- **Ordering**: a kernel's WRITABLE (`usage: "storage"`) storage outputs are
  auto-declared as the pass's writes, so a draw (or a later pass) reading the same
  id is ordered after the dispatch — no manual `writes` list needed for them.
- **Pipeline caching**: the compute pipeline is built once (keyed by the resolved
  WGSL source + entry point) and reused across frames; only the bind group is
  rebuilt.
- **Degradation is loud, never a device error**: a malformed kernel, an
  unresolved binding, or a device without compute support surfaces a structured
  `computeKernel.*` diagnostic on the frame and the pass records no commands.

Keep the raw `addComputePass(encode)` path when you need full control (multiple
dispatches, indirect dispatch, or bindings the kernel surface does not cover). See
`examples/luminance-histogram.html`, which computes a histogram BOTH ways — a raw
dispatch and a data-described kernel — into two buffers and asserts the readbacks
are byte-identical.

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

### Sampling scene depth (depth-fade custom materials)

A custom material can bind the renderer-owned scene depth read-only (parity
plan B4) and fade against the opaque surfaces already drawn behind it — the
classic force-field / soft-particle depth-fade. Declare a texture binding whose
`source` is `"scene-depth"` and whose `sampleType` is `"depth"`; the renderer
supplies the depth, so a source-backed binding needs no `texture` handle:

```ts
material.customWgsl({
  familyKey: "app/forcefield",
  label: "Forcefield",
  shader: shader.asset(this.assets.shader("forcefield")),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
  // Scene-depth materials MUST be transparent (see below).
  renderState: {
    alphaMode: "blend",
    blend: { preset: "alpha" },
    depth: { test: true, write: false, compare: "less-equal" },
  },
  bindings: [
    material.texture("sceneDepth", {
      binding: 0,
      visibility: ["fragment"],
      source: "scene-depth", // renderer-owned; no texture handle needed
      sampleType: "depth",
    }),
    material.uniform("params", {
      binding: 1,
      visibility: ["fragment"],
      fields: {
        color: { type: EcsType.Vec4, default: [0.2, 0.7, 1, 1] },
        fadeDistance: { type: EcsType.Float32, default: 0.01 },
      },
    }),
  ],
});
```

In WGSL the binding is a `texture_depth_2d` at group 2 (`@group(0)` is the view
uniform and `@group(1)` the world transforms, as always). Sample the stored
depth at the fragment's own pixel with `textureLoad`, then compare it to
`input.position.z` — the fragment's window-space depth — so a smaller delta
means the opaque surface behind is closer:

```wgsl
@group(2) @binding(0) var sceneDepth: texture_depth_2d;

struct Params {
  color: vec4f,
  fadeDistance: f32,
}
@group(2) @binding(1) var<uniform> params: Params;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // input.position is the @builtin(position) framebuffer coordinate: xy in
  // pixels, z in window depth. Load the opaque depth stored at this pixel.
  let coord = vec2i(i32(input.position.x), i32(input.position.y));
  let sampledDepth = textureLoad(sceneDepth, coord, 0);

  // A small delta means the surface behind is close: fade the field in.
  let delta = sampledDepth - input.position.z;
  let edge = 1.0 - saturate(delta / params.fadeDistance);
  return vec4f(params.color.rgb, params.color.a * edge);
}
```

Depth-fade semantics and constraints:

- **Transparent only.** A scene-depth material must be transparent
  (`renderState.alphaMode: "blend"`); an opaque one is rejected at material
  preparation with `customMaterialSource.sceneDepthRequiresTransparent`.
  Scene-depth sampling is a post-opaque effect — the material draws _after_ the
  opaque pass has written depth.
- **Read-only depth, own submission.** A texture cannot be both a writable
  depth attachment and a sampled binding in one pass, so the depth-sampling
  draw runs in a post-opaque submission that attaches the scene depth
  read-only. Compose it with two swapchain cameras (the ascending-`priority`
  rule from [Render Targets](#render-targets)): a lower-priority camera A
  renders the opaque geometry and writes depth, and a higher-priority camera B
  renders the transparent depth-sampling material, loading camera A's depth
  read-only. Scope each camera's meshes with render layers.
- **MSAA.** On a `{ msaa: 4 }` app the scene depth is multisampled: declare
  `multisampled: true` on the binding and sample a
  `texture_depth_multisampled_2d` with an explicit sample index
  (`textureLoad(sceneDepth, coord, 0)`); a non-MSAA app uses `texture_depth_2d`.
- **User passes read depth too.** The other half of depth access is on user
  render passes: `app.addRenderPass({ reads: ["depth"], ... })` resolves
  `ctx.view("depth")` to a `texture_depth_2d` (see `examples/custom-graph-pass`).
- **Binding-layout variants.** The scene-depth binding rides on fully general
  texture/sampler layouts. `material.texture(...)` accepts `sampleType`
  (`"float"` default, `"unfilterable-float"`, `"depth"`, `"sint"`, `"uint"`),
  `viewDimension` (`"2d"` default, `"cube"`), and `multisampled`;
  `material.sampler(...)` accepts `samplerType` (`"filtering"` default,
  `"non-filtering"`, `"comparison"`). A comparison sampler pairs with a sampler
  asset carrying a compare op — `createSamplerAsset({ compare: "less" })` — for
  hardware depth comparison. Each field participates in the pipeline key only
  when set to a non-default value, so pre-B4 materials keep byte-identical keys.

See `examples/forcefield-scene.js` (with `forcefield.main.js` /
`forcefield.worker.js`) for a complete two-camera force-field that fades
against the opaque scene depth.

Current limitations: WGSL only; no shader imports; no user-supplied WebGPU
objects or callbacks; and no arbitrary app-owned material adapter
registration. App-route custom WGSL supports group-2 uniform buffers,
read-only storage buffers, texture bindings, sampler bindings, CPU-authored
instance-attribute layouts AND buffer-backed instance streams (parity plan
C1), the opt-in group(3) lit contract (`lighting: "lit"`), multi-target output
declarations (`colorTargets`), and mixed built-in/custom frames through the
normal `createWebGpuApp()` path (MRT materials excepted — they need the
single-custom-material route). Material storage bindings are read-only
(`access: "read"`); a compute pass supplies writable-buffer writes via
`usage: "storage"` buffers (see Compute→draw plumbing above).

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

## Dynamic and video textures — parity plan D3

The analog of three.js `CanvasTexture` / `VideoTexture` /
`DataTexture.needsUpdate`: a texture whose CONTENTS change every frame while its
handle stays stable. The ECS simulation runs in a worker that must never touch
the DOM (`HTMLVideoElement`, `<canvas>`, `ImageBitmap`), so the split is: the
**worker DECLARES** the dynamic texture (DOM-free metadata) and authors the
material that samples it; the **main thread UPLOADS** its pixels (the DOM/GPU
side).

Declare it in a worker system with `this.textures.register(...)` (mirrors
`this.buffers.register` / `this.renderTargets.register`). A material-sampled
texture MUST be declared here — extraction validates the material's texture
handle against the worker registry:

```ts
// worker system init()
this.textures.register({
  id: "hud.tv",
  width: 64,
  height: 64,
  externalImage: true, // adds render-attachment usage for copyExternalImageToTexture
  data: new Uint8Array(64 * 64 * 4), // optional initial contents (DOM-free bytes)
});

this.spawn.mesh({
  mesh: mesh.plane({ size: [1, 1] }),
  material: material.customWgsl({
    familyKey: "app/tv",
    shader: { kind: "inline-wgsl", code: tvWgsl },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    bindings: [
      material.texture("tv", {
        binding: 0,
        visibility: ["fragment"],
        texture: createTextureHandle("hud.tv"),
      }),
    ],
  }),
});
```

Then upload new contents each animation frame on the main thread
(`app.webgpu.app` from a generated browser app):

```js
// main thread (never the worker)
const app = webgpu.app;

function frame() {
  // AC1 — raw CPU bytes via queue.writeTexture (full-image OR sub-rect):
  app.updateDynamicTexture("hud.tv", { data: rgbaBytes }); // full image
  app.updateDynamicTexture("hud.tv", {
    region: { x: 8, y: 8, width: 16, height: 16 },
    bytesPerRow: 16 * 4,
    data: patchBytes,
  }); // sub-rect

  // AC2 — an HTMLVideoElement / VideoFrame / canvas / ImageBitmap via
  // queue.copyExternalImageToTexture:
  app.updateDynamicTextureFromExternalImage("hud.tv", { source: videoElement });

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

For a texture sampled OUTSIDE the extracted-material path (e.g. a user render
pass), `app.registerDynamicTexture({ id, width, height, ... })` registers the
same kind of texture directly on the renderer.

- **Supported formats:** `rgba8unorm`, `rgba8unorm-srgb`, `bgra8unorm`,
  `bgra8unorm-srgb`, `r8unorm`, `rg8unorm`, `rgba16float` (each is renderable and
  has a fixed texel byte size for sub-rect validation). Default `rgba8unorm`.
- **Frame report.** The frame report gains a `dynamicTextures` section — the
  per-frame update rate + bytes (`frameUpdates` / `frameBytesUploaded`),
  cumulative totals, and per-texture stats — present only once at least one
  dynamic texture has been registered.
- **Failures are structured, never device errors.** A bad sub-rect
  (`dynamicTexture.invalidRegion`), sub-minimum `bytesPerRow`
  (`dynamicTexture.invalidBytesPerRow`), undersized data
  (`dynamicTexture.uploadDataTooSmall`), unsupported format / bad descriptor
  (`dynamicTexture.invalidDescriptor`), missing external source
  (`dynamicTexture.missingSource`), an id that was never registered
  (`dynamicTexture.notRegistered`), a texture no material has sampled yet
  (`dynamicTexture.notRealized`), or a device upload failure
  (`dynamicTexture.uploadFailed`) each return a diagnostic on the update result.
- **Byte-identity.** A dynamic texture realizes byte-for-byte like any texture
  with the same usages, so existing (non-dynamic) textures are unaffected; no
  worker→renderer packet or determinism fixture changes.

See `examples/runtime-texture.html` for an in-scene video wall — a canvas
scoreboard, a canvas-animated TV, and a CPU-bytes ticker.

## Decals — parity plan D4

A **decal** is a textured quad projected onto opaque scene geometry — bullet
holes, scorch marks, footprints, blood splats. Aperture renders decals as
**depth-biased projected quads**: the quad lies in the projector's plane and is
nudged toward the camera by a small `depthBias` so it wins the depth test
against the surface it sits on WITHOUT z-fighting, then depth-tests (never
writes) against the scene depth the opaque pass already wrote, so nearer
geometry still occludes it. All decals draw through ONE shared instanced
pipeline in the post-opaque transparent phase — no extra pass, and a scene with
no decals renders byte-identically to one authored before decals existed.

Spawn one with the `spawn.decal(...)` system command:

```ts
class GunSystem extends createSystem({ priority: 0 }) {
  override onHit(point: Vec3, normal: Vec3): void {
    this.spawn.decal({
      texture: this.assets.texture("bulletHole"),
      // The entity WORLD transform IS the projector: place it at the hit point
      // and orient it to face along the surface normal (e.g. lookAt the shooter
      // or rotate so +Z aligns with `normal`).
      transform: {
        translation: point,
        lookAt: [
          point[0] + normal[0],
          point[1] + normal[1],
          point[2] + normal[2],
        ],
      },
      size: [0.4, 0.4], // world-space width/height of the quad
      color: [1, 1, 1, 1], // tint; alpha multiplies `opacity`
      opacity: 0.9, // overall fade in [0, 1]
      depthBias: 0.02, // toward-camera offset (world units) — bump up on grazing walls
      capacity: 64, // shared live-decal pool cap
      layer: 1, // RenderLayer mask (defaults to 1)
      // `sequence` is auto-stamped from the world change version so eviction
      // follows firing order; pass it explicitly to control ordering.
    });
  }
}
```

Fields (all optional except `texture`): `texture` / `sampler`, `size`
(`number` for square or `[w, h]`), `color` (RGBA tint), `opacity` (fade folded
into the tint alpha at extraction), `depthBias`, `capacity`, `sequence`,
`layer`, `transform`. The lower-level trait `withDecal(...)` and the
`createDecal(...)` component factory are available for `createExtractionApp` /
trait-based spawning.

**Cap + eviction (ring buffer).** Decals accumulate — an FPS wall fills with
bullet holes — so the subsystem caps the LIVE decal count. Extraction keeps the
newest `capacity` decals by `sequence` and evicts the rest **oldest-first**
(`selectRenderedDecals` is the exported pure policy). The tally is surfaced two
ways: `snapshot.report.decals` = `{ capacity, live, evicted, submitted }` and
the renderer's `report.features.decals` (same tally plus `drawn` /
`textureBatches`). `report.counts.decals` appears only when a frame has decals.

**Layer mask.** A decal's `RenderLayer` mask gates which cameras render it
(standard per-view layer filtering); a decal on a layer no camera sees is
dropped at extraction with a `render.layerMismatch` diagnostic.

**Diagnostics.** A missing/invalid texture (`decal.invalidTexture`), degenerate
size (`decal.invalidSize`), bad opacity/`depthBias` (`decal.invalidOpacity` /
`decal.invalidDepthBias`), or non-positive capacity (`decal.invalidCapacity`)
each fail authoring validation; unavailable GPU resources emit `decalFrame.*`
codes — never a raw WebGPU validation error.

**Limitations (honest).** The projected-quad route is ideal for flat surfaces
(walls, floors) and does not mesh-conform to arbitrary curved geometry; it
projects the primary view's matrix (single-camera scenes); and the layer mask
gates the decal per view, not per underlying-surface layer. A deferred
box-projector reconstructing world position from the scene depth buffer is the
follow-up that lifts these.

See `examples/decals.html` for FPS-style bullet holes accumulating on a wall,
hitting the cap and evicting the oldest.

## Fat lines — parity plan E1

A **fat line** is a polyline drawn with a **screen-space width in pixels** — the
analog of three.js `Line2` / `LineMaterial` (the fat-lines addon), not a 1px GPU
`line-list`. Each segment of the polyline is expanded on the GPU into an
instanced quad: both endpoints project to pixel space, and the quad is a capsule
bounding box (half the pixel width perpendicular to the segment, plus half-width
caps past each endpoint). A capsule SDF in the fragment shader discards
everything beyond half-width from the segment core, which gives **round caps and
round joins for free**. Width is resolution-independent (it stays N pixels at any
camera distance). All lines draw through ONE shared instanced pipeline in the
post-opaque transparent phase, and a scene with no lines renders byte-identically
to one authored before lines existed.

Spawn one with the `spawn.line(...)` system command:

```ts
class PathDebugSystem extends createSystem({ priority: 0 }) {
  override drawPath(waypoints: readonly Vec3[]): void {
    this.spawn.line({
      // Flat local-space xyz per vertex; N vertices -> N-1 segments.
      positions: waypoints.flat(),
      color: [0.1, 0.85, 1, 1], // RGBA tint (uniform along the polyline)
      width: 6, // SCREEN-SPACE width in pixels
      dashSize: 0.25, // world-unit dash length (0 = solid)
      gapSize: 0.25, // world-unit gap between dashes
      dashOffset: 0, // world-unit phase offset
      layer: 1, // RenderLayer mask (defaults to 1)
    });
  }
}
```

Fields (all optional except `positions`): `positions` (flat xyz, ≥ 2 vertices),
`color`, `width` (pixels), `dashSize` / `gapSize` / `dashOffset` (world units),
`layer`, `transform`. The lower-level trait `withLine(...)` and the
`createLine(...)` component factory are available for `createExtractionApp` /
trait-based spawning.

**Dashes.** Dash phase uses the **world-continuous arc length** along the
polyline (accumulated from the world-transformed vertices), so `dashSize` /
`gapSize` are world units and the pattern flows unbroken across segments and
joins. The fragment discards where `mod(arcLength + dashOffset, dashSize +
gapSize) > dashSize`.

**Report.** `snapshot.report.lines` = `{ lines, segments, vertices }`; the
renderer's `report.features.lines` = `{ lines, segments, drawnSegments }`.

**Diagnostics.** A degenerate polyline (`line.invalidPositions`, e.g. < 2
vertices or a length not a multiple of 3), bad width (`line.invalidWidth`), bad
dash params (`line.invalidDash`), or a non-finite color (`line.invalidColor`)
fail authoring validation with NO packet; unavailable GPU resources emit
`lineFrame.*` codes — never a raw WebGPU validation error.

**Limitations (honest).** 🟡 Joins/caps are **round only** (the capsule SDF); no
miter/bevel option. 🟡 Segments crossing behind the camera are not near-plane
clipped (the endpoints clamp to a small positive `w`). Per-vertex line colors
are a follow-up — the color is uniform per polyline today. Dashes are per-line
world-continuous (not per-screen-pixel). The pipeline projects the primary
view's matrix (single-camera scenes).

See `examples/fat-lines.html` for a dashed debug-path visualization.

## Points — parity plan E1

A **point cloud** draws each point as a **camera-facing quad**, the analog of
three.js `PointsMaterial`. Size is either in **pixels** (constant on screen) or,
with `sizeAttenuation`, in **world units with perspective size falloff** — a
point at clip depth `w` renders `size * 0.5 * viewportHeight / w` pixels wide, so
nearer points are larger (matching three.js's attenuation). Points can be
**round** (radial `discard` outside the unit disc) or **square**, with an
optional **per-point color**. One shared instanced pipeline, transparent phase,
byte-identical when unused.

Spawn one with the `spawn.points(...)` system command:

```ts
class CloudSystem extends createSystem({ priority: 0 }) {
  override showCloud(cloud: PointCloud): void {
    this.spawn.points({
      positions: cloud.xyz, // flat local-space xyz per point
      colors: cloud.rgba, // OPTIONAL flat RGBA per point (4 per point)
      color: [1, 1, 1, 1], // uniform tint when `colors` is omitted
      size: 0.5, // world units (with attenuation) or pixels
      sizeAttenuation: true, // perspective size falloff
      shape: "round", // "round" (default) or "square"
      layer: 1,
    });
  }
}
```

Fields (all optional except `positions`): `positions` (flat xyz, ≥ 1 point),
`colors` (flat RGBA, 4 per point), `color` (uniform fallback), `size`,
`sizeAttenuation`, `shape`, `layer`, `transform`. The lower-level trait
`withPoints(...)` and the `createPoints(...)` component factory are available for
`createExtractionApp` / trait-based spawning.

**Report.** `snapshot.report.points` = `{ clouds, points }`; the renderer's
`report.features.points` = `{ clouds, points, drawnPoints }`.

**Diagnostics.** Degenerate positions (`points.invalidPositions`), a per-point
color buffer whose length ≠ `points * 4` (`points.invalidColors`), a bad size
(`points.invalidSize`), a non-finite color (`points.invalidColor`), or an
unknown shape (`points.invalidShape`) fail authoring validation with NO packet;
unavailable GPU resources emit `pointFrame.*` codes.

**Limitations (honest).** 🟡 Attenuation uses three.js's `0.5 * viewportHeight /
w` model (FOV-independent scale), matching `PointsMaterial` rather than an
exact-projection derivation. Per-point size is uniform per cloud (size is a
cloud-level field). The pipeline projects the primary view's matrix
(single-camera scenes).

See `examples/point-cloud.html` for a near/far attenuated point-cloud viewer.

## Mesh LOD — parity plan E2

**Level of detail** swaps an entity's drawn mesh by camera distance — the analog
of three.js `THREE.LOD`. A `Lod` component holds N **levels** (each a mesh handle

- an ascending distance threshold) plus a **hysteresis** band. Selection runs
  **worker-side in extraction**, is **deterministic**, and **overrides the drawn
  mesh handle** — so LOD needs no renderer change; the ordinary mesh draw just
  carries a different handle per frame. Byte-identical when unused.

Author it as a `lod` option on `spawn.mesh(...)`. The base `mesh` is the fallback
and the `material` is shared across levels (LOD swaps the mesh, not the whole
sub-object):

```ts
class RockSystem extends createSystem({ priority: 0 }) {
  override placeRock(position: Vec3): void {
    this.spawn.mesh({
      mesh: { kind: "sphere", options: { radius: 0.8, segments: 32 } }, // base/fallback
      material: {
        kind: "standard",
        options: { baseColor: [0.6, 0.66, 0.72, 1] },
      },
      transform: { translation: position },
      lod: {
        levels: [
          {
            mesh: { kind: "sphere", options: { radius: 0.8, segments: 32 } },
            distance: 0,
          },
          { mesh: { kind: "box", options: { size: 1.3 } }, distance: 20 },
        ],
        hysteresis: 3, // world units; keeps the selection sticky near a boundary
      },
    });
  }
}
```

Each level is a `{ mesh, distance }` where `mesh` is a primitive descriptor or a
resolved `MeshHandle`. Levels are **nearest first** with **strictly ascending**
distances (level 0 usually `distance: 0`). The lower-level trait `withLod(...)`
and the `createLod(...)` / `validateLodInput(...)` factories
(`@aperture-engine/render`) are available for `createExtractionApp` /
trait-based spawning; pair `withLod(...)` with `withMesh(...)` + `withMaterial(...)`.

**Selection + hysteresis.** Each frame extraction computes the camera→object
world distance (the three.js `LOD.update` model — object world position, not a
screen-coverage metric) and selects the highest level whose threshold the
distance has cleared. A **symmetric hysteresis band** keeps the previously
selected level sticky: a switch to a coarser level needs `distance >= threshold +
hysteresis`, a switch back needs `distance < threshold - hysteresis`. Between
those the level is held, so a camera loitering on a boundary never pops. The
sticky state lives on the component (`Lod.currentLevel`) as ordinary
deterministic ECS world state (NOT renderer memory), rewritten only on an actual
change — so selections reproduce exactly under record/replay. The pure selection
function `selectLodLevel(distance, thresholds, currentLevel, hysteresis)` is
exported and unit-tested.

**Report.** `snapshot.report.lod` = `{ entities, levels }`, where `levels[i]`
counts the LOD entities currently at level `i` (index 0 = highest detail) — the
per-level draw distribution that shifts near→far. Absent when a frame has no LOD
entities.

**Diagnostics.** Empty levels (`lod.emptyLevels`), out-of-order thresholds
(`lod.thresholdsNotAscending`), a missing level mesh handle
(`lod.invalidLevelMesh`), or a negative hysteresis (`lod.invalidHysteresis`) fail
authoring validation; at extraction the same codes surface as `render.lod.*` and
the entity falls back to drawing its base `Mesh` handle rather than raising a
device error.

**Limitations (honest).** 🟡 Distance-based only (no screen-coverage / bounding-
sphere-pixel-size metric). Selection uses the **primary/active view**
(single-camera scenes); a multi-camera scene selects against the first view.
LOD swaps the **mesh handle** only (shared material), not whole sub-objects with
their own materials.

See `examples/mesh-lod.html` for a field of LOD'd rocks the camera dollies
near→far, with a frame-report e2e proving the distribution shift and the
no-popping hysteresis band.

## Debug draw — parity plan E3

An **immediate-mode debug-draw** overlay — the analog of three.js's helper
objects (`Box3Helper`, `SphereHelper`, `AxesHelper`, `GridHelper`, `CameraHelper`,
`SkeletonHelper`, `ArrowHelper`) — but as a single API you call **from a system,
every frame**, instead of spawning helper entities. Each primitive lasts exactly
one frame: draw it again next frame to keep it on screen.

```ts
class DebugSystem extends createSystem() {
  update() {
    // Skip the work entirely in production builds (see the no-op contract below).
    if (!this.debugDraw.enabled) return;

    this.debugDraw.line([0, 0, 0], [1, 1, 0], [1, 1, 1, 1]); // segment
    this.debugDraw.aabb([-1, -1, -1], [1, 1, 1], [0.1, 0.9, 1, 1]); // Box3Helper
    this.debugDraw.box([0, 2, 0], [0.5, 0.5, 0.5]); // center + half-extents
    this.debugDraw.sphere([0, 0, 0], 2, [1, 0.2, 0.9, 1], { segments: 24 });
    this.debugDraw.axes([0, 0, 0], 1); // X red, Y green, Z blue
    this.debugDraw.grid({ size: 10, divisions: 10 }); // XZ-plane ground grid
    this.debugDraw.frustum(inverseViewProjection); // CameraHelper
    this.debugDraw.bones([{ from: hipWorld, to: kneeWorld }]); // SkeletonHelper
    this.debugDraw.light({ position: sunPos, direction: sunDir }); // light gizmo
  }
}
```

Each primitive tessellates into **world-space line segments** and renders as an
**overlay** through the same fat-line pipeline the E1 lines use (screen-space
pixel width, round caps/joins), drawn after the scene in the transparent queue
and depth-tested (matching three.js helpers). Optional trailing `color?`/`width?`
arguments (and the `{ segments, width }` options on `sphere`/`grid`) tune each
call; colors are RGBA, widths are in pixels.

**Immediate-mode lifecycle.** Systems accumulate primitives during the worker
frame; render extraction drains them into a transient `snapshot.debugLines`
family and a `report.debugDraw = { primitives, segments, vertices }` tally, then
clears the accumulator. Nothing persists between frames, and the geometry is not
tied to any ECS entity.

**No-op in production (zero overhead when disabled).** Set `debugDraw: false` in
the app config to bind a shared no-op: every `this.debugDraw.*` call accumulates
nothing, emits no snapshot family, builds no pipeline, and produces a frame that
is **byte-identical** to one without debug draw. Gate expensive debug tessellation
behind `if (this.debugDraw.enabled)`. A frame that simply makes no debug calls is
already byte-identical whether debug draw is enabled or not.

```ts
export default defineApertureConfig({
  mode: "browser",
  debugDraw: false, // production: this.debugDraw.* is a no-op, zero overhead
});
```

**Physics collider wireframes.** Physics debug geometry re-plumbs onto the same
overlay. With physics enabled, add a `PhysicsDebug` component (via
`withPhysicsDebug({ colliderWireframes: true, ... })`) and the engine routes
`physics.debugGeometry()` — collider wireframes, contact normals, body-state
markers, broadphase AABBs, joint frames — through the debug-draw overlay each
frame automatically. You can also feed a `PhysicsDebugGeometry` in yourself with
`this.debugDraw.physics(geometry)`.

Degenerate primitives (non-finite coordinates/colors) and an exceeded per-frame
segment cap are dropped with a structured `render.debugDraw.*` diagnostic rather
than raising a device error.

See `examples/debug-draw.html` for a system drawing an AABB + sphere + axes +
grid + a physics collider wireframe every frame, with a frame-report e2e asserting
the exact primitive/segment counts and proving `?debug=off` drops them to zero.

## Post-processing tail — parity plan E4

Three post-processing effects — the analogs of three.js's `MotionBlur`,
`LUTPass`, and `OutlinePass` — slot into the ordered post stack alongside the
existing bloom / DoF / FXAA / tonemap / SSAO / SSR / TAA. Enable them from the app
config `render` block (each is `boolean | { …params }`); the generated app builds
them in the order bloom → motion blur → LUT → outline:

```ts
export default defineApertureConfig({
  mode: "browser",
  render: {
    motionBlur: { intensity: 1.5, samples: 16, maxVelocity: 0.2 },
    lut: { size: 16, data: coolGradeStrip, intensity: 1 },
    outline: {
      color: [1, 0.5, 0.05],
      thickness: 3,
      opacity: 1,
      fillOpacity: 0,
    },
  },
});
```

Unlike bloom (which needs the HDR scene buffer and implies `exposure`), all three
are **LDR-safe** and do NOT force the HDR path — the exposure gate keys off
`render.bloom` specifically. You can also construct the effects directly and pass
them to `createWebGpuApp({ postEffects: [...] })` in the order you want them
applied (`createWebGpuMotionBlurPostEffect`, `createWebGpuLutColorGradePostEffect`,
`createWebGpuOutlinePostEffect`, exported from `@aperture-engine/webgpu`).

**Motion blur** (`render.motionBlur`). Smears each pixel along its screen-space
velocity, read from the renderer-owned motion-vector texture (the same plumbing
TAA uses — it turns on automatically). Params: `intensity` (velocity multiplier,
`0` disables, clamped `[0, 8]`, default `1`), `samples` (taps along the velocity
vector, `[2, 32]`, default `12`), `maxVelocity` (UV-space smear clamp so a large
frame-to-frame jump does not sample the whole screen, `(0, 0.5]`, default `0.1`).
On a frame/route that cannot produce motion vectors (MSAA / sprite+skybox packets
/ missing previous-transform history) the effect emits no commands and reports
`webGpuPostPass.motionVectorTextureUnavailable` rather than a device error.

**LUT color grade** (`render.lut`). Applies a 3D color LUT stored as a 2D N-slice
strip (`N*N` wide by `N` tall), sampled with trilinear interpolation. Params:
`size` (cube edge `N`, `[2, 64]`, default `16`), `data` (RGBA bytes for the strip,
length must be `N*N*N*4`; omit for an identity LUT — a pass-through you can start
from), `intensity` (blend of the graded color over the original, `[0, 1]`, default
`1`). A `data` length that does not match `size` reports
`webGpuPostPass.lutDataInvalid` and emits no commands.

**Outline** (`render.outline`). Draws a colored silhouette ring around the
entities you have SELECTED — the analog of `OutlinePass`. Params: `color` (linear
RGB `[0,1]`, default orange), `thickness` (ring half-width in pixels, `[1, 8]`,
default `2`), `opacity` (ring blend over the scene, `[0, 1]`, default `1`),
`fillOpacity` (interior tint over the selected surface, `[0, 1]`, default `0` =
outline only). Drive the selection at runtime with **`app.setOutlineSelection(entities)`**:

```ts
const { app } = await createWebGpuApp({
  canvas,
  postEffects: [
    createWebGpuOutlinePostEffect({ color: [1, 0.5, 0.05], thickness: 3 }),
  ],
});

// Outline the picked/hovered entities. Accepts the RenderEntityRef from a
// snapshot's meshDraws (or a raw stable id). Pass [] to clear the outline.
app.setOutlineSelection([targetDraw.entity]);
app.setOutlineSelection([]); // deselect → the ring disappears
```

The renderer produces the outline by REUSING the existing ID-buffer picking
pipeline: with a non-empty selection and an active outline effect it renders the
selected entities into a per-frame `r32uint` mask (occlusion handled by the mask
pass's own depth test), which the outline effect edge-detects. Selection membership
is live on the read-only `app.outlineSelection` set, and each frame reports
`report.outline = { selection, maskDrawCalls, ok }`. When the selection is empty
(or no outline effect is active) the mask is never rendered and the effect is a
pass-through, so a non-outline frame is byte-identical to one without the effect.
Outline picking supports rigid, unmorphed, triangle-list mesh draws; skinned /
morphed / non-triangle selections produce no mask and the outline degrades to an
exact identity copy.

> **GTAO note.** E4 scoped an optional GTAO upgrade for the SSAO slot; it was
> deferred (it could not be pixel-proven end-to-end), so SSAO is unchanged. See
> `docs/DECISIONS.md` decision 0027.

See `examples/post-tail.html` for the outlined + LUT-graded target box beside a
motion-blurred mover (four side-by-side canvases), with a pixel + report e2e that
smears the mover, pushes the scene bluer, and makes the warm outline ring appear
(selected) / vanish (deselected).

## Hemisphere light — parity plan E5

A hemisphere light is a soft, two-color ambient gradient — the three.js
`HemisphereLight`. Author it with `kind: "hemisphere"`: `color` is the **sky**
color, `groundColor` is the **ground** color, and `intensity` scales both. A
receiver's shading blends the two along world **+Y**:
`mix(groundColor, skyColor, 0.5 + 0.5 * dot(N, up))` — an up-facing surface reads
the sky color, a down-facing one the ground color. Like ambient/environment
lights it needs **no transform** (the gradient axis is fixed world-+Y).

```ts
this.spawn.light({
  key: "light.sky",
  kind: "hemisphere",
  color: [0.3, 0.5, 1.0, 1], // sky (blue)
  groundColor: [0.95, 0.55, 0.2, 1], // ground (warm)
  intensity: 3.6,
});
```

`groundColor` is meaningful **only** for hemisphere lights; every other light
kind ignores it. Under the hood the packed light record does not grow — the
ground color rides in the otherwise-unused range/cone slots — so adding a
hemisphere light never perturbs other lights' packed output. See
`examples/hemisphere-light.html` (a sphere whose top reads sky-blue and bottom
reads ground-warm, with a pixel e2e).

Light probes / spherical-harmonics irradiance (`LightProbe` /
`SphericalHarmonics3`) are **not** shipped — see `docs/DECISIONS.md` decision 0028.

## 3D and 2D-array texture assets — parity plan E5

Texture assets support two more dimensions beyond `2d`/`cube`:

- **`3d`** — a volume texture (`width` × `height` × `depthOrLayers` = the depth).
  Realized with a WebGPU `dimension: "3d"` storage texture; sampled in WGSL as
  `texture_3d<f32>` with a `vec3f` coordinate (hardware trilinear filtering).
- **`2d-array`** — N stacked 2D layers (`depthOrLayers` = the layer count).
  Realized as 2D storage with a `2d-array` view; sampled as
  `texture_2d_array<f32>` with a `vec2f` coordinate + an integer layer index.

Author the bytes for every slice/layer contiguously (slice 0's `width`×`height`
texels, then slice 1's, …) with `bytesPerRow` = one row and `rowsPerImage` =
`height`:

```ts
const texture = createTextureAsset({
  label: "VolumeLut",
  dimension: "3d",
  width: 4,
  height: 4,
  depthOrLayers: 4, // 4 depth slices
  format: "rgba8unorm",
  colorSpace: "data",
  semantic: "data",
  usage: ["sampled", "copy-dst"],
  sourceData: {
    bytes: volumeBytes, // 4*4*4 RGBA texels, red fastest, then row, then slice
    bytesPerRow: 4 * 4,
    rowsPerImage: 4,
  },
});
```

Sample it from a **custom WGSL material** by declaring a texture binding with the
matching `viewDimension`:

```ts
bindings: [
  {
    name: "volumeTexture",
    binding: 0,
    kind: "texture",
    visibility: ["fragment"],
    texture, // the 3d TextureAsset handle
    sampleType: "float",
    viewDimension: "3d", // or "2d-array"
  },
  {
    name: "volumeSampler",
    binding: 1,
    kind: "sampler",
    visibility: ["fragment"],
    sampler,
    samplerType: "filtering",
  },
];
```

and in the shader (group `2`):

```wgsl
@group(2) @binding(0) var volumeTexture: texture_3d<f32>;
@group(2) @binding(1) var volumeSampler: sampler;
// ...
let color = textureSampleLevel(volumeTexture, volumeSampler, vec3f(u, v, w), 0.0);
```

The `viewDimension` participates in the material's pipeline key **only** when it
is not the default `2d`, so 2d/cube bindings keep byte-identical keys. Sample a
`2d-array` with `textureSample(tex, samp, vec2f(u, v), layerIndex)`. The LUT
color-grade post effect (`createWebGpuLutColorGradePostEffect`) is itself a real
`texture_3d<f32>` internally. See `examples/volume-texture-lut.html` (one custom
material samples a 4×4×4 LUT volume; the depth coordinate selects the slice).

## Dynamic meshes — parity plan D5

For geometry that changes every frame on the CPU (cloth, jelly, procedural
ribbons, waveforms), register a **dynamic mesh** and stream only the changed
byte windows to the GPU with `this.meshes.update(...)` — the analog of three.js
`BufferAttribute.needsUpdate` + `updateRange`. The update flows through the
existing update-range plan: the changed windows re-publish as a new source
version carrying `updateRanges`, the renderer reuses the same-layout GPU buffers,
and writes only the named ranges via `queue.writeBuffer`. The asset is never
re-registered and untouched buffers are never re-uploaded.

```js
class ClothSystem extends createSystem({ priority: 0 }) {
  #positions = null; // interleaved backing array (POSITION/NORMAL/UV, stride 32)
  #mesh = null;

  init() {
    const { positions, indices } = createClothGeometry();
    this.#positions = positions;
    // dynamic() registers + seeds the initial (full) mesh; the returned handle
    // is stable, so spawn once and update forever.
    this.#mesh = this.meshes.dynamic("cloth.mesh", {
      label: "Cloth",
      initial: createClothMeshAsset(positions, indices),
    });
    this.spawn.mesh({
      mesh: this.#mesh.handle,
      material: material.standard({ baseColor: [0.86, 0.16, 0.18, 1] }),
    });
  }

  update(delta) {
    deformCloth(this.#positions, this.time.elapsed); // mutate the array in place
    // Upload ONLY the changed window. The index buffer (not named) is skipped.
    this.#mesh.update({
      streams: [
        {
          id: "cloth-surface",
          data: this.#positions, // optional; omit to reuse the registered array
          updateRanges: [{ byteOffset: 416, byteLength: 3744 }],
        },
      ],
    });
  }
}
```

**The shape.** `meshes.update(id, { streams, index, updateRanges })` (or the
`DynamicMesh.update(...)` convenience returned by `meshes.dynamic(...)`):

- `streams: [{ id, data?, updateRanges? }]` — per named vertex stream. `data`
  optionally swaps the backing typed array (it MUST match the registered
  stream's byte length and element type — a partial update cannot resize or
  relayout the buffer); omit it to reuse the stream's array (mutated in place).
  `updateRanges` are the 4-byte-aligned `{ byteOffset, byteLength }` windows that
  changed; omit them to re-upload the whole stream.
- `index: { data?, updateRanges? }` — same contract for the index buffer.
- `updateRanges` (top level) — a shared default applied to any named stream/index
  that does not carry its own.
- Streams and the index buffer NOT named are re-published with an empty range
  list, so the renderer **skips** re-uploading them.

**The byte counter.** On a frame where a dynamic mesh was partially updated, the
frame report grows a `dynamicMeshUploads` section: `frameBytes` (the update-range
bytes actually streamed this frame), `frameWrites`, `frameUpdates`,
`frameFullBytes` (what a full re-realization of those buffers would have cost),
a `partial` flag (`frameBytes < frameFullBytes`), and cumulative `total*`. It is
present ONLY when a dynamic upload happened, so a frame with no mesh update stays
byte-identical. This is the proof that the upload was partial rather than a full
re-registration.

**The contract: partial upload, no re-registration.** As long as the layout is
stable (same stream ids, byte sizes, element types, attribute layout, and index
format — bounds may change freely), the update reuses the existing GPU buffers
and streams only the named ranges. Changing any of those forces a normal
re-realization (fall back to `dynamic().publish(fullMesh)` for a wholesale swap).
Every invalid input — unknown handle, unready asset, empty update, unknown
stream, stream/index length-or-type mismatch, out-of-bounds or misaligned range,
missing index buffer — is rejected with a structured `meshUpdate.*` diagnostic in
`result.diagnostics` and NO publish, so a bad range never reaches WebGPU as a raw
validation error. Keep dynamic meshes SMALL and set a generous static `localAabb`
that already contains every deformed pose so the mesh is not frustum-culled and
the bounds do not churn.

See `examples/cloth-flag.html` for a CPU-simulated cloth banner deforming every
frame, whose report byte counter stays partial across the run.

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
