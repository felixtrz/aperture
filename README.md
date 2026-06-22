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
default app surface is `@aperture-engine/app` plus the Aperture Vite plugin.
Lower-level simulation, render extraction, runtime transport, and WebGPU
presentation live in focused packages.

For browser rendering, the default shape is worker-by-default:

- Main thread: owns the canvas, WebGPU app, renderer-side source assets, and
  input/UI.
- Worker thread: owns `createExtractionApp()`, ECS entities, systems, transform
  updates, and render extraction.
- Boundary: the worker posts transferable `RenderSnapshot` typed arrays; the
  renderer consumes snapshots and never owns gameplay state.

## Quick Start

Scaffold an app with the CLI — it generates the Vite config, the worker/main
split, and starter ECS systems for you:

```sh
pnpm dlx @aperture-engine/cli create my-app
cd my-app
pnpm install
pnpm run dev
```

See [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) for the five-minute
walkthrough (edit systems, load a GLB, react to input) and
[`docs/AUTHORING.md`](docs/AUTHORING.md) for the full authoring model.

## Low-Level Runtime Example

The app facade above is the default surface. The focused runtime packages
remain usable directly for custom orchestration — the example below wires the
worker/renderer split by hand.

Create a renderer main module:

```js
import { createSimulationWorker } from "@aperture-engine/runtime";
import {
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createRenderAssetCollections,
} from "@aperture-engine/render";
import { AssetRegistry } from "@aperture-engine/simulation";
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
  createExtractionApp,
  renderSnapshotTransferList,
  withCamera,
  withMaterial,
  withMesh,
  withRenderLayer,
  withSpin,
  withTransform,
  withVisibility,
} from "@aperture-engine/runtime";
import {
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createRenderAssetCollections,
} from "@aperture-engine/render";

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
pnpm install
```

Run validation:

```sh
pnpm run check
pnpm run build
pnpm test
pnpm run lint
pnpm run format:check
```

`pnpm run check` runs package boundary checks, plan-document status checks,
release/publish checks, TypeScript checks, docs-site build checks, browser
harness syntax checks, lint, format checking, and the Vitest suite. Build output
is emitted to `dist/`.

## Docs Site

The documentation site lives in [`docs-site/`](docs-site/) and is built by
Cloudflare Pages from source. It is not committed as static output under
`docs/`.

Run the production docs build locally:

```sh
pnpm run docs:build:cloudflare
```

Run browser examples:

```sh
pnpm run examples:build
pnpm run examples:serve
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
pnpm run test:e2e
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

## Contributing

Issues are very welcome — bug reports, feature requests, and questions. Aperture
is maintained mostly by AI agents with limited maintainer bandwidth, so it does
**not accept pull requests**; please
[open an issue](https://github.com/felixtrz/aperture/issues/new/choose) instead.
See [`CONTRIBUTING.md`](CONTRIBUTING.md).
