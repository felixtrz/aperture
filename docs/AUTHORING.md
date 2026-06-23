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
- `@group(3)`: reserved for future renderer extensions.

Mesh vertex locations follow the built-in instance layout: `@location(0)`
position (`vec3f`), `@location(1)` normal (`vec3f`), and `@location(2)` UV
(`vec2f`). Use `runtimeUniformKey` on a group-2 uniform binding when per-frame
values should come from `this.spawn.runtimeUniform(...)`.

Current limitations: WGSL only; no shader imports; no user-supplied WebGPU
objects or callbacks; no arbitrary app-owned material adapter registration; and
lighting/environment integration is deferred. App-route custom WGSL supports
group-2 uniform buffers, texture bindings, sampler bindings, existing
instance-attribute layouts, and mixed built-in/custom frames through the normal
`createWebGpuApp()` path. Storage-buffer bindings are validated but reported as
unsupported until a renderer-independent buffer source asset exists.

See [`recipes/custom-wgsl-material.md`](./recipes/custom-wgsl-material.md) for
a complete shader and material setup.

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
