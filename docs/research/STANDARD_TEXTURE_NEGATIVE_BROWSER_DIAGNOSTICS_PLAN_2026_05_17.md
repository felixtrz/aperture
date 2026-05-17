# StandardMaterial Missing/Not-Ready Texture Browser Diagnostics Plan - 2026-05-17

## Scope

Plan the smallest browser-visible negative-path coverage for StandardMaterial
texture dependencies after the controlled base-color texture proof landed.

This is a planning slice. It does not change shader sampling, resource
preparation, app report schemas, GLB loading, or texture upload behavior.

## References Inspected

- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `test/e2e/texture-dependency-routing.spec.ts`
- `examples/multi-entity.js`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_BOUNDARY_AUDIT_2026_05_17.md`

## Current State

The new `standard-texture-control` example proves a ready base-color
StandardMaterial texture path through the app facade and screenshot sampling.

`app-diagnostics` already covers a StandardMaterial source-dependency failure:
one ready peer material and one StandardMaterial with a missing base-color
texture plus loading sampler. That path reports
`webGpuApp.materialDependenciesNotReady`, keeps submission disabled, and
aggregates dependency diagnostics without exposing handles in the summary.

The gap is a dedicated browser example/test next to the positive
StandardMaterial texture proof. A reader should not need to discover the
diagnostics-only example to verify how the same focused texture-control surface
fails when the texture is missing or not ready.

## Selected Slice

Extend `standard-texture-control` with an explicit scenario parameter, starting
with `?scenario=missing-texture`.

The scenario should:

- keep the scalar StandardMaterial peer ready so the scene still proves partial
  extraction behavior;
- author the textured StandardMaterial with a missing base-color texture and a
  ready sampler;
- publish `ok: false`, `phase: "extract"` or the current app failure phase,
  `expectedFailure: true`, and JSON-safe diagnostic codes;
- assert no draw submission occurs for the invalid frame;
- include the detailed render diagnostic code
  `render.standardMaterialTexture.textureNotReady` or the current app-level
  source-dependency code if the app facade blocks before render-world binding;
- avoid source texture payloads, prepared resources, backend cache maps, or GPU
  handles in status JSON.

## Deferred Work

- Loading and failed texture/sampler variants can follow after the missing
  texture case establishes the scenario shape.
- StandardMaterial resource-withheld failures should remain separate from source
  asset readiness failures.
- Exact current-texture readback for app-facade examples remains deferred until
  a dedicated readback support plan decides whether to expose it.

## Follow-Up

Proceed with `task-1074`: add the `missing-texture` StandardMaterial texture
control scenario and focused Playwright coverage for JSON-safe no-submission
diagnostics.
