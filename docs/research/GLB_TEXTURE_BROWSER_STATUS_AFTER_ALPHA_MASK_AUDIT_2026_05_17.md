# GLB Texture Browser Status After Alpha-Mask Audit - 2026-05-17

## Scope

Audit the `standard-gltf-texture` browser fixture after adding the
GLB-derived alpha-mask texture pixel scenario.

This audit checks architecture drift and JSON-safety only. It does not add new
rendering behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

No corrective code change is needed.

The new alpha-mask texture scenario still follows the intended ownership model:

- source material, texture, sampler, and mesh assets are planned through
  GLB-shaped source reports;
- source assets are registered in the app asset registry before rendering;
- the renderable entity is authored through ECS components with stable mesh and
  material handles;
- rendering remains derived from the extracted snapshot and WebGPU app report;
- GPU resources stay inside `@aperture-engine/webgpu`.

The browser status remains JSON-safe:

- published texture and sampler data are stable handle keys, sampler mapping
  descriptors, expected colors, and normalized sample points;
- readback status contains copied pixel values and origins only;
- source texture bytes are not published;
- source asset objects are not published;
- backend caches, bind groups, pipelines, encoders, queues, device handles, and
  raw WebGPU resources are not published.

The added `standardTexture.samples` shape is local to the example status and is
small enough to keep inline for now. A helper extraction is not warranted until
another fixture needs multi-sample texture status.

## Validation Context

The alpha-mask texture scenario was validated by:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "base-color alpha"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check`

## Follow-Ups

Keep `task-1127` as the next architecture task. If continuing GLB fixture work
instead, use `task-1128` for invalid texture/sampler diagnostics or `task-1129`
for delayed dependency browser diagnostics before adding more visual scenarios.
