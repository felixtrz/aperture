# Advanced Orchestration

This page covers lower-level APIs for generated bootstrap internals, tests,
tools, and nonstandard hosts. New browser apps should start with
[`AUTHORING.md`](./AUTHORING.md).

## Worker And Main Split

Aperture browser apps still preserve the worker-by-default architecture. The
main thread owns the canvas and WebGPU renderer. A module Worker owns ECS
authoring, systems, transforms, and render extraction. The boundary between
them is a typed `RenderSnapshot`.

Advanced code can wire that boundary manually with `createWebGpuApp()`,
`createSimulationWorker()`, `createExtractionApp()`, and direct snapshot
transport. This is useful for tests, tools, custom hosts, and render-only
consumers. It is not the recommended first-app path.

## Manual Renderer Main

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

## Manual Simulation Worker

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

## SharedArrayBuffer Transport

Large scenes can opt into
`createWebGpuApp({ transport: "shared-array-buffer" })`. This mode requires
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`; otherwise `createWebGpuApp()`
reports a typed fallback diagnostic and uses the default transferable transport.
See [`SHARED_ARRAY_BUFFER_TRANSPORT.md`](./SHARED_ARRAY_BUFFER_TRANSPORT.md)
and `examples/sab-cube.html` for the complete pattern.
