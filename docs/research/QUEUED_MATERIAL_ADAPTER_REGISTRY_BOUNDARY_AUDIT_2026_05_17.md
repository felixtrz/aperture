# Queued Material Adapter Registry Boundary Audit - 2026-05-17

## Scope

Audited queued material adapter registry diagnostics and JSON projection from
`task-0748` and `task-0749`.

Audited files:

- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/webgpu/queued-material-adapter.test.ts`
- `test/webgpu/queued-material-adapter-json.test.ts`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/rendering/material-queue.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift found.

`createQueuedMaterialAdapterRegistry` remains a WebGPU-side setup helper. It
stores caller-provided adapter registrations, returns the first adapter whose
`kind` matches a requested material family, and returns `null` for unknown
families so the app route can continue emitting unsupported-family diagnostics.

The new duplicate-family diagnostics are setup/readiness metadata only:

- They are computed from adapter `kind` strings.
- They do not inspect `RenderSnapshot`, `MaterialQueueItem`, ECS worlds, source
  asset registries, prepared resources, WebGPU devices, pipelines, bind groups,
  or command encoders.
- They do not change first-match routing behavior.
- They do not allocate GPU resources or mutate render state.

The JSON helper exposes only adapter count, family strings, and diagnostics. It
omits adapter objects and functions, making the report safe for inspection and
future frame diagnostics.

Exporting `queued-material-adapter.ts` through `@aperture-engine/webgpu` keeps
the helper in the WebGPU backend package and does not introduce dependencies
from simulation or render back into WebGPU internals.

## Validation

- Ownership scan found no ECS, snapshot, render packet, GPU device, queue, or
  pipeline usage in the adapter registry helper.
- `pnpm exec vitest run test/webgpu/queued-material-adapter.test.ts test/webgpu/queued-material-adapter-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.

## Follow-Ups

No corrective refactor is needed.

The next queue work should plan a JSON-safe WebGPU app material queue route
report that summarizes selected adapters, unsupported families/phases, asset
mismatches, and prepared resource failures without moving queue routing into
ECS or render extraction.
