# Authoring Aperture Apps

Aperture browser apps use a worker-by-default shape. The main thread owns the
canvas and WebGPU renderer. A module Worker owns ECS authoring, systems,
transforms, and render extraction. The boundary between them is a typed
`RenderSnapshot`.

## File Shape

A normal app has two JavaScript entry points:

- `app.main.js`: creates `createWebGpuApp()`, registers renderer-side source
  assets, collects input, and starts a `SimulationWorker`.
- `app.worker.js`: creates `createExtractionApp()`, registers the same source
  assets by stable handle ID, spawns ECS entities, runs systems, and posts
  snapshots.

The main thread must not call `app.spawn(...)`, mutate ECS components, or keep a
renderer-owned scene graph. GPU resources are prepared from source assets and
worker snapshots.

## Renderer Main

Use stable asset IDs on the main thread so renderer-side source assets match the
handles extracted by the worker:

```js
import {
  AssetRegistry,
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createRenderAssetCollections,
  createSimulationWorker,
} from "@aperture-engine/core";
import { createWebGpuApp } from "@aperture-engine/webgpu";

const canvas = document.querySelector("#aperture-canvas");
const sourceAssets = new AssetRegistry();
const assets = createRenderAssetCollections({ registry: sourceAssets });

assets.meshes.add(createBoxMeshAsset({ label: "Cube" }), { id: "cube" });
assets.materials.debugNormal.add(
  createDebugNormalMaterialAsset({ label: "CubeNormals" }),
  { id: "cube-normal" },
);

const simulationWorker = createSimulationWorker(
  new Worker(new URL("./app.worker.js", import.meta.url), { type: "module" }),
  { entityCapacity: 16 },
);
const created = await createWebGpuApp({
  canvas,
  sourceAssets,
  simulationWorker,
  autoStart: true,
});

if (!created.ok) {
  throw new Error(created.message);
}
```

`createWebGpuApp()` subscribes to the worker and renders incoming snapshots.
Examples that need custom manual render paths can still call
`app.renderSnapshot(snapshot, options)`, but ECS authoring should stay in the
worker.

## Simulation Worker

The public worker helper connects a `MessagePort` and sends a start message.
The worker should listen for `SIMULATION_WORKER_PROTOCOL.connect`, then respond
to `SIMULATION_WORKER_PROTOCOL.start` by creating an extraction app:

```js
import {
  SIMULATION_WORKER_PROTOCOL,
  SpinSystem,
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createExtractionApp,
  createRenderAssetCollections,
  renderSnapshotTransferList,
  withCamera,
  withMaterial,
  withMesh,
  withRenderLayer,
  withSpin,
  withTransform,
  withVisibility,
} from "@aperture-engine/core";

let port = null;
let app = null;
let frame = 0;

self.onmessage = (event) => {
  if (event.data?.type !== SIMULATION_WORKER_PROTOCOL.connect) {
    return;
  }

  port = event.data.port;
  port.onmessage = (message) => {
    if (message.data?.type === SIMULATION_WORKER_PROTOCOL.start) {
      startSimulation(message.data.options ?? {});
    }
  };
  port.start?.();
};

function startSimulation(options) {
  app = createExtractionApp({
    worldOptions: { entityCapacity: options.entityCapacity ?? 16 },
  });
  const assets = createRenderAssetCollections({ registry: app.assets });
  const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }), {
    id: "cube",
  });
  const material = assets.materials.debugNormal.add(
    createDebugNormalMaterialAsset({ label: "CubeNormals" }),
    { id: "cube-normal" },
  );

  app.registerSystem(SpinSystem);
  app.spawn(
    withTransform({ translation: [0, 0, 3] }),
    withCamera({ aspect: 16 / 9, near: 0.1, far: 100, layerMask: 1 }),
  );
  app.spawn(
    withTransform(),
    withMesh(mesh),
    withMaterial(material),
    withRenderLayer(1),
    withVisibility(true),
    withSpin({ radiansPerSecond: 1.8, axis: [0.4, 1, 0.2] }),
  );

  setInterval(postSnapshot, 16);
}

function postSnapshot() {
  frame += 1;
  const snapshot = app.stepAndExtract(1 / 60, frame / 60, frame);

  port.postMessage(
    { type: SIMULATION_WORKER_PROTOCOL.snapshot, frame, snapshot },
    renderSnapshotTransferList(snapshot),
  );
}
```

`renderSnapshotTransferList(snapshot)` transfers the hot typed-array buffers so
the main thread receives `Float32Array` data without JSON serialization.

## Common Patterns

One-off scene:

- Worker builds the ECS scene on start.
- Worker posts one snapshot.
- Main calls `createWebGpuApp({ autoStart: true })` or manually renders the
  received snapshot.

Animated scene:

- Worker registers systems such as `SpinSystem`.
- Worker calls `app.stepAndExtract(deltaSeconds, elapsedSeconds, frame)` every
  tick.
- Main renders each snapshot and publishes UI/diagnostic status from render
  reports.

Renderer-side controls:

- Main owns DOM inputs, pointer state, and UI.
- Main sends commands to the worker.
- Worker applies commands to ECS state before the next extraction.

## Commands From Main To Worker

Keep commands small and serializable. Prefer app-specific messages over sharing
live objects:

```js
// main
simulationWorker.worker.postMessage({
  type: "set-spin-speed",
  radiansPerSecond: 3,
});
```

```js
// worker
self.onmessage = (event) => {
  if (event.data?.type === "set-spin-speed") {
    pendingSpinSpeed = Number(event.data.radiansPerSecond);
    return;
  }

  // Also handle SIMULATION_WORKER_PROTOCOL.connect here.
};
```

Apply pending commands inside the worker before `stepAndExtract()`. Do not pass
`Entity`, `World`, `AssetRegistry`, WebGPU resources, DOM nodes, or functions
through `postMessage`.

## Migrating Old Main-Thread Apps

The old WebGPU app authoring surface exposed main-thread `app.spawn`,
`app.world`, and `app.assets`. That surface has been removed from
`createWebGpuApp()`.

Migration steps:

1. Move ECS setup, systems, and `app.spawn(...)` calls into a module Worker.
2. Mirror source asset registration on the main thread and worker with stable
   IDs such as `{ id: "cube" }`.
3. Replace main-thread `stepAndRender()` calls with worker
   `stepAndExtract()` plus posted snapshots.
4. Let `createWebGpuApp()` render worker snapshots, or call
   `app.renderSnapshot(snapshot, options)` for manual render examples.
5. Keep diagnostics JSON-safe by reporting handles, counts, and diagnostic
   codes instead of raw WebGPU or ECS objects.

The renderer may prepare GPU resources and summarize render reports, but ECS
state remains authoritative in the worker.
