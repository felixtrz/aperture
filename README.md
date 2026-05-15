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
npm run build
npm test
npm run lint
npm run format:check
```

Build output is emitted to `dist/`.

## Constraints

- ECS is the source of truth.
- Rendering is derived from ECS state.
- WebGPU is the only rendering backend.
- There is no core mutable `Object3D`/scene graph.
- Render extraction is a first-class boundary.
- Future worker-thread simulation must remain possible.
