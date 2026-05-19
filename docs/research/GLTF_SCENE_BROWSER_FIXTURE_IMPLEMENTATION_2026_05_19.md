# GLTF Scene Browser Fixture Implementation

Date: 2026-05-19
Task: `task-1791`
Category: `runtime-orchestration`

## What Landed

- Added `examples/gltf-scene.html` and `examples/gltf-scene.js`.
- The example creates a GLTF-derived scene contract, registers typed source
  mesh/material assets, replays ECS authoring commands, and renders through
  `createWebGpuApp`.
- The fixture renders three primitive shapes: plane, box, and cone.
- The fixture uses two built-in material families: `StandardMaterial` and
  `UnlitMaterial`.
- The fixture carries camera, direct-light, environment/IBL intent, and shadow
  intent metadata in JSON-safe status.
- Added `test/e2e/gltf-scene.spec.ts` to verify status, pixels, draw counts,
  render-world active objects, and JSON-safe diagnostics.

## Bridge Fix

The browser test exposed that `replayGltfEcsAuthoringCommands` applied short
glTF asset IDs to `Mesh` and `Material` components, while extraction expects
stable handle keys such as `mesh:gltf:...` and `material:gltf:...`. Replay now
uses the command value's existing `handleKey` for render authoring components.

## Validation

- `pnpm exec vitest run test/assets/gltf-ecs-command-replay.test.ts test/assets/gltf-scene-import-contract.test.ts`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm run check:examples`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

## Next

Start `task-1792`: turn the scene's environment/IBL intent into renderer-owned
environment resource readiness or a structured unsupported diagnostic that is
surfaced through the GLTF scene app status.
