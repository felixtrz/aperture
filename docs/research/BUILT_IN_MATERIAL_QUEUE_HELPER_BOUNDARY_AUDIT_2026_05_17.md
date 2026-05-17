# Built-In Material Queue Helper Boundary Audit - 2026-05-17

## Scope

Audit the extraction of built-in material queue family and phase diagnostics out
of `packages/webgpu/src/webgpu/app.ts`.

The audit is intentionally narrow. It checks that the extracted helpers preserve
the existing WebGPU app route behavior and do not create new ownership paths
back into ECS, render snapshots, source assets, or GPU resources.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_ROUTE_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-family.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `test/webgpu/built-in-material-queue-family.test.ts`
- `test/webgpu/built-in-material-queue-phase.test.ts`
- focused material queue diagnostics in `test/webgpu/webgpu-app.test.ts`

## Findings

- The built-in family helper is a pure string guard over `unlit`, `matcap`, and
  `standard`. It imports no ECS, render snapshot, source asset, or GPU-resource
  modules.
- The phase diagnostic helper is also pure. It accepts queue-item-shaped data,
  parses only the existing material pipeline key tokens, and returns JSON-safe
  diagnostics or `null`.
- `app.ts` still owns WebGPU app orchestration, source-asset lookup, texture and
  sampler preparation, frame resource creation, pipeline/layout use, and draw
  submission.
- The queue route still uses the same three built-in adapter registrations. The
  extracted phase validator is assigned to each adapter, preserving the previous
  support matrix:
  - all built-in families support `opaque`;
  - only `standard` supports `alpha-test`;
  - only `standard` supports `transparent` with alpha blending;
  - other phases, families, and blend presets produce diagnostics.
- The first-material-kind readiness guard now calls the shared family helper,
  but the supported family set and error message remain unchanged.
- No mutable scene graph, renderer-owned ECS/game state, WebGL fallback, or GPU
  resource ownership change was introduced.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/webgpu/built-in-material-queue-family.test.ts test/webgpu/built-in-material-queue-phase.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "unsupported material queue families|unsupported alpha-test material queue families|unsupported transparent material queue families"`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Follow-Ups

- Continue with the planned route report app integration design before wiring
  route counts into `createWebGpuApp`.
- Keep future extraction focused on pure adapter contracts first. GPU resource
  preparation should remain in `app.ts` until a smaller cache/scratch boundary
  has been designed.
