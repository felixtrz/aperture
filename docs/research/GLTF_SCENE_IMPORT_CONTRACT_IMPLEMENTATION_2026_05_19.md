# GLTF Scene Import Contract Implementation

Date: 2026-05-19
Task: `task-1790`
Category: `render-bridge`

## What Landed

- Added `createGltfSceneImportContractReport` in
  `packages/render/src/assets/gltf-scene-import-contract.ts`.
- The contract composes existing pure glTF reports:
  - asset mapping,
  - mesh primitive mapping,
  - primitive material resolution,
  - scene traversal,
  - ECS authoring command planning.
- The contract carries JSON-safe scene-slice intent metadata:
  - primitive shape labels,
  - camera intent,
  - direct-light intent,
  - environment/IBL intent,
  - shadow intent.
- The contract reports focused diagnostics when the scene slice is not ready:
  insufficient primitive shapes, insufficient material families, missing camera,
  missing direct light, missing environment intent, missing shadow intent, or
  invalid/missing prerequisite reports.
- Added JSON conversion helpers so browser fixtures and agent diagnostics can
  inspect the contract without raw typed arrays, ECS entities, or GPU handles.

## Architecture Notes

This is still a contract/report layer. It does not parse binary GLB containers,
does not replay ECS commands, does not allocate GPU resources, and does not add
a scene graph. Source asset registration and ECS command replay remain explicit
separate stages.

The first scene fixture should use this contract as the front door, then replay
the generated ECS authoring commands into the app world through existing helper
paths.

## Validation

- `pnpm exec vitest run test/assets/gltf-scene-import-contract.test.ts`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
