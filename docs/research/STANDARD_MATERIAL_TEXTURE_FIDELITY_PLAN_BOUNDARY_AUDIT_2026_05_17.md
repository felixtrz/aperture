# StandardMaterial Texture Fidelity Plan Boundary Audit - 2026-05-17

## Scope

Audit the `task-0969` StandardMaterial texture fidelity diagnostics plan.

This audit checks whether the planned follow-up stays inside a narrow
diagnostics summary slice and avoids expanding into IBL, shadows, texture upload
behavior, shader rewrites, app report wiring, or source asset ownership changes.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_FIDELITY_DIAGNOSTICS_PLAN_2026_05_17.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/three.js/src/materials/MeshStandardMaterial.js`
- `references/three.js/src/textures/Texture.js`

## Findings

The plan is boundary-safe:

- It uses existing StandardMaterial texture readiness reports as input instead
  of adding new ECS components, source asset fields, renderer-owned gameplay
  state, or WebGPU resources.
- The proposed output is aggregate-only. It buckets by stable field names and
  diagnostic codes, plus numeric counts for sampler, color-space, semantic, UV,
  and transform issues.
- The helper explicitly excludes material keys, texture keys, sampler keys, raw
  readiness reports, source assets, prepared resources, bind groups, buffers,
  pipelines, devices, queues, and other GPU handles.
- The planned tests are focused on summary shape and JSON safety. They do not
  require browser rendering, pixel assertions, shader edits, or app report
  changes.
- The plan keeps IBL, shadows, environment maps, render-target behavior,
  texture upload, sampler creation, bind group layout changes, and broad PBR
  shader work out of scope.

## Architecture Check

The planned helper remains an inspection surface over data already derived from
ECS-authored material and asset handles. It does not make WebGPU state
authoritative, does not require the renderer to query ECS, and does not create a
scene-graph-style object model.

The WebGPU package placement is acceptable because recent diagnostics summary
helpers live there when they are backend/app inspection surfaces. The helper
should still import only renderer-independent JSON types from `@aperture-engine/render`
or the public barrel, not raw asset registries or WebGPU resources.

## Backlog Tightening

`task-0983` has been tightened to name the concrete implementation target:
adding a JSON-safe StandardMaterial texture fidelity summary helper with field
and issue buckets.

No additional task split is required before implementation. A later app wiring
task can be added only if the summary proves useful as an optional report
surface.

## Validation Recommendation

For `task-0983`, run:

- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

If the helper imports render package types, also run:

- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
