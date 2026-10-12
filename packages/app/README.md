# @aperture-engine/app

The aperture metaframework app facade: config helpers, worker-safe system authoring, and the browser/headless run loop.

## Install

```sh
pnpm add @aperture-engine/app
```

This package is part of the [aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used together with the other `@aperture-engine/*` packages (render, runtime, simulation, physics, audio, webgpu, vite-plugin).

## What it does

`@aperture-engine/app` is the top layer most apps author against. It turns an `ApertureConfig` (mode, assets, signals, input bindings, render defaults) plus a set of ECS systems into a running app — either driving a WebGPU canvas in the browser or stepping deterministically in a headless extraction loop. Systems are authored by extending `createSystem(...)`, which gives each system typed queries, config signals, and worker-safe access facades (spawn, assets, physics, spatial queries, cameras, hierarchy, materials, interaction, diagnostics) without importing the renderer or DOM directly.

## Usage

Author a system, then run it headlessly:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";

class SceneSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 0, 4], lookAt: [0, 0, 0] },
    });
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.plane({ size: [2, 1] }),
      material: material.standard(),
    });
  }
}

const runner = await createApertureHeadlessRunner({
  config: defineApertureConfig({ mode: "headless", systems: [] }),
  systems: [{ default: SceneSystem }],
});

try {
  const { snapshot } = runner.step(1 / 60, 0);
  console.log(snapshot.meshDraws.length);
} finally {
  const cleanupErrors = await disposeApertureApp(runner.app);
  if (cleanupErrors.length > 0) {
    console.error("Aperture cleanup failed", cleanupErrors);
    process.exitCode = 1;
  }
}
```

The runner receives imported module objects. For a default-imported class, use
`systems: [{ default: SceneSystem }]`; for a module namespace, use
`systems: [sceneModule]`. Set scheduling priority in `createSystem({ priority })`.
`config.systems` holds file-discovery patterns for the Vite plugin and CLI.

Await the shared `disposeApertureApp` helper to release systems and features once.
Its returned errors indicate incomplete cleanup; preserve any original operation
error and restart the process before creating another runner if cleanup fails.
Stop using the runner after disposal. Direct `runner.app.dispose()` handles
features only.

The same `createSystem` authoring and `defineApertureConfig` config work for browser apps, which are wired up by the `aperture` Vite plugin (re-exported from `@aperture-engine/app/vite`) and `startGeneratedBrowserApp` from `@aperture-engine/app/browser`.

## Entry points

The package exposes these subpath exports:

- `@aperture-engine/app` — aggregate root (config, advanced app, headless, entity lookup, commands, diagnostics, physics, controllers).
- `@aperture-engine/app/config` — `defineApertureConfig`, `asset`/`signal`/`input` helpers, config types.
- `@aperture-engine/app/systems` — `createSystem`, spawn/material/shader/mesh helpers, ECS components, system access types.
- `@aperture-engine/app/advanced` — `createApertureApp` and the low-level app/step/extract API.
- `@aperture-engine/app/headless` — `createApertureHeadlessRunner` and headless status/step reports.
- `@aperture-engine/app/entity-lookup` — entity lookup and snapshot helpers.
- `@aperture-engine/app/commands` — devtools/command message protocol helpers.
- `@aperture-engine/app/diagnostics` — diagnostic normalization and status helpers.
- `@aperture-engine/app/vite` — the `aperture` Vite plugin (re-exported from `@aperture-engine/vite-plugin`).
- `@aperture-engine/app/browser` — `startGeneratedBrowserApp`, render-settings and input helpers for the browser run loop.
- `@aperture-engine/app/worker` — `startGeneratedSimulationWorker` for running the simulation in a Web Worker.

---

Part of the [aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
