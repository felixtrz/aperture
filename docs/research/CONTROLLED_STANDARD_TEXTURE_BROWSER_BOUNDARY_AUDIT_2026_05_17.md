# Controlled StandardMaterial Texture Browser Boundary Audit - 2026-05-17

## Scope

Audit the dedicated StandardMaterial texture control browser example and its
Playwright coverage.

## References Inspected

- `examples/standard-texture-control.html`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `examples/materials-showcase.js`
- `examples/webgpu-readback.js`
- `docs/ARCHITECTURE.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_HARNESS_AUDIT_2026_05_17.md`

## Findings

- The example uses the public app facade route with ECS-authored camera, lights,
  mesh, materials, texture, and sampler assets. It does not add renderer-owned
  scene state.
- The example renders two fixed StandardMaterial primitives: a scalar baseline
  and a base-color textured material. This keeps the proof narrower than the
  animated materials showcase.
- Status JSON contains stable keys, counts, sample coordinates, and expected
  colors. It does not expose source texture payloads, prepared resources, cache
  maps, or GPU handles.
- The Playwright test asserts the textured material uses the
  `standard|baseColorTexture|opaque|back|less|none` pipeline key, creates one
  texture/sampler resource pair, submits two draws, and produces visually
  distinct screenshot samples.
- Current verification is screenshot-based. App-facade current-texture readback
  remains a separate future capability if exact pixel readback is needed.

## Validation

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## Result

No ECS/render/WebGPU ownership drift found. The next concrete follow-up is the
missing/not-ready StandardMaterial texture browser diagnostics plan.
