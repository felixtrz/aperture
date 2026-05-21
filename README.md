# Aperture

Aperture is a WebGPU-only, ECS-native 3D runtime where simulation is authoritative and rendering is a derived view.

The intended architecture is:

```text
ECS World
-> Transform/System Resolution
-> Render Extraction
-> Render Snapshot
-> Render World
-> WebGPU Render Graph
-> GPU Submission
```

This repository is currently an early engine foundation with working ECS
authoring, render extraction, WebGPU submission, and browser examples. The
public headless entrypoint is `@aperture-engine/core`; GPU presentation is
available explicitly through `@aperture-engine/webgpu`.

For browser rendering, the default shape is worker-by-default:

- Main thread: owns the canvas, WebGPU app, renderer-side source assets, and
  input/UI.
- Worker thread: owns `createExtractionApp()`, ECS entities, systems, transform
  updates, and render extraction.
- Boundary: the worker posts transferable `RenderSnapshot` typed arrays; the
  renderer consumes snapshots and never owns gameplay state.

## Quick Start

Create a renderer main module:

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

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing canvas.");
}

const sourceAssets = new AssetRegistry();
const assets = createRenderAssetCollections({ registry: sourceAssets });

assets.meshes.add(
  createBoxMeshAsset({ label: "Cube", width: 1.4, height: 1.4, depth: 1.4 }),
  { id: "cube" },
);
assets.materials.debugNormal.add(
  createDebugNormalMaterialAsset({ label: "CubeNormals" }),
  { id: "cube-normal" },
);

const simulationWorker = createSimulationWorker(
  new Worker(new URL("./simulation.worker.js", import.meta.url), {
    type: "module",
  }),
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

Create the matching simulation worker:

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
  if (app !== null || port === null) {
    return;
  }

  app = createExtractionApp({
    worldOptions: { entityCapacity: options.entityCapacity ?? 16 },
  });
  const assets = createRenderAssetCollections({ registry: app.assets });
  const mesh = assets.meshes.add(
    createBoxMeshAsset({ label: "Cube", width: 1.4, height: 1.4, depth: 1.4 }),
    { id: "cube" },
  );
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

  setInterval(postFrame, 16);
}

function postFrame() {
  if (app === null || port === null) {
    return;
  }

  frame += 1;
  const snapshot = app.stepAndExtract(1 / 60, frame / 60, frame);

  port.postMessage(
    {
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      frame,
      snapshot,
    },
    renderSnapshotTransferList(snapshot),
  );
}
```

See [`docs/AUTHORING.md`](docs/AUTHORING.md) for the full authoring model,
command messages, one-off scenes, animated scenes, and migration notes for the
removed main-thread WebGPU app authoring surface. Direct WebGPU helpers remain
backend and test surfaces, not the default application API.

## Development

Install dependencies:

```sh
npm install
```

Run validation:

```sh
npm run check
npm run build
npm test
npm run lint
npm run format:check
```

`npm run check` runs package boundary checks, progress tracker freshness
validation, TypeScript checks, browser harness syntax checks, lint, format
checking, and the Vitest suite. Build output is emitted to `dist/`.

## Public Progress Tracker

The static project dashboard is published from
[`docs/index.html`](docs/index.html) through GitHub Pages at
[`https://felixtrz.github.io/aperture/`](https://felixtrz.github.io/aperture/).

Update `docs/index.html` whenever a run changes project status, completes
notable backlog work, changes the recommended next task, or materially changes
overall completion estimates. Render-pipeline work should also update
[`docs/render-pipeline-comparison.html`](docs/render-pipeline-comparison.html)
so phase estimates and concrete missing pieces stay aligned.

Run tracker validation after edits:

```sh
npm run check:progress
```

The check is local-only. It verifies recent update dates and six phase-status
entries without requiring network access or exact percentage values.

Run browser examples:

```sh
npm run examples:build
npm run examples:serve
```

Then open `http://127.0.0.1:4173/`. The local server uses Node built-ins only
and serves the browser harness from `examples/` plus the built package from
`dist/`. The initial clear example exercises the low-level WebGPU initialization
path. New user-facing examples should prefer `createWebGpuApp`, ECS-authored
entities, typed assets, systems, and the worker-split main/worker shape.

The ECS triangle example is available at
`http://127.0.0.1:4173/examples/triangle.html`. Its worker authors a camera and
mesh entity in ECS and extracts a render snapshot; the main thread uploads
unlit GPU resources and submits a WebGPU draw from derived render-world data.

The ECS multi-entity example is available at
`http://127.0.0.1:4173/examples/multi-entity.html`. Its worker owns the large
scenario ECS matrix and extraction path; the main thread renders received
snapshots through the manual render-world binding and WebGPU unlit draw path.

The ECS spinning cube example is available at
`http://127.0.0.1:4173/examples/spinning-cube.html`. It renders a lit
`StandardMaterial` box mesh through `createWebGpuApp`; the worker extracts
ambient, directional, and environment lights from ECS and updates the
authoritative ECS transform every animation frame before WebGPU consumes the
derived render snapshot.

The material showcase example is available at
`http://127.0.0.1:4173/examples/materials-showcase.html`. It renders unlit,
StandardMaterial, and MatcapMaterial cubes through the app facade from
ECS-authored mesh/material entities and publishes JSON-safe app render reports.

The app diagnostics example is available at
`http://127.0.0.1:4173/examples/app-diagnostics.html`. It demonstrates how app
render failures report material dependency readiness, missing resources, and
submission state without exposing raw WebGPU/browser objects. It also publishes
aggregate dependency summary counts for failure scenarios so tests and tooling
can inspect readiness by material kind, dependency kind, status, and diagnostic
code without parsing source asset handles.

Run browser verification:

```sh
npm run test:e2e
```

The Playwright Chromium project passes `--enable-unsafe-webgpu` for local
WebGPU execution. If Chromium cannot expose WebGPU on the current machine, the
clear smoke test reports the unsupported WebGPU reason from Aperture's
initialization helper.

See [`docs/BROWSER_E2E_RENDERING.md`](docs/BROWSER_E2E_RENDERING.md) for the
current ECS-to-WebGPU browser verification workflow, supported commands, and
Playwright artifacts for browser rendering failures, including status
attachments, readback diagnostics, screenshots, videos, and traces.

## Constraints

- ECS is the source of truth.
- Rendering is derived from ECS state.
- WebGPU is the only rendering backend.
- There is no core mutable `Object3D`/scene graph.
- Render extraction is a first-class boundary.
- Future worker-thread simulation must remain possible.
