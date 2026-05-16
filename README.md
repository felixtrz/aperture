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

This repository is currently in its foundation phase. The public entrypoint only exposes minimal project identity metadata; ECS and renderer implementation work starts in later backlog tasks.

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

Then open `http://127.0.0.1:4173/`. The local server uses Node built-ins
only and serves the browser harness from `examples/` plus the built package
from `dist/`. The initial example imports Aperture from `dist/`, initializes
WebGPU against a canvas, and clears it to a distinctive color when the browser
supports WebGPU.

The ECS triangle example is available at
`http://127.0.0.1:4173/examples/triangle.html`. It authors a camera and mesh
entity in ECS, extracts a render snapshot, uploads unlit GPU resources, and
submits a WebGPU draw from derived render-world data.

The ECS multi-entity example is available at
`http://127.0.0.1:4173/examples/multi-entity.html`. It renders two ECS mesh
entities through the same snapshot, render-world binding, and WebGPU unlit draw
path with distinct transforms and materials.

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
