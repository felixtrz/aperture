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

For browser rendering examples, the preferred user-facing path is
`createWebGpuApp` from `@aperture-engine/webgpu`. Author scenes by spawning ECS
entities with transform, camera, mesh, material, light, visibility, and system
components; create mesh/material/texture/sampler data through typed asset
collections; then let the app facade step ECS, extract a render snapshot, prepare
WebGPU resources, and submit the frame. Direct WebGPU helpers remain backend and
test surfaces, not the default application API.

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

`npm run check` runs TypeScript checks, browser harness syntax checks, lint,
format checking, and the Vitest suite. Build output is emitted to `dist/`.

Run browser examples:

```sh
npm run examples:build
npm run examples:serve
```

Then open `http://127.0.0.1:4173/`. The local server uses Node built-ins only
and serves the browser harness from `examples/` plus the built package from
`dist/`. The initial clear example exercises the low-level WebGPU initialization
path. New user-facing examples should prefer `createWebGpuApp`, ECS-authored
entities, typed assets, and systems.

The ECS triangle example is available at
`http://127.0.0.1:4173/examples/triangle.html`. It authors a camera and mesh
entity in ECS, extracts a render snapshot, uploads unlit GPU resources, and
submits a WebGPU draw from derived render-world data.

The ECS multi-entity example is available at
`http://127.0.0.1:4173/examples/multi-entity.html`. It renders two ECS mesh
entities through the same snapshot, render-world binding, and WebGPU unlit draw
path with distinct transforms and materials.

The ECS spinning cube example is available at
`http://127.0.0.1:4173/examples/spinning-cube.html`. It renders a lit
`StandardMaterial` box mesh through `createWebGpuApp`, extracts ambient and
directional lights from ECS, and updates the authoritative ECS transform every
animation frame before WebGPU consumes the derived render snapshot.

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
