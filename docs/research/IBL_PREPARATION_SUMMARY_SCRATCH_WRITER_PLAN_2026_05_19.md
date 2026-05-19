# IBL Preparation Summary Scratch Writer Plan — 2026-05-19

## Task

`task-1818` planned the scratch-writer follow-up for IBL preparation/status
helpers after the renderer hot-path allocation audit.

## Current Usage

The following helpers are currently diagnostic/browser-status surfaces:

- `createIblTexturePreparationReport`
- `createIblSamplerDescriptorReadinessReport`
- `createIblPreparationPassPlanReport`
- `createIblPreparationResourceSummaryReport`

They are called from `examples/gltf-scene.js` inside `publishFrameStatus`, which
publishes JSON-safe telemetry for the browser example. They are not currently
inside `createWebGpuApp().render`, render-world preparation, command encoding,
or GPU submission.

## Allocation Notes

Before live frame-loop use, writer forms should avoid:

- fresh slot/pass/sampler arrays,
- `flatMap`, `map`, `filter`, and spread clones on success paths,
- `new Set` for stable key uniqueness,
- fresh diagnostic arrays when no diagnostics are emitted.

JSON helpers may keep allocating because they are inspection surfaces.

## Recommended Follow-Up Task

```md
### task-1822 — Add scratch-backed IBL preparation summary writer

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests.
Reference anchor: Decision 0009 hot-path writer guidance and local
`ibl-preparation-resource-summary`.

Acceptance criteria:

- Define reusable scratch storage for IBL preparation resource summary reports.
- Provide a writer API that refills caller-owned arrays for descriptor keys,
  texture keys, sampler keys, pass keys, and diagnostics.
- Keep existing JSON helpers as diagnostic convenience wrappers.
```

## Result

No implementation change was needed for this audit. Current GLTF status usage
remains diagnostic/browser-facing, but the IBL preparation summary should get a
scratch writer before it becomes runtime frame-loop machinery.
