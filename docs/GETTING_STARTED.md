# Getting Started

> **Doc status (2026-06-12): CURRENT.** Matches the `aperture create` minimal
> template and the `@aperture-engine/app` config/system APIs at 0.1.x.

This is the five-minute path from nothing to a spinning cube you can edit,
then to your own systems and assets. For the full authoring model, see
[`AUTHORING.md`](AUTHORING.md).

## What you need

- Node.js 20 or newer and a package manager (`pnpm` recommended).
- A WebGPU-capable browser (Chrome or Edge 113+, or equivalent).

## 1. Create an app

```sh
pnpm dlx @aperture-engine/cli create my-app
cd my-app
pnpm install
pnpm run dev
```

Open the printed URL (Vite defaults to `http://localhost:5173`). You should
see a blue cube slowly spinning over a dark background, antialiased at 4x
MSAA.

> Working inside the aperture monorepo instead? Run
> `node packages/cli/dist/bin/aperture.js create my-app` after `pnpm run build`.

`aperture create` scaffolds a complete Vite app:

```text
my-app/
├── aperture.config.ts        ← assets, signals, input actions, render options
├── vite.config.ts            ← wires the aperture() Vite plugin
├── index.html                ← hosts the <canvas id="aperture">
└── src/systems/
    ├── setup.system.ts       ← spawns the camera, lights, and cube
    └── spin.system.ts        ← rotates the cube every frame
```

Two more templates exist: `--template glb-viewer` (model viewer) and
`--template game` (input-driven starter).

## 2. How a frame flows

Aperture is ECS-first and worker-by-default:

- Your systems (everything under `src/systems/`) run in a **worker**. They own
  entities, components, and game logic.
- The **main thread** owns the canvas and WebGPU. Every frame it consumes a
  typed render snapshot extracted from ECS state — rendering is a derived
  view, never the source of truth.
- The Vite plugin generates both entries for you. There is no worker
  boilerplate to write.

## 3. Read the two starter systems

`src/systems/setup.system.ts` runs once at `init()` and spawns the scene:

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main" /* ... */ });
    this.spawn.light({ key: "light.key", kind: "directional" /* ... */ });
    this.spawn.mesh({
      key: "starter.cube",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [0.18, 0.58, 1, 1] }),
    });
  }
}
```

`src/systems/spin.system.ts` runs every frame, queries entities, and writes
ECS state:

```ts
export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    cubes: { required: [AppEntityKey, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 0.8 },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.cubes.entities) {
      // rotate via the LocalTransform vector view
    }
  }
}
```

Any file matching `src/systems/**/*.system.ts` with a default-exported system
is discovered automatically — add a file and it runs.

## 4. Make your first changes

With `pnpm run dev` still running:

1. **Change the spin speed.** In `spin.system.ts`, change
   `speed: { ... default: 0.8 }` to `2.5`. The page hot-reloads and the cube
   spins faster.
2. **Change the clear color.** In `aperture.config.ts`, edit
   `render.clearColor`.
3. **Spawn a second cube.** In `setup.system.ts`, duplicate the
   `this.spawn.mesh(...)` call with a different `key` and
   `transform: { translation: [2, 0.5, 0] }`.

## 5. Load a GLB model

Declare the asset in `aperture.config.ts`:

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  // ...
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
  },
});
```

Put `robot.glb` in `public/assets/`, then spawn it from any system:

```ts
this.spawn.gltf(this.assets.gltf("robot"), {
  key: "level.robot",
  name: "robot",
  transform: { translation: [1, 0, 0] },
});
```

glTF/GLB is the supported model format, including Draco and KTX2/Basis
compression, skins, morph targets, and animations (see
[`AUTHORING.md`](AUTHORING.md) for animation playback).

## 6. React to input

Input actions are declared in config and arrive in systems fully typed:

```ts
// aperture.config.ts
input: {
  actions: {
    jump: input.button([input.key("Space"), input.gamepadButton("south")]),
    move: input.axis2d([
      input.keyboard2d({ negativeX: ["KeyA"], positiveX: ["KeyD"] }),
      input.gamepadStick("left"),
    ]),
  },
},
```

```ts
// inside a system's update()
if (this.actions.jump.down()) {
  /* pressed this frame */
}
const x = this.actions.move.x;
```

## Where to go next

- [Authoring guide](https://github.com/felixtrz/aperture/blob/main/docs/AUTHORING.md) — the full metaframework guide: signals,
  asset handles, materials (standard PBR, unlit, custom WGSL), spatial
  queries, physics components, UI, diagnostics.
- [Examples](https://aperture-engine.dev/examples/) — 100+ focused browser examples behind
  `npm run examples:serve`.
- [Architecture](https://github.com/felixtrz/aperture/blob/main/docs/ARCHITECTURE.md) — the ECS → extraction → render-world
  pipeline and the invariants behind it.
- [AI tooling](https://github.com/felixtrz/aperture/blob/main/docs/AI_TOOLING.md) — `aperture dev`, MCP tools, and the
  agent-facing inspection surface scaffolded into every new app.
