# Authoring Aperture Apps

The default Aperture app is a Vite app with an `aperture.config.ts` file and
worker-discovered ECS systems. The Vite plugin owns browser bootstrap, worker
bundling, asset preload, render extraction, snapshot transport, WebGPU
submission, resize, input forwarding, and diagnostics.

## File Shape

Normal browser apps use this shape:

- `vite.config.ts`: installs the Aperture Vite plugin.
- `aperture.config.ts`: declares mode, canvas, systems, assets, render defaults,
  input, signals, and diagnostics.
- `src/systems/*.system.ts`: default-export ECS system classes that run in the
  simulation worker.

`index.ts` is not required for the first scene. User code should not call
`createWebGpuApp()`, `createExtractionApp()`, `stepAndExtract()`, post render
snapshots, or register renderer-side source assets before it can see a cube or
GLB.

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
is Node/build-time code.

## Aperture Config

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
  },
});
```

Asset preload policies:

- `blocking`: loaded before the first simulation tick.
- `background`: starts immediately and exposes readiness signals to systems.
- `manual`: registered in the manifest and loaded when a system or command
  requests it.

Headless apps use the same config shape with `mode: "headless"` and no canvas.

## Setup System

Scene setup is ECS startup work in a system, not mutation of a main-thread app
object.

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export const schedule = { priority: 0 };

export default class SetupSystem extends createSystem() {
  override init(): void {
    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [1, 0.4, 0.2, 1] }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      transform: { translation: [1, 0, 0] },
    });
  }
}
```

`name` is a debugging label. `key` is optional app-authored identity when a
globally unique stable lookup is useful. The canonical runtime identity remains
`{ index, generation }`.

## Runtime System

Systems map to EliCS systems and can query ECS components directly.

```ts
import {
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export const schedule = { priority: 100 };

const SpinCrateSystemBase = createSystem({
  crates: {
    required: [Name, LocalTransform],
    where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
  },
});

export default class SpinCrateSystem extends SpinCrateSystemBase {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time));
    }
  }
}
```

Lower numeric `schedule.priority` runs earlier. System modules default-export
the class; the generated worker registers discovered systems in priority order.
The main-thread generated bootstrap receives only serializable manifest
metadata, not live system classes.

## Reactive Effects

Use lifecycle-owned effects for ECS mutation driven by signals. Do not use raw
Preact `effect()` for arbitrary microtask-time ECS writes.

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SelectSystem extends createSystem() {
  override init(): void {
    this.effects.watch(this.input.actions.select.pressed, (pressed) => {
      if (pressed) {
        this.diagnostics.info("select.pressed");
      }
    });
  }
}
```

Effects registered in `init()` are disposed on system destroy and flushed in
explicit simulation phases.

## Advanced APIs

Programmatic app creation, manual stepping, manual worker transport, direct
render snapshot inspection, source asset transfer packages, renderer-side
registration, and custom render hosts remain available as advanced paths.
Start with [`ADVANCED_ORCHESTRATION.md`](./ADVANCED_ORCHESTRATION.md) when you
need generated bootstrap internals, tests, tools, or nonstandard loops.
