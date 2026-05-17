# Alpha-Test And Transparent Queue Consumption Plan - 2026-05-17

## Context

`task-0623` added renderer-independent material queue sorting for opaque,
alpha-test, and transparent phases. `task-0629` then added WebGPU app
diagnostics proving that non-opaque queue items are currently rejected before
submission. This audit plans the smallest safe path from diagnostic-only
behavior to browser-rendered alpha-test and transparent queue items.

Relevant Aperture implementation:

- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/*-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/*-pipeline.ts`

Reference patterns inspected:

- Bevy keeps `Opaque3d` and `AlphaMask3d` in binned phases, with
  `Transparent3d` in a sorted phase. Its mesh pipeline enables depth writes for
  opaque/alpha-mask replacement paths and disables depth writes for alpha-blend
  paths.
- three.js separates render-list items into opaque and transparent arrays,
  sorts opaque front-to-back, sorts transparent back-to-front, and renders
  opaque before transparent.
- PlayCanvas keeps separate opaque and transparent layer lists, defaults
  transparent sorting to back-to-front, and gives alpha-test/cutout materials a
  distinct opaque sort bit so they render after fully opaque draws.

## Current Aperture State

The renderer-independent queue already has the needed phase contract:

- `opaque` items sort first by phase, pipeline, material, mesh, then depth.
- `alpha-test` items sort after opaque and before transparent.
- `transparent` items sort after alpha-test and use back-to-front depth order
  with stable tie breakers.

The app route is still intentionally narrower:

- `collectQueuedOpaqueBuiltInAppResourceSet()` rejects every queue item whose
  `renderPhase` is not `opaque`.
- The queue route only runs for mixed multi-resource frames; single-family
  frames can still take older app paths until `task-0630` lands.
- Descriptor cache keys include material render-state tokens, but the browser
  pipeline descriptors still create opaque-style WebGPU descriptors: fragment
  targets do not carry blend state, and depth writes remain enabled whenever a
  depth format is present.

## Smallest Safe Route

1. Make built-in WebGPU pipeline descriptors render-state aware before changing
   queue consumption. Descriptor plans and browser descriptors should derive
   WebGPU depth/blend state from the material pipeline key:
   - `opaque`: no blend, depth test/write according to the authored depth
     state tokens.
   - `mask`: no blend, depth writes enabled, fragment discard handled by
     shader/material data where supported.
   - `blend`: blend target required, depth test allowed, depth writes disabled.

2. Consume alpha-test queue items first, limited to `StandardMaterial`.
   `StandardMaterial` already packs `alphaCutoff` and an alpha-mask feature
   flag, and the shader discards when `alpha < alphaCutoff`. The first slice
   should not promote unlit or matcap alpha-test, because unlit has no discard
   path and matcap alpha semantics are not yet covered by app pixel tests.

3. Consume transparent queue items after descriptor render state is proven.
   The first transparent slice should support `StandardMaterial` with
   `alphaMode: "blend"`, `depth.write: false`, and `blend.preset: "alpha"`.
   The existing material validation already diagnoses blend materials with
   depth writes enabled or no blend preset. The app should preserve JSON-safe
   diagnostics for unsupported blend presets and unsupported material families.

4. Keep phase ordering queue-driven. Do not add pairwise material branches or a
   renderer-owned scene list. The WebGPU app should consume `MaterialQueueItem`
   order after resources are prepared, then feed the same flat snapshot-derived
   draw packets through the render-world/frame-plan boundary.

5. Prove pixels in the browser after unit coverage. Unit tests should validate
   descriptor depth/blend state, JSON-safe app diagnostics, alpha-test routing,
   and transparent queue order. Playwright should then verify a small frame
   where an opaque object, an alpha-test StandardMaterial cutout, and a
   transparent StandardMaterial overlap with deterministic color output.

## Diagnostics Policy

Keep every unsupported case as plain JSON diagnostics:

- Unsupported phase/material-family pair:
  `webGpuApp.unsupportedMaterialQueuePhase`.
- Unsupported alpha-test family:
  `webGpuApp.unsupportedMaterialQueueAlphaTestFamily`.
- Unsupported transparent family:
  `webGpuApp.unsupportedMaterialQueueTransparentFamily`.
- Unsupported transparent blend preset:
  `webGpuApp.unsupportedMaterialQueueBlendPreset`.
- Invalid depth/write/blend state should continue to surface from material
  validation and may be mirrored at the app boundary when a stale or synthetic
  snapshot bypasses asset validation.

Diagnostics should include `renderId`, `drawIndex`, `renderPhase`,
`materialFamily`, `materialKey` when available, and the source ECS entity.

## Material Family Order

Support first:

- `StandardMaterial` alpha-test (`alphaMode: "mask"`), because the uniform
  buffer and shader already carry alpha cutoff/discard support.
- `StandardMaterial` transparent alpha blend, after browser descriptors write
  real blend state and disable depth writes.

Defer:

- `UnlitMaterial` alpha-test until the unlit shader has an explicit discard
  path and alpha-cutoff data.
- `UnlitMaterial` transparent until unlit browser descriptors and app bind
  groups have pixel coverage for alpha blending.
- `MatcapMaterial` alpha-test/transparent until matcap blend and cutout
  behavior are defined and tested.
- `DebugNormalMaterial` non-opaque phases; it is diagnostic/debug output, not a
  material authoring target for transparency.

## Backlog Slices

The follow-up tasks should land in this order:

1. Make built-in WebGPU descriptor plans and browser descriptors render-state
   aware for mask/blend keys.
2. Allow the queue app route to collect and submit StandardMaterial alpha-test
   items.
3. Allow the queue app route to collect and submit StandardMaterial transparent
   alpha-blend items.
4. Add Playwright pixel coverage for the StandardMaterial alpha-test and
   transparent queue route.
5. Audit the expanded phase route before broadening support to unlit or matcap.

## Audit Result

The `task-0640` audit found the phase route still snapshot-derived and
queue-driven, with WebGPU resources owned by `packages/webgpu`. The one drift
found in browser validation was WebGPU auto-layout bind-group ownership:
StandardMaterial light bind groups must be scoped per pipeline just like shared
view/transform bind groups, because `layout: "auto"` creates pipeline-owned
layouts. The app route now scopes non-material bind groups by pipeline key, and
Playwright verifies opaque, alpha-test, and transparent StandardMaterial phases
with deterministic pixels.
