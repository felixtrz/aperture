# IBL/Shadow Planning Chain Audit

Date: 2026-05-19

## Scope

This audit covers the first GLTF scene IBL/shadow planning chain from
`task-1806` through `task-1809`:

- IBL preparation pass planning.
- Directional shadow view/projection planning.
- Shadow caster draw-list planning.
- StandardMaterial IBL/shadow shader binding readiness metadata.

## Reference anchors

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `references/engine/src/scene/renderer/shadow-renderer.js`
- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
- `references/three.js/src/renderers/shaders/ShaderChunk`

The common reference pattern is still: collect renderable/light/environment
state, prepare renderer-owned resources, then bind/sample those resources during
render passes. Aperture's current implementation intentionally stops at
JSON-safe planning/readiness reports until the ECS-derived snapshot and
WebGPU-only resource contracts are ready to carry real GPU work.

## Findings

- ECS remains the source of truth. The GLTF scene status path consumes extracted
  render packets, light packets, environment intents, and shadow request packets;
  it does not add a mutable scene graph or renderer-owned gameplay state.
- The IBL and shadow helpers are renderer-owned diagnostics in
  `packages/webgpu`. They report stable resource keys, pass keys, matrix keys,
  draw-list records, and readiness sections instead of live GPU objects.
- The reports remain JSON-safe. A targeted scan for raw WebGPU handle names,
  command submission APIs, WebGL fallback names, and scene graph shortcuts found
  matches only in JSON-safety test regexes.
- Command encoding remains deferred. The shadow caster draw list reports
  planned casters and skipped counts, while shadow pass submission and command
  encoding are explicitly false/deferred.
- Shader/bind-group changes remain deferred. StandardMaterial IBL/shadow binding
  readiness exposes planned slot metadata, but the bind-group layout and shader
  sampling sections are still false.
- No public custom material API or app-owned material adapter shortcut was added
  during these tasks.

## Validation

- `pnpm run check:boundaries`
- Raw-handle and fallback scan over:
  - `packages/webgpu/src/webgpu/*ibl*`
  - `packages/webgpu/src/webgpu/*shadow*`
  - `examples/gltf-scene.js`
  - `test/webgpu/*ibl*`
  - `test/webgpu/*shadow*`

## Recommendation

The next implementation slice should stay data-first and add the shadow matrix
buffer descriptor before allocating a GPU buffer. That gives the visible shadow
path a concrete resource contract while preserving the current boundary between
ECS extraction, render planning, GPU allocation, and command submission.
