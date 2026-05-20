# Backlog

This file contains immediate executable tasks.

Agents should work on one task at a time, but should continue into the next ready task when the current task finishes before the 55-minute run window has elapsed.

Do not stop merely because one task is complete. Stop only when the 55-minute work window has elapsed, no ready task remains, or a stop condition applies.

When tasks are completed, move them to `agent/COMPLETED.md` or mark them complete here and summarize in handoff.

## Execution Note

The MVP 3D concept coverage gate is complete. Ready tasks are now implementation slices derived from:

- `docs/MVP_3D_CONCEPTS.md`
- `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`
- `docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md`
- `docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md`
- `docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md`

Keep implementation vertical, typed, and testable. Do not introduce a public mutable scene graph, renderer-owned ECS/game state, or WebGL fallback.

## Task Categories

Every ready task must declare one primary category:

- `simulation`: ECS, assets, math, diagnostics, transforms, headless systems.
- `render-bridge`: render authoring components, extraction, snapshots, render
  world contracts, prepared-asset contracts.
- `webgpu-render`: GPU resources, WGSL, pipelines, bind groups, render passes,
  command encoding, submission, GPU diagnostics.
- `runtime-orchestration`: app facades, frame loop policy, examples, headless vs
  WebGPU mode selection.
- `docs-tooling`: docs, scripts, tests, validation, agent workflow.
- `audit-refactor`: architecture drift checks and small corrective refactors.

Reference anchors:

- `simulation`, `render-bridge`, and `runtime-orchestration` work should inspect
  `/Users/felixz/Projects/aperture/references/bevy` for ECS, assets, extraction,
  render app, material, and render-asset preparation patterns before
  implementation.
- `webgpu-render` work should inspect both
  `/Users/felixz/Projects/aperture/references/engine` and
  `/Users/felixz/Projects/aperture/references/three.js`, compare common render
  pipeline patterns, and adapt the best Aperture-specific version without
  copying code.
- `audit-refactor` work should compare implementation against the North Star,
  Architecture, Decisions, package boundaries, and the relevant reference
  anchors for the audited area.

Every few implementation tasks, keep an `audit-refactor` task in the ready queue
to catch drift before it compounds.

## Recommended Next Task

Start with `task-2150`: route normal maps through TEXCOORD_1.

`task-2001` is complete: the spinning-cube example now creates a renderer-owned face-colored diffuse IBL cube texture and sampler, routes it through the StandardMaterial diffuse IBL shader variant, and Playwright verifies direction-dependent face pixels.
`task-2002` is complete: `withEnvironmentMap(handle)` is exported from runtime/core and materials-showcase now uses it with visible diffuse IBL routing.
`task-2003` is complete: the spinning-cube example now creates renderer-owned specular IBL resources, routes StandardMaterial through `iblSpecularProof`, and Playwright verifies visible specular response.
`task-2004` is complete: the specular IBL proof now samples a minimal roughness-addressed mip chain, and the spinning-cube example includes glossy/rough probes with Playwright pixel comparison.
`task-2005` is complete: the GLTF scene buffer-backed primitive now resolves its source GLB material, registers a prefixed material handle, and publishes/asserts the GLB-authored base-color factor.
`task-2006` is complete: `loadGlbFromUri(url, options)` is exported from `@aperture-engine/render`, fetches GLB bytes into the existing no-fetch facade, and reports typed URL/fetch/HTTP/read/loader diagnostics.
`task-2007` is complete: `examples/glb-viewer.html` fetches `examples/assets/cube.glb` with `loadGlbFromUri(...)`, registers/replays the GLB source assets through ECS, and Playwright verifies a visible rendered draw.
`task-2008` is complete: `glb-viewer` has pointer-drag orbit and wheel zoom controls over the ECS camera transform, with Playwright proving drag changes rendered pixels.
`task-2009` is complete: `glb-viewer` has a three-asset selector, destroys the previous replayed ECS scene before loading the next GLB, and Playwright proves switched assets render different pixels.
`task-2010` is complete: `gltf-scene` now reports active directional shadow rendering through the submitted shadow depth pass and StandardMaterial shadow-map pipeline, and Playwright asserts the receiver region darkens.
`task-2011` is complete: StandardMaterial directional shadow sampling now uses a 3x3 PCF comparison filter, publishes the active PCF mode in `gltf-scene`, and targeted browser coverage still passes.
`task-2017` is complete: StandardMaterial point-shadow sampling now compares against clamped projected cube-face receiver depth instead of a constant occupancy reference, and Playwright samples named receiver coordinates to prove near wall pixels remain lit while mid/far samples darken without WebGPU warnings.
`task-2013` is complete: `examples/spot-shadow.html` now extracts spot shadow requests, plans a single 2D shadow pass with a perspective spot matrix, routes StandardMaterial spot lighting plus receiver sampling, and Playwright verifies lit and shadowed receiver samples without WebGPU warnings.
`task-2014` is complete: `examples/multi-light-shadow.html` now submits directional, spot, and point shadow passes into one browser-safe StandardMaterial receiver route, and Playwright verifies six named receiver samples in one scene.
`task-2016` is complete: `examples/glb-viewer.html` now accepts a typed custom `.glb` URL, loads it through the same ECS replay/unload path as the sample selector, reports the selected URL in JSON-safe status, and Playwright verifies a local custom URL swaps rendered pixels.
`task-2018` is complete: `withShadowCaster()` and `withShadowReceiver()` are public runtime helpers, extracted mesh draws carry JSON-safe caster/receiver flags, and the GLTF scene toggles now update ECS-authored flags that drive caster draw-list and receiver pipeline routing.
`task-2019` is complete: `examples/glb-viewer.html?url=...` now seeds the custom URL field, loads through the same guarded ECS replay path, and Playwright verifies query-driven initial render status and pixels.
`task-2020` is complete: `glb-viewer` now fits its orbit target, distance, and zoom limits from replayed GLB mesh bounds, reports JSON-safe fit status, and Playwright verifies differently sized GLBs remain visibly framed near the render center.
`task-2021` is complete: `gltf-scene` now proves the combined StandardMaterial `iblDiffuse|iblSpecularProof|shadowMap` browser route with draw bind groups bounded to groups 0 through 3 and Playwright-covered IBL plus receiver-shadow samples.
`task-2022` is complete: `glb-viewer` now includes a lit brass StandardMaterial GLB sample, ECS-authored lights, material-family status, and Playwright coverage proving the StandardMaterial sample renders differently from unlit samples.
`task-2023` is complete: `glb-viewer` now includes an animated local GLB, applies the first translation clip to replayed ECS node transforms, reports active clip status, and Playwright proves transform status plus pixels move over time.
`task-2024` is complete: `glb-viewer` now includes a dual-primitive GLB with two source materials, reports two resolved primitive materials and two extracted draws, and Playwright verifies two distinct visible material regions.
`task-2025` is complete: `glb-viewer` now includes a parent/child hierarchy GLB, reports JSON-safe local and world transform summaries for replayed nodes, and Playwright verifies the child world transform depends on its parent.
`task-2026` is complete: the lit brass GLB viewer sample now adds ECS-authored shadow caster/receiver state, a simple StandardMaterial receiver floor, and a directional shadow pass; Playwright verifies the model and a shadow-darkened floor in one frame.
`task-2027` is complete: the lit brass GLB viewer sample now authors an environment map and routes StandardMaterial model/floor draws through diffuse plus specular-proof IBL; Playwright compares direct-lit-only and IBL-enabled pixels.
`task-2028` is complete: `glb-viewer` now includes a mixed alpha-state StandardMaterial GLB sample with one opaque primitive and one transparent primitive, JSON-safe per-primitive render-state/pipeline status, and Playwright proof for both visible regions.
`task-2029` is complete: `glb-viewer` now includes a home camera reset control that restores the current asset's fitted orbit target, distance, yaw, and zoom limits; Playwright proves status and pixels return near the fitted view after drag/zoom.
`task-2030` is complete: `glb-viewer` now exposes compact ambient and point-light sliders that mutate ECS-authored `Light` component intensities, report controls/ECS/extracted values, and visibly change the lit brass sample.

Reference anchors (read both before writing WGSL):

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

## Strategic Focus — MVP Renderer

Target: a credible MVP renderer that ships three capabilities. In priority order:

1. **Image-based lighting (IBL).** Diffuse + specular environment lighting visible in the spinning-cube, materials-showcase, and GLTF-scene examples. Infrastructure (descriptors, bind groups, shader variants) already exists; only shader wiring, pipeline-key extension, and bind-group routing remain.

2. **Real GLB scene loading and rendering.** A glTF viewer comparable to existing engine sample viewers: fetch any `.glb` URL, parse it, register assets, replay ECS authoring commands, render. Camera navigation and multi-asset switching included. Animation playback queued for post-MVP.

3. **Complete shadow path.** Multi-light (directional + point + spot) with PCF soft shadows. Single directional shadow path is closest to ready; soft-shadow and multi-light extensions follow.

These three tracks are the only acceptable subjects for the Recommended Next Task. Other work (route boundaries, generic adapter families, broader material extensibility, container format edge cases) is **deferred** until all three MVP tracks land.

All MVP-track tasks are visible-feature tasks under `agent/WAKE.md` §9. Diagnostic and audit work follows the visible feature, never precedes it. Every task entry below cites at least one specific reference file under `references/bevy`, `references/engine` (PlayCanvas), or `references/three.js`. The agent MUST read the cited references before writing implementation code (see `agent/WAKE.md` §4).

## Ready Tasks — MVP Tracks

### task-2001 — Render diffuse IBL on the spinning-cube example

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, `examples/spinning-cube.js`, `test/e2e/spinning-cube.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`, `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`, `references/engine/src/scene/graphics/reproject-texture.js`. Compare at least two before writing WGSL.

Implementation notes:

- Wire `STANDARD_DIFFUSE_IBL_SHADER_VARIANT` (already defined in `packages/webgpu/src/standard-shader.ts`) into the spinning-cube path.
- Extend `StandardMaterialPipelineKey` with `iblDiffuseEnabled`.
- Route `getOrCreateWebGpuAppEnvironmentResourceCache()` output into bind group 4.

Acceptance criteria:

- Cube in `examples/spinning-cube.html` shows direction-dependent diffuse-IBL shading (not flat ambient).
- Playwright canvas readback at three named coordinates differs measurably between top/side/bottom faces.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passes.

### task-2002 — Add `withEnvironmentMap(handle)` runtime helper and adopt in materials-showcase

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src/index.ts`, `examples/materials-showcase.js`, targeted tests.
Reference anchor: existing `withCamera`, `withLight` patterns in `packages/runtime/src/index.ts`; Bevy environment-map components under `references/bevy/crates/bevy_pbr/src/` (verify path on read).

Acceptance criteria:

- `withEnvironmentMap(handle)` exported from `@aperture-engine/runtime`, typed, callable.
- `examples/materials-showcase.html` uses it; showcase cubes show IBL response in Playwright pixel readback.
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit` passes.

### task-2003 — Render specular IBL on the spinning-cube example

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, `examples/spinning-cube.js`, targeted tests.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js` (specular mip chain); `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionCube.js` (PlayCanvas WGSL specular cube sampling).

Acceptance criteria:

- Metallic cube in `examples/spinning-cube.html` shows specular reflection of the environment.
- Playwright pixel at a named coordinate over a specular highlight is measurably brighter than at a matte coordinate.
- Extend `StandardMaterialPipelineKey` with `iblSpecularEnabled`.

### task-2004 — Replace specular-IBL placeholder with a minimal GGX mip-chain prefilter

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, targeted tests.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js` — the load-time GGX prefilter is the proven anchor.

Acceptance criteria:

- Specular highlight on the spinning cube responds to roughness.
- Two cubes with `roughness=0.1` and `roughness=0.9` show visibly different specular extent in Playwright pixel comparison.

### task-2005 — Map GLB source material onto the buffer-backed primitive (promotes the deleted task-1978)

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs` (material resolution from glTF material index); `references/three.js/examples/jsm/loaders/GLTFLoader.js` (function `loadMaterial`).

Implementation notes:

- Replace the example's hardcoded material handle with one derived from the GLB source via existing `packages/render/src/assets/gltf-primitive-material-resolution.ts`.

Acceptance criteria:

- Primitive in `examples/gltf-scene.html` uses the GLB-defined `baseColorFactor`.
- Playwright pixel readback at the primitive's center differs measurably based on the fixture's material color compared to the previous hardcoded color.

### task-2006 — Add public `loadGlbFromUri(url, options)` async loader with error reporting

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/`, targeted tests.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js` (fetch + parse + error reporting flow); `references/engine/src/framework/parsers/glb-parser.js` (PlayCanvas GLB parser entry).

Acceptance criteria:

- `loadGlbFromUri(url, options)` exported from `@aperture-engine/render`, typed.
- Test loads a base64-data-URL `.glb` and reports `ok: true`.
- Test loads a malformed URL and reports `ok: false` with a typed diagnostic.

### task-2007 — Create `examples/glb-viewer.html` that fetches and renders a sample `.glb`

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/assets/cube.glb`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js` and the three.js glTF viewer under `references/three.js/examples/` for the smallest end-to-end load+render flow.

Implementation notes:

- Commit a small sample `cube.glb` under `examples/assets/`.
- Use `loadGlbFromUri` to fetch it; register assets via `app.assets.register`; replay ECS commands via `applyGltfEcsCommandPlanToApp`; render.

Acceptance criteria:

- Example renders the fetched primitive.
- Playwright sees non-clear-color pixels in the render region.

### task-2008 — Add orbit camera control to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `packages/runtime/src/` if a shared helper emerges, targeted tests.
Reference anchor: `references/three.js/examples/jsm/controls/OrbitControls.js`.

Acceptance criteria:

- Pointer-drag rotates the camera around the scene origin; mouse wheel zooms.
- Playwright simulates drag and asserts canvas pixel content changes between before/after frames.

### task-2009 — Multi-asset switching in glb-viewer with three sample `.glb` files

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`, `examples/assets/`, targeted tests.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (sample-switching UI patterns).

Acceptance criteria:

- Dropdown with 3 sample `.glb` files; switching unloads previous scene, loads next.
- Playwright switches dropdown and asserts pixel difference between selections.

### task-2010 — Execute shadow depth pass and render visible directional shadow in gltf-scene

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`.
Reference anchor: `references/three.js/src/lights/DirectionalLightShadow.js` + `references/three.js/src/lights/LightShadow.js`; `references/engine/src/scene/renderer/shadow-renderer-directional.js` + `references/engine/src/scene/renderer/render-pass-shadow-directional.js`; `references/bevy/examples/3d/shadow_caster_receiver.rs`.

Implementation notes:

- Wire `shadowPassCommandEncoderResource` into `app.render()` before the main color pass.
- Add shadow sampling to `standard-material.wgsl`.
- Extend `StandardMaterialPipelineKey` with `shadowMapEnabled`.

Acceptance criteria:

- A box in `examples/gltf-scene.html` casts a visible shadow onto a receiving plane.
- Playwright pixel under the shadow is measurably darker than an unshadowed pixel.

### task-2011 — Add 3×3 PCF soft-shadow filtering for directional light

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, targeted tests.
Reference anchor: `references/three.js/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js` (3-tap and 5-tap PCF); PlayCanvas WGSL shadow chunks under `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/`.

Acceptance criteria:

- Shadow edges in `examples/gltf-scene.html` are visibly softer than the hard-shadow version.
- Playwright samples the shadow penumbra and asserts intermediate intensity (between fully-shadowed and fully-lit pixels).

### task-2012 — Add point-light shadow cube map and render visible point-light shadow

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, an example update, targeted tests.
Reference anchor: `references/three.js/src/lights/PointLightShadow.js`; `references/engine/src/scene/renderer/shadow-renderer-local.js`; `references/engine/src/scene/renderer/render-pass-shadow-local-non-clustered.js`.

Acceptance criteria:

- A point light near a cube produces a visible shadow that wraps around the caster.
- Playwright pixel readback at three named coordinates around the cube shows shadow on the far side and light on the near side.

### task-2017 — Replace point-shadow occupancy proof with radial depth compare

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, `examples/point-shadow.js`, `test/e2e/point-shadow.spec.ts`, targeted tests.
Reference anchor: `references/three.js/src/lights/PointLightShadow.js`; `references/engine/src/scene/renderer/shadow-renderer-local.js`; `references/engine/src/scene/renderer/render-pass-shadow-local-non-clustered.js`.

Acceptance criteria:

- Point-shadow caster pass writes distance-accurate point-light depth instead of relying on conservative cube-map occupancy clear behavior.
- `examples/point-shadow.html` shows a localized far-side shadow while nearby receiver pixels remain visibly lit.
- Playwright samples at least three named receiver coordinates and proves localized shadow/lit separation with no WebGPU validation warnings.

### task-2013 — Add spot-light shadow projection and render visible spot-light shadow

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, an example update, targeted tests.
Reference anchor: `references/three.js/src/lights/SpotLightShadow.js`; `references/engine/src/scene/renderer/shadow-renderer-local.js`.

Acceptance criteria:

- Spot light placed above the spot-shadow cube produces a visible conical shadow region.
- Playwright samples named receiver pixels and proves lit/shadowed separation.

### task-2014 — Combined multi-light scene: directional + point + spot all casting shadows

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, `examples/multi-light-shadow.html`, `examples/multi-light-shadow.js`, `test/e2e/multi-light-shadow.spec.ts`.
Reference anchor: `references/engine/src/scene/renderer/shadow-renderer.js` (PlayCanvas shadow-renderer top-level coordination); Bevy multi-light render path under `references/bevy/crates/bevy_pbr/src/render/` (verify file on read).

Implementation notes:

- Current StandardMaterial receiver resources accept one shadow resource set per
  frame. The next slice should add a real multi-shadow receiver contract before
  trying to build the browser example.
- Directional and spot shadows can share the 2D `shadowMap` feature; point
  shadows require the cube `pointShadowMap` feature.

Acceptance criteria:

- New `examples/multi-light-shadow.html` with all three light types active casts three distinct shadows on a shared plane.
- Playwright pixel sampling at six named coordinates distinguishes each shadow region.

### task-2015 — Add caster/receiver shadow toggles to gltf-scene

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, `examples/gltf-scene.html`, `test/e2e/gltf-scene.spec.ts`.
Reference anchor: `references/bevy/examples/3d/shadow_caster_receiver.rs` (caster/receiver toggles over ECS-authored renderables).

Acceptance criteria:

- `examples/gltf-scene.html` exposes caster and receiver toggles without replacing the ECS/render extraction path.
- Toggling receiver mode removes the visible receiver darkening while keeping the scene rendered.
- Playwright toggles receiver mode and asserts the shadow-region luminance returns toward the unshadowed baseline.

### task-2016 — Add URL-driven GLB loading to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`, targeted tests.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (model URL selection and stale-load guard).

Acceptance criteria:

- `glb-viewer` accepts a typed `.glb` URL in addition to the three committed sample assets.
- Loading a custom URL destroys the previous replayed ECS scene and reports the selected URL in JSON-safe status.
- Playwright loads a local sample URL through the custom URL control and asserts one rendered mesh draw plus changed pixels.

### task-2018 — Add public shadow caster/receiver authoring helpers

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/rendering/`, `packages/runtime/src/`, `examples/gltf-scene.js`, targeted tests.
Reference anchor: `references/bevy/examples/3d/shadow_caster_receiver.rs`.

Acceptance criteria:

- Public helpers can mark ECS-authored renderables as shadow casters, shadow receivers, or both without renderer-owned scene state.
- `examples/gltf-scene.html` uses the helpers for its caster/receiver controls instead of filtering only example-local renderer inputs.
- Targeted extraction/runtime tests prove shadow caster/receiver flags appear in render snapshot data and remain JSON-safe.

### task-2019 — Add query-URL bootstrap to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (model selection flow and stale-load guard).

Acceptance criteria:

- Opening `examples/glb-viewer.html?url=/examples/assets/sapphire-pillar.glb` seeds the custom URL control and loads that GLB without first selecting a sample asset.
- JSON-safe viewer status reports `selectedAsset.source: "custom"` and the selected URL while extraction reports one mesh draw.
- Playwright covers the query-driven initial load and proves rendered pixels differ from the default sample asset.

### task-2020 — Fit glb-viewer orbit camera from loaded asset bounds

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, targeted tests.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (`fitCameraToSelection` pattern).

Acceptance criteria:

- Each GLB load derives an orbit distance/framing target from the replayed mesh bounds instead of using a fixed one-size camera distance.
- JSON-safe viewer status reports the active fit bounds and distance used for the current asset.
- Playwright switches at least two differently sized sample assets and verifies both remain visibly framed with non-clear pixels near the render-region center.

### task-2021 — Render IBL and shadows together in one StandardMaterial browser scene

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/`, one example, targeted tests.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`; `references/engine/src/scene/renderer/shadow-renderer.js`.

Acceptance criteria:

- A browser example renders a StandardMaterial surface with environment lighting and an active shadow receiver route in the same frame.
- The active pipeline key includes IBL and shadow features while all draw bind groups remain within Chrome's four-bind-group limit.
- Playwright verifies both an IBL-lit sample and a shadow-darkened receiver sample with no WebGPU validation warnings.

### task-2022 — Add a lit StandardMaterial GLB sample to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets/`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js` (material resolution from loaded glTF assets).

Acceptance criteria:

- `glb-viewer` includes a sample GLB whose source material resolves to StandardMaterial instead of an unlit-only path.
- Viewer status reports the selected sample material family and a successful replay with one rendered mesh draw.
- Playwright selects the lit sample and verifies rendered pixels differ from the unlit samples.

### task-2023 — Play the first GLB animation clip in glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `packages/render/src/assets/`, `examples/assets/`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js` (animation clip loading and playback contracts).

Acceptance criteria:

- A small animated local `.glb` sample is available in `examples/assets/` and selectable in `glb-viewer`.
- `glb-viewer` applies the first animation clip through ECS-authored transform updates without introducing a renderer-owned scene graph.
- Viewer status reports the active clip name, time, channel count, and at least one animated node transform.
- Playwright verifies the animated sample changes transform status and rendered pixels over time without WebGPU validation warnings.

### task-2024 — Render a multi-primitive GLB sample in glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets/`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted render-asset tests if needed.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js` (mesh primitive/material index mapping).

Acceptance criteria:

- `glb-viewer` includes a local GLB sample with at least two mesh primitives using distinct source materials.
- ECS replay registers and extracts both primitives as separate mesh draws without losing material handles.
- Viewer status reports two resolved primitive materials and two extracted mesh draws.
- Playwright selects the sample and verifies two distinct visible colored regions in the render area.

### task-2025 — Preserve GLB node hierarchy transforms during viewer replay

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets/`, `packages/runtime/src/` if replay transform helpers are needed, `examples/assets/`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_transform/src/systems.rs` (hierarchical transform propagation).

Acceptance criteria:

- A local GLB hierarchy sample demonstrates a child mesh whose world transform depends on a parent node transform.
- ECS replay preserves parent/child transform relationships through the existing simulation transform propagation path.
- Viewer status reports local and world transform summaries for the replayed hierarchy.
- Playwright verifies the hierarchy sample is framed and visibly differs from the same mesh without the parent transform.

### task-2026 — Add a shadow-receiver floor for the lit GLB viewer sample

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted WebGPU tests if routing changes.
Reference anchor: `references/bevy/examples/3d/shadow_caster_receiver.rs`; `references/engine/src/scene/renderer/shadow-renderer.js`.

Acceptance criteria:

- Selecting the lit brass GLB sample creates ECS-authored shadow caster/receiver state and a simple receiver floor without making the renderer own scene state.
- Viewer status reports at least one shadow request, one caster draw, and one receiver route for the selected sample.
- Playwright verifies a lit model sample and a shadow-darkened floor sample in the same frame with no WebGPU validation warnings.

### task-2027 — Route glb-viewer StandardMaterial samples through IBL

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `examples/glb-viewer.js`, `packages/webgpu/src/` if a route gap is exposed, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`; `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- The lit StandardMaterial GLB viewer sample can use the existing renderer-owned environment resource path.
- Routed pipeline status includes the active IBL feature for the StandardMaterial sample while staying within Chrome's four bind groups.
- Playwright verifies a visible pixel delta between direct-lit-only and IBL-enabled viewer states.

### task-2028 — Render a mixed alpha-state GLB sample in glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets/`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted render-state tests if needed.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js` (material alphaMode and primitive material assignment).

Acceptance criteria:

- `glb-viewer` includes a local GLB sample with at least one opaque primitive and one alpha-state primitive using distinct source materials.
- Viewer status reports both primitive material resolutions and routed pipeline keys for the mixed render states.
- Playwright selects the sample and verifies visible pixels from both primitives with no WebGPU validation warnings.

### task-2029 — Add a camera reset control to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (`fitCameraToSelection` and viewer camera reset behavior).

Acceptance criteria:

- `glb-viewer` exposes a reset/home camera control that restores the current asset's fitted orbit target, distance, yaw, and zoom limits.
- The control updates only ECS camera transform state and the existing orbit controller state.
- Playwright drags/zooms the camera, activates reset, and verifies status and rendered pixels return near the fitted view.

### task-2030 — Add ECS light controls for the lit GLB viewer sample

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/light_probe/mod.rs`; `references/bevy/crates/bevy_pbr/src/render/light.rs`.

Acceptance criteria:

- `glb-viewer` exposes compact controls for the ECS-authored point light intensity and ambient fill used by StandardMaterial samples.
- Changing controls mutates ECS light components rather than renderer-owned scene state.
- Playwright verifies light status changes and the lit brass sample pixels respond measurably.

### task-2031 — Add live shadow caster/receiver controls to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/examples/3d/shadow_caster_receiver.rs`.

Acceptance criteria:

- `glb-viewer` exposes compact caster and receiver checkboxes for the lit brass sample.
- Changing controls mutates ECS-authored `ShadowCaster` and `ShadowReceiver` components rather than renderer-owned scene state.
- Viewer status reports the live caster/receiver control state, caster draw-list changes, and receiver route support.
- Playwright toggles caster and receiver modes and verifies status plus receiver-region pixel changes without WebGPU validation warnings.

### task-2032 — Add a live IBL enable control to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`; `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- `glb-viewer` exposes a compact IBL enable toggle for StandardMaterial samples.
- Toggling IBL updates ECS-authored environment-map state or the equivalent source authoring path without storing authoritative renderer state in ECS.
- Viewer status reports the live IBL control state, environment extraction, and routed pipeline keys.
- Playwright verifies direct-lit versus IBL-enabled brass pixels respond to the control.

### task-2033 — Add animation pause and scrub controls to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` exposes pause/play and scrub controls for the animated GLB sample.
- Controls update example animation state that writes replayed ECS `LocalTransform` data; no renderer-owned scene graph is introduced.
- Viewer status reports paused/playing state, scrub time, active clip, and animated node transform values.
- Playwright verifies paused pixels remain stable and scrubbing changes both transform status and rendered pixels.

### task-2034 — Add GLB viewer sample metadata status

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted asset report helpers only if needed.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` publishes JSON-safe metadata counts for loaded scenes: nodes, meshes, primitives, materials, animations, and unsupported feature diagnostics.
- Metadata is derived from the parsed GLB/import reports and does not include raw binary buffers or GPU handles.
- Playwright verifies metadata for at least the animated, dual-primitive, mixed-alpha, and hierarchy samples.

### task-2035 — Add `?asset=` sample bootstrap to glb-viewer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html` (model selection flow and stale-load guard).

Acceptance criteria:

- Opening `examples/glb-viewer.html?asset=brass` selects and loads the matching committed sample without using the custom URL path.
- Invalid sample ids fall back to the default sample and report a JSON-safe selection diagnostic.
- Playwright covers a valid sample bootstrap and an invalid fallback with rendered pixels and selected-asset status.

Future MVP slices (IBL composition quality, animation breadth, and performance reporting) remain candidates after these visible feature tasks.

### task-2036 — Add a GLB viewer roughness/IBL comparison sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`; `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- `glb-viewer` includes a committed two-primitive StandardMaterial GLB sample with visibly different roughness values on the same base material.
- Viewer status reports the resolved roughness/material factors for both primitives without raw GPU handles.
- Playwright verifies IBL-enabled pixels differ between glossy and rough regions and that disabling IBL changes the comparison.

### task-2037 — Add a normal-mapped StandardMaterial GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with a normal texture and tangent-backed mesh data.
- Viewer status reports the normal texture/material readiness and routed pipeline key for the sample.
- Playwright verifies the normal-mapped sample renders visible non-flat lighting compared with a scalar-control region.

### task-2038 — Add a textured StandardMaterial GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with base-color and metallic-roughness texture bindings.
- Viewer status reports both texture-backed material slots and the routed combined texture pipeline key.
- Playwright verifies textured pixels render and differ from an untextured material-control region.

### task-2039 — Add animation speed control to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/animation/AnimationClipCreator.js`.

Acceptance criteria:

- `glb-viewer` exposes a compact speed control for animated samples.
- Changing speed updates example animation state that writes replayed ECS `LocalTransform` values, with no renderer-owned scene graph.
- Playwright verifies speed 0 freezes pixels/status and a higher speed advances transform status faster than the default.

### task-2040 — Add multi-clip animation selection to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes or loads a sample with at least two animation clips and exposes a compact clip selector.
- Changing clips updates the example animation state and writes the selected clip into replayed ECS `LocalTransform` data.
- Playwright verifies selected clip status and rendered pixels differ between two clips.

### task-2042 — Add animation loop-mode control to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/src/animation/AnimationAction.js`.

Acceptance criteria:

- `glb-viewer` exposes compact repeat/once loop controls for animated samples.
- Loop mode updates example animation state that writes replayed ECS `LocalTransform` values, with no renderer-owned scene graph.
- Viewer status reports the active loop mode and whether playback is clamped at the clip end.
- Playwright verifies repeat wraps animation time while once mode holds the final transform and pixels stable after reaching the end.

### task-2043 — Add reverse animation playback to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/src/animation/AnimationAction.js`.

Acceptance criteria:

- `glb-viewer` exposes a compact reverse-playback control for animated samples.
- Reverse playback updates example animation time and replayed ECS `LocalTransform` values without renderer-owned scene state.
- Viewer status reports direction and signed playback speed.
- Playwright verifies reverse playback moves transform status and rendered pixels opposite the forward direction.

### task-2044 — Add rotation and scale animation channel coverage to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes or loads a sample with rotation and scale animation channels.
- The example animation sampler applies GLB rotation and scale channels to replayed ECS `LocalTransform` data in addition to translation.
- Viewer status reports animated channel paths and sampled values for rotation and scale.
- Playwright verifies rotation/scale status and rendered pixels change without introducing a renderer-owned scene graph.

### task-2041 — Audit GLB viewer control/status architecture

Status: completed 2026-05-20. See `docs/research/GLB_VIEWER_CONTROL_STATUS_ARCHITECTURE_AUDIT_2026_05_20.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `examples/glb-viewer.js`, targeted tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Confirm GLB viewer controls and status remain ECS-authored, JSON-safe, and free of renderer-owned authoritative scene state.
- Check package-boundary drift from the live shadow, IBL, animation, metadata, and query-bootstrap slices.
- Recommend the next visible GLB/IBL/animation fidelity slice.

### task-2045 — Add STEP interpolation animation coverage to glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with at least one `STEP` animation sampler.
- The example animation sampler holds the previous keyframe value until the next key time while continuing to write replayed ECS `LocalTransform` values.
- Viewer status reports the stepped channel path, interpolation mode, and sampled value.
- Playwright verifies held status/pixels before the step and changed status/pixels after the step, with no renderer-owned scene graph.

### task-2046 — Replay an imported glTF camera in glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with a perspective camera node.
- A compact viewer control can switch from fitted orbit camera to the imported camera by mutating the ECS camera transform/projection state.
- Viewer status reports imported camera metadata and whether the ECS camera is currently using it.
- Playwright verifies imported-camera status and a visible pixel difference from the fitted orbit view.

### task-2047 — Render an embedded-image textured GLB sample in glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose base-color texture image is stored in a GLB `bufferView` instead of an example-local synthetic URI.
- The source image bytes resolve through the GLB import path without exposing raw bytes in status.
- Viewer status reports the embedded image/texture slot readiness and routed texture pipeline key.
- Playwright verifies textured pixels differ from a scalar-control region.

### task-2048 — Replay glTF punctual lights in glb-viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `packages/render/src/assets`, `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with `KHR_lights_punctual` point or directional light data.
- Replay creates ECS-authored `Light` components from supported glTF light nodes without storing renderer-owned light state in ECS.
- Viewer status reports imported light counts, kinds, intensities, and extracted light packet counts.
- Playwright verifies the imported-light sample renders visibly differently from the same material under the viewer default lights.

### task-2049 — Add morph-target unsupported-feature viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with morph-target metadata while still rendering the base mesh.
- Viewer status reports a JSON-safe unsupported morph-target diagnostic with target count and no raw buffers.
- The diagnostic does not block rendering of supported mesh/material data.
- Playwright verifies both the visible base mesh and the unsupported-feature diagnostic.

### task-2050 — Audit imported camera/light/embedded-image viewer slices

Status: completed 2026-05-20. See `docs/research/GLB_VIEWER_IMPORT_STATUS_AUDIT_2026_05_20.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Confirm imported cameras, lights, embedded images, and unsupported-feature samples preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check package-boundary drift after the next three to five visible GLB viewer fidelity slices.
- Recommend the next visible scene-import or animation fidelity task.

### task-2051 — Add skinning unsupported-feature viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with skin and joint metadata while still rendering an unskinned base mesh.
- Viewer status reports JSON-safe unsupported skinning diagnostics with skin, joint, and inverse-bind-matrix counts.
- The diagnostic does not block rendering supported mesh/material data.
- Playwright verifies both the visible base mesh and the unsupported-feature diagnostic.

### task-2052 — Add unsupported orthographic-camera viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with an orthographic camera node and a visible base mesh.
- Imported-camera status reports the camera as unsupported without enabling the imported-camera control.
- The fitted orbit camera continues rendering the mesh through ECS-authored state.
- Playwright verifies visible pixels and the unsupported orthographic-camera status.

### task-2053 — Add unsupported primitive-mode viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with one supported triangle primitive and one unsupported non-triangle primitive.
- Viewer status reports a JSON-safe unsupported primitive-mode diagnostic for the non-triangle primitive.
- The supported primitive still registers, replays, extracts, and renders.
- Playwright verifies visible pixels from the supported primitive and the unsupported-mode diagnostic.

### task-2054 — Add emissive StandardMaterial GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with a non-zero emissive factor and a scalar control region.
- Viewer status reports the emissive factor through primitive material resolution status.
- The sample renders through the StandardMaterial app route without new renderer-owned source state.
- Playwright verifies visible emissive-factor status and a pixel difference from the scalar control region.

### task-2055 — Add sampler-state textured GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed textured StandardMaterial GLB sample with non-default sampler wrap/filter metadata.
- Viewer status reports JSON-safe sampler metadata for the routed texture slot.
- Texture and sampler source assets remain renderer-independent; WebGPU resource creation stays in the backend path.
- Playwright verifies visible textured pixels and the non-default sampler metadata.

### task-2056 — Add CUBICSPLINE animation unsupported-feature viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with a `CUBICSPLINE` animation sampler and a visible base mesh.
- Viewer animation status reports a JSON-safe unsupported interpolation diagnostic without exposing raw keyframe buffers.
- The unsupported interpolation does not create renderer-owned animation state or block base mesh rendering.
- Playwright verifies visible pixels and the unsupported `CUBICSPLINE` interpolation status.

### task-2057 — Add multi-scene GLB viewer status sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample with at least two scenes and a default scene.
- Viewer status reports JSON-safe scene count, default scene index, and replayed root-node identifiers.
- The viewer renders only the selected/default scene through ECS replay state.
- Playwright verifies visible pixels from the default scene and the reported scene metadata.

### task-2058 — Add texture-transform GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `KHR_texture_transform` on a base-color texture and a scalar/control region.
- Viewer status reports JSON-safe texture transform metadata for the routed texture slot.
- The transform remains renderer-independent source metadata and WebGPU resource creation stays in the backend path.
- Playwright verifies transformed-texture status and a visible pixel difference from the control region.

### task-2059 — Add missing TEXCOORD_1 GLB viewer diagnostic sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed GLB sample where one StandardMaterial texture binding requests `TEXCOORD_1` without matching mesh UV1 data.
- Viewer status reports the existing JSON-safe missing-TEXCOORD diagnostic for the affected texture slot.
- A supported control primitive in the same sample still registers, replays, extracts, and renders.
- Playwright verifies visible control pixels and the missing-TEXCOORD diagnostic.

### task-2060 — Audit GLB unsupported-feature and sampler-status slices

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm unsupported morph, skin, orthographic camera, primitive-mode, emissive, and sampler-status viewer slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that warning diagnostics do not incorrectly block supported primitives or base meshes.
- Recommend the next visible GLB viewer fidelity task.

### task-2061 — Add occlusion/emissive texture GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with an occlusion texture and emissive texture/factor on one primitive plus a scalar control primitive.
- Viewer status reports JSON-safe `occlusionTexture` and `emissiveTexture` slot readiness plus emissive factor metadata for the textured primitive.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies visible textured/emissive pixels and a difference from the scalar control primitive.

### task-2062 — Preserve TEXCOORD_1 GLB mesh attributes and add supported UV1 viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted asset tests.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- GLB mesh asset construction preserves `TEXCOORD_1` vertex attributes for primitives that provide UV1 data.
- `glb-viewer` includes a committed StandardMaterial GLB sample whose base-color texture requests `TEXCOORD_1` and whose mesh provides matching UV1 data.
- Viewer status reports a `standard|baseColorTexture|uv1|...` pipeline key and JSON-safe texture-slot `texCoord: 1` without missing-UV1 diagnostics.
- Playwright verifies visible UV1-textured pixels and a difference from a scalar control primitive.

### task-2063 — Add alpha-mask texture GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `alphaMode: "MASK"`, an alpha-cutoff base-color texture, and a scalar/control primitive.
- Viewer status reports JSON-safe alpha mode, alpha cutoff, texture-slot readiness, and the alpha-mask pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies visible opaque/masked pixel regions and a difference from the scalar control primitive.

### task-2064 — Add metallic-roughness UV1 GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, targeted asset tests only if needed.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose metallic-roughness texture requests `TEXCOORD_1` and whose mesh provides matching UV1 data.
- Viewer status reports JSON-safe metallic-roughness texture-slot `texCoord: 1`, material factors, and a UV1 pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies visible roughness/metallic pixel differences against a scalar control primitive.

### task-2065 — Add normal-scale GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed tangent-backed StandardMaterial GLB sample with a normal texture and non-default `normalTexture.scale`.
- Viewer status reports JSON-safe normal texture slot readiness and normal-scale factor metadata.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies the normal-scaled region renders differently from a scalar or flat-normal control primitive.

### task-2066 — Add texture-transform-on-occlusion GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `KHR_texture_transform` on an `occlusionTexture` and a scalar/control primitive.
- Viewer status reports JSON-safe occlusion texture transform metadata, texture-slot readiness, and material factors.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed occlusion texture pixels differ from a scalar control primitive.

### task-2067 — Audit GLB viewer UV1 and expanded texture-status slices

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm the supported UV1, alpha-mask, metallic-roughness UV1, normal-scale, and occlusion-transform viewer slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that UV1 mesh attributes stay renderer-independent source data and that missing-UV1 diagnostics still skip only affected primitives.
- Recommend the next visible GLB viewer fidelity task.

### task-2068 — Decode a same-origin PNG URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes at least one committed GLB sample whose texture points to a real same-origin PNG asset instead of an example-local synthetic byte resolver branch.
- The viewer decodes that PNG into the existing renderer-independent texture source data before GLB replay/material registration.
- Viewer status remains JSON-safe and reports the decoded texture slot without exposing image, GPU texture, or sampler objects.
- Playwright verifies visible textured pixels and no regression in ECS-authored replay or WebGPU backend ownership.

### task-2069 — Add an alpha-blend texture GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `alphaMode: "BLEND"`, a base-color texture with translucent alpha, and an opaque/scalar control primitive.
- Viewer status reports JSON-safe alpha mode, blend preset, depth-write state, texture-slot readiness, and the alpha-blend pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies visible translucent pixels differ from both clear color and the opaque control primitive.

### task-2070 — Add rotated metallic-roughness transform GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `KHR_texture_transform.rotation` on `pbrMetallicRoughness.metallicRoughnessTexture` and a scalar/control primitive.
- Viewer status reports JSON-safe metallic-roughness texture transform metadata, texture-slot readiness, and material factors.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed metallic/roughness pixels differ from a scalar control primitive.

### task-2071 — Audit GLB viewer real-image and alpha-state follow-ups

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm the real-image decode, alpha-blend texture, and rotated metallic-roughness transform viewer slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that decoded image bytes remain source texture data and that prepared GPU textures remain backend-owned.
- Recommend the next visible GLB viewer fidelity task.

### task-2072 — Decode a same-origin JPEG URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose base-color texture points to a real same-origin JPEG asset.
- The viewer decodes the JPEG into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata and the decoded base-color texture slot without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible textured pixels and a difference from a scalar control primitive.

### task-2073 — Add normal-texture transform GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed tangent-backed StandardMaterial GLB sample with `KHR_texture_transform` on `normalTexture` plus a flat/scalar control primitive.
- Viewer status reports JSON-safe normal texture transform metadata, normal-scale/factor status, texture-slot readiness, and the normal-texture pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed-normal pixels differ from the flat control primitive.

### task-2074 — Add emissive texture-transform GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with `KHR_texture_transform` on `emissiveTexture` and a scalar/control primitive.
- Viewer status reports JSON-safe emissive texture transform metadata, emissive factor status, texture-slot readiness, and the emissive-texture pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed emissive pixels differ from the scalar control primitive.

### task-2075 — Audit GLB viewer image-decode and transformed-slot follow-ups

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm the JPEG decode, normal-texture transform, and emissive texture-transform viewer slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that decoded image bytes remain source texture data and that transformed texture-slot metadata does not create renderer-owned source state.
- Recommend the next visible GLB viewer fidelity task.

### task-2076 — Add transformed-vs-untransformed normal texture GLB viewer controls

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed tangent-backed StandardMaterial GLB sample with transformed normal texture, untransformed normal texture, and flat/scalar control primitives.
- Viewer status reports JSON-safe normal texture transform metadata for only the transformed primitive, normal-scale/factor status for all primitives, and the normal-texture pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed-normal pixels differ from both the untransformed normal primitive and the flat control primitive.

### task-2077 — Add transformed-vs-untransformed emissive texture GLB viewer controls

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with transformed emissive texture, untransformed emissive texture, and scalar/control primitives.
- Viewer status reports JSON-safe emissive texture transform metadata for only the transformed primitive, emissive factor status, texture-slot readiness, and the emissive-texture pipeline key.
- The sample remains ECS-authored through GLB replay and WebGPU resources stay backend-owned.
- Playwright verifies transformed emissive pixels differ from both the untransformed emissive primitive and the scalar control primitive.

### task-2078 — Decode a same-origin normal-map URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed tangent-backed StandardMaterial GLB sample whose `normalTexture` points to a real same-origin image asset instead of the synthetic fallback resolver.
- The viewer decodes that image into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata, normal texture-slot readiness, and normal-scale/factor status without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible normal-mapped pixels and a difference from a flat control primitive.

### task-2080 — Decode a same-origin emissive URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose `emissiveTexture` points to a real same-origin image asset instead of the synthetic fallback resolver.
- The viewer decodes that image into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata, emissive texture-slot readiness, and emissive factor status without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible emissive-textured pixels and a difference from a scalar control primitive.

### task-2081 — Decode a same-origin metallic-roughness URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose `metallicRoughnessTexture` points to a real same-origin image asset instead of the synthetic fallback resolver.
- The viewer decodes that image into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata, metallic-roughness texture-slot readiness, and material factor status without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible metallic/roughness textured pixels and a difference from a scalar control primitive.

### task-2082 — Decode a same-origin alpha-mask URI texture for a GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose alpha-mask `baseColorTexture` points to a real same-origin image asset instead of the synthetic fallback resolver.
- The viewer decodes that image into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata, alpha-mask render-state status, and base-color texture-slot readiness without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible masked pixels and a difference from an opaque/scalar control primitive.

### task-2083 — Add a real same-origin occlusion URI texture GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, targeted texture-loading tests if practical, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample whose `occlusionTexture` points to a real same-origin image asset instead of the synthetic fallback resolver.
- The viewer decodes that image into renderer-independent RGBA texture source data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata, occlusion texture-slot readiness, and occlusion strength status without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies visible occlusion-textured pixels and a difference from a scalar control primitive.

### task-2079 — Audit GLB viewer transform-control and real-normal-image follow-ups

Status: completed 2026-05-20. See
`docs/research/GLB_VIEWER_TRANSFORM_CONTROLS_REAL_NORMAL_AUDIT_2026_05_20.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm the transformed-vs-untransformed normal/emissive controls and real normal-image decode slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that decoded normal-map image bytes remain source texture data and that transform-control fixtures do not introduce renderer-owned source state.
- Recommend the next visible GLB viewer fidelity task.

### task-2084 — Add an all-slot real URI texture GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with real same-origin URI images for `baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`, `occlusionTexture`, and `emissiveTexture`.
- The viewer decodes every same-origin image into renderer-independent source texture data before GLB replay/material registration.
- Viewer status reports JSON-safe image decode metadata and all five texture-slot readiness entries without exposing image, GPU texture, sampler, or raw byte objects.
- Playwright verifies the all-slot textured primitive is visible and differs from a scalar StandardMaterial control primitive.

### task-2085 — Add occlusion transform-control GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with transformed, untransformed, and scalar-control occlusion primitives using a real same-origin occlusion image.
- Viewer status reports JSON-safe image decode metadata, occlusion strength, and transformed-vs-untransformed `occlusionTexture` metadata for the matching primitives.
- Playwright verifies transformed, untransformed, and scalar-control occlusion regions render visibly different pixels.

### task-2086 — Add metallic-roughness transform-control GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with transformed, untransformed, and scalar-control `metallicRoughnessTexture` primitives using a real same-origin metallic-roughness image.
- Viewer status reports JSON-safe image decode metadata, metallic/roughness factors, and transformed-vs-untransformed metallic-roughness slot metadata for the matching primitives.
- Playwright verifies transformed, untransformed, and scalar-control metallic-roughness regions render visibly different pixels.

### task-2087 — Add sampler wrap visual-control GLB viewer sample

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with repeat and clamp sampler variants over out-of-range UVs using the same real same-origin base-color image.
- Viewer status reports JSON-safe image decode metadata and sampler readiness for both variants.
- Playwright verifies repeat and clamp regions render visibly different pixels while both remain routed through ECS replay and StandardMaterial texture slots.

### task-2088 — Add UV1 image-decode controls in GLB viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with UV0, UV1, and scalar-control primitives using a real same-origin base-color image.
- Viewer status reports JSON-safe image decode metadata and distinct `texCoord` readiness for UV0 and UV1 texture slots.
- Playwright verifies UV0, UV1, and scalar-control regions render visibly different pixels without missing-`TEXCOORD_1` diagnostics for the UV1 primitive.

### task-2089 — Add alpha-mask plus emissive real URI GLB viewer controls

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with one primitive using real same-origin `baseColorTexture` alpha-mask data plus real same-origin `emissiveTexture`, alongside alpha-mask-only and scalar-control primitives.
- Viewer status reports JSON-safe image decode metadata, alpha-mask render-state status, emissive factor/status, and texture-slot readiness for the matching primitives.
- Playwright verifies the combined alpha-mask plus emissive primitive, alpha-mask-only primitive, and scalar-control region render visibly different pixels.

### task-2090 — Add normal plus occlusion real URI GLB viewer controls

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- `glb-viewer` includes a committed StandardMaterial GLB sample with combined real same-origin `normalTexture` and `occlusionTexture`, normal-only, and scalar-control primitives.
- Viewer status reports JSON-safe image decode metadata, normal scale, occlusion strength, tangent-backed mesh readiness, and texture-slot readiness.
- Playwright verifies the combined normal/occlusion primitive differs visibly from the normal-only and scalar-control regions.

### task-2091 — Add real URI texture unload/reload stress sample switch

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, existing `examples/assets`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/webgl_loader_gltf.html`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Playwright switches between at least three real URI texture-heavy GLB viewer samples in one page session.
- Viewer status proves prior replayed ECS scene entities are removed, the selected sample's decoded image metadata updates, and extracted mesh draws match only the active sample.
- Pixel readback changes across each switch without WebGPU validation warnings.

### task-2092 — Add GLB viewer material-slot summary for selected asset

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- GLB viewer status includes a compact JSON-safe material-slot summary for the active asset with per-slot counts for base color, metallic-roughness, normal, occlusion, emissive, alpha modes, and UV1 usage.
- The summary is derived from registered source material assets and does not expose raw texture bytes, image objects, GPU resources, or renderer-owned state.
- Playwright verifies the summary on the all-slot, sampler-wrap, UV1, and scalar-only samples.

### task-2093 — Add GLB viewer real URI texture gallery keyboard navigation

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- `glb-viewer` supports keyboard previous/next navigation across the committed real-URI texture sample subset without changing the custom URL flow.
- Viewer status reports the active gallery index and sample ID in JSON-safe form.
- Playwright sends keyboard events, verifies selected asset changes through the normal ECS replay/unload path, and checks visible pixel changes for at least two transitions.

### task-2094 — Audit GLB viewer real URI texture controls

Status: completed 2026-05-20. See
`docs/research/GLB_VIEWER_REAL_URI_TEXTURE_CONTROLS_AUDIT_2026_05_20.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted examples/tests only if a small corrective refactor is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`; `docs/DECISIONS.md`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- Confirm the all-slot, occlusion-control, metallic-roughness-control, sampler-control, and UV1-control GLB viewer slices preserve ECS authority, render extraction boundaries, JSON-safe status, and WebGPU-only backend ownership.
- Check that decoded image bytes remain source texture data and that controls do not introduce renderer-owned source state.
- Recommend the next visible GLB viewer fidelity task.

### task-2095 — Prove custom URL same-origin URI texture decode

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, existing `examples/assets`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/three.js/examples/webgl_loader_gltf.html`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- `/examples/glb-viewer.html?url=/examples/assets/uri-png-texture.glb` loads through the custom URL path and keeps `selectedAsset.source` as `custom`.
- Viewer status reports JSON-safe same-origin image-decode metadata for `aperture-uri-base-color-checker.png`, material-slot summary counts, and active draws only for the custom asset.
- Playwright verifies visible textured pixels and no WebGPU validation warnings.

### task-2096 — Add real URI texture gallery button controls

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- GLB viewer exposes compact previous/next controls for the committed real-URI texture gallery without changing the custom URL form.
- Button clicks use the same sample replay/unload path as selector and keyboard navigation, and status reports the active gallery index/sample ID.
- Playwright clicks both controls and verifies selected asset IDs, decoded image metadata, extracted draw counts, and visible pixel changes.

### task-2097 — Persist GLB viewer sample selection in the URL

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Selecting a sample or navigating the real-URI texture gallery updates the address bar to `?asset=<sample-id>` with `history.replaceState`.
- Reloading that URL restores the same selected asset through the normal initial sample-selection path.
- Custom URL loads keep the `url=` flow intact and are not overwritten by sample-selection persistence.

### task-2098 — Render material-slot summary rows in the GLB viewer status panel

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The status panel shows compact material-slot counts for base color, metallic-roughness, normal, occlusion, emissive, alpha modes, and UV1 usage for the active asset.
- The displayed rows are derived from the same JSON-safe selected-asset material-slot summary and do not expose image bytes or GPU resources.
- Playwright switches between all-slot and scalar-only samples and verifies the visible rows and status JSON update together.

### task-2099 — Prove custom URL to sample switch clears texture decode state

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`, existing `examples/assets`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Starting from a custom URL real-URI texture asset, selecting a committed real-URI texture sample unloads the custom replayed scene and updates `selectedAsset.source` back to `sample`.
- Viewer status shows decoded image metadata only for the active sample and no stale custom URL image entries.
- Playwright verifies selected asset IDs, active draw counts, decoded URI sets, and visible pixel changes across the custom-to-sample switch.

### task-2100 — Render decoded-image summary rows in the GLB viewer status panel

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows compact rows for same-origin decoded image URI, MIME type, dimensions, and byte length for the active asset.
- The displayed rows are derived from `source.imageDecode.decoded` and do not expose raw image bytes, browser image objects, or GPU resources.
- Playwright verifies the rows for an all-slot sample and the custom URL URI texture path.

### task-2101 — Add GLB viewer unsupported-feature status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact unsupported-feature diagnostic rows when the active GLB declares unsupported morph targets, skinning, orthographic cameras, or primitive modes.
- The displayed rows are derived from existing JSON-safe metadata diagnostics and do not block rendering supported primitives.
- Playwright switches between one unsupported-feature sample and a clean sample and verifies the rows clear with active status.

### task-2102 — Add GLB viewer animation status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows active animation clip name, loop mode, direction, speed, and sampled time for animated assets.
- The rows are derived from the existing example animation state that writes ECS `LocalTransform` components.
- Playwright verifies the rows update while switching clip/direction or scrub controls and clear for a non-animated sample.

### task-2103 — Add GLB viewer imported camera status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows imported camera availability, selected camera name, FOV, near/far range, and whether the ECS camera is using it.
- The rows are derived from existing imported-camera status and mutate only ECS camera state through the current control.
- Playwright verifies rows for the imported-camera sample, toggles the control, and verifies rows clear for a sample without cameras.

### task-2104 — Add GLB viewer live light status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/light.rs`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows compact rows for ECS-authored ambient and point-light intensities plus extracted light counts for the active asset.
- Changing the existing light controls updates the visible rows and the JSON-safe status together without renderer-owned scene state.
- Playwright verifies row updates on the lit brass sample and row consistency on an imported-light sample.

### task-2105 — Add GLB viewer scene metadata status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact rows for scene, node, mesh, primitive, material, animation, and extension counts from the active GLB metadata.
- Rows are derived from existing JSON-safe GLB metadata and do not expose binary buffers or renderer-owned resources.
- Playwright verifies rows for a multi-scene sample and a texture-heavy sample.

### task-2106 — Add GLB viewer orbit-fit status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`; `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows orbit fit status, center, size, distance, and zoom range for the active asset.
- Rows are derived from existing JSON-safe orbit status and update when switching differently sized samples.
- Playwright verifies row updates when switching from cube to brass and after camera reset.

### task-2107 — Add GLB viewer shadow status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/examples/3d/shadow_caster_receiver.rs`; `references/engine/src/scene/renderer/shadow-renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows live shadow availability, caster/receiver control state, caster draw-list counts, and receiver route support.
- Rows are derived from existing JSON-safe shadow status and update when toggling caster/receiver controls.
- Playwright verifies row updates on the lit brass sample and row clearing on a sample without shadow authoring.

### task-2108 — Add GLB viewer IBL status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`; `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- The GLB viewer status panel shows IBL control state, environment-map key, diffuse/specular resource keys, and active pipeline support.
- Rows are derived from existing JSON-safe IBL status and update when toggling the IBL control.
- Playwright verifies rows on the lit brass or roughness IBL sample and row clearing on an unlit sample.

### task-2109 — Add GLB viewer draw/extraction status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`, `examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_render/src/render_phase/mod.rs`; `references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows mesh draw count, package count, draw-call count, material family counts, and active pipeline keys for the current asset.
- Rows are derived from existing JSON-safe extraction, draw, selected-asset, and render-state status.
- Playwright verifies row updates when switching between all-slot, brass, and custom URL samples.

### task-2110 — Add GLB viewer imported-light status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/light.rs`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows imported-light declared, replayed,
  extracted, and kind-count rows for assets that declare punctual lights.
- Rows are derived from existing JSON-safe `importedLights` status and update
  when imported-light controls change ECS-authored light state.
- Playwright verifies rows on the imported-lights sample and row clearing on a
  sample without imported-light authoring.

### task-2111 — Add GLB viewer primitive material-resolution rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-primitive material resolution
  rows with mesh/primitive index, source material index, family, alpha mode, and
  pipeline key.
- Rows are derived from existing JSON-safe `gltf.primitiveMaterials.resolutions`
  status and do not expose raw material assets or GPU handles.
- Playwright verifies rows on dual-material, alpha-state, and custom URL
  samples.

### task-2112 — Add GLB viewer source-loader status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows source kind, byte length, loader status,
  image-decode diagnostic count, and source diagnostic count for the active
  asset.
- Rows are derived from existing JSON-safe `source` status and clear/update
  across sample and custom URL loads.
- Playwright verifies rows for a clean sample, a custom URL sample, and an
  unsupported-feature sample with diagnostics.

### task-2113 — Add GLB viewer hierarchy status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_transform/src/systems.rs`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows replayed node count, parented-node count,
  and a compact first-child local/world translation row for hierarchy-bearing
  assets.
- Rows are derived from existing JSON-safe `hierarchy.nodes` status and reflect
  ECS transform resolution, not a renderer-owned scene graph.
- Playwright verifies rows on the hierarchy sample and row updates after
  switching to a non-hierarchy sample.

### task-2114 — Add GLB viewer animation-channel diagnostic rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows unsupported animation-channel counts and
  compact channel-path diagnostics when an animated asset includes unsupported
  interpolation or target paths.
- Rows are derived from existing JSON-safe animation status and do not block
  supported animation playback.
- Playwright verifies rows on the CUBICSPLINE/unsupported-channel sample and
  row clearing on the basic animated sample.

### task-2115 — Add GLB viewer replay-stage status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows source registration validity/diagnostics,
  command-plan command/dependency counts, and ECS replay created/diagnostic
  counts for the active asset.
- Rows are derived from existing JSON-safe `gltf.registration`,
  `gltf.commandPlan`, and `gltf.replay` status, not from source assets or GPU
  resources.
- Playwright verifies rows on a clean sample, a hierarchy sample, and an
  unsupported-feature sample.

### task-2116 — Add GLB viewer texture-gallery status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows real-URI gallery active state, active
  index/count, active sample ID, and available sample count.
- Rows are derived from existing JSON-safe `textureGallery` status and update
  when previous/next gallery buttons, sample selection, and custom URL loads
  change the active asset.
- Playwright verifies rows on a gallery asset, after next/previous navigation,
  and after switching to a custom URL where gallery state clears.

### task-2117 — Add GLB viewer extraction diagnostic rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_render/src/extract_component.rs`;
`references/bevy/crates/bevy_pbr/src/render/mesh.rs`.

Acceptance criteria:

- The GLB viewer status panel shows compact extraction diagnostic rows with
  code, asset/material/texture context, and texCoord/field when present.
- Rows are derived from existing JSON-safe `extraction.diagnosticsList` status
  and clear on assets without extraction diagnostics.
- Playwright verifies rows on the missing-UV1 sample and row clearing on the
  UV1 image-decode control sample.

### task-2118 — Add GLB viewer primitive texture-slot route rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-primitive texture-slot rows for
  texture-backed material slots, including slot name, texCoord, transform
  presence, and sampler readiness.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[].textureSlots` status and do not expose
  image bytes or GPU handles.
- Playwright verifies rows on all-slot URI textures, UV1 image-decode controls,
  and a scalar-only sample where the rows clear.

### task-2119 — Add GLB viewer selected-scene status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows default scene index, selected scene index,
  selected root node count, and first selected root node index.
- Rows are derived from existing JSON-safe `gltf.metadata.scene` status and
  clear or report `none` when scene metadata is absent.
- Playwright verifies rows on the multi-scene sample and updates after
  switching to a single-scene sample.

### task-2120 — Add GLB viewer selected-asset status rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/webgl_loader_gltf.html`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer status panel shows selected asset source, loading state,
  formatted URL, and material-family summary for the active asset.
- Rows are derived from existing JSON-safe `selectedAsset` status and update
  across sample, gallery, and custom URL loads.
- Playwright verifies rows on a sample, after a gallery button load, and after a
  custom URL load.

### task-2121 — Add GLB viewer render-state detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/mesh.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact render queue counts and unique
  pipeline-key rows separate from the broad draw summary.
- Rows are derived from existing JSON-safe `renderState` status and do not read
  renderer-owned GPU handles.
- Playwright verifies rows on all-slot URI textures, lit brass, and custom URL
  samples.

### task-2122 — Add GLB viewer source-output summary rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows source output-summary rows for mesh
  construction, source registration, ECS command plan, and ECS replay readiness
  when available.
- Rows are derived from existing JSON-safe `source.outputSummary` status and
  clear when no loader output summary exists.
- Playwright verifies rows on a clean sample, all-slot URI textures, and a
  custom URL sample.

### task-2123 — Add GLB viewer animation clip-list rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact animation clip rows with clip
  index, name, and duration for assets with supported clips.
- Rows are derived from existing JSON-safe `animation.clips` status and clear on
  assets without supported clips.
- Playwright verifies rows on animated and multi-clip samples and clearing on a
  static sample.

### task-2124 — Add GLB viewer imported-camera list rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact imported-camera rows for every
  declared camera, including projection, support status, and node/camera index.
- Rows are derived from existing JSON-safe `importedCamera.cameras` status and
  clear on assets without imported cameras.
- Playwright verifies rows on perspective and orthographic camera samples and
  clearing on a sample without cameras.

### task-2125 — Add GLB viewer imported-light list rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact imported-light rows for every
  declared glTF punctual light, including kind, extraction state, node/light
  index, intensity, and range.
- Rows are derived from existing JSON-safe `importedLights.lights` status and
  clear on assets without imported lights.
- Playwright verifies rows on the imported-light sample with imported lights
  enabled and disabled, then verifies clearing on a sample without lights.

### task-2126 — Add GLB viewer animated-node list rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_animation/src/lib.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact animated-node rows with node index,
  animated path, and current value summary for active clips.
- Rows are derived from existing JSON-safe `animation.animatedNodes` status and
  clear on static assets.
- Playwright verifies rows on translation and rotate/scale animation samples
  and clearing on a static sample.

### task-2127 — Add GLB viewer shadow-request detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/mesh.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact shadow-request rows with light kind,
  caster count, receiver count, and active route state.
- Rows are derived from existing JSON-safe `shadow.requests` and shadow
  authoring status without exposing GPU handles.
- Playwright verifies rows on the brass shadow sample and clearing when the
  sample has no active shadow request.

### task-2128 — Add GLB viewer IBL resource detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/src/extras/PMREMGenerator.js`;
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact IBL resource rows for enabled state,
  environment key, diffuse/specular resource presence, and pipeline keys.
- Rows are derived from existing JSON-safe `ibl` status and clear or report
  `none` for assets without IBL resources.
- Playwright verifies rows on the lit brass IBL sample and on a scalar-only
  sample without IBL.

### task-2129 — Add GLB viewer material-factor detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-primitive material-factor rows
  for base color, metallic, roughness, normal, occlusion, and emissive values.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[].factors` status and clear on missing
  factor summaries.
- Playwright verifies rows on StandardMaterial texture-control samples and a
  scalar-only sample.

### task-2130 — Add GLB viewer texture-sampler detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact texture-sampler rows with slot,
  address modes, filter modes, and anisotropy for texture-backed primitive
  material slots.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[].textureSlots.*.sampler` status and
  clear on scalar-only materials.
- Playwright verifies rows on sampler wrap controls, all-slot URI textures, and
  scalar-only cube.

### task-2131 — Add GLB viewer texture-transform detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact texture-transform rows with slot,
  offset, scale, and rotation for texture slots that declare transforms.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[].textureSlots.*.transform` status and
  clear on texture-backed slots without transforms.
- Playwright verifies rows on normal, emissive, and metallic-roughness
  transform-control samples.

### task-2132 — Add GLB viewer material-alpha detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-primitive alpha rows with
  alpha mode, alpha cutoff, blend preset, depth write, and cull mode.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[]` render-state fields and clear on
  missing primitive material resolution status.
- Playwright verifies rows on alpha-mask, alpha-blend, mixed-alpha, and opaque
  scalar samples.

### task-2133 — Add GLB viewer prepared-resource reuse rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_render/src/render_asset.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact prepared-resource reuse rows for
  mesh buffers, material buffers, bind groups, texture resources, and samplers.
- Rows are derived from existing JSON-safe `report.resourceReuse` status and do
  not expose GPU handles.
- Playwright verifies rows across initial sample load, sample switch, and
  custom URL load.

### task-2134 — Add GLB viewer render-diagnostics section rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_render/src/diagnostic/mod.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact render diagnostics section rows for
  material queue, routed resource set, direct lighting, and built-in app
  resource adapter summaries when present.
- Rows are derived from existing JSON-safe `report.diagnosticsSummary` status
  and clear when the report is absent.
- Playwright verifies rows on StandardMaterial, imported-light, and scalar-only
  samples.

### task-2135 — Add GLB viewer texture handle-key detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-texture-slot handle rows with
  slot, texture key, sampler key, and texCoord for texture-backed primitive
  material slots.
- Rows are derived from existing JSON-safe
  `gltf.primitiveMaterials.resolutions[].textureSlots.*` status and do not
  expose texture objects, sampler objects, image bytes, or GPU handles.
- Playwright verifies rows on all-slot URI textures, sampler wrap controls, and
  row clearing on scalar-only cube.

### task-2136 — Add GLB viewer pipeline-token detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/mesh.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-primitive pipeline-token rows
  for material family, feature tokens, alpha token, cull token, depth token, and
  blend token parsed from each JSON-safe pipeline key.
- Rows are derived from existing
  `gltf.primitiveMaterials.resolutions[].pipelineKey` status and clear on
  missing pipeline keys.
- Playwright verifies rows on all-slot URI textures, mixed alpha, and unlit
  scalar cube.

### task-2137 — Add GLB viewer decoded-image detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-decoded-image rows with image
  index, source kind, URI, MIME type, dimensions, and byte length.
- Rows are derived from existing JSON-safe `source.imageDecode.decoded` status
  and do not expose raw image bytes, ImageBitmap objects, texture objects, or
  GPU handles.
- Playwright verifies rows on all-slot URI textures, embedded texture, and a
  scalar-only asset with no decoded images.

### task-2138 — Add GLB viewer unsupported-feature detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/mod.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact unsupported-feature detail rows with
  diagnostic code, severity, and the most specific mesh/primitive/field detail
  available.
- Rows are derived from existing JSON-safe
  `gltf.metadata.unsupportedFeatureDiagnostics` status and clear on supported
  assets.
- Playwright verifies rows on unsupported primitive, morph target, and scalar
  cube samples.

### task-2139 — Add GLB viewer mesh-draw identity rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`examples/styles.css`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_render/src/extract_component.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- The GLB viewer status panel shows compact per-draw rows with render ID,
  mesh key, material key, queue, and pipeline key for extracted mesh draws.
- Rows are derived from JSON-safe extraction/render-state data and do not make
  the renderer own ECS or gameplay state.
- Playwright verifies rows on dual primitive, mixed alpha, and custom URL
  samples.

### task-2140 — Audit GLB viewer status-panel boundary after detail rows

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, backlog/handoff only unless a tiny
corrective UI/test change is required.
Reference anchor: `docs/NORTH_STAR.md`; `docs/ARCHITECTURE.md`;
`references/bevy/crates/bevy_render/src/diagnostic/mod.rs`;
`references/engine/src/scene/renderer/renderer.js`.

Acceptance criteria:

- Confirm the expanded GLB viewer status panels remain projections of ECS,
  extraction, source asset, or JSON-safe render report data.
- Confirm panels do not expose raw image bytes, source buffers, GPU handles,
  mutable renderer state, or a hidden scene graph.
- Recommend whether to continue detail-row UI work or shift back to a rendered
  glTF scene fidelity slice.

### task-2141 — Add GLB viewer selected-scene replay control

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.html`, `examples/glb-viewer.js`,
`test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`.

Acceptance criteria:

- The GLB viewer shows a scene selector for GLB assets with more than one glTF
  scene and hides or disables it for single-scene assets.
- Changing the selected scene destroys the previous replayed ECS scene and
  replays only the newly selected glTF scene through the existing command-plan
  path.
- Playwright verifies the committed multi-scene sample switches visible pixels,
  selected-scene status, and extracted draw counts without WebGPU warnings.

### task-2142 — Render a committed external `.gltf` scene in GLB viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/assets`,
`examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- A public loader path can fetch a simple same-origin `.gltf` JSON file plus
  its external `.bin` buffer without using the GLB container parser.
- The GLB viewer includes a committed external-gltf sample that registers and
  replays through the same ECS asset/material path as current GLB samples.
- Playwright verifies visible rendered pixels, JSON-safe source-loader status,
  and no raw fetched buffer exposure.

### task-2143 — Render GLB vertex colors through a built-in material

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/render/src/assets`, `packages/webgpu/src`,
`examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_pbr/src/render/mesh.rs`.

Acceptance criteria:

- GLB mesh construction preserves a `COLOR_0` vertex attribute for a committed
  sample with per-vertex color variation.
- The selected built-in material route consumes vertex color data without adding
  renderer-owned source material state.
- Playwright verifies distinct vertex-colored pixels and JSON-safe mesh/material
  status for the sample.

### task-2144 — Generate or route tangents for missing-tangent normal maps

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `packages/webgpu/src`,
`examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`;
`references/three.js/examples/jsm/loaders/GLTFLoader.js`.

Acceptance criteria:

- A committed normal-mapped GLB sample without authored `TANGENT` data renders
  without silently dropping the normal texture.
- The implementation either generates renderer-independent tangent attributes
  during mesh construction or reports and tests a deliberate derivative-tangent
  shader path.
- Playwright verifies the normal-mapped region differs from a scalar/flat
  control region and status explains the tangent path used.

### task-2145 — Add GLB viewer imported-camera selection

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/assets`, `examples/glb-viewer.html`,
`examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- The GLB viewer includes a committed sample with at least two supported
  perspective cameras.
- The viewer exposes a compact imported-camera selector that switches the
  ECS-authored camera transform/projection without bypassing the existing
  imported-camera toggle.
- Playwright verifies selected-camera status and a visible pixel/framing change
  between cameras.

### task-2146 — Add GLB viewer imported-camera URL bootstrap

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/glb-viewer.js`, `examples/glb-viewer.html`,
`test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_render/src/camera.rs`.

Acceptance criteria:

- `examples/glb-viewer.html?asset=multi-camera&camera=1` seeds the selected
  imported-camera selector from the URL without bypassing the imported-camera
  toggle.
- A URL flag can also start with imported-camera mode enabled, using the same
  ECS-authored camera transform/projection path as the manual toggle.
- Playwright verifies selector value, JSON-safe selected-camera status, toggle
  state, and a visible framing/pixel change for the deep-linked camera.

### task-2147 — Render textured unlit vertex colors

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src`, `packages/render/src/assets`,
`examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`,
targeted WebGPU tests.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/base.js`.

Acceptance criteria:

- A committed GLB sample combines `COLOR_0` with an unlit base-color texture.
- The unlit WebGPU route multiplies base-color factor, texture color, and
  vertex color without adding renderer-owned source material state.
- Playwright verifies JSON-safe mesh/material/pipeline status and visibly
  different textured vertex-color regions.

### task-2148 — Render StandardMaterial vertex colors

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src`, `packages/render/src/assets`,
`examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`,
targeted WebGPU tests.
Reference anchor: `references/bevy/crates/bevy_pbr/src/render/mesh.rs`;
`references/three.js/src/materials/MeshStandardMaterial.js`.

Acceptance criteria:

- A committed lit StandardMaterial GLB sample preserves and routes `COLOR_0`
  through the standard material shader path.
- Pipeline/layout selection stays derived from extracted mesh attributes and
  material family state.
- Playwright verifies lit vertex-color pixels, JSON-safe mesh layout status,
  and no WebGPU validation warnings.

### task-2149 — Support imported orthographic cameras in GLB viewer

Status: completed 2026-05-20. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `packages/render/src/assets`, `examples/assets`,
`examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/bevy/crates/bevy_render/src/camera.rs`.

Acceptance criteria:

- The existing orthographic-camera GLB sample becomes a supported imported
  camera path instead of an unsupported-feature-only diagnostic.
- The imported-camera toggle applies the glTF orthographic projection through
  ECS-authored camera state.
- Playwright verifies JSON-safe orthographic camera status and a visible
  framing/pixel change compared with the fitted orbit camera.

### task-2150 — Route normal maps through TEXCOORD_1

Category: `webgpu-render`
Package/write-scope: `packages/render/src/assets`, `packages/webgpu/src`,
`examples/assets`, `examples/glb-viewer.js`, `test/e2e/glb-viewer.spec.ts`,
targeted tests.
Reference anchor: `references/three.js/examples/jsm/loaders/GLTFLoader.js`;
`references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/normalMap.js`.

Acceptance criteria:

- A committed StandardMaterial GLB sample uses `normalTexture.texCoord = 1`
  with `TEXCOORD_1` mesh data.
- The normal-map shader route samples the declared coordinate set while keeping
  texture-slot status JSON-safe.
- Playwright verifies texCoord-1 status, distinct pixels against a texCoord-0
  or scalar control, and no WebGPU validation warnings.

## Ready Tasks By Category

### Proof Point Critical Path

### task-1366 — Plan next route or glTF fidelity slice after alpha-blend double-sided coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the latest alpha-blend route/glTF fidelity audits.

Acceptance criteria:

- Compare one route/prepared-resource candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1367 — Audit selected pipeline-layout-missing frame-resource plan

Status: completed 2026-05-18. See
`docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/glTF diagnostic audits.

Acceptance criteria:

- Confirm the selected pipeline-layout-missing follow-up is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1368 — Add pipeline-layout-missing frame-resource regression

Status: completed 2026-05-18. See
`test/webgpu/queued-material-frame-resource-set.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  a valid pipeline resource whose `pipeline` lacks `getBindGroupLayout`.
- Assert the result is invalid, reports `webGpuApp.missingPipelineLayouts`,
  appends no frame resources, creates no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep app-level non-built-in rendering, binary GLB loading, IBL, shadows, and
  GLB viewer behavior deferred.

### task-1369 — Audit selected route or glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1368`, the plan/audit from `task-1366` and
`task-1367`, `docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1370 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PIPELINE_LAYOUT_GUARD_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1368`/`task-1369` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1371 — Plan next route/prepared-resource slice after pipeline-layout guard

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`,
and recent route/prepared-resource audits.

Acceptance criteria:

- Compare one generic route/prepared-resource candidate, one DebugNormalMaterial
  route-readiness candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1372 — Audit invalid pipeline-view frame-resource plan

Status: completed 2026-05-18. See
`docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected invalid pipeline-view follow-up is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1373 — Add invalid pipeline-view frame-resource regression

Status: completed 2026-05-18. See
`test/webgpu/queued-material-frame-resource-set.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  `valid: false` with a diagnostic.
- Assert the result is invalid, preserves the pipeline-view diagnostic, creates
  no pipeline plans, no frame resources, no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep app-level non-built-in rendering, binary GLB loading, IBL, shadows, and
  GLB viewer behavior deferred.

### task-1374 — Audit selected route/prepared-resource follow-up

Status: completed 2026-05-18. See
`docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1373`, the plan/audit from `task-1371` and
`task-1372`, `docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1375 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_PIPELINE_VIEW_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1373`/`task-1374` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1376 — Plan next route/prepared-resource slice after invalid pipeline-view coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`,
and recent route/prepared-resource audits.

Acceptance criteria:

- Compare one remaining generic route diagnostic candidate, one
  DebugNormalMaterial route-readiness candidate, and one StandardMaterial/glTF
  fidelity candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1377 — Audit DebugNormalMaterial route-readiness plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_ROUTE_READINESS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected DebugNormalMaterial readiness map is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1378 — Add DebugNormalMaterial route-readiness map

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/debug-normal-preparation.ts`,
`packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`test/webgpu/built-in-material-queue-family.test.ts`, and
`test/webgpu/built-in-material-queue-adapter.test.ts`.

Acceptance criteria:

- Document which DebugNormalMaterial pieces are already present: source asset
  type/factory, preparation plan, shader metadata, and pipeline descriptor plan.
- Document why it is not active in app-level built-in routing yet.
- Define the smallest safe activation sequence and tests needed before browser
  rendering can be enabled.
- Keep app-level DebugNormalMaterial rendering, binary GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

### task-1379 — Audit DebugNormalMaterial route-readiness map

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_ROUTE_READINESS_MAP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`, the
plan/audit from `task-1376` and `task-1377`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1380 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_READINESS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1378`/`task-1379` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1381 — Add debug-normal material buffer resource helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`, and
`test/webgpu/debug-normal-material-buffer.test.ts`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, `test/webgpu`, and exports
only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/unlit-material-buffer.ts`,
`packages/webgpu/src/webgpu/unlit-material-buffer-resource.ts`,
`packages/webgpu/src/webgpu/matcap-material-buffer.ts`,
`packages/webgpu/src/webgpu/standard-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`, and
`references/three.js/src/renderers/common/Bindings.js`.

Acceptance criteria:

- Add a renderer-owned debug-normal material uniform data/buffer resource helper
  for the current shader contract.
- Expose JSON-safe inspection or report helpers that omit raw GPU handles.
- Add targeted tests for buffer contents/descriptor shape and JSON safety.
- Do not add debug-normal app route activation, bind groups, frame resources,
  browser rendering, IBL, shadows, or GLB viewer behavior.

### task-1382 — Audit debug-normal material buffer resource helper

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_MATERIAL_BUFFER_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1381`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous material buffer helpers.

Acceptance criteria:

- Confirm the helper is renderer-owned and JSON-safe.
- Confirm it matches the debug-normal shader binding contract.
- Confirm app route activation remains deferred.

### task-1383 — Audit tracker/backlog alignment after debug-normal material buffer

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BUFFER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1381`/`task-1382` results.

Acceptance criteria:

- Confirm the public tracker reflects the debug-normal material buffer slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1384 — Plan next DebugNormalMaterial route activation slice

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
the `task-1381`/`task-1382` results, `docs/ARCHITECTURE.md`, and analogous
built-in material bind group/frame-resource helpers.

Acceptance criteria:

- Compare debug-normal bind group resources, debug-normal frame resources, and
  route adapter activation candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep app-level rendering deferred unless the selected prerequisite is fully
  testable in one focused run.

### task-1385 — Audit DebugNormalMaterial bind group plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BIND_GROUP_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in material resource helpers.

Acceptance criteria:

- Confirm the selected bind group resource follow-up is concrete enough for one
  focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1386 — Add DebugNormalMaterial bind group resources

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`, and
`test/webgpu/debug-normal-bind-group.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`test/webgpu/debug-normal-bind-group.test.ts`, and exports only if needed.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group.ts`, and analogous built-in
material resource helpers.

Acceptance criteria:

- Add DebugNormalMaterial group-2 bind group layout metadata/plan for binding 0
  material uniform buffer.
- Add descriptor/resource helpers that consume a material buffer resource key
  and renderer-owned buffer resource.
- Add JSON-safe inspection for successful bind group resources that omits raw
  bind group handles.
- Add targeted tests for descriptor planning, resource creation, JSON safety,
  and missing material/layout/device diagnostics.
- Do not activate app-level DebugNormalMaterial routing, frame resources,
  browser rendering, binary GLB loading, IBL, shadows, or GLB viewer behavior.

### task-1387 — Audit selected DebugNormalMaterial route activation prerequisite

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BIND_GROUP_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1386`, the plan/audit from `task-1384` and
`task-1385`, `docs/ARCHITECTURE.md`, and
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1388 — Audit tracker/backlog alignment after selected DebugNormal prerequisite

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BIND_GROUP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1386`/`task-1387` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1389 — Plan next DebugNormalMaterial route activation slice

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
the `task-1386`/`task-1387` results, `docs/ARCHITECTURE.md`, and analogous
built-in material resource helpers.

Acceptance criteria:

- Compare the next DebugNormalMaterial prerequisite candidates after the
  selected `task-1386` work lands.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep app-level rendering deferred unless the selected prerequisite is fully
  testable in one focused run.

### task-1390 — Audit next DebugNormalMaterial route activation plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1389`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in material resource helpers.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1391 — Add DebugNormalMaterial frame resources

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts` and
`test/webgpu/debug-normal-frame-resources.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`test/webgpu/debug-normal-frame-resources.test.ts`, and exports only if needed.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/matcap-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-frame-resources.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial frame-resource assembly helper that can upload mesh,
  view uniforms, world transforms, material buffer, shared bind groups, and the
  debug-normal group-2 bind group.
- Support prepared mesh and prepared material resources as inputs so app/cache
  integration can reuse renderer-owned resources later.
- Return JSON-safe diagnostics and no resources when required inputs are
  missing.
- Add targeted tests for successful resource assembly and missing required
  input diagnostics.
- Do not activate app-level routing, browser rendering, binary GLB loading, IBL,
  shadows, or GLB viewer behavior.

### task-1392 — Audit selected DebugNormalMaterial frame-resource prerequisite

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1391`, the plan/audit from `task-1389` and
`task-1390`, `docs/ARCHITECTURE.md`, and analogous built-in material frame
resource helpers.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1393 — Audit tracker/backlog alignment after DebugNormal frame resources

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1391`/`task-1392` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1394 — Plan next DebugNormalMaterial route activation slice after frame resources

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_FRAME_RESOURCES_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app frame-resource helpers.

Acceptance criteria:

- Compare app frame-resource cache/reuse integration, direct app route
  activation, and route diagnostics coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep browser rendering deferred unless the selected slice includes all needed
  app resources and diagnostics in one focused run.

### task-1395 — Audit next DebugNormalMaterial route activation plan after frame resources

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1394`,
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app frame-resource helpers.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1396 — Add DebugNormalMaterial app frame-resource cache/reuse helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts` and
`test/webgpu/debug-normal-app-frame-resources.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
targeted tests, and exports only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial app frame-resource helper that wraps
  `createDebugNormalFrameGpuResources()`.
- Cache/reuse mesh, material buffer, bind groups, and dynamic view/transform
  buffer writes using the established app helper pattern.
- Track reuse counters consistently with existing built-in material app
  frame-resource reports.
- Add targeted tests for first-frame creation and same-key dynamic-buffer reuse.
- Do not add active app routing or browser rendering.

### task-1397 — Audit selected DebugNormalMaterial app frame-resource helper

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1396`, the plan/audit from `task-1394` and
`task-1395`, `docs/ARCHITECTURE.md`, and analogous built-in app frame-resource
helpers.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm app cache/reuse does not make the renderer own ECS/game state.
- Confirm route activation remains deferred until diagnostics and app adapter
  wiring are explicitly selected.

### task-1398 — Audit tracker/backlog alignment after DebugNormal app frame resources

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1396`/`task-1397` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal app frame-resource
  prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1399 — Plan active DebugNormalMaterial route integration after app frame resources

Status: completed 2026-05-18. See
`docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
analogous Unlit/Matcap app route paths.

Acceptance criteria:

- Compare app route resource integration, route-summary diagnostics, and browser
  pixel coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep browser rendering deferred unless the selected slice includes route
  wiring, summaries, and reliable targeted verification in one focused run.

### task-1400 — Audit active DebugNormalMaterial route integration plan

Status: completed 2026-05-18. See
`docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1399`,
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app route resource paths.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1401 — Add DebugNormalMaterial app route resource integration

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/app.ts` and
`docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
targeted tests, and exports only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`, and analogous app
route resource wiring.

Acceptance criteria:

- Wire DebugNormalMaterial into the app route resource path using the
  app-frame-resource helper and existing generic route summaries.
- Report JSON-safe routed resource summaries and diagnostics for debug-normal
  family routes.
- Add targeted tests for app resource creation and route-summary shape.
- Keep browser pixel coverage, binary GLB loading, IBL, shadows, and GLB viewer
  behavior deferred.

### task-1402 — Audit selected DebugNormalMaterial app route resource integration

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1401`, the plan/audit from `task-1399` and
`task-1400`, `docs/ARCHITECTURE.md`, and analogous built-in app route resource
paths.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm route integration preserves ECS authority, render extraction
  boundaries, and JSON-safe diagnostics.
- Recommend the next tracker/backlog or browser verification follow-up.

### task-1403 — Audit tracker/backlog alignment after DebugNormal route integration

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_ROUTE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1401`/`task-1402` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal route integration.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1404 — Plan DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1401`/`task-1402` route integration results,
`docs/ARCHITECTURE.md`, and existing material browser fixtures.

Acceptance criteria:

- Compare browser pixel coverage, route diagnostics coverage, and prepared
  material cache coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected browser slice narrow enough for one focused Playwright run
  if browser coverage is selected.

### task-1405 — Audit DebugNormalMaterial browser pixel coverage plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1404`, the `task-1401`/`task-1402` route integration
results, `docs/ARCHITECTURE.md`, and existing material browser fixtures.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1406 — Add DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See `examples/debug-normal-app.js` and
`test/e2e/debug-normal-app.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/debug-normal-app.html`, `examples/debug-normal-app.js`,
`test/e2e/debug-normal-app.spec.ts`, and tracker updates if the rendered browser
slice lands.
Reference anchor:
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`, and the active
DebugNormal route integration from `task-1401`.

Acceptance criteria:

- A browser example creates a `createWebGpuApp` scene with one camera, one mesh,
  and one `DebugNormalMaterial` authored through ECS components and typed
  assets.
- The example publishes JSON-safe status with `debug-normal` material queue and
  routed resource summaries, pipeline key, draw count, and no raw GPU handles.
- Playwright verifies the rendered pixel/readback sample is not clear and is
  consistent with the expected normal-encoded color for the sampled cube face.
- Keep prepared DebugNormal material cross-slot caching, GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

### task-1407 — Audit DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1406`,
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and existing browser material fixtures.

Acceptance criteria:

- Confirm the browser example and Playwright regression satisfy the selected
  acceptance criteria.
- Confirm the browser slice preserves ECS authority, render extraction
  boundaries, JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1408 — Audit tracker/backlog alignment after DebugNormal browser coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BROWSER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1406`/`task-1407` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal browser pixel
  coverage.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1409 — Plan next material route or DebugNormal follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1406`/`task-1408` results.

Acceptance criteria:

- Compare one material route architecture candidate, one DebugNormal cleanup or
  cache candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1410 — Audit selected next material route or DebugNormal follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1409`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1411 — Implement prepared DebugNormal material cache parity

Status: completed 2026-05-18. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/prepared-debug-normal-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`,
`packages/webgpu/src/webgpu/prepared-app-material-resource.ts`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and exports if needed.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`, and
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`.

Acceptance criteria:

- Add a renderer-owned prepared DebugNormal material cache keyed by source
  material handle/version and pipeline key where applicable.
- Integrate the cache into DebugNormal app frame resources so material buffer
  and material bind group resources can be reused across frame-resource cache
  misses.
- Extend prepared app material cache summaries to report `debug-normal`
  entries.
- Add targeted tests covering first creation, reuse after mesh-only frame
  resource misses, JSON-safe summaries, and no raw GPU handles.
- Keep non-built-in custom material rendering, GLB loading, IBL, shadows, and
  broader route renames deferred.

### task-1412 — Audit prepared DebugNormal material cache parity

Status: completed 2026-05-18. See
`docs/research/PREPARED_DEBUG_NORMAL_MATERIAL_CACHE_PARITY_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1411`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and relevant prepared material cache references.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1413 — Audit tracker/backlog alignment after prepared DebugNormal cache parity

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PREPARED_DEBUG_NORMAL_CACHE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if the selected follow-up changes
public status.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1411`/`task-1412` results.

Acceptance criteria:

- Confirm public tracker pages reflect the selected follow-up when status
  changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1414 — Plan next material route or StandardMaterial follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1411`/`task-1413` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1415 — Audit selected next material route or StandardMaterial follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1414`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.

### task-1416 — Add generic built-in app resource adapter registry smoke coverage

Status: completed 2026-05-18. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and docs/research only if
the audit finds a boundary concern.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Add or expose a typed built-in app resource adapter registry shape that covers
  Unlit, Matcap, Standard, and DebugNormal without adding new material family
  behavior.
- Add tests proving all active built-in families are present, uniquely keyed,
  and route through the shared registry metadata.
- Preserve existing app resource creation behavior and JSON-safe route reports.
- Keep non-built-in custom material rendering, route renames, GLB loading, IBL,
  shadows, and batching deferred.

### task-1417 — Audit generic built-in app resource adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/GENERIC_BUILT_IN_APP_RESOURCE_ADAPTER_REGISTRY_SMOKE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1416`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant route adapter files.

Acceptance criteria:

- Confirm the adapter registry coverage did not broaden into a route rewrite.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1418 — Audit tracker/backlog alignment after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_REGISTRY_SMOKE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1416`/`task-1417` results.

Acceptance criteria:

- Confirm public tracker pages reflect adapter registry smoke coverage if
  status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1419 — Plan next material route or StandardMaterial follow-up after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1416`/`task-1418` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1420 — Audit selected follow-up plan after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1419`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1421 — Add GLB metallic-roughness UV1 transform browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples`, `test/e2e`, targeted StandardMaterial/glTF mapping code only if the
fixture reveals a bug.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`,
existing StandardMaterial GLB texture-transform browser fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and
`docs/DECISIONS.md`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture that samples a
  metallic-roughness texture through `TEXCOORD_1` with a transform.
- Verify JSON-safe status includes the expected texture-info/transform/UV set
  mapping.
- Verify a readback or screenshot pixel proves the transformed `TEXCOORD_1`
  sample affects rendered output.
- Keep GLB viewer work, IBL, shadows, broad PBR completeness, route renames,
  and non-built-in material rendering deferred.

### task-1422 — Audit GLB metallic-roughness UV1 transform browser coverage

Status: completed 2026-05-18. See
`docs/research/GLB_METALLIC_ROUGHNESS_UV1_TRANSFORM_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1421`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial GLB texture-transform
fixtures.

Acceptance criteria:

- Confirm the fixture proves the intended `TEXCOORD_1` metallic-roughness
  transform behavior.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1423 — Audit tracker/backlog alignment after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLB_METALLIC_ROUGHNESS_UV1_TRANSFORM_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1421`/`task-1422` results.

Acceptance criteria:

- Confirm public tracker pages reflect the coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1424 — Plan next material route or StandardMaterial follow-up after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1421`/`task-1423` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1425 — Audit selected follow-up plan after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1424`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1426 — Add GLB combined base-color metallic-roughness browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`;
targeted StandardMaterial/glTF mapping code only if the fixture exposes a bug.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`,
existing StandardMaterial GLB texture fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `references/bevy/crates/bevy_pbr/src/gltf.rs`,
`references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture with both
  `baseColorTexture` and `metallicRoughnessTexture` resolved.
- Verify JSON-safe status includes both texture/sampler mappings, material
  readiness for both slots, expected resource counts, and the combined
  `standard|baseColorTexture|metallicRoughnessTexture|...` pipeline key.
- Verify a screenshot or readback pixel proves the combined textured material
  affects rendered output.
- Keep binary GLB loading, GLB viewer work, IBL, shadows, route renames, broad
  PBR completeness, and non-built-in material rendering deferred.

### task-1427 — Audit GLB combined base-color metallic-roughness browser coverage

Status: completed 2026-05-18. See
`docs/research/GLB_COMBINED_BASE_COLOR_METALLIC_ROUGHNESS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1426`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial GLB combined-texture
fixtures.

Acceptance criteria:

- Confirm the fixture proves the intended combined base-color plus
  metallic-roughness StandardMaterial browser behavior.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1428 — Audit tracker/backlog alignment after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLB_COMBINED_TEXTURE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1426`/`task-1427` results.

Acceptance criteria:

- Confirm public tracker pages reflect the coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1429 — Plan next material route or StandardMaterial follow-up after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1426`/`task-1428` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1430 — Audit selected follow-up plan after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1429`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1431 — Add built-in app adapter registration diagnostics

Status: completed 2026-05-18. See
`test/webgpu/built-in-material-app-resource-adapter.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts` and
`test/webgpu/built-in-material-app-resource-adapter.test.ts`.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, existing built-in app adapter registry tests,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Duplicate built-in app adapter family registrations produce deterministic
  diagnostics without changing the active default registry behavior.
- Missing built-in family registrations produce deterministic diagnostics or a
  validation report suitable for JSON-safe app diagnostics.
- Existing default built-in adapter registration remains valid for Unlit,
  Matcap, Standard, and DebugNormal.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.

### task-1432 — Audit built-in app adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/BUILT_IN_APP_ADAPTER_REGISTRATION_DIAGNOSTICS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1431`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant material-route adapter tests.

Acceptance criteria:

- Confirm duplicate and missing registration diagnostics are deterministic and
  JSON-safe.
- Confirm default built-in app adapter registration remains valid for active
  built-in families.
- Confirm ECS authority, render extraction boundaries, and WebGPU-only resource
  ownership remain intact.

### task-1433 — Audit tracker/backlog alignment after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_REGISTRATION_DIAGNOSTICS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1431`/`task-1432` results.

Acceptance criteria:

- Confirm public tracker pages reflect the diagnostics if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1434 — Plan next material route or StandardMaterial follow-up after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1431`/`task-1433` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1435 — Audit selected follow-up plan after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1434`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1436 — Surface built-in app adapter validation in app diagnostics

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
targeted WebGPU app/adapter tests.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- The default WebGPU app route/resource adapter registry reports valid
  built-in family registration without adding noisy diagnostics.
- A test-only invalid built-in app adapter registry can surface duplicate and
  missing-family diagnostics in JSON-safe app diagnostics or an app report.
- The report omits adapter callbacks, app objects, source asset payloads, and raw
  GPU handles.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.

### task-1437 — Audit built-in app adapter validation app diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1436`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant WebGPU app diagnostics tests.

Acceptance criteria:

- Confirm default app diagnostics stay quiet for valid built-in registration.
- Confirm test-only invalid registration surfaces duplicate/missing diagnostics
  through JSON-safe app diagnostics or reports.
- Confirm ECS authority, render extraction boundaries, and WebGPU-only resource
  ownership remain intact.

### task-1438 — Audit tracker/backlog alignment after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1436`/`task-1437` results.

Acceptance criteria:

- Confirm public tracker pages reflect the diagnostics if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1439 — Plan next material route or StandardMaterial follow-up after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1436`/`task-1438` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1440 — Audit selected follow-up plan after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1439`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1441 — Add combined base-color metallic-roughness normal GLB browser coverage

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color,
  metallic-roughness, and normal textures active together.
- Verify JSON-safe material status reports all three texture/sampler mappings
  and readiness slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and materially different from a
  base-color-only or untextured control.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.

### task-1444 — Add combined base-color occlusion emissive GLB browser coverage

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BMR_NORMAL_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color, occlusion, and
  emissive textures active together.
- Verify JSON-safe status reports all texture/sampler mappings and readiness
  slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and reflect the combined
  StandardMaterial texture route.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.

### task-1445 — Audit combined base-color occlusion emissive GLB browser coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1444`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial browser tests.

Acceptance criteria:

- Confirm the fixture uses the existing ECS-authored app path and built-in
  StandardMaterial route.
- Confirm status/readback assertions remain JSON-safe and WebGPU-only.
- Confirm no broad PBR, IBL, GLB viewer, or app-level generic adapter work
  slipped into the slice.

### task-1446 — Audit tracker/backlog alignment after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1444`/`task-1445` results.

Acceptance criteria:

- Confirm public tracker pages reflect the browser coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1447 — Plan next material route or StandardMaterial follow-up after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1444`/`task-1446` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1448 — Audit selected follow-up plan after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1447`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1449 — Extract multi-texture StandardMaterial browser assertion helper

Status: Completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and the existing combined StandardMaterial browser
tests.

Acceptance criteria:

- Extract a small helper for asserting multi-texture glTF asset mapping,
  readiness slots, resource counts, and pipeline keys.
- Refactor the combined base-color plus metallic-roughness, combined
  base-color/metallic-roughness/normal, and combined
  base-color/occlusion/emissive tests to use it.
- Keep screenshot/readback assertions scenario-specific.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.

### task-1450 — Audit multi-texture StandardMaterial browser assertion helper

Status: Completed 2026-05-18. See
`docs/research/MULTI_TEXTURE_STANDARD_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1449`, `docs/ARCHITECTURE.md`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm helper extraction does not weaken scenario-specific pixel/readback
  assertions.
- Confirm JSON-safe status coverage and pipeline/resource assertions remain
  intact.
- Confirm no runtime code was changed for a test-only cleanup.

### task-1451 — Audit tracker/backlog alignment after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MULTI_TEXTURE_STANDARD_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1449`/`task-1450` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for test-only cleanup.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1452 — Plan next material route or StandardMaterial follow-up after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1449`/`task-1451` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1453 — Audit selected follow-up plan after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1452`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1454 — Route app diagnostics through generic material summary

Status: Completed 2026-05-18. See `packages/webgpu/src/webgpu/app.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`test/webgpu/webgpu-app.test.ts`, and targeted summary tests if needed.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `createQueuedBuiltInAppDiagnosticsSummary()` builds `routedResourceSet`
  through `createQueuedMaterialFrameResourceSetSummary()` or an equivalent
  generic material-family summary path.
- Existing public `routedResourceSet` JSON shape and built-in compatibility
  arrays remain unchanged.
- Built-in wrapper exports are either kept as explicit compatibility aliases or
  removed only if no public exports/tests/docs rely on them.
- Tests cover at least one app diagnostics summary route and any touched summary
  wrapper behavior.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1455 — Audit generic material summary app diagnostics routing

Status: Completed 2026-05-18. See
`docs/research/GENERIC_MATERIAL_SUMMARY_APP_DIAGNOSTICS_ROUTING_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1454`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/app.ts`.

Acceptance criteria:

- Confirm the app diagnostics route uses the generic summary helper without
  changing the public `routedResourceSet` JSON shape.
- Confirm built-in compatibility exports remain stable.
- Confirm no app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes were introduced.

### task-1456 — Audit tracker/backlog alignment after generic summary routing

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_SUMMARY_ROUTING_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1454`/`task-1455` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the generic summary
  route cleanup.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1457 — Plan next route or StandardMaterial follow-up after generic summary routing

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1454`/`task-1456` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1458 — Add generic queued material app resource set contract

Status: Completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic `QueuedMaterialAppResourceSet` type or interface that carries
  generic queued material app resource items.
- Make `QueuedBuiltInAppResourceSet` use or alias that generic set shape while
  preserving its built-in item type.
- Add or update tests proving a fake non-built-in item can be grouped in the
  generic set without adding family-specific diagnostics fields or built-in
  compatibility arrays.
- Existing built-in app resource set and WebGPU app diagnostics tests continue
  to pass.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1459 — Audit generic queued material app resource set contract

Status: Completed 2026-05-18. See
`docs/research/GENERIC_QUEUED_MATERIAL_APP_RESOURCE_SET_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1458`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Acceptance criteria:

- Confirm the generic app resource set remains a typed derived render-route
  contract, not renderer-owned ECS/game state.
- Confirm built-in compatibility behavior and diagnostics fields remain stable.
- Recommend whether to continue route cleanup or return to StandardMaterial/glTF
  fidelity.

### task-1460 — Audit tracker/backlog alignment after generic app resource set contract

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_APP_RESOURCE_SET_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1458`/`task-1459` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the generic app resource
  set contract.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1461 — Plan next route or StandardMaterial follow-up after generic app resource set contract

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1458`/`task-1460` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1462 — Make built-in app resource item extend generic route item

Status: Completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `QueuedBuiltInAppResourceItem` extends or aliases
  `QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>`.
- Existing built-in resource set collection behavior and diagnostics JSON shape
  remain unchanged.
- Tests cover the generic item contract and the built-in collector path.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1463 — Audit built-in app resource item generic contract

Status: Completed 2026-05-18. See
`docs/research/BUILT_IN_APP_RESOURCE_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1462`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

Acceptance criteria:

- Confirm the built-in item type is a compatibility specialization of the
  generic app resource item contract.
- Confirm no public diagnostics shape or rendering behavior changed.
- Recommend whether to continue route cleanup or return to StandardMaterial/glTF
  fidelity.

### task-1464 — Audit tracker/backlog alignment after built-in item generic contract

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1462`/`task-1463` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the built-in item
  generic contract.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1465 — Plan next route or StandardMaterial follow-up after built-in item generic contract

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1462`/`task-1464` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1466 — Add combined alpha-mask emissive StandardMaterial browser coverage

Status: Completed 2026-05-18. See
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and targeted docs only if the fixture changes public status.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped StandardMaterial browser scenario with base-color,
  alpha-mask, and emissive textures.
- Assert glTF texture/sampler mappings, readiness slots, resource counts,
  alpha-mask render-state status, and the combined pipeline key.
- Keep screenshot/readback assertions scenario-specific and verify masked versus
  visible pixels where practical.
- Keep app-level non-built-in material rendering, binary GLB loading, IBL,
  shadows, route renames, and broad PBR work deferred.
- Run targeted Playwright coverage for the new scenario and the full
  `standard-gltf-texture.spec.ts` file.

### task-1467 — Audit combined alpha-mask emissive StandardMaterial browser coverage

Status: Completed 2026-05-18. See
`docs/research/GLB_COMBINED_BASE_COLOR_ALPHA_MASK_EMISSIVE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1466`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm combined texture assertions and scenario-specific pixel/readback
  checks cover the new fixture.
- Confirm alpha-mask render-state expectations remain honest and JSON-safe.
- Confirm no app-level non-built-in rendering, binary GLB loading, IBL, shadows,
  route renames, or broad PBR work was added.

### task-1468 — Audit tracker/backlog alignment after alpha-mask emissive coverage

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_MASK_EMISSIVE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1466`/`task-1467` results.

Acceptance criteria:

- Confirm public tracker pages reflect the new combined alpha-mask emissive
  browser coverage if it lands.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1469 — Plan next route or StandardMaterial follow-up after alpha-mask emissive coverage

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1466`/`task-1468` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1470 — Extract alpha texture browser pixel assertion helper

Status: Completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`,
`test/e2e/standard-gltf-texture.spec.ts`, and existing alpha-mask/alpha-blend
browser tests.

Acceptance criteria:

- Extract a helper for screenshot/readback comparisons shared by alpha-mask
  texture and combined alpha-mask emissive tests.
- Keep alpha-blend translucent comparisons scenario-specific unless the helper
  can support them without weakening assertions.
- Preserve render-state, mapping, readiness, resource, and pipeline assertions.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.

### task-1471 — Audit alpha texture browser pixel assertion helper

Status: Completed 2026-05-18. See
`docs/research/ALPHA_TEXTURE_BROWSER_PIXEL_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1470`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`,
and `test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm the helper does not weaken alpha-mask or combined alpha-mask emissive
  pixel/readback assertions.
- Confirm render-state, pipeline, resource, and JSON-safe status assertions
  remain scenario-specific.
- Confirm no runtime files changed for the test-only helper.

### task-1472 — Audit tracker/backlog alignment after alpha texture helper

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_TEXTURE_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1470`/`task-1471` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the test-only helper.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1473 — Plan next route or StandardMaterial follow-up after alpha texture helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_TEXTURE_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1470`/`task-1472` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1474 — Generalize app route report routed-item serialization

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a family-agnostic helper that serializes a `QueuedMaterialAppResourceItem`
  into the JSON-safe routed-item shape used by app material queue route reports.
- Use the helper from the built-in app resource set route failure diagnostic.
- Add or update tests with a test-only non-built-in item to prove the helper
  does not require built-in material fields or GPU handles.
- Preserve existing built-in route diagnostic JSON shape and app behavior.

### task-1475 — Audit generic app route report routed-item serialization

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_TEXTURE_HELPER_PLAN_2026_05_18.md`,
the implementation from `task-1474`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the helper is family-agnostic and JSON-safe.
- Confirm built-in app route failure diagnostics preserve their public JSON
  shape.
- Confirm the change does not add custom material rendering, WebGL fallback, or
  renderer-owned ECS state.

### task-1476 — Audit tracker/backlog alignment after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and the
`task-1474`/`task-1475` results.

Acceptance criteria:

- Update public tracker pages if the helper materially changes route-contract
  status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1477 — Plan next route or StandardMaterial follow-up after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1474`/`task-1476` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1478 — Audit selected follow-up plan after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1477`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1479 — Audit remaining built-in-specific app route collector diagnostics surfaces

Status: completed 2026-05-18. See
`docs/research/BUILT_IN_APP_ROUTE_COLLECTOR_DIAGNOSTICS_SURFACE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and recent
generic route-contract audits.

Acceptance criteria:

- Identify remaining built-in-specific app route collector diagnostics or
  serialization helpers.
- Separate acceptable built-in compatibility wrappers from surfaces that block
  future non-built-in material-family routing.
- Recommend one small follow-up, or state that no immediate cleanup is needed.

### task-1480 — Plan next collector genericization slice after route surface audit

Status: completed 2026-05-18. See
`docs/research/NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1479` audit, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract implementation
tasks.

Acceptance criteria:

- Compare one collector genericization candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1481 — Audit selected collector genericization plan

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1480`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1482 — Audit tracker/backlog alignment after collector genericization plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1480`/`task-1481` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected collector genericization plan
  materially changes the recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1483 — Plan next route or StandardMaterial follow-up after collector genericization plan audit

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1480`/`task-1482` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1484 — Audit selected follow-up plan after collector-genericization follow-up planning

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_FOLLOW_UP_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1483`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1485 — Extract generic app route report diagnostic builder

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts` and
`test/webgpu/queued-material-app-resource-item.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic helper that builds the
  `webGpuApp.materialQueueRouteReport` diagnostic from `MaterialQueueItem[]`,
  `QueuedMaterialAppResourceItem[]`, normalized route diagnostics, and a reusable
  route report shell.
- Route `collectQueuedBuiltInAppResourceSet()` through the helper without
  changing its public diagnostic JSON shape.
- Add a test-only non-built-in material family fixture proving queue-item and
  routed-item serialization stays JSON-safe and excludes source assets,
  adapters, app objects, and raw GPU handles.
- Keep built-in missing-family diagnostic translation in the built-in collector
  and do not add app-level non-built-in rendering.

### task-1486 — Audit generic app route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1485` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the extraction preserves the built-in route failure diagnostic JSON
  shape.
- Confirm the generic helper does not expose source assets, adapters, app
  objects, or raw GPU handles.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1487 — Audit tracker/backlog alignment after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1485`/`task-1486` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the generic route-report diagnostic builder
  extraction.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1488 — Plan next route or StandardMaterial follow-up after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1485`/`task-1487` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1489 — Audit selected follow-up plan after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1488`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1490 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1495`, which aligned tracker/backlog
after the selected normalizer follow-up was implemented and audited.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1488`/`task-1489` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1491 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1496`, the refreshed planning task after
the implemented normalizer extraction.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1488`/`task-1490` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1492 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1497`, the refreshed audit task after
the implemented normalizer extraction.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1491`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1493 — Extract generic route diagnostic normalizer

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/material-queue-route-report.ts` and
`test/webgpu/material-queue-route-report-diagnostics.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic exported helper that converts unknown diagnostics into zero or
  one `WebGpuAppMaterialQueueRouteDiagnostic` values using the current JSON-safe
  field allowlist.
- Route `collectQueuedBuiltInAppResourceSet()` through the generic normalizer
  after its built-in compatibility diagnostic translation.
- Add targeted coverage proving non-object diagnostics are skipped, JSON-safe
  fields are preserved, invalid entity fields are omitted, and raw GPU/source
  fields do not leak.
- Keep built-in missing-family and material-mismatch diagnostic translation in
  the built-in collector, and do not add app-level non-built-in rendering.

### task-1494 — Audit generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1493` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the normalizer preserves current JSON-safe route diagnostic fields.
- Confirm built-in compatibility policy remains in the built-in collector.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1495 — Audit tracker/backlog alignment after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1493`/`task-1494` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the generic route diagnostic normalizer
  extraction.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1496 — Plan next route or StandardMaterial follow-up after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1493`/`task-1495` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1497 — Audit selected follow-up plan after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1496`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1498 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_REMAINING_COLLECTOR_RESPONSIBILITIES_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1496`/`task-1497` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1499 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1503`, the refreshed planning task after
the remaining collector responsibilities audit.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1496`/`task-1498` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1500 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1504`, the refreshed audit task after
the remaining collector responsibilities audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1499`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1501 — Audit remaining built-in collector responsibilities after route diagnostic helper extraction

Status: completed 2026-05-18. See
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`, and recent
route-contract audits.

Acceptance criteria:

- Identify remaining built-in collector responsibilities and classify each as
  built-in compatibility, generic extraction candidate, or deferred until
  non-built-in app rendering exists.
- Recommend exactly one next implementation or documentation follow-up, or state
  that StandardMaterial/glTF fidelity should resume.
- Confirm no proposed follow-up introduces app-level non-built-in rendering,
  renderer-owned ECS state, WebGL fallback, or a broad collector rewrite.

### task-1502 — Audit tracker/backlog alignment after remaining collector responsibilities audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_REMAINING_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1501` result, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the audit materially changes the recommended
  next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1503 — Plan next route or StandardMaterial follow-up after collector responsibilities audit

Status: superseded 2026-05-18 by `task-1509`, the refreshed planning task after
the selected source asset index helper extraction.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1501`/`task-1502` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1504 — Audit selected follow-up plan after collector responsibilities follow-up planning

Status: superseded 2026-05-18 by `task-1510`, the refreshed audit task after
the selected source asset index helper extraction.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1503`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1505 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1508`, the tracker/backlog alignment
task for the selected source asset index helper extraction.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1503`/`task-1504` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1506 — Extract generic queued source asset index helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-source-assets.ts` and
`test/webgpu/queued-source-assets.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-source-assets.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Move generic queued source mesh/material asset interfaces and source asset
  indexing into a reusable WebGPU app route helper.
- Route the built-in collector through the helper without changing collector
  result shape or diagnostics.
- Add focused tests for ready, missing/loading, duplicate, and versioned mesh
  and material source asset indexing.
- Do not move built-in adapter policy, route traversal, compatibility
  diagnostics, or app-level non-built-in rendering.

### task-1507 — Audit queued source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/QUEUED_SOURCE_ASSET_INDEX_HELPER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1506` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the helper is generic source asset lookup, not built-in adapter policy.
- Confirm built-in collector result shape and diagnostics remain stable.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1508 — Audit tracker/backlog alignment after source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_QUEUED_SOURCE_ASSET_INDEX_HELPER_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1506`/`task-1507` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the helper extraction materially changes route
  contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1509 — Plan next route or StandardMaterial follow-up after source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1506`/`task-1508` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1510 — Audit selected follow-up plan after source asset index helper follow-up planning

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1509`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1511 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_FIDELITY_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1509`/`task-1510` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1512 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1516`, the refreshed planning task after
the selected fidelity gap audit.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1509`/`task-1511` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1513 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1517`, the refreshed audit task after
the selected fidelity gap audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1512`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1514 — Audit remaining StandardMaterial glTF fidelity gaps after route helper cleanup

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and recent StandardMaterial/glTF browser coverage audits.

Acceptance criteria:

- Inventory the remaining near-term StandardMaterial/glTF fidelity gaps visible
  from current examples/tests and medium-term goals.
- Compare at least three candidate browser-verifiable slices.
- Recommend exactly one next implementation task with category,
  package/write-scope, reference anchor, and acceptance criteria.
- Keep IBL, shadows, binary GLB loading, and app-level non-built-in rendering
  deferred unless the audit finds a direct blocker.

### task-1515 — Audit tracker/backlog alignment after StandardMaterial glTF fidelity gap audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1514` result, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the audit materially changes the recommended
  next task or StandardMaterial/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1516 — Plan next route or StandardMaterial follow-up after fidelity gap audit

Status: superseded 2026-05-18 by `task-1522`, the refreshed planning task after
the selected occlusion strength coverage.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1514`/`task-1515` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1517 — Audit selected follow-up plan after fidelity follow-up planning

Status: superseded 2026-05-18 by `task-1523`, the refreshed audit task after
the selected occlusion strength coverage.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1516`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1518 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1521`, the tracker/backlog alignment
task for the selected occlusion strength coverage.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1516`/`task-1517` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1519 — Add StandardMaterial glTF occlusion strength browser coverage

Status: completed 2026-05-18. See
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `occlusionTexture.strength` set to a
  finite non-default value such as `0.25`.
- Assert status JSON reports the mapped occlusion texture, strength value,
  resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-strength
  occlusion path or another deterministic control so the test proves the
  strength changes rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.

### task-1520 — Audit StandardMaterial glTF occlusion strength browser coverage

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_OCCLUSION_STRENGTH_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1519` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Confirm the fixture proves non-default occlusion strength affects browser
  output.
- Confirm the status JSON remains stable and JSON-safe.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1521 — Audit tracker/backlog alignment after occlusion strength coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_OCCLUSION_STRENGTH_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1519`/`task-1520` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for occlusion strength browser coverage.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1522 — Plan next route or StandardMaterial follow-up after occlusion strength coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1519`/`task-1521` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1523 — Audit selected follow-up plan after occlusion strength follow-up planning

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1522`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1524 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. Covered by
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_NORMAL_SCALE_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1522`/`task-1523` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1525 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1528`, the focused visual
normal-scale proof audit after browser mapping coverage exposed a fixture
readback gap.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1522`/`task-1524` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1526 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1528`, the focused visual
normal-scale proof audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1525`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1527 — Add StandardMaterial glTF normal scale browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts` and
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `normalTexture.scale` set to a finite
  non-default value such as `0.25`.
- Assert status JSON reports the mapped normal texture, scale value, tangent
  mesh layout, resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-scale normal-map
  path or another deterministic control so the test proves the scale changes
  rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.

### task-1528 — Audit visual normal-scale proof options after browser mapping coverage

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_NORMAL_SCALE_VISUAL_PROOF_OPTIONS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `examples/standard-gltf-texture.js`,
and `test/e2e/standard-gltf-texture.spec.ts` only if a tiny corrective fixture
change is required.
Reference anchor:
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`,
`examples/standard-texture-control.js`,
`test/e2e/standard-texture-control.spec.ts`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare at least two narrow options for proving normal-scale visual output in
  browser without broad lighting or shader refactors.
- Recommend one deterministic fixture shape, such as a scalar-vs-normal control
  inside the glTF example or a reused Standard texture control pattern.
- Preserve JSON-safe diagnostics, ECS authority, and WebGPU-only ownership.

### task-1529 — Implement deterministic visual normal-scale browser proof

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the audit exposes a focused defect.
Reference anchor:
the `task-1528` audit, `examples/standard-texture-control.js`,
`test/e2e/standard-texture-control.spec.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add or adjust one deterministic browser fixture so normal texture scale
  produces a readback or screenshot delta against a stable control.
- Keep the existing mapped-scale status assertions.
- Run targeted Playwright coverage for the normal-scale proof.

### task-1530 — Audit tracker/backlog alignment after visual normal-scale proof

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_NORMAL_SCALE_VISUAL_PROOF_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1528`/`task-1529` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the visual proof materially changes render
  pipeline status.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1531 — Plan next route or StandardMaterial follow-up after normal-scale visual proof

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_NORMAL_SCALE_VISUAL_PROOF_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1528`/`task-1530` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1532 — Audit selected follow-up plan after normal-scale planning

Status: completed 2026-05-18. See
`docs/research/METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1531`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1533 — Audit tracker/backlog alignment after normal-scale follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_METALLIC_ROUGHNESS_DEPENDENCY_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1531`/`task-1532` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1536 — Add metallic-roughness dependency diagnostics browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_NORMAL_SCALE_VISUAL_PROOF_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with an unavailable
  `metallicRoughnessTexture` texture or sampler dependency.
- Assert JSON-safe readiness/dependency diagnostics identify the
  metallic-roughness slot and dependency status.
- Assert no draw submission and no raw GPU handles leak through status JSON.
- Keep IBL, shadows, binary GLB loading, broad PBR work, and app-level
  non-built-in rendering deferred.

### task-1537 — Audit metallic-roughness dependency diagnostics browser coverage

Status: completed 2026-05-18. See
`docs/research/METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1536` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF dependency
diagnostics audits.

Acceptance criteria:

- Confirm the metallic-roughness dependency scenario proves the intended
  JSON-safe readiness/diagnostic behavior.
- Confirm the implementation preserves ECS authority, render extraction
  boundaries, and WebGPU-only GPU resource ownership.
- Recommend whether to proceed to tracker alignment or add a focused fix.

### task-1538 — Audit tracker/backlog alignment after metallic-roughness dependency diagnostics

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1536`/`task-1537` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the dependency diagnostics materially change
  render pipeline status or the recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1534 — Audit StandardMaterial glTF texture-dependency gaps after normal-scale proof

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_TEXTURE_DEPENDENCY_GAP_AUDIT_AFTER_METALLIC_ROUGHNESS_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md` only if a focused
follow-up needs to be queued.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and recent StandardMaterial/glTF fidelity audits.

Acceptance criteria:

- Inventory remaining browser-verifiable dependency gaps for base-color,
  metallic-roughness, normal, occlusion, and emissive texture/sampler slots.
- Identify one narrow follow-up that improves StandardMaterial/glTF honesty
  without adding binary GLB loading, IBL, shadows, or broad PBR work.
- Preserve ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership.

### task-1535 — Audit generic material route boundary before non-built-in app route migration

Status: completed 2026-05-18. See
`docs/research/GENERIC_MATERIAL_ROUTE_BOUNDARY_BEFORE_NON_BUILT_IN_APP_MIGRATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted WebGPU tests only if a tiny
boundary regression is exposed.
Reference anchor:
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Inventory which app route collector responsibilities remain intentionally
  built-in-specific versus family-generic.
- Confirm the boundary still treats route family keys as adapter routing
  metadata, not public custom source material authoring.
- Recommend one small route-boundary implementation or diagnostic follow-up
  before real non-built-in app rendering.

### task-1539 — Plan next route or StandardMaterial follow-up after dependency gap audit

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_DEPENDENCY_GAP_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1534` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1542 — Add occlusion/emissive dependency diagnostics browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_DEPENDENCY_GAP_AUDIT_PLAN_2026_05_18.md`,
`docs/research/STANDARD_GLTF_TEXTURE_DEPENDENCY_GAP_AUDIT_AFTER_METALLIC_ROUGHNESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser scenario with unavailable occlusion/emissive texture
  or sampler dependencies.
- Assert JSON-safe readiness/dependency diagnostics identify both affected slots
  and statuses.
- Assert no draw submission, no pipeline keys, and no prepared GPU resources.
- Keep IBL, shadows, binary GLB loading, broad PBR work, and app-level
  non-built-in rendering deferred.

### task-1540 — Audit selected follow-up plan after dependency gap planning

Status: completed 2026-05-18. See
`docs/research/OCCLUSION_EMISSIVE_DEPENDENCY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1539`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1543 — Audit occlusion/emissive dependency diagnostics browser coverage

Status: completed 2026-05-18. See
`docs/research/OCCLUSION_EMISSIVE_DEPENDENCY_DIAGNOSTICS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1542` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF dependency
diagnostics audits.

Acceptance criteria:

- Confirm the occlusion/emissive dependency scenario proves the intended
  JSON-safe readiness/diagnostic behavior.
- Confirm the implementation preserves ECS authority, render extraction
  boundaries, and WebGPU-only GPU resource ownership.
- Recommend whether to proceed to tracker alignment or add a focused fix.

### task-1544 — Audit tracker/backlog alignment after occlusion/emissive dependency diagnostics

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_DIAGNOSTICS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1542`/`task-1543` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the dependency diagnostics materially change
  render pipeline status or the recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1541 — Audit tracker/backlog alignment after dependency follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1539`/`task-1540` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1545 — Plan next route or StandardMaterial follow-up after occlusion/emissive dependency tracker alignment

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1542`/`task-1544` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1550 — Add unknown material route family diagnostics regression

Status: completed 2026-05-18. See
`test/webgpu/queued-built-in-app-resource-set.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-built-in-app-resource-set.test.ts` or the nearest existing
route diagnostics test, with implementation files only if the regression exposes
a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_EMISSIVE_DEPENDENCY_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a test-only queued material route item or snapshot fixture with a valid
  but unsupported material family key.
- Assert the route report is invalid, includes
  `webGpuApp.unsupportedMaterialQueueFamily`, groups the skipped family/phase,
  appends no routed resources, and exposes no raw source assets, app objects, or
  GPU handles in JSON.
- Do not add public custom material source authoring or real non-built-in app
  rendering.

### task-1546 — Audit selected follow-up plan after occlusion/emissive follow-up planning

Status: completed 2026-05-18. See
`docs/research/UNKNOWN_MATERIAL_ROUTE_FAMILY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1545`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1547 — Audit delayed-dependency browser assertion helper extraction

Status: completed 2026-05-18. See
`docs/research/DELAYED_DEPENDENCY_BROWSER_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `test/e2e/standard-gltf-texture.spec.ts`
only if a tiny local cleanup is clearly worthwhile.
Reference anchor:
`test/e2e/standard-gltf-texture.spec.ts`,
`examples/standard-gltf-texture.js`, `docs/ARCHITECTURE.md`, and recent
StandardMaterial/glTF dependency diagnostics audits.

Acceptance criteria:

- Identify whether the delayed-dependency browser assertions now have enough
  duplication to justify a focused helper extraction.
- If yes, recommend one helper shape and scope; if no, explain why the
  slot-specific assertions should stay local for now.
- Preserve JSON-safe status checks and avoid weakening slot-specific coverage.

### task-1548 — Plan next route or StandardMaterial follow-up after helper audit

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_DELAYED_DEPENDENCY_HELPER_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1547` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1549 — Audit selected follow-up plan after helper-audit planning

Status: completed 2026-05-18. See
`docs/research/UNKNOWN_ROUTE_FAMILY_DIAGNOSTICS_REGRESSION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1548`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1551 — Audit unknown route family diagnostics regression

Status: completed 2026-05-18. See
`docs/research/UNKNOWN_ROUTE_FAMILY_DIAGNOSTICS_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1550` implementation, `docs/DECISIONS.md` decision 0010,
`docs/ARCHITECTURE.md`, `test/webgpu/queued-built-in-app-resource-set.test.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and
`packages/webgpu/src/webgpu/material-queue-route-report.ts`.

Acceptance criteria:

- Confirm the unknown-family regression preserves decision 0010 and does not
  imply public custom material source authoring.
- Confirm diagnostics are JSON-safe, grouped, and omit routed resources and raw
  handles.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1552 — Audit tracker/backlog alignment after unknown-family route regression

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_UNKNOWN_ROUTE_FAMILY_REGRESSION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1550`/`task-1551` results, `docs/ARCHITECTURE.md`, and
`docs/DECISIONS.md`.

Acceptance criteria:

- Update public tracker pages if the route regression materially changes route
  architecture status or the recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1556 — Audit route diagnostics report field naming consistency

Status: completed 2026-05-18. See
`docs/research/ROUTE_DIAGNOSTICS_REPORT_FIELD_NAMING_CONSISTENCY_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and recent
route diagnostics tests.

Acceptance criteria:

- Inventory whether route diagnostics consistently expose nested reports under
  `report` versus `routeReport`.
- Confirm current JSON shape is documented by tests and does not leak raw
  resources.
- Recommend whether to keep the current field or add a compatibility helper.

### task-1557 — Plan next route or StandardMaterial follow-up after route diagnostics naming audit

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_DIAGNOSTICS_NAMING_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1556` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1558 — Audit selected follow-up plan after route diagnostics naming planning

Status: completed 2026-05-18. See
`docs/research/VALID_NON_DEFAULT_GLTF_SAMPLER_MAPPING_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1557`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1559 — Audit tracker/backlog alignment after route diagnostics follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ROUTE_DIAGNOSTICS_NAMING_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1557`/`task-1558` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1553 — Plan next route or StandardMaterial follow-up after route regression alignment

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_UNKNOWN_ROUTE_REGRESSION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1552` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1554 — Audit selected follow-up plan after route regression planning

Status: completed 2026-05-18. See
`docs/research/ROUTE_DIAGNOSTICS_REPORT_FIELD_NAMING_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1553`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1555 — Audit tracker/backlog alignment after route follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ROUTE_FIELD_NAMING_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1553`/`task-1554` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1560 — Audit tracker freshness after route diagnostics naming track

Status: completed 2026-05-18. See
`docs/research/TRACKER_FRESHNESS_AFTER_ROUTE_DIAGNOSTICS_NAMING_TRACK_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the route diagnostics naming track results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the route diagnostics naming work changes
  project status or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1561 — Add valid non-default glTF sampler mapping browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_DIAGNOSTICS_NAMING_AUDIT_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-material.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with a valid non-default sampler enum
  combination such as repeat wrapping and linear filtering.
- Assert JSON-safe asset-mapping status includes the original glTF sampler enum
  values and the mapped sampler settings.
- Assert the rendered path creates exactly one sampler resource and one texture
  resource, submits a draw, and exposes no raw GPU handles.
- Keep visual wrap-repeat proof, IBL, shadows, binary GLB loading, broad PBR
  work, and app-level non-built-in rendering deferred unless this fixture
  exposes a focused defect.

### task-1562 — Audit valid non-default sampler mapping browser coverage

Status: completed 2026-05-18. See
`docs/research/VALID_NON_DEFAULT_GLTF_SAMPLER_MAPPING_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1561` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF sampler
audits.

Acceptance criteria:

- Confirm the valid sampler mapping scenario proves the intended JSON-safe
  source enum, mapped sampler, resource, and draw behavior.
- Confirm the implementation preserves ECS authority, render extraction
  boundaries, and WebGPU-only GPU resource ownership.
- Recommend whether to proceed to tracker alignment or add a focused fix.

### task-1563 — Audit tracker/backlog alignment after valid sampler mapping coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_VALID_GLTF_SAMPLER_MAPPING_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1561`/`task-1562` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the valid sampler mapping coverage materially
  changes render pipeline status or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1564 — Plan next route or StandardMaterial follow-up after valid sampler mapping coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_VALID_GLTF_SAMPLER_MAPPING_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1561`/`task-1562` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and recent route/glTF
fidelity audits.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1565 — Audit selected follow-up plan after valid sampler mapping planning

Status: completed 2026-05-18. See
`docs/research/GLTF_SAMPLER_WRAP_VISUAL_PROOF_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1564`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1566 — Audit tracker/backlog alignment after valid sampler follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLTF_SAMPLER_WRAP_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1564`/`task-1565` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1567 — Add glTF sampler wrap visual browser proof

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts` and
`examples/standard-gltf-texture.js`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_VALID_GLTF_SAMPLER_MAPPING_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`test/e2e/standard-texture-control.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario that uses a valid repeat or mirror-repeat
  sampler with UVs outside the 0..1 range.
- Assert JSON-safe sampler mapping status still preserves source enums and
  mapped sampler settings.
- Assert screenshot or readback samples distinguish wrapped sampling from clamp
  behavior.
- Keep the proof to one sampler/wrap behavior and defer sampler matrices, IBL,
  shadows, binary GLB loading, and real non-built-in app rendering.

### task-1568 — Audit glTF sampler wrap visual browser proof

Status: completed 2026-05-18. See
`docs/research/GLTF_SAMPLER_WRAP_VISUAL_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1567` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF sampler
audits.

Acceptance criteria:

- Confirm the visual proof distinguishes wrapped sampling from clamp behavior
  without broadening into a sampler matrix.
- Confirm the implementation preserves ECS authority, render extraction
  boundaries, and WebGPU-only GPU resource ownership.
- Recommend whether to proceed to tracker alignment or add a focused fix.

### task-1569 — Audit tracker/backlog alignment after glTF sampler wrap visual proof

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLTF_SAMPLER_WRAP_VISUAL_PROOF_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1567`/`task-1568` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the visual sampler proof materially changes
  render pipeline status or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1570 — Plan next route or StandardMaterial follow-up after sampler wrap proof

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SAMPLER_WRAP_VISUAL_PROOF_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1567`/`task-1568` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one generic material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1571 — Audit selected post-sampler-wrap follow-up plan

Status: completed 2026-05-18. See
`docs/research/OPAQUE_DOUBLE_SIDED_GLTF_BROWSER_COVERAGE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1570` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1572 — Implement selected post-sampler-wrap follow-up

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts` and
`examples/standard-gltf-texture.js`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SAMPLER_WRAP_VISUAL_PROOF_PLAN_2026_05_18.md`,
`docs/research/OPAQUE_DOUBLE_SIDED_GLTF_BROWSER_COVERAGE_PLAN_AUDIT_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/Material.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario for `alphaMode` default/opaque plus
  `doubleSided: true`.
- Assert JSON-safe render-state status maps to `alphaMode: "opaque"` and
  `cullMode: "none"`.
- Assert a backface screenshot/readback sample renders non-clear content.
- Defer alpha/cull matrices, binary GLB loading, IBL, shadows, and real
  non-built-in app rendering.

### task-1573 — Audit selected post-sampler-wrap implementation

Status: completed 2026-05-18. See
`docs/research/OPAQUE_DOUBLE_SIDED_GLTF_BROWSER_COVERAGE_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1572` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1574 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_OPAQUE_DOUBLE_SIDED_GLTF_COVERAGE_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1572`/`task-1573` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1575 — Plan next route or StandardMaterial follow-up after opaque double-sided coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OPAQUE_DOUBLE_SIDED_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1572`/`task-1573` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one generic material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1576 — Audit selected post-opaque-double-sided follow-up plan

Status: completed 2026-05-18. See
`docs/research/OMITTED_GLTF_SAMPLER_DEFAULT_MAPPING_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1575` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1577 — Implement selected post-opaque-double-sided follow-up

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts` and
`examples/standard-gltf-texture.js`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OPAQUE_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`docs/research/OMITTED_GLTF_SAMPLER_DEFAULT_MAPPING_PLAN_AUDIT_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-sampler.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/textures/Texture.js`, and
`references/engine/src/platform/graphics/texture.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario whose texture omits the `sampler` field.
- Preserve `source: null` or equivalent JSON-safe status for the omitted sampler
  source rather than pretending an authored sampler exists.
- Assert mapped sampler defaults are repeat addressing and linear filtering.
- Assert one texture resource, one sampler resource, one draw, no diagnostics,
  and no raw backend resources in JSON status.

### task-1578 — Audit selected post-opaque-double-sided implementation

Status: completed 2026-05-18. See
`docs/research/OMITTED_GLTF_SAMPLER_DEFAULT_MAPPING_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1577` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1579 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_OMITTED_GLTF_SAMPLER_DEFAULT_MAPPING_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1577`/`task-1578` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1580 — Plan next route or StandardMaterial follow-up after omitted sampler coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OMITTED_SAMPLER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1577`/`task-1578` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one generic material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1581 — Audit selected post-omitted-sampler follow-up plan

Status: completed 2026-05-18. See
`docs/research/MATERIAL_QUEUE_ROUTE_REPORT_DIAGNOSTIC_COLLECTOR_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1580` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1582 — Implement selected post-omitted-sampler follow-up

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`, and
`test/webgpu/app-diagnostics-summary.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`, and
`test/webgpu/app-diagnostics-summary.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OMITTED_SAMPLER_PLAN_2026_05_18.md`,
`docs/research/MATERIAL_QUEUE_ROUTE_REPORT_DIAGNOSTIC_COLLECTOR_PLAN_AUDIT_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`, and recent route
diagnostics audits.

Acceptance criteria:

- Add a reusable helper that extracts a
  `webGpuApp.materialQueueRouteReport` diagnostic using the public `report`
  field.
- Ignore unknown diagnostics and malformed/non-object `report` values.
- Route app failure diagnostics summary creation through the helper.
- Add targeted tests proving valid extraction, null for missing/malformed
  diagnostics, and JSON-safe behavior.

### task-1583 — Audit selected post-omitted-sampler implementation

Status: completed 2026-05-18. See
`docs/research/MATERIAL_QUEUE_ROUTE_REPORT_DIAGNOSTIC_COLLECTOR_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1582` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1584 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ROUTE_REPORT_COLLECTOR_EXTRACTION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1582`/`task-1583` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1585 — Plan next route or StandardMaterial follow-up after route-report collector extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_REPORT_COLLECTOR_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1582`/`task-1583` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one generic material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1586 — Audit selected post-route-helper follow-up plan

Status: completed 2026-05-18. See
`docs/research/MATERIAL_DEPENDENCY_READINESS_COLLECTOR_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1585` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1587 — Extract app material dependency readiness collector

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`, and
`test/webgpu/app-diagnostics-summary.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_REPORT_COLLECTOR_PLAN_2026_05_18.md`,
the `task-1586` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`, and recent route
diagnostics collector audits.

Acceptance criteria:

- Add a reusable helper that extracts
  `webGpuApp.materialDependenciesNotReady` diagnostics through the public
  `materialDependencyReadiness` field.
- Ignore unknown diagnostics and malformed/non-object readiness payloads.
- Route `webGpuAppRenderReportToJsonValue()` through the helper without
  changing JSON output shape.
- Add targeted tests proving valid extraction, empty output for missing or
  malformed diagnostics, and JSON-safe behavior.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1588 — Audit selected post-route-helper implementation

Status: completed 2026-05-18. See
`docs/research/MATERIAL_DEPENDENCY_READINESS_COLLECTOR_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1587` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1589 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MATERIAL_DEPENDENCY_COLLECTOR_EXTRACTION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1587`/`task-1588` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1590 — Plan next route or StandardMaterial follow-up after material dependency collector extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_MATERIAL_DEPENDENCY_COLLECTOR_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1587`/`task-1588` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one real material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1591 — Audit selected post-dependency-helper follow-up plan

Status: completed 2026-05-18. See
`docs/research/EMISSIVE_FACTOR_GLTF_BROWSER_COVERAGE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1590` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1592 — Add emissive-factor-only glTF browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_MATERIAL_DEPENDENCY_COLLECTOR_PLAN_2026_05_18.md`,
the `task-1591` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`,
`references/engine/src/scene/materials/standard-material.js`, and
`references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/emissive.js`.

Acceptance criteria:

- Add a glTF-shaped StandardMaterial browser scenario with `emissiveFactor` and
  no `emissiveTexture`.
- Assert the scenario registers no texture or sampler assets, creates no
  texture or sampler GPU resources, and uses the scalar StandardMaterial opaque
  pipeline.
- Assert JSON-safe status exposes the expected emissive factor without raw GPU
  handles or source texture payloads.
- Assert screenshot or readback samples distinguish rendered emissive output
  from clear color.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1593 — Audit selected post-dependency-helper implementation

Status: completed 2026-05-18. See
`docs/research/EMISSIVE_FACTOR_GLTF_BROWSER_COVERAGE_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1592` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1594 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_EMISSIVE_FACTOR_GLTF_COVERAGE_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1592`/`task-1593` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1595 — Plan next route or StandardMaterial follow-up after emissive-factor coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_EMISSIVE_FACTOR_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1592`/`task-1593` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Give route/prepared-resource cleanup serious weight before selecting another
  browser fixture.

### task-1596 — Audit selected post-emissive-factor follow-up plan

Status: completed 2026-05-18. See
`docs/research/SCALAR_STANDARD_ROUTE_SUMMARY_FIELD_SHAPE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1595` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1597 — Pin scalar StandardMaterial app route summary field shape

Status: completed 2026-05-18. See
`test/webgpu/webgpu-app.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_EMISSIVE_FACTOR_PLAN_2026_05_18.md`,
the `task-1596` audit, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`,
and the existing scalar StandardMaterial app route test.

Acceptance criteria:

- Extend the scalar StandardMaterial app route report test to assert successful
  app diagnostics use `routedResourceSet`.
- Assert the serialized app report does not expose `standardResourceSet`,
  `unlitResourceSet`, or `matcapResourceSet` fields.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1598 — Audit selected post-emissive-factor implementation

Status: completed 2026-05-18. See
`docs/research/SCALAR_STANDARD_ROUTE_SUMMARY_FIELD_SHAPE_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1597` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1599 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_SCALAR_STANDARD_ROUTE_SUMMARY_FIELD_SHAPE_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1597`/`task-1598` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1600 — Plan next route or StandardMaterial follow-up after scalar route summary field-shape coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SCALAR_ROUTE_SHAPE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1597`/`task-1598` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer a route/prepared-resource cleanup if it can stay narrow.

### task-1601 — Audit selected post-route-shape follow-up plan

Status: completed 2026-05-18. See
`docs/research/ROUTE_FAILURE_SUMMARY_FIELD_SHAPE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1600` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1602 — Pin route-failure summary field shape

Status: completed 2026-05-18. See
`test/webgpu/webgpu-app.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SCALAR_ROUTE_SHAPE_PLAN_2026_05_18.md`,
the `task-1601` audit, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, the `task-1597` implementation, and the
unsupported material queue family app route test.

Acceptance criteria:

- Extend the unsupported material queue family app route test to assert route
  failure diagnostics use `materialQueueRoute`.
- Assert the route failure diagnostics summary does not expose
  `standardResourceSet`, `unlitResourceSet`, or `matcapResourceSet`.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1603 — Audit selected post-route-shape implementation

Status: completed 2026-05-18. See
`docs/research/ROUTE_FAILURE_SUMMARY_FIELD_SHAPE_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1602` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1604 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ROUTE_FAILURE_SUMMARY_FIELD_SHAPE_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1602`/`task-1603` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1605 — Plan next route or StandardMaterial follow-up after route failure summary field-shape coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_FAILURE_SHAPE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1602`/`task-1603` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer a substantive route/prepared-resource or StandardMaterial fidelity
  slice over additional field-shape assertions.

### task-1606 — Audit selected post-route-failure-shape follow-up plan

Status: completed 2026-05-18. See
`docs/research/EMISSIVE_FACTOR_GLTF_MAPPING_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1605` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1607 — Add emissive-factor-only glTF material mapping regression

Status: completed 2026-05-18. See
`test/materials/gltf-material.test.ts`.

Category: `render-bridge`
Package/write-scope: `test/materials/gltf-material.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_FAILURE_SHAPE_PLAN_2026_05_18.md`,
the `task-1606` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `packages/render/src/materials/gltf-material.ts`, and
the existing glTF material mapping tests.

Acceptance criteria:

- Add a mapper-level regression where `emissiveFactor` is authored without
  `emissiveTexture`.
- Assert the mapped StandardMaterial keeps the factor, has no active emissive
  texture binding, remains valid, and emits no diagnostics.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1608 — Audit selected post-route-failure-shape implementation

Status: completed 2026-05-18. See
`docs/research/EMISSIVE_FACTOR_GLTF_MAPPING_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1607` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1609 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_EMISSIVE_FACTOR_GLTF_MAPPING_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1607`/`task-1608` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1610 — Plan next route or StandardMaterial follow-up after emissive-factor mapping coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_EMISSIVE_MAPPING_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1607`/`task-1608` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected follow-up to one focused run.

### task-1611 — Audit selected post-emissive-mapping follow-up plan

Status: completed 2026-05-18. See
`docs/research/INVALID_EMISSIVE_FACTOR_GLTF_MAPPING_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1610` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/glTF fidelity audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1612 — Add invalid emissive-factor glTF mapping regression

Status: completed 2026-05-18. See
`test/materials/gltf-material.test.ts`.

Category: `render-bridge`
Package/write-scope: `test/materials/gltf-material.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_EMISSIVE_MAPPING_PLAN_2026_05_18.md`,
the `task-1611` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `packages/render/src/materials/gltf-material.ts`, and
the existing glTF material mapping tests.

Acceptance criteria:

- Add a mapper-level regression where `emissiveFactor` is malformed.
- Assert the mapped StandardMaterial falls back to `[0, 0, 0]`, remains a
  StandardMaterial, marks the report invalid, and emits a JSON-safe
  `gltfMaterial.invalidField` diagnostic for `emissiveFactor`.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1613 — Audit selected post-emissive-mapping implementation

Status: completed 2026-05-18. See
`docs/research/INVALID_EMISSIVE_FACTOR_GLTF_MAPPING_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1612` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1614 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_EMISSIVE_FACTOR_GLTF_MAPPING_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1612`/`task-1613` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1615 — Plan next route or StandardMaterial follow-up after invalid emissive-factor mapping coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_INVALID_EMISSIVE_FACTOR_MAPPING_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1612`/`task-1613` results, and recent
route/StandardMaterial glTF fidelity audits.

Acceptance criteria:

- Compare one material-route/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer moving away from emissive-factor coverage unless a directly adjacent
  defect is identified.

### task-1616 — Audit selected post-invalid-emissive follow-up plan

Status: completed 2026-05-18. See
`docs/research/MIXED_FAMILY_ROUTED_RESOURCE_SUMMARY_FIELD_SHAPE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1615` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent scalar/route-failure summary
field-shape audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1617 — Add mixed-family routed-resource summary field-shape regression

Status: completed 2026-05-18. See `test/webgpu/webgpu-app.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_INVALID_EMISSIVE_FACTOR_MAPPING_PLAN_2026_05_18.md`,
the `task-1616` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
the existing mixed built-in material app route tests, and recent scalar/route
failure field-shape regressions.

Acceptance criteria:

- Add a focused assertion to the mixed `unlit`/`matcap`/`standard` app route
  path proving `diagnosticsSummary.routedResourceSet` is present.
- Assert the JSON diagnostics summary does not contain legacy
  `standardResourceSet`, `unlitResourceSet`, or `matcapResourceSet` fields.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.
- Do not change browser examples, glTF mapping, adapter policy, binary GLB
  loading, IBL, shadows, or non-built-in material rendering.

### task-1618 — Audit selected post-invalid-emissive implementation

Status: completed 2026-05-18. See
`docs/research/MIXED_FAMILY_ROUTED_RESOURCE_SUMMARY_FIELD_SHAPE_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1617` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated route, sampler, GLB, IBL, shadow,
  or non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1619 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MIXED_FAMILY_ROUTE_SUMMARY_SHAPE_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1617`/`task-1618` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1620 — Plan next route or StandardMaterial follow-up after mixed-family routed-resource summary coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_MIXED_FAMILY_ROUTE_SUMMARY_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1617`/`task-1618` results, and recent route
collector/prepared-resource audits.

Acceptance criteria:

- Compare one production route/prepared-resource cleanup candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer production route/prepared-resource cleanup over another field-shape
  assertion unless a blocker is identified.

### task-1621 — Audit selected post-mixed-route follow-up plan

Status: completed 2026-05-18. See
`docs/research/QUEUED_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1620` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1622 — Extract queued prepare-route app diagnostic normalization

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
WebGPU tests.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_MIXED_FAMILY_ROUTE_SUMMARY_PLAN_2026_05_18.md`,
the `task-1621` audit, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and recent
route collector cleanup audits.

Acceptance criteria:

- Move missing-adapter and material-mismatch app diagnostic normalization into a
  focused helper module.
- Keep the existing public diagnostic codes and messages unchanged.
- Add targeted tests for both normalized diagnostic paths and passthrough of
  unknown diagnostics.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.
- Do not change route traversal, adapter registration policy, frame-resource
  preparation, browser examples, glTF mapping, binary GLB loading, IBL, shadows,
  or non-built-in material rendering.

### task-1623 — Audit selected post-mixed-route implementation

Status: completed 2026-05-18. See
`docs/research/QUEUED_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1622` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated sampler, GLB, IBL, shadow, or
  non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1624 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1622`/`task-1623` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1625 — Plan next route or StandardMaterial follow-up after queued prepare-route diagnostic normalization

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1622`/`task-1623` results, and recent route
collector/prepared-resource audits.

Acceptance criteria:

- Compare one production route/prepared-resource cleanup candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer continuing route/prepared-resource cleanup unless the selected
  candidate would require broad non-built-in app rendering.

### task-1626 — Audit selected post-normalization follow-up plan

Status: completed 2026-05-18. See
`docs/research/FRAME_RESOURCE_ROUTE_DIAGNOSTIC_HELPER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1625` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1627 — Implement selected post-normalization follow-up

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`
and `test/webgpu/queued-material-frame-resource-route-diagnostics.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and targeted
WebGPU tests.
Reference anchor:
the `task-1625`/`task-1626` plan and audit,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`,
`references/three.js/src/renderers/common/Pipeline.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Move app-facing `webGpuApp.frameResourceRoute` diagnostic construction into a
  focused frame-resource route diagnostics helper.
- Keep the existing diagnostic code, message, and route payload shape
  unchanged.
- Add targeted tests proving diagnostic shape, JSON safety, and preservation of
  facade queue keys versus backend resource keys.
- Preserve successful-frame report shape: do not emit successful frame-resource
  route shells in default app diagnostics.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1628 — Audit selected post-normalization implementation

Status: completed 2026-05-18. See
`docs/research/FRAME_RESOURCE_ROUTE_DIAGNOSTIC_HELPER_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1627` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated sampler, GLB, IBL, shadow, or
  non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1629 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_FRAME_RESOURCE_ROUTE_DIAGNOSTIC_HELPER_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1627`/`task-1628` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1630 — Plan next route or StandardMaterial follow-up after frame-resource route diagnostic helper extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_FRAME_RESOURCE_DIAGNOSTIC_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1627`/`task-1628` results, and recent
route/prepared-resource audits.

Acceptance criteria:

- Compare one production route/prepared-resource cleanup candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer continuing route/prepared-resource cleanup unless the selected
  candidate would require broad non-built-in app rendering.

### task-1631 — Audit selected post-helper follow-up plan

Status: completed 2026-05-18. See
`docs/research/BASE_COLOR_FACTOR_TEXTURE_TINT_BROWSER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1630` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1632 — Implement selected post-helper follow-up

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted status/helper updates in
those files only unless a focused defect is exposed.
Reference anchor:
the `task-1630`/`task-1631` plan and audit,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-material-buffer.ts`,
`packages/render/src/materials/gltf-material.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario where `baseColorTexture` is multiplied by
  a non-white `baseColorFactor`.
- Publish JSON-safe status for the source factor, mapped factor, texture/sampler
  readiness, resource counts, and selected readback sample.
- Assert screenshot/readback output is closer to the tinted expected color than
  to an untinted texture sample and clear color.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.

### task-1633 — Audit selected post-helper implementation

Status: completed 2026-05-18. See
`docs/research/BASE_COLOR_FACTOR_TEXTURE_TINT_BROWSER_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1632` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated sampler, GLB, IBL, shadow, or
  non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1634 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_BASE_COLOR_FACTOR_TEXTURE_TINT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1632`/`task-1633` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1635 — Plan next route or StandardMaterial follow-up after base-color factor texture tint coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BASE_COLOR_FACTOR_TINT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the `task-1632`/`task-1633` results, and recent
route/prepared-resource and StandardMaterial/glTF audits.

Acceptance criteria:

- Compare one production route/prepared-resource cleanup candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer route/prepared-resource cleanup only when the candidate is concrete
  and does not require broad non-built-in app rendering.

### task-1636 — Audit selected post-tint follow-up plan

Status: completed 2026-05-18. See
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1635` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource or
StandardMaterial/glTF audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1637 — Implement selected post-tint follow-up

Status: completed 2026-05-18. See
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md` and backlog only.
Reference anchor:
the `task-1635`/`task-1636` plan and audit,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
and `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Acceptance criteria:

- Map each current route diagnostic layer to its source module, diagnostic
  codes, and JSON/public surface.
- Call out which helpers are generic route infrastructure and which remain
  built-in/app compatibility policy.
- Identify two concrete next route/prepared-resource cleanup candidates and
  one reason each should or should not be selected next.
- Do not change runtime code, public APIs, app examples, or browser fixtures.

### task-1638 — Audit selected post-tint implementation

Status: completed 2026-05-18. See
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1637` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated sampler, GLB, IBL, shadow, or
  non-built-in app rendering work.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1639 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1637`/`task-1638` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1640 — Plan next route or StandardMaterial follow-up after material route diagnostics map

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_DIAGNOSTICS_MAP_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`,
and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare one route/prepared-resource design or cleanup candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Prefer decomposing real non-built-in app material adapter support only if the
  selected task remains a small design/audit slice rather than broad rendering.

### task-1641 — Audit selected post-map follow-up plan

Status: completed 2026-05-18. See
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1640` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource or
StandardMaterial/glTF audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1642 — Implement selected post-map follow-up

Status: completed 2026-05-18. See
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
and backlog only.
Reference anchor:
the `task-1640`/`task-1641` plan and audit,
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`, and
`packages/render/src/materials/types.ts`.

Acceptance criteria:

- Break real non-built-in app material adapter support into small ordered
  vertical slices.
- For each slice, identify package/write-scope, required diagnostics, tests,
  and explicit non-goals.
- Preserve closed source material asset kinds until a separate public custom
  material source API decision exists.
- Do not add runtime code, public APIs, shader code, examples, or browser
  fixtures.

### task-1643 — Audit selected post-map implementation

Status: completed 2026-05-18. See
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1642` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into unrelated sampler, GLB, IBL, shadow, or
  non-built-in app rendering work unless explicitly selected as a design-only
  decomposition.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1644 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_NON_BUILT_IN_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1642`/`task-1643` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1645 — Plan next route or StandardMaterial follow-up after adapter decomposition

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ADAPTER_DECOMPOSITION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare the recommended generic app adapter contract audit against one
  StandardMaterial/glTF fidelity candidate and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected route candidate design/audit-only unless a very small
  targeted type/test change is clearly justified.

### task-1646 — Audit selected post-decomposition follow-up plan

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1645` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource or
StandardMaterial/glTF audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1647 — Implement selected post-decomposition follow-up

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`;
targeted type/test files only if the audit finds a tiny corrective mismatch.
Reference anchor:
the `task-1645`/`task-1646` plan and audit,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/render/src/materials/types.ts`.

Acceptance criteria:

- Identify which current generic adapter/route contracts are already
  non-built-in-ready.
- Identify which boundaries remain built-in/app policy or closed source asset
  policy.
- Recommend exactly one next route/prepared-resource task or state that a
  decision record is needed first.
- Do not add runtime custom material rendering, public source material APIs,
  shader code, examples, or browser fixtures.

### task-1648 — Audit selected post-decomposition implementation

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1647` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into runtime custom material rendering unless a
  later accepted decision explicitly enables that direction.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1649 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_APP_ADAPTER_CONTRACT_READINESS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1647`/`task-1648` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1650 — Prove generic app adapter contract with test-only family

Status: completed 2026-05-18. See
`test/webgpu/queued-material-generic-app-adapter-contract.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu`, with targeted generic type/helper files only if a tiny mismatch
is found.
Reference anchor:
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`.

Acceptance criteria:

- Define a test-only material-like object and family key outside public
  `MaterialAsset` exports.
- Register a test-only `QueuedMaterialPrepareRouteAdapter` and prove successful
  route preparation through `routeQueuedMaterialPrepare()`.
- Create a `QueuedMaterialAppResourceItem` for the test-only family and pass it
  through `prepareQueuedMaterialFrameResourceSet()` with fake pipeline,
  dependency, frame-resource, and bind-group callbacks.
- Assert resource-key mappings, diagnostics, and JSON-safe failure behavior.
- Do not add public custom material source APIs, shader code, GPU resources,
  WebGPU app options, examples, or browser fixtures.

### task-1651 — Audit generic app adapter contract proof implementation

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1650` implementation,
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Confirm the proof remains test-only and does not expose custom material
  authoring.
- Confirm the proof validates generic adapter, route, app item, and
  frame-resource contracts without relying on built-in material arrays.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1652 — Audit tracker/backlog alignment after generic contract proof

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_APP_ADAPTER_CONTRACT_PROOF_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1650`/`task-1651` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the proof changes project status or
  recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1653 — Plan next route or StandardMaterial follow-up after generic contract proof

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_ADAPTER_CONTRACT_PROOF_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`,
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`,
and the `task-1650`/`task-1651` results.

Acceptance criteria:

- Compare one route/prepared-resource candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the selected
  plan explicitly calls for a decision record first.

### task-1654 — Audit selected post-contract-proof follow-up plan

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1653` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource or
StandardMaterial/glTF audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1655 — Implement selected post-contract-proof follow-up

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`;
targeted tests only if a tiny corrective mismatch is found.
Reference anchor:
the `task-1653`/`task-1654` plan and audit,
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and
`packages/webgpu/src/webgpu/app.ts`.

Acceptance criteria:

- Identify which app adapter registration pieces can become generic without
  exposing public custom source material authoring.
- Identify which validation diagnostics remain built-in-specific and which
  should become generic app adapter policy.
- Recommend exactly one implementation slice or state that a decision record is
  required first.
- Do not add public custom material source APIs, shader code, GPU resources,
  examples, or browser fixtures.

### task-1656 — Audit selected post-contract-proof implementation

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1655` implementation, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it does not broaden into public custom material source authoring
  unless a decision record explicitly enables that direction.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1657 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_APP_ADAPTER_REGISTRATION_POLICY_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1655`/`task-1656` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1658 — Add generic app adapter registry validation helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-adapter.ts` and
`test/webgpu/queued-material-adapter-json.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-adapter.ts` or a focused sibling
module, plus targeted `test/webgpu` coverage.
Reference anchor:
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`, and
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.

Acceptance criteria:

- Add a generic validation helper that accepts a
  `QueuedMaterialAdapterRegistry` plus optional expected family keys.
- Preserve existing duplicate-family diagnostics.
- Report missing expected family diagnostics without naming built-in policy.
- Add tests for duplicate custom family, missing expected custom family,
  expected built-in family compatibility, and JSON-safe serialization.
- Do not change `createWebGpuApp()`, public source material APIs, shaders, GPU
  resources, examples, or browser fixtures.

### task-1659 — Audit generic app adapter registry validation helper

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ADAPTER_REGISTRY_VALIDATION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1658` implementation,
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Confirm the helper remains generic app adapter policy, not built-in required
  family policy.
- Confirm built-in validation behavior and diagnostics remain compatible.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1660 — Audit tracker/backlog alignment after registry validation

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_REGISTRY_VALIDATION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1658`/`task-1659` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the validation helper changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1661 — Plan next route or StandardMaterial follow-up after registry validation

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`,
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`,
and the `task-1658`/`task-1659` results.

Acceptance criteria:

- Compare one route/prepared-resource candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the selected
  plan explicitly calls for a decision record first.

### task-1662 — Audit selected post-registry-validation follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1661` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route/prepared-resource or
StandardMaterial/glTF audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1663 — Add non-built-in prepared-resource route shell regression

Status: completed 2026-05-18. See
`test/webgpu/queued-material-frame-resource-route.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-frame-resource-route.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`references/three.js/src/renderers/common/Pipelines.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a test-only non-built-in family route shell using distinct facade and
  backend mesh/material resource keys.
- Assert shell summary reports family, prepared status, key-presence booleans,
  pipeline key, source version, frame, and sorted diagnostic code counts.
- Assert JSON-safe shell and summary output omit raw GPU handles and do not
  require public source material APIs, shaders, examples, or browser fixtures.

### task-1664 — Audit non-built-in route shell regression

Status: completed 2026-05-18. See
`docs/research/NON_BUILT_IN_ROUTE_SHELL_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`.
Reference anchor:
the `task-1663` implementation and
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Acceptance criteria:

- Confirm the regression remains test-only and does not expose public custom
  material source APIs.
- Confirm route shell summaries remain JSON-safe.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1665 — Audit tracker/backlog alignment after non-built-in route shell

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_NON_BUILT_IN_ROUTE_SHELL_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1663`/`task-1664` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the route-shell regression.
- Confirm ready backlog remains concrete and categorized.
- Run `pnpm run check:progress`.

### task-1666 — Plan next route or StandardMaterial follow-up after route shell coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/research/NON_BUILT_IN_ROUTE_SHELL_REGRESSION_AUDIT_2026_05_18.md`, and
recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare one route/prepared-resource candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.

### task-1667 — Audit selected post-route-shell follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`.
Reference anchor:
the `task-1666` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and StandardMaterial shader references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.

### task-1668 — Add metallic-roughness factor texture shader contract regression

Status: completed 2026-05-18. See
`test/webgpu/standard-shader.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/standard-shader.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Assert metallic-roughness texture WGSL multiplies texture blue by
  `material.metallicFactor`.
- Assert metallic-roughness texture WGSL multiplies texture green by
  `material.roughnessFactor`.
- Keep the slice as shader contract coverage only.

### task-1669 — Audit metallic-roughness factor shader contract regression

Status: completed 2026-05-18. See
`docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`.
Reference anchor:
the `task-1668` implementation and StandardMaterial shader contract docs/tests.

Acceptance criteria:

- Confirm the regression stays test-only and no production shader change was
  needed unless the test exposed a defect.
- Confirm no app routing, public material source API, IBL, shadow, or browser
  fixture behavior changed.

### task-1670 — Audit tracker/backlog alignment after metallic-roughness factor shader

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_METALLIC_ROUGHNESS_FACTOR_SHADER_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1668`/`task-1669` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the shader contract coverage.
- Confirm ready backlog remains concrete and categorized.
- Run `pnpm run check:progress`.

### task-1671 — Plan app adapter registration or glTF browser fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_OR_GLTF_AFTER_SHADER_CONTRACT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`,
and recent StandardMaterial/glTF browser audits.

Acceptance criteria:

- Compare one app adapter registration candidate, one StandardMaterial/glTF
  browser fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the plan calls
  for a decision record first.

### task-1672 — Audit selected post-shader-contract follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_OR_GLTF_AFTER_SHADER_CONTRACT_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1671` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route or StandardMaterial
audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1673 — Add metallic-roughness factor browser proof

Status: completed 2026-05-18. See `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and targeted status helpers only if selected by `task-1671`.
Reference anchor:
`docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario where `metallicFactor` and
  `roughnessFactor` are non-default while `metallicRoughnessTexture` is mapped.
- Surface JSON-safe expected factor and texture-channel status.
- Add Playwright coverage proving the scenario renders and reports the expected
  pipeline/readiness state.
- Do not add app-level non-built-in rendering, IBL, shadows, binary GLB loading,
  or public custom material source APIs.

### task-1674 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/METALLIC_ROUGHNESS_FACTOR_BROWSER_PROOF_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1671`/`task-1672`,
`docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1675 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_METALLIC_ROUGHNESS_FACTOR_BROWSER_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1671` through `task-1674` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1676 — Plan next route/app adapter or StandardMaterial follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_FACTOR_BROWSER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/research/METALLIC_ROUGHNESS_FACTOR_BROWSER_PROOF_AUDIT_2026_05_18.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one route/app adapter candidate, one StandardMaterial/glTF fidelity
  candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the plan calls
  for a decision record first.

### task-1677 — Audit selected post-factor-browser follow-up plan

Status: completed 2026-05-18. See
`docs/research/APP_ADAPTER_REGISTRY_COHABITATION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1676` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route or StandardMaterial
audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1678 — Implement selected route or glTF fidelity slice

Status: completed 2026-05-18. See
`test/webgpu/queued-material-adapter-json.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-adapter-json.test.ts`; implementation files only
if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_FACTOR_BROWSER_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0010,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/bevy/crates/bevy_render/src/render_asset.rs`, and
`references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add a generic adapter registry regression with all built-in app resource
  families plus one test-only app-owned family.
- Assert validation succeeds when the expected family list includes the custom
  test family and all built-ins.
- Assert duplicate app-owned family diagnostics remain warnings with stable
  first/duplicate indexes and no built-in fallback semantics.
- Assert JSON output contains family keys and diagnostics only, with no adapter
  functions, raw GPU handles, public custom material source APIs, app-level
  non-built-in rendering, IBL, shadows, or binary GLB loading.

### task-1679 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1678`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1680 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_REGISTRY_COHABITATION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1676` through `task-1679` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1681 — Plan explicit app-owned adapter facade or StandardMaterial follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_REGISTRY_COHABITATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0010,
`docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one explicit app-owned adapter facade candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the plan calls
  for a decision record first.

### task-1682 — Audit selected post-coexistence follow-up plan

Status: completed 2026-05-18. See
`docs/research/APP_ADAPTER_BUILT_IN_COLLISION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1681` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route or StandardMaterial
audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1683 — Implement selected app adapter or glTF fidelity slice

Status: completed 2026-05-18. See
`test/webgpu/queued-material-adapter-json.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-adapter-json.test.ts`; implementation files only
if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_REGISTRY_COHABITATION_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0010,
`docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/bevy/crates/bevy_render/src/render_asset.rs`, and
`references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add a generic adapter registry regression where an app-owned adapter reuses a
  built-in family key such as `standard` after the built-in registrations.
- Assert the duplicate-family diagnostic is a warning with stable first and
  duplicate indexes.
- Assert `get("standard")` returns the first built-in-style registration rather
  than the colliding app-owned registration.
- Assert validation remains JSON-safe and does not imply override, fallback,
  public custom material source authoring, app-level non-built-in rendering,
  IBL, shadows, or binary GLB loading.

### task-1684 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1683`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1685 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_BUILT_IN_COLLISION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1681` through `task-1684` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1686 — Plan next app adapter facade, route docs, or glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_OR_DIAGNOSTICS_AFTER_COLLISION_POLICY_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0010,
`docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one explicit app-owned adapter facade candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source authoring unless the plan calls
  for a decision record first.

### task-1687 — Audit selected post-collision follow-up plan

Status: completed 2026-05-18. See
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_DOCS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1686` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, or
StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1688 — Implement selected app adapter, docs, or glTF fidelity slice

Status: completed 2026-05-18. See `docs/DIAGNOSTICS_SUMMARIES.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/DIAGNOSTICS_SUMMARIES.md`; tracker/backlog docs only if alignment changes.
Reference anchor:
`docs/research/NEXT_APP_ADAPTER_OR_DIAGNOSTICS_AFTER_COLLISION_POLICY_PLAN_2026_05_18.md`,
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`,
`docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`,
`docs/DIAGNOSTICS_SUMMARIES.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Acceptance criteria:

- Add a concise public docs section that maps the current material route
  diagnostic layers, their JSON surfaces, and their ownership boundaries.
- Explicitly distinguish generic route infrastructure from built-in/app
  compatibility policy.
- Include JSON-safety guidance that excludes raw WebGPU handles, adapter
  callbacks, app objects, source asset payloads, override semantics, and
  fallback semantics.
- Do not add public custom material source APIs, app-level non-built-in
  rendering, IBL, shadows, binary GLB loading, or implementation changes.

### task-1689 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_DOCS_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1688`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1690 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MATERIAL_ROUTE_DIAGNOSTICS_DOCS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1686` through `task-1689` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1691 — Plan app-owned adapter decision or StandardMaterial/glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_APP_ADAPTER_DECISION_AFTER_ROUTE_DOCS_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0010,
`docs/DIAGNOSTICS_SUMMARIES.md`,
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_DOCS_IMPLEMENTATION_AUDIT_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one app-owned adapter source/API decision candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source implementation unless the plan
  first calls for a decision record.

### task-1692 — Audit selected post-route-docs follow-up plan

Status: completed 2026-05-18. See
`docs/research/APP_OWNED_ADAPTER_DECISION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1691` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, or
StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1693 — Implement selected app adapter decision or glTF fidelity slice

Status: completed 2026-05-18. See `docs/DECISIONS.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/DECISIONS.md`; backlog/handoff docs only for alignment.
Reference anchor:
`docs/research/NEXT_APP_ADAPTER_DECISION_AFTER_ROUTE_DOCS_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0010, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DIAGNOSTICS_SUMMARIES.md`, and
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Acceptance criteria:

- Add a decision record stating that public app-owned material adapter facade
  options remain deferred until a public custom material source asset contract
  is accepted.
- Clarify that generic route/adapter family keys are internal or test surfaces
  unless backed by source validation, dependency, preparation, shader/resource,
  diagnostics, and lifecycle contracts.
- Preserve built-in app route behavior and do not add implementation,
  app-level non-built-in rendering, IBL, shadows, binary GLB loading, or public
  custom material source APIs.

### task-1694 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/APP_OWNED_ADAPTER_DECISION_IMPLEMENTATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1693`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1695 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_OWNED_ADAPTER_DECISION_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1691` through `task-1694` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1696 — Plan source/API design, diagnostics example, or glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_SOURCE_API_OR_GLTF_AFTER_DECISION_0011_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0011,
`docs/DIAGNOSTICS_SUMMARIES.md`,
`docs/research/APP_OWNED_ADAPTER_DECISION_IMPLEMENTATION_AUDIT_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one custom material source/API design candidate, one diagnostics
  example/tooling candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source implementation unless the plan
  first defines a small design/decision slice.

### task-1697 — Audit selected post-decision follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1696` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, or
StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1698 — Implement selected source/API design, diagnostics, or glTF fidelity slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for alignment.
Reference anchor:
`docs/research/NEXT_SOURCE_API_OR_GLTF_AFTER_DECISION_0011_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0011, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DIAGNOSTICS_SUMMARIES.md`, and
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Acceptance criteria:

- Draft a concise design brief listing the minimum source asset shape,
  validation, dependency declaration, preparation/lifetime, shader/resource,
  diagnostics, and worker-boundary questions for public custom material support.
- Identify which parts are decisions versus implementation tasks.
- Keep it non-binding and explicitly avoid implementing public source APIs,
  app-owned adapter facades, app-level non-built-in rendering, IBL, shadows, or
  binary GLB loading.

### task-1699 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1698`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1700 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_API_DESIGN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1696` through `task-1699` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1701 — Plan source decision, diagnostics example, or glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_BRIEF_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0011,
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one public custom material source decision candidate, one diagnostics
  example/tooling candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source implementation unless the plan
  first narrows a decision record or source validation design slice.

### task-1702 — Audit selected post-source-brief follow-up plan

Status: completed 2026-05-18. See
`docs/research/SOURCE_ASSET_SHAPE_CHECKLIST_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1701` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, or
StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1703 — Implement selected source decision, diagnostics, or glTF fidelity slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for alignment.
Reference anchor:
`docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_BRIEF_PLAN_2026_05_18.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0011, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Draft a decision-ready checklist for the minimum public custom material source
  asset shape.
- Separate source asset shape decisions from validation, dependency,
  preparation, shader/resource, and app facade implementation tasks.
- Keep it non-binding and do not add public custom material source APIs,
  app-owned adapter facades, app-level non-built-in rendering, IBL, shadows, or
  binary GLB loading.

### task-1704 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1703`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1705 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1701` through `task-1704` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1706 — Plan source-shape decision or StandardMaterial/glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_CHECKLIST_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0011,
`docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one public custom material source-shape decision candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public custom material source implementation unless the plan
  first narrows a decision record or source validation design slice.

### task-1707 — Audit selected post-checklist follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1706` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, or
StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1708 — Implement selected source-shape decision or glTF fidelity slice

Status: completed 2026-05-18. See `docs/DECISIONS.md` Decision 0012.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1706`; expected to stay within targeted docs,
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1706` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1706`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public custom material source APIs, app-level non-built-in
  rendering, IBL, shadows, or binary GLB loading unless explicitly selected
  with the required decision/design record.

### task-1709 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1708`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1710 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1706` through `task-1709` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1711 — Plan source validation diagnostics or glTF fidelity after Decision 0012

Status: completed 2026-05-18. See
`docs/research/NEXT_SOURCE_VALIDATION_OR_GLTF_AFTER_DECISION_0012_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/DECISIONS.md` Decision 0012, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_IMPLEMENTATION_AUDIT_2026_05_19.md`,
and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one source validation diagnostics candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public app-owned adapter facade implementation, rendered custom
  material families, IBL, shadows, or binary GLB loading.

### task-1712 — Audit selected post-decision follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TAXONOMY_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1711` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, source
validation, or StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1713 — Implement selected source validation diagnostics or glTF fidelity slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1711`; expected to stay within targeted docs,
`packages/render`, `packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1711` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1711`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public app-owned adapter facades, app-level non-built-in rendered
  material families, IBL, shadows, or binary GLB loading.

### task-1714 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TAXONOMY_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1713`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1715 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_VALIDATION_TAXONOMY_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1711` through `task-1714` results, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1716 — Plan source validation fixture or glTF fidelity after taxonomy

Status: completed 2026-05-18. See
`docs/research/NEXT_SOURCE_VALIDATION_FIXTURE_OR_GLTF_AFTER_TAXONOMY_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`,
`docs/DECISIONS.md` Decision 0012, `docs/DIAGNOSTICS_SUMMARIES.md`,
`docs/ARCHITECTURE.md`, and recent route/StandardMaterial audits.

Acceptance criteria:

- Compare one test-only source validation fixture candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public app-owned adapter facade implementation, rendered custom
  material families, IBL, shadows, or binary GLB loading.

### task-1717 — Audit selected post-taxonomy follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1716` plan, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and the latest route, diagnostics, source
validation, or StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1718 — Implement selected source validation fixture or glTF fidelity slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1716`; expected to stay within targeted docs,
`packages/render`, `packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1716` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1716`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public app-owned adapter facades, app-level non-built-in rendered
  material families, IBL, shadows, or binary GLB loading.

### task-1719 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1718`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1720 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1716` through `task-1719` results, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1721 — Plan validator helper or glTF fidelity after fixture matrix

Status: completed 2026-05-18. See
`docs/research/NEXT_VALIDATOR_HELPER_OR_GLTF_AFTER_FIXTURE_MATRIX_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`,
`docs/DECISIONS.md` Decision 0012, `docs/ARCHITECTURE.md`, and recent
route/StandardMaterial audits.

Acceptance criteria:

- Compare one deliberately test-only validator helper candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public app-owned adapter facade implementation, rendered custom
  material families, IBL, shadows, or binary GLB loading.

### task-1722 — Audit selected post-fixture follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TEST_HELPER_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1721` plan, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and the latest route, diagnostics, source
validation, or StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1723 — Implement selected validator helper or glTF fidelity slice

Status: completed 2026-05-18. See
`test/materials/custom-material-source-validation-fixture.test.ts`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1721`; expected to stay within targeted docs,
`packages/render`, `packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1721` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1721`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public app-owned adapter facades, app-level non-built-in rendered
  material families, IBL, shadows, or binary GLB loading.

### task-1724 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_TEST_HELPER_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1723`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1725 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_VALIDATION_TEST_HELPER_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1721` through `task-1724` results, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1726 — Plan package validator or glTF fidelity after test fixture

Status: completed 2026-05-18. See
`docs/research/NEXT_PACKAGE_VALIDATOR_OR_GLTF_AFTER_TEST_FIXTURE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`test/materials/custom-material-source-validation-fixture.test.ts`,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`,
`docs/DECISIONS.md` Decision 0012, `docs/ARCHITECTURE.md`, and recent
route/StandardMaterial audits.

Acceptance criteria:

- Compare one package-level custom material source validator candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Do not select public app-owned adapter facade implementation, rendered custom
  material families, IBL, shadows, or binary GLB loading.

### task-1727 — Audit selected post-test-fixture follow-up plan

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DOCS_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1726` plan, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and the latest route, diagnostics, source
validation, or StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1728 — Implement selected package validator or glTF fidelity slice

Status: completed 2026-05-18. See `docs/DIAGNOSTICS_SUMMARIES.md`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1726`; expected to stay within targeted docs,
`packages/render`, `packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1726` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1726`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public app-owned adapter facades, app-level non-built-in rendered
  material families, IBL, shadows, or binary GLB loading.

### task-1729 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DOCS_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1728`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1730 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_CUSTOM_MATERIAL_SOURCE_VALIDATION_DOCS_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1726` through `task-1729` results, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1731 — Plan StandardMaterial/glTF fidelity or package validation after source docs

Status: completed 2026-05-18. See
`docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_SOURCE_DIAGNOSTICS_DOCS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/DIAGNOSTICS_SUMMARIES.md`, `docs/DECISIONS.md` Decision 0012,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and recent
StandardMaterial/glTF audits.

Acceptance criteria:

- Compare one StandardMaterial/glTF fidelity candidate, one package-level custom
  source validation candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Prefer returning to StandardMaterial/glTF fidelity unless package validation
  is required to unblock the material route architecture.

### task-1732 — Audit selected post-docs follow-up plan

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_EMISSIVE_FACTOR_TEXTURE_ASSERTION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1731` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest route, diagnostics, source
validation, or StandardMaterial audits selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1733 — Implement selected StandardMaterial/glTF fidelity or package validation slice

Status: completed 2026-05-18. See `test/e2e/standard-gltf-texture.spec.ts`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1731`; expected to stay within targeted docs,
`packages/render`, `packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1731` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused slice from `task-1731`.
- Add targeted tests, docs validation, or browser coverage appropriate to the
  selected scope.
- Do not add public app-owned adapter facades, app-level non-built-in rendered
  material families, IBL, shadows, or binary GLB loading.

### task-1734 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_EMISSIVE_FACTOR_TEXTURE_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1733`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1735 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_EMISSIVE_FACTOR_TEXTURE_ASSERTION_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1731` through `task-1734` results, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` Decision 0012, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1736 — Plan next StandardMaterial/glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_EMISSIVE_ASSERTION_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
`packages/webgpu/src/webgpu/standard-shader.ts`, and recent
StandardMaterial/glTF audits.

Acceptance criteria:

- Compare at least two StandardMaterial/glTF fidelity candidates and one
  diagnostics/tooling or route architecture candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run and do not add IBL, shadows, binary
  GLB loading, public custom material APIs, or app-owned adapter facades.

### task-1737 — Audit selected post-emissive follow-up plan

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_COMBINED_EMISSIVE_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1736` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest StandardMaterial/glTF audits
selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1738 — Implement selected StandardMaterial/glTF fidelity slice

Status: completed 2026-05-18. See `test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
To be narrowed by `task-1736`; expected to stay within targeted
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1736` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused StandardMaterial/glTF fidelity slice.
- Add targeted unit or browser coverage appropriate to the selected scope.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs, or
  app-owned adapter facades.

### task-1739 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_COMBINED_EMISSIVE_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1738`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1740 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_COMBINED_EMISSIVE_ASSERTIONS_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1736` through `task-1739` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1741 — Plan next StandardMaterial assertion or fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_STANDARD_GLTF_ASSERTION_AFTER_COMBINED_EMISSIVE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare at least two StandardMaterial/glTF assertion or fidelity candidates
  and one diagnostics/tooling or route architecture candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run and do not add IBL, shadows, binary
  GLB loading, public custom material APIs, or app-owned adapter facades.

### task-1742 — Audit selected post-combined-emissive follow-up plan

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_METALLIC_ROUGHNESS_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1741` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest StandardMaterial/glTF audits
selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1743 — Implement selected StandardMaterial assertion or fidelity slice

Status: completed 2026-05-18. See `test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
To be narrowed by `task-1741`; expected to stay within targeted
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1741` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused StandardMaterial/glTF assertion or
  fidelity slice.
- Add targeted unit or browser coverage appropriate to the selected scope.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs, or
  app-owned adapter facades.

### task-1744 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_METALLIC_ROUGHNESS_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1743`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1745 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_METALLIC_ROUGHNESS_ASSERTIONS_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1741` through `task-1744` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1746 — Plan next glTF assertion or fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_GLTF_ASSERTION_AFTER_METALLIC_ROUGHNESS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare at least two StandardMaterial/glTF assertion or fidelity candidates
  and one diagnostics/tooling or route architecture candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run and do not add IBL, shadows, binary
  GLB loading, public custom material APIs, or app-owned adapter facades.

### task-1747 — Audit selected post-metallic follow-up plan

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_OCCLUSION_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1746` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest StandardMaterial/glTF audits
selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1748 — Implement selected glTF assertion or fidelity slice

Status: completed 2026-05-18. See `test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
To be narrowed by `task-1746`; expected to stay within targeted
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1746` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused StandardMaterial/glTF assertion or
  fidelity slice.
- Add targeted unit or browser coverage appropriate to the selected scope.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs, or
  app-owned adapter facades.

### task-1749 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_OCCLUSION_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1748`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1750 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_OCCLUSION_ASSERTIONS_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1746` through `task-1749` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1751 — Plan next StandardMaterial fidelity or audit follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_STANDARD_GLTF_AFTER_OCCLUSION_ASSERTIONS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Compare one StandardMaterial/glTF fidelity implementation candidate, one
  audit-refactor candidate, and one diagnostics/tooling or route architecture
  candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run and do not add IBL, shadows, binary
  GLB loading, public custom material APIs, or app-owned adapter facades.

### task-1752 — Audit selected post-occlusion follow-up plan

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1751` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest StandardMaterial/glTF audits
selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1753 — Implement selected StandardMaterial fidelity or audit slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
To be narrowed by `task-1751`; expected to stay within targeted docs,
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1751` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused StandardMaterial/glTF fidelity or audit
  slice.
- Add targeted unit, browser, or docs validation appropriate to the selected
  scope.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs, or
  app-owned adapter facades.

### task-1754 — Audit selected implementation slice

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1753`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1755 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1751` through `task-1754` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1756 — Plan alpha/render-state or transform status hardening

Status: completed 2026-05-18. See
`docs/research/NEXT_ALPHA_OR_TRANSFORM_STATUS_AFTER_ASSERTION_AUDIT_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, and
`examples/standard-gltf-texture.js`.

Acceptance criteria:

- Compare alpha/render-state status hardening, texture-transform status
  hardening, and one diagnostics/tooling or route architecture candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run and do not add IBL, shadows, binary
  GLB loading, public custom material APIs, or app-owned adapter facades.

### task-1757 — Audit selected post-assertion-audit follow-up plan

Status: completed 2026-05-18. See
`docs/research/ALPHA_RENDER_STATE_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1756` plan, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the latest StandardMaterial/glTF audits
selected by the plan.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction boundaries,
  JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1758 — Implement selected alpha/render-state or transform status slice

Status: completed 2026-05-19. See
`docs/research/STANDARD_GLTF_ALPHA_RENDER_STATE_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
To be narrowed by `task-1756`; expected to stay within targeted
`packages/webgpu`, `examples`, or `test` files.
Reference anchor:
the selected `task-1756` plan plus relevant local reference code.

Acceptance criteria:

- Implement exactly the selected focused StandardMaterial/glTF status hardening
  slice.
- Add targeted unit or browser coverage appropriate to the selected scope.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs, or
  app-owned adapter facades.

### task-1759 — Audit selected implementation slice

Status: completed 2026-05-19. See
`docs/research/STANDARD_GLTF_ALPHA_RENDER_STATE_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the selected implementation from `task-1758`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm implementation satisfies the selected acceptance criteria.
- Confirm no ECS/render ownership, WebGPU-only, or public API boundary drift.
- Recommend tracker/backlog alignment or the next implementation follow-up.

### task-1760 — Audit tracker/backlog alignment after selected slice

Status: completed 2026-05-19. See
`docs/index.html`, `docs/render-pipeline-comparison.html`, and this backlog
update.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1756` through `task-1759` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if project status or recommended next task
  changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1761 — Attach a depth-stencil texture so opaque draws depth-test

Status: completed 2026-05-19. See
`docs/research/DEPTH_ATTACHMENT_FIX_AUDIT_2026_05_18.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/frame-boundary.ts`,
the app-level material adapters under
`packages/webgpu/src/webgpu/*-app-frame-resources.ts` and
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
plus a new depth-texture resource module under
`packages/webgpu/src/webgpu/` and matching unit tests under
`packages/webgpu/test/`. A new browser proof under
`test/e2e/` and a research note under `docs/research/` are also in scope.
Reference anchor:
`packages/webgpu/src/webgpu/material-render-state.ts:50-91`,
`packages/webgpu/src/webgpu/pipeline-cache.ts:130-165`,
`packages/webgpu/src/webgpu/render-pass-attachments.ts:48-106`,
`packages/webgpu/src/webgpu/frame-boundary.ts:160-200`,
`references/three.js` WebGPU renderer for the canonical depth-texture
lifecycle, and `references/engine` for an alternate pattern.

Root-cause summary (verified 2026-05-18 against a standalone five-mesh
demo with the box, sphere, torus, cylinder, cone arrangement):

- `frame-boundary.ts:178` calls `createRenderPassAttachmentPlan({
colorTargets: [texture.target] })` with no `depthTarget`, so the forward
  render pass has no depth-stencil attachment.
- No code under `packages/webgpu/src` creates a depth texture; a
  `grep -rn "depth24" packages/webgpu/src` returns zero non-type matches.
- `material-render-state.ts:78-83` returns
  `{ depthWriteEnabled: false, depthCompare: "always" }` whenever
  `depthFormat` is `null`/`undefined`; `pipeline-cache.ts:159-160` defaults
  match. Every built-in pipeline therefore disables depth-test and depth-write.
- Symptom: with five opaque meshes spawned in box→sphere→torus→cylinder→cone
  order, the farthest object (box) is rendered on top of nearer objects
  because draw order wins where pixels overlap, not depth.

Acceptance criteria:

- Allocate a depth-stencil texture (`depth24plus`) sized to the
  swap-chain output and re-create it when the canvas/output target resizes;
  expose its `GPUTextureView` to the frame boundary so the forward pass
  receives a `depthStencilAttachment` with `depthLoadOp: "clear"`,
  `depthClearValue: 1.0`, and `depthStoreOp: "store"`.
- Plumb a non-null `depthFormat` from `WebGpuApp` through to every
  built-in material pipeline descriptor (`unlit`, `standard`, `matcap`,
  `debug-normal`) so `resolveWebGpuPipelineRenderState` returns
  `depthCompare: "less"` (or `"less-equal"`) and
  `depthWriteEnabled: true` for opaque pipelines. The
  alpha-blend Standard variant must keep `depthWriteEnabled: false` while
  still depth-testing.
- Add a focused unit test that asserts
  `createWebGpuDepthStencilDescriptor` produces
  `{ depthCompare: "less", depthWriteEnabled: true }` for an opaque pipeline
  key with a non-null `depthFormat`, and confirms the existing
  `null`-depth-format fallback still returns the no-depth state.
- Add a Playwright browser proof that authors at least one inter-family
  overlap (e.g. an `Unlit` cube in front of a `Standard` sphere at
  overlapping screen-space coordinates) and asserts via canvas readback
  that the nearer object's color wins at the overlap pixel. Spawn order
  must intentionally place the farther object first so the test fails
  loudly if depth is regressed.
- Surface a JSON-safe `webGpuApp.depthAttachment` block in the render
  report (format, attached: boolean, opaque pipeline depth-write count)
  without exposing raw GPU textures or views.
- Do not introduce a public render-graph, multi-pass API, IBL, shadows,
  binary GLB loading, or a public custom-material facade — this slice
  attaches a single depth-stencil to the existing single forward pass and
  nothing more.
- Add a research note
  `docs/research/DEPTH_ATTACHMENT_FIX_AUDIT_2026_05_18.md` capturing the
  root-cause diagnosis above and the chosen approach.
- Update `docs/index.html` and
  `docs/render-pipeline-comparison.html` phase 6 (submit) to record that
  depth-test/write is now wired, then run `pnpm run check:progress`.

### task-1762 — Audit depth-attachment fix after implementation

Status: completed 2026-05-19. See
`docs/research/DEPTH_ATTACHMENT_FIX_IMPLEMENTATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a tiny corrective fix is required.
Reference anchor:
the selected implementation from `task-1761`, `docs/ARCHITECTURE.md`,
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/material-render-state.ts`,
`packages/webgpu/src/webgpu/render-pass-attachments.ts`, and the local
WebGPU app depth-resource changes.

Acceptance criteria:

- Confirm the depth attachment remains a derived WebGPU render resource and
  does not introduce renderer-owned ECS/game state or a scene graph.
- Confirm opaque and alpha-blend pipeline depth behavior matches the selected
  design and that diagnostics stay JSON-safe.
- Confirm targeted unit/browser coverage and tracker updates are sufficient,
  or document the smallest follow-up.

### task-1763 — Audit tracker/backlog alignment after depth attachment

Status: completed 2026-05-19. See `docs/index.html`,
`docs/render-pipeline-comparison.html`, and this backlog update.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1761`/`task-1762` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if depth-test/write status or recommended next
  task changed.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1764 — Plan next renderer/material architecture slice after depth

Status: completed 2026-05-19. See
`docs/research/NEXT_RENDERER_MATERIAL_AFTER_DEPTH_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the depth-attachment implementation/audit, and relevant
`references/engine` and `references/three.js` material/pipeline code.

Acceptance criteria:

- Compare one generic material-family queue/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1765 — Tighten transformed texture status assertions

Status: completed 2026-05-19. See
`docs/research/NORMAL_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
status assertion exposes a focused defect.
Reference anchor:
existing transformed texture browser fixtures in
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
`references/three.js` texture transform handling, and `references/engine`
material texture transform handling.

Acceptance criteria:

- Pick one under-asserted transformed texture fixture among normal, occlusion,
  or emissive texture transforms.
- Replace broad status matchers with exact JSON-safe transform, texCoord,
  slot/readiness, and pipeline-key assertions where the fixture already exposes
  that data.
- Preserve existing screenshot/readback checks and WebGPU warning guards.
- Do not add new material features, IBL, shadows, binary GLB loading, or public
  custom material APIs.

### task-1766 — Audit transformed texture status assertion hardening

Status: completed 2026-05-19. See
`docs/research/NORMAL_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1765` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, existing transformed texture browser
fixtures, and relevant `references/three.js` / `references/engine` material
texture transform handling.

Acceptance criteria:

- Confirm the transformed texture assertion slice tightened status coverage
  without adding unsupported material features.
- Confirm JSON-safe status remains free of raw GPU handles and source payload
  blobs.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1767 — Add app depth attachment resize report regression

Status: completed 2026-05-19. See
`docs/research/DEPTH_ATTACHMENT_RESIZE_REPORT_REGRESSION_AUDIT_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/webgpu-app.test.ts` and focused WebGPU app test fixtures; app
implementation files only if the test exposes a resize/report defect.
Reference anchor:
`packages/webgpu/src/webgpu/depth-texture-resource.ts`,
`packages/webgpu/src/webgpu/app.ts`, `references/three.js` depth-buffer resize
handling, and `references/engine` WebGPU render-target depth attachment
lifecycle.

Acceptance criteria:

- Add a focused app-level regression that renders, changes the canvas/output
  size, renders again, and asserts the JSON-safe depth report reflects the new
  dimensions.
- Confirm the depth texture cache reuses same-size attachments and recreates
  resized attachments without exposing raw GPU objects.
- Keep the test within the existing single forward pass; do not add a render
  graph, multi-pass API, IBL, shadows, or public custom material APIs.

### task-1768 — Audit app depth attachment resize report coverage

Status: completed 2026-05-19. See
`docs/research/DEPTH_ATTACHMENT_RESIZE_REPORT_REGRESSION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1767` regression, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and WebGPU app depth attachment reports.

Acceptance criteria:

- Confirm depth resize coverage remains app/resource-cache scoped and does not
  move simulation state into the renderer.
- Confirm the report shape stays JSON-safe and useful for browser/agent status
  checks.
- Recommend whether the renderer/material track should proceed to transformed
  texture status hardening, generic material-family contracts, or another
  depth/resource lifecycle follow-up.

### task-1769 — Plan next renderer/material slice after depth resize coverage

Status: completed 2026-05-19. See
`docs/research/NEXT_RENDERER_MATERIAL_AFTER_DEPTH_RESIZE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
the depth attachment and transformed texture assertion audits, plus relevant
`references/engine` and `references/three.js` material/pipeline code.

Acceptance criteria:

- Compare one generic material-family queue/prepared-resource candidate, one
  StandardMaterial/glTF fidelity candidate, and one diagnostics/tooling
  candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1770 — Tighten occlusion or emissive transformed texture status assertions

Status: completed 2026-05-19. See
`docs/research/OCCLUSION_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
status assertion exposes a focused defect.
Reference anchor:
existing occlusion/emissive transformed texture browser fixtures in
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
`references/three.js` texture transform handling, and `references/engine`
material texture transform handling.

Acceptance criteria:

- Pick either the occlusion or emissive transformed texture fixture.
- Pin exact JSON-safe transform, texCoord, slot/readiness, sampler mapping, and
  pipeline-key assertions where the fixture already exposes that data.
- Preserve existing screenshot/readback checks and WebGPU warning guards.
- Do not add new material features, IBL, shadows, binary GLB loading, or public
  custom material APIs.

### task-1771 — Audit transformed texture status assertion follow-up

Status: completed 2026-05-19. See
`docs/research/OCCLUSION_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1770` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and transformed texture browser fixtures.

Acceptance criteria:

- Confirm the selected transformed texture fixture now pins the meaningful
  status fields without duplicating unrelated assertions.
- Confirm JSON-safe status remains free of raw GPU handles and source payload
  blobs.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1772 — Audit tracker/backlog alignment after transformed texture follow-up

Status: completed 2026-05-19. See `docs/index.html`,
`docs/render-pipeline-comparison.html`, and this backlog update.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the transformed texture status follow-up, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and current public tracker state.

Acceptance criteria:

- Update public tracker pages only if project status or recommended next task
  changed materially.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1773 — Plan next generic material-family contract slice

Status: completed 2026-05-19. See
`docs/research/GENERIC_MATERIAL_FAMILY_CONTRACT_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and relevant
Bevy render-asset/material references.

Acceptance criteria:

- Identify one small generic material-family contract slice that does not
  expose public custom material APIs yet.
- Define category, package/write-scope, reference anchors, and acceptance
  criteria for the selected follow-up.
- Keep the selected task suitable for one focused run.

### task-1774 — Serialize generic queued material app resource items

Status: completed 2026-05-19. See
`docs/research/GENERIC_MATERIAL_APP_RESOURCE_ITEM_SERIALIZATION_AUDIT_2026_05_19.md`.

Category: `render-bridge`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts` and
`test/webgpu/queued-material-app-resource-item.test.ts`.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_CONTRACT_PLAN_2026_05_19.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, relevant Bevy
render-asset/material references, and local queued-material contract code.

Acceptance criteria:

- Add a JSON-safe helper for serializing
  `QueuedMaterialAppResourceItem` route identity plus source/prepared
  mesh/material keys.
- Omit raw `mesh`, `material`, `adapter`, `draw`, GPU objects, app caches, and
  source payload bytes from the JSON helper output.
- Cover a test-only material family and assert the output is family-agnostic,
  deterministic, and free of backend handles.
- Do not expose public custom material APIs, app-owned adapter facades, IBL,
  shadows, binary GLB loading, or WebGL fallback.

### task-1775 — Audit selected generic material-family contract slice

Status: completed 2026-05-19. See
`docs/research/GENERIC_MATERIAL_APP_RESOURCE_ITEM_SERIALIZATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1774` implementation, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, relevant Bevy render-asset/material references, and local
queued-material contract code.

Acceptance criteria:

- Confirm the selected generic contract slice does not expose deferred public
  custom material APIs or app-owned adapter facades.
- Confirm ECS/render ownership, WebGPU-only backend boundaries, and JSON-safe
  diagnostics remain intact.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1776 — Tighten emissive transformed texture status assertions

Status: completed 2026-05-19. See
`docs/research/EMISSIVE_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
status assertion exposes a focused defect.
Reference anchor:
the existing emissive transformed texture browser fixture in
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
`references/three.js` texture transform handling, and `references/engine`
material texture transform handling.

Acceptance criteria:

- Pin exact JSON-safe transform, texCoord, slot/readiness, sampler mapping, and
  pipeline-key assertions for the emissive transformed texture fixture.
- Preserve existing screenshot/readback checks and WebGPU warning guards.
- Do not add new material features, IBL, shadows, binary GLB loading, or public
  custom material APIs.

### task-1777 — Audit emissive transformed texture status assertions

Status: completed 2026-05-19. See
`docs/research/EMISSIVE_TEXTURE_TRANSFORM_STATUS_ASSERTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1776` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and transformed texture browser fixtures.

Acceptance criteria:

- Confirm the emissive transformed texture fixture now pins the meaningful
  status fields without duplicating unrelated assertions.
- Confirm JSON-safe status remains free of raw GPU handles and source payload
  blobs.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1778 — Audit tracker/backlog alignment after generic item serialization

Status: completed 2026-05-19. See `docs/index.html`,
`docs/render-pipeline-comparison.html`, and this backlog update.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1774`/`task-1775` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and current public tracker state.

Acceptance criteria:

- Update public tracker pages only if project status or recommended next task
  changed materially.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1779 — Plan next generic material-family contract follow-up

Status: completed 2026-05-19. See
`docs/research/NEXT_GENERIC_MATERIAL_CONTRACT_AFTER_ITEM_JSON_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, the generic app resource item serialization audit,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`, and relevant Bevy
render-asset/material references.

Acceptance criteria:

- Compare one small generic contract candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task suitable for one focused run.

### task-1780 — Add routed item key details to route report diagnostics

Status: completed 2026-05-19. See
`docs/research/GENERIC_ROUTE_REPORT_ROUTED_ITEMS_AUDIT_2026_05_19.md`.

Category: `render-bridge`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts` and
`test/webgpu/queued-material-app-resource-item.test.ts`.
Reference anchor:
`docs/research/NEXT_GENERIC_MATERIAL_CONTRACT_AFTER_ITEM_JSON_PLAN_2026_05_19.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, relevant Bevy
render-asset/material references, and local queued-material contract code.

Acceptance criteria:

- Extend generic route report diagnostics with a JSON-safe `routedItems` list
  built from `queuedMaterialAppResourceItemToJsonValue`.
- Preserve existing route report summary fields and diagnostic counts.
- Cover a test-only material family and assert the diagnostic output omits raw
  mesh/material assets, adapter instances, draw packets, GPU handles, app
  caches, and source payload bytes.
- Do not expose public custom material APIs, app-owned adapter facades, IBL,
  shadows, binary GLB loading, or WebGL fallback.

### task-1781 — Audit selected generic material-family contract follow-up

Status: completed 2026-05-19. See
`docs/research/GENERIC_ROUTE_REPORT_ROUTED_ITEMS_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1780` implementation, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, relevant Bevy render-asset/material references, and local
queued-material contract code.

Acceptance criteria:

- Confirm the selected generic contract slice preserves ECS/render ownership
  and deferred public custom material API boundaries.
- Confirm JSON-safe diagnostics/serialization remain free of raw GPU handles and
  source payload blobs.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1782 — Audit tracker/backlog alignment after generic contract follow-up

Status: completed 2026-05-19. See `docs/index.html`,
`docs/render-pipeline-comparison.html`, and this backlog update.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1780`/`task-1781` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and current public tracker state.

Acceptance criteria:

- Update public tracker pages only if project status or recommended next task
  changed materially.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1783 — Plan next StandardMaterial/glTF fidelity follow-up

Status: completed 2026-05-19. See
`docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_ROUTE_ITEMS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, current
StandardMaterial/glTF browser fixtures, `references/three.js` material/texture
handling, and `references/engine` material/texture handling.

Acceptance criteria:

- Compare at least two remaining StandardMaterial/glTF fidelity candidates and
  one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task suitable for one focused run.

### task-1784 — Tighten base-color rotation transform fixture status

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift to IBL/GLB/shadow tracks. See `agent/HANDOFF.md`.

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
status assertion exposes a focused defect.
Reference anchor:
`docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_ROUTE_ITEMS_PLAN_2026_05_19.md`,
the base-color rotation transform fixture in
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
`references/three.js` material/texture handling, and `references/engine`
material/texture handling.

Acceptance criteria:

- Pin exact JSON-safe transform, texCoord, slot/readiness, sampler mapping, and
  pipeline-key assertions for the base-color rotation transform fixture.
- Preserve existing screenshot/readback checks and WebGPU warning guards.
- Do not add IBL, shadows, binary GLB loading, public custom material APIs,
  app-owned adapter facades, or WebGL fallback.

### task-1785 — Audit selected StandardMaterial/glTF fidelity follow-up

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift to IBL/GLB/shadow tracks. See `agent/HANDOFF.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1784` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, current StandardMaterial/glTF browser
fixtures, and relevant engine references.

Acceptance criteria:

- Confirm the selected StandardMaterial/glTF slice satisfies its acceptance
  criteria without adding deferred features.
- Confirm JSON-safe status/diagnostics remain free of raw GPU handles and
  source payload blobs.
- Recommend tracker/backlog alignment or the smallest follow-up.

### task-1786 — Plan next generic material-family contract follow-up

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift to IBL/GLB/shadow tracks. See `agent/HANDOFF.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, recent generic route/item audits, and relevant Bevy
render-asset/material references.

Acceptance criteria:

- Compare one small generic contract candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task suitable for one focused run.

### task-1787 — Audit tracker/backlog alignment after selected fidelity follow-up

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift to IBL/GLB/shadow tracks. See `agent/HANDOFF.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1784`/`task-1785` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and current public tracker state.

Acceptance criteria:

- Update public tracker pages only if project status or recommended next task
  changed materially.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1788 — Implement selected generic material-family contract follow-up

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift to IBL/GLB/shadow tracks. See `agent/HANDOFF.md`.

Category: `render-bridge`
Package/write-scope:
To be narrowed by `task-1786`; expected to stay within focused render/WebGPU
route, queue, summary, or diagnostics contract files plus targeted tests.
Reference anchor:
the selected `task-1786` plan, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, relevant Bevy render-asset/material references, and local
queued-material contract code.

Acceptance criteria:

- Implement exactly the selected focused generic contract slice.
- Add targeted tests appropriate to the selected scope.
- Do not expose public custom material APIs, app-owned adapter facades, IBL,
  shadows, binary GLB loading, or WebGL fallback.

### task-1789 — Plan GLTF scene vertical slice

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_VERTICAL_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and tracker docs if
status changes.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`references/bevy` asset/material/render-extraction patterns, and local
StandardMaterial/glTF browser fixtures.

Acceptance criteria:

- Define the smallest GLTF scene fixture that proves multiple primitive shapes,
  multiple built-in materials, transforms, camera, direct light, IBL intent, and
  shadow intent.
- Order the implementation blockers into scene contract, built-in material
  rendering, IBL, shadows, and audit slices.
- Explicitly defer public custom shader/material APIs and app-owned custom
  adapter facades unless they block the built-in scene path.

### task-1790 — Define GLTF scene import data contract

Status: completed 2026-05-19. See
`packages/render/src/assets/gltf-scene-import-contract.ts`,
`test/assets/gltf-scene-import-contract.test.ts`, and
`docs/research/GLTF_SCENE_IMPORT_CONTRACT_IMPLEMENTATION_2026_05_19.md`.

Category: `render-bridge`
Package/write-scope:
`packages/render`, GLTF fixture helpers, docs/research, and targeted tests.
Reference anchor:
`references/bevy` scene/asset/material extraction patterns, local glTF mapper
fixtures, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Define a JSON-safe scene import contract for mesh primitives, node
  transforms, cameras, built-in material references, texture/sampler
  references, environment/IBL metadata, and shadow-capable light metadata.
- Map the contract into existing typed assets and ECS authoring without adding a
  mutable scene graph.
- Add tests covering multiple primitive shapes and multiple built-in materials.

### task-1791 — Build multi-primitive multi-material GLTF scene fixture

Status: completed 2026-05-19. See `examples/gltf-scene.js`,
`examples/gltf-scene.html`, `test/e2e/gltf-scene.spec.ts`, and
`docs/research/GLTF_SCENE_BROWSER_FIXTURE_IMPLEMENTATION_2026_05_19.md`.

Category: `runtime-orchestration`
Package/write-scope:
`examples`, `test/e2e`, and app-facade fixture helpers; implementation files
only as needed by the public app path.
Reference anchor:
`references/bevy` app/render extraction patterns, existing browser examples,
and local WebGPU app diagnostics.

Acceptance criteria:

- Add a browser fixture that renders at least three primitive shapes with at
  least two built-in material families through the public app facade.
- Verify pixels and JSON-safe frame status with Playwright.
- Preserve ECS authority, render extraction, typed assets, and WebGPU-only
  backend ownership.

### task-1792 — Add first GLTF scene IBL resource path

Status: completed 2026-05-19. See `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and
`docs/research/GLTF_SCENE_BROWSER_FIXTURE_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, relevant shader/resource helpers, examples, and targeted
tests.
Reference anchor:
`references/engine` and `references/three.js` environment/IBL resource and
shader patterns, adapted to Aperture's ECS/render-world architecture.

Acceptance criteria:

- Prepare an environment/IBL resource from the GLTF scene path without storing
  renderer state in ECS.
- Bind and sample the IBL resource in StandardMaterial or report a structured
  unsupported diagnostic when incomplete.
- Add browser-visible proof or a targeted diagnostic proof, plus JSON-safe
  readiness reporting.

### task-1793 — Add first GLTF scene shadow-map path

Status: completed 2026-05-19. See `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and
`docs/research/GLTF_SCENE_BROWSER_FIXTURE_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/render`, `packages/webgpu`, relevant shaders, examples, and targeted
tests.
Reference anchor:
`references/engine` and `references/three.js` shadow pass/resource patterns,
plus Bevy render extraction concepts for light/shadow requests.

Acceptance criteria:

- Extract at least one shadow-capable light request from ECS/render snapshot
  data.
- Create a first shadow-map render path and bind shadow resources to
  StandardMaterial without WebGL fallback or renderer-owned game state.
- Verify visible shadow behavior or a narrowly scoped first-step diagnostic
  proof with Playwright/targeted tests.

### task-1794 — Audit GLTF scene vertical slice architecture

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_VERTICAL_SLICE_ARCHITECTURE_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, tracker docs, and tiny corrective fixes
only if required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and the scene/IBL/shadow
implementation tasks.

Acceptance criteria:

- Confirm the scene path does not introduce a central mutable scene graph,
  renderer-owned ECS/game state, WebGL fallback, or raw GPU objects in source
  assets.
- Confirm IBL and shadows are modeled through render resources, diagnostics,
  and the established frame phases.
- Update tracker/backlog recommendations and run `pnpm run check:progress` if
  tracker pages change.

### task-1795 — Define GLTF scene IBL resource descriptors

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_IBL_DESCRIPTOR_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, and docs/research.
Reference anchor:
`references/engine` environment atlas/resource selection patterns,
`references/three.js` PMREM/environment texture patterns, and Aperture's
`environment-map-readiness` / `environment-resource-planning` helpers.

Acceptance criteria:

- Define a JSON-safe renderer-owned IBL descriptor shape for the GLTF scene's
  environment-map handle, including diffuse/specular resource keys or explicit
  unsupported placeholders.
- Keep descriptor/resource state out of ECS and source assets.
- Surface descriptor readiness in the GLTF scene status and targeted tests
  without claiming StandardMaterial shader IBL sampling is active.

### task-1796 — Add StandardMaterial IBL readiness diagnostics

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_STANDARD_IBL_READINESS_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, StandardMaterial readiness/diagnostic helpers, and targeted
tests.
Reference anchor:
`references/engine` lit material reflection-source selection,
`references/three.js` environment intensity/material envMap patterns, and local
StandardMaterial direct-light readiness diagnostics.

Acceptance criteria:

- StandardMaterial route/readiness status can report whether IBL descriptors
  are available, unsupported, or missing.
- Diagnostics remain JSON-safe and do not include raw GPU handles.
- The GLTF scene app exposes the StandardMaterial IBL readiness state.

### task-1797 — Define GLTF scene shadow-map descriptors

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_DESCRIPTOR_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/render`, `packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine` shadow-map render target/pass patterns,
`references/three.js` shadow map resource/pass patterns, and Bevy light/shadow
request extraction concepts.

Acceptance criteria:

- Define a renderer-owned shadow-map descriptor from extracted
  `ShadowRequestPacket` data plus scene shadow intent.
- Keep shadow textures, passes, and GPU state out of ECS/source assets.
- Add tests for descriptor keys, map size/bias metadata, and JSON-safe
  diagnostics.

### task-1798 — Add first GLTF scene shadow resource diagnostic proof

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_RESOURCE_READINESS_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, `test/e2e`, and targeted tests.
Reference anchor:
the descriptor from `task-1797`, `references/engine` shadow render target
lifecycle, and `references/three.js` shadow-map pass/resource lifecycle.

Acceptance criteria:

- The GLTF scene app reports a renderer-owned shadow-map resource descriptor or
  explicit unsupported resource diagnostic.
- Playwright verifies shadow request/resource status remains JSON-safe.
- Do not claim visible shadow sampling until a real shadow pass and material
  sampling path exists.

### task-1799 — Audit GLTF scene IBL/shadow descriptor alignment

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_IBL_SHADOW_DESCRIPTOR_ALIGNMENT_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, tracker docs, and tiny corrective fixes
only if required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and the
`task-1795` through `task-1798` implementation notes.

Acceptance criteria:

- Confirm IBL/shadow descriptors remain renderer-owned and ECS-safe.
- Confirm the scene fixture does not hide a scene graph or bypass extraction.
- Refill the backlog with the next concrete resource/pass/shader slices.

### task-1800 — Add first shadow texture resource helper

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_TEXTURE_RESOURCE_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine` shadow render target lifecycle,
`references/three.js` shadow map texture/render target ownership, and local
`shadow-map-descriptor` / `shadow-resource-readiness` helpers.

Acceptance criteria:

- Define a renderer-owned shadow texture resource descriptor/result shape from
  `ShadowMapDescriptorReport`.
- Keep raw `GPUTexture`, `GPUTextureView`, render pass, and command encoder
  objects out of JSON output.
- Add tests for stable resource keys, depth format, map size, and JSON-safety.

### task-1801 — Add first shadow pass plan report

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_PASS_PLAN_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine` shadow pass/frame graph patterns,
`references/three.js` shadow map render flow, and Aperture's frame-boundary and
render-pass assembly helpers.

Acceptance criteria:

- Define a JSON-safe shadow pass plan/report that consumes shadow texture
  resource descriptors and extracted shadow requests.
- Report whether pass submission is deferred, unsupported, or ready.
- Do not submit GPU commands or claim visible shadows yet.

### task-1802 — Add StandardMaterial shadow readiness diagnostics

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_STANDARD_SHADOW_READINESS_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, StandardMaterial readiness helpers, GLTF scene status, and
targeted tests.
Reference anchor:
`references/engine` lit material shadow option selection,
`references/three.js` material shadow-map bindings, and local
`standard-material-ibl-readiness` diagnostics.

Acceptance criteria:

- StandardMaterial readiness can report whether shadow descriptors/resources
  are available, missing, unsupported, or deferred.
- The GLTF scene app exposes StandardMaterial shadow readiness status.
- Diagnostics remain JSON-safe and do not include raw GPU handles.

### task-1803 — Add IBL texture preparation descriptor

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_IBL_TEXTURE_PREPARATION_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine` environment atlas generation/resource selection,
`references/three.js` PMREM texture preparation, and local
`ibl-resource-descriptor` / `standard-material-ibl-readiness` helpers.

Acceptance criteria:

- Define the next renderer-owned IBL texture preparation descriptor for
  diffuse/specular resources.
- Report whether texture upload/prefiltering is unsupported, deferred, or ready
  without changing shaders.
- Tests cover JSON-safe resource keys and unsupported/deferred diagnostics.

### task-1804 — Audit post-descriptor GLTF scene resource alignment

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_POST_DESCRIPTOR_RESOURCE_ALIGNMENT_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, tracker docs, and tiny corrective fixes
only if required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and tasks
`1800` through `1803`.

Acceptance criteria:

- Confirm the IBL/shadow resource path still uses ECS authoring, extraction,
  renderer-owned resources, WebGPU-only submission, and JSON-safe diagnostics.
- Confirm no public custom shader/material APIs or scene graph shortcuts were
  introduced.
- Refill the next ready queue toward actual shader/pass work.

### task-1805 — Add first IBL/shadow resource dashboard audit

Status: completed 2026-05-19. See
`docs/research/IBL_SHADOW_RESOURCE_DASHBOARD_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research` only.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, local GLTF scene
diagnostics, and tasks `1800` through `1804`.

Acceptance criteria:

- Confirm the public tracker describes IBL/shadow state as descriptor/planning
  work until real GPU passes and shader sampling exist.
- Confirm the backlog still prioritizes GLTF scenes with built-in materials,
  shadows, and IBL over public custom shader/material APIs.

### task-1806 — Add IBL texture preparation pass planning

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_IBL_PREPARATION_PASS_PLAN_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, and local
`ibl-texture-preparation` helpers.

Acceptance criteria:

- Define a JSON-safe IBL preparation pass plan from
  `IblTexturePreparationReport`.
- Report upload/prefilter pass status as deferred, unsupported, missing, or
  ready without creating GPU textures or command encoders.
- GLTF scene status exposes the pass plan without claiming shader IBL sampling.

### task-1807 — Add directional shadow view-projection plan

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_DIRECTIONAL_SHADOW_VIEW_PROJECTION_PLAN_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/renderer/light-camera.js`,
`references/engine/src/scene/renderer/shadow-renderer.js`,
`references/three.js/src/lights/LightShadow.js`, and Aperture shadow pass plan
helpers.

Acceptance criteria:

- Define a JSON-safe directional shadow view/projection planning report from
  extracted shadow requests and light packet data.
- Include stable keys, light/shadow ids, layer masks, map size, and explicit
  deferred matrix/camera computation diagnostics when insufficient data exists.
- Do not add live shadow cameras, scene graph nodes, or GPU resources.

### task-1808 — Add shadow caster draw-list planning

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_CASTER_DRAW_LIST_PLAN_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/renderer/shadow-renderer.js`,
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`, and Aperture
render-pass draw-list helpers.

Acceptance criteria:

- Define a JSON-safe shadow caster draw-list plan from render packets and shadow
  caster layer masks.
- Report included/skipped caster counts and stable resource keys.
- Keep command encoding and shadow-map submission deferred.

### task-1809 — Add IBL/shadow shader binding readiness metadata

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_IBL_SHADOW_SHADER_BINDING_READINESS_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, StandardMaterial readiness helpers, targeted tests, and
docs/research.
Reference anchor:
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting`,
`references/three.js/src/renderers/shaders/ShaderChunk`, local
`light-shader-metadata`, `standard-material-ibl-readiness`, and
`standard-material-shadow-readiness`.

Acceptance criteria:

- Define JSON-safe StandardMaterial shader binding readiness metadata for IBL
  and shadow resource slots.
- Report missing/deferred shader bindings without modifying WGSL or bind group
  layouts.
- Tests cover JSON safety and status classification.

### task-1810 — Audit first IBL/shadow planning chain

Status: completed 2026-05-19. See
`docs/research/IBL_SHADOW_PLANNING_CHAIN_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, and tiny corrective fixes only if required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/DECISIONS.md`, and tasks `1806`
through `1809`.

Acceptance criteria:

- Confirm IBL and shadow planning still uses ECS extraction, renderer-owned
  resources, WebGPU-only backend state, and JSON-safe diagnostics.
- Confirm no public custom material API, scene graph shortcut, WebGL fallback,
  or raw GPU handle JSON exposure was introduced.
- Recommend the next implementation slice toward visible IBL or shadows.
- Add the next five concrete ready tasks toward visible IBL/shadow rendering.

### task-1811 — Plan shadow matrix buffer descriptor

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_MATRIX_BUFFER_DESCRIPTOR_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/renderer/shadow-renderer.js`,
`references/three.js/src/lights/LightShadow.js`, and local
`directional-shadow-view-projection-plan`.

Acceptance criteria:

- Define a JSON-safe descriptor for the directional shadow view/projection
  matrix buffer from the existing shadow view/projection plan.
- Report stable buffer/resource keys, matrix count, byte size, and upload
  readiness without allocating a GPU buffer.
- Tests cover not-required, deferred, missing-plan, and JSON-safety cases.

### task-1812 — Add IBL preparation resource summary bridge

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status path, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, local
`ibl-texture-preparation`, and local `ibl-preparation-pass-plan`.

Acceptance criteria:

- Summarize IBL descriptor, texture preparation, and pass-plan readiness into a
  compact renderer resource status object.
- Keep the summary JSON-safe and data-only; do not allocate textures or submit
  IBL preparation passes.
- GLTF scene browser status exposes the summary with deferred sampling clearly
  separated from descriptor readiness.

### task-1813 — Add shadow caster command-plan readiness

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/renderer/render-pass-shadow-directional.js`,
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`, local
`shadow-pass-plan`, and local `shadow-caster-draw-list-plan`.

Acceptance criteria:

- Define a JSON-safe readiness report that combines shadow pass plans,
  directional view/projection plans, matrix-buffer descriptor state, and caster
  draw lists into command-plan status.
- Report missing prerequisites and deferred command encoding without creating a
  `GPUCommandEncoder` or render pass.
- Tests cover ready/deferred/missing classification from data-only inputs.

### task-1814 — Add StandardMaterial IBL/shadow pipeline-key readiness report

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, StandardMaterial readiness helpers, targeted tests, and
docs/research.
Reference anchor:
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting`,
`references/three.js/src/renderers/shaders/ShaderChunk`, local
`standard-material-pipeline-descriptor`, and local
`standard-material-ibl-shadow-binding-readiness`.

Acceptance criteria:

- Define JSON-safe metadata describing which StandardMaterial pipeline-key
  features would be required for IBL and shadow sampling.
- Report the features as deferred without modifying WGSL, bind-group layouts, or
  pipeline descriptors.
- Tests cover no-material, deferred-feature, and JSON-safety cases.

### task-1815 — Audit renderer planning hot-path allocation surfaces

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `packages/webgpu` only for tiny corrective fixes, and
agent backlog/status files.
Reference anchor:
Decision 0009 hot-path writer guidance, `docs/ARCHITECTURE.md`, and the new
IBL/shadow planning helpers.

Acceptance criteria:

- Confirm the new IBL/shadow reports are setup/diagnostic helpers and are not
  used as per-frame hot-path writer APIs.
- Identify any planning helper that should eventually gain a scratch-backed
  writer before entering the live frame loop.
- Add follow-up tasks for concrete allocation cleanup if needed.

### task-1816 — Add IBL sampler descriptor readiness

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status path, targeted tests, and docs/research.
Reference anchor:
`references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, local
`ibl-texture-preparation`, and local StandardMaterial IBL readiness helpers.

Acceptance criteria:

- Define JSON-safe sampler descriptor readiness for diffuse irradiance and
  specular prefilter IBL slots.
- Report stable sampler keys and deferred GPU sampler allocation without
  changing bind-group layouts or shader sampling.
- GLTF scene status exposes sampler descriptor readiness alongside the existing
  IBL texture preparation status.

### task-1817 — Add scratch-backed shadow command-plan writer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
Decision 0009 hot-path writer guidance and local
`shadow-caster-command-plan-readiness`.

Acceptance criteria:

- Define a reusable scratch object for shadow caster command-plan readiness.
- Provide a writer API that can refill caller-owned arrays for valid frames.
- Keep the existing JSON helper as a diagnostic convenience wrapper.

### task-1818 — Add IBL preparation summary scratch-writer plan

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, backlog only unless a tiny corrective docs change is required.
Reference anchor:
Decision 0009 hot-path writer guidance, local `ibl-preparation-resource-summary`,
and local `ibl-sampler-descriptor-readiness`.

Acceptance criteria:

- Identify which IBL preparation/status helpers need scratch-backed writer forms
  before live frame-loop use.
- Propose one concrete implementation task with package scope and tests.
- Confirm current GLTF status usage remains diagnostic/browser-facing.

### task-1819 — Add shadow command-plan resource summary bridge

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status path, targeted tests, and docs/research.
Reference anchor:
local `shadow-caster-command-plan-readiness`, `shadow-matrix-buffer-descriptor`,
and `shadow-pass-plan`.

Acceptance criteria:

- Summarize shadow texture, matrix-buffer, pass, draw-list, and command-plan
  readiness into a compact renderer resource status object.
- Keep the summary JSON-safe and data-only; do not allocate GPU buffers,
  textures, encoders, or render passes.
- GLTF scene status exposes the summary with deferred command encoding clearly
  separated from descriptor readiness.

### task-1820 — Audit GLTF status report surface growth

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, GLTF scene status/tests only for tiny corrective fixes.
Reference anchor:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
`docs/ARCHITECTURE.md`, and Decision 0009.

Acceptance criteria:

- Confirm the GLTF scene status remains useful and JSON-safe after recent
  IBL/shadow report additions.
- Identify any repeated status sections that should be grouped before more
  render resources are added.
- Add follow-up tasks for concrete cleanup if needed.

### task-1821 — Add IBL/shadow readiness status grouping

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope:
`examples/gltf-scene.js`, e2e status expectations, and docs/research.
Reference anchor:
local GLTF scene status shape and Bevy-inspired render diagnostics grouping.

Acceptance criteria:

- Add a compact top-level GLTF scene readiness grouping for IBL and shadow
  phases without removing detailed reports.
- Keep detailed JSON-safe report objects intact for agent inspection.
- Playwright verifies the grouped status alongside rendered pixels.

### task-1822 — Add scratch-backed IBL preparation summary writer

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, and docs/research.
Reference anchor:
Decision 0009 hot-path writer guidance and local
`ibl-preparation-resource-summary`.

Acceptance criteria:

- Define reusable scratch storage for IBL preparation resource summary reports.
- Provide a writer API that refills caller-owned arrays for descriptor keys,
  texture keys, sampler keys, pass keys, and diagnostics.
- Keep existing JSON helpers as diagnostic convenience wrappers.

### task-1823 — Audit scratch writer API consistency

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `packages/webgpu` only for tiny naming fixes.
Reference anchor:
Decision 0009 and the shadow/IBL scratch-backed writer APIs.

Acceptance criteria:

- Compare scratch creation and writer names/signatures across shadow and IBL
  readiness helpers.
- Confirm convenience wrappers still produce JSON-safe reports.
- Recommend concrete naming or writer-shape cleanup if needed.

### task-1824 — Add grouped readiness helper extraction

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope:
`examples/gltf-scene.js`, targeted tests if a helper is moved into package code,
and docs/research.
Reference anchor:
local GLTF scene readiness grouping and Bevy-style diagnostics grouping.

Acceptance criteria:

- Extract the GLTF scene readiness grouping logic into a small named helper
  rather than keeping it embedded in `publishFrameStatus`.
- Preserve the existing browser status shape.
- Playwright verifies grouped readiness and rendered pixels.

### task-1825 — Plan first live IBL resource allocation slice

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
`references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, and local IBL descriptor
reports.

Acceptance criteria:

- Compare diffuse irradiance, specular prefilter, and sampler allocation as
  candidates for the first live WebGPU IBL resource slice.
- Select one implementation task with acceptance criteria and validation.
- Keep shader sampling and public custom material APIs deferred unless selected
  as explicit prerequisites.

### task-1826 — Add shadow matrix-buffer scratch writer plan

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, backlog only unless a tiny docs correction is required.
Reference anchor:
Decision 0009 and local `shadow-matrix-buffer-descriptor`.

Acceptance criteria:

- Identify allocation-heavy parts of shadow matrix-buffer descriptor planning.
- Propose a concrete scratch-writer implementation task if needed.
- Confirm current matrix-buffer descriptor usage remains diagnostic/status-only.

### task-1827 — Allocate diffuse IBL texture resource

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path, and docs/research.
Reference anchor:
`references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, local
`ibl-texture-preparation`, and local `texture-resources`.

Acceptance criteria:

- Create a renderer-owned diffuse IBL texture/view resource from a planned IBL
  texture slot using an injected WebGPU-like device.
- Report stable resource keys and creation diagnostics without raw GPU handles
  in JSON helpers.
- GLTF scene status distinguishes allocated diffuse IBL texture resources from
  deferred specular prefiltering and deferred shader sampling.

### task-1828 — Plan first live shadow resource allocation slice

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `shadow-texture-resource`, `shadow-matrix-buffer-descriptor`, and
`shadow-caster-command-plan-readiness`.

Acceptance criteria:

- Compare shadow texture allocation, matrix-buffer allocation/upload, and
  command encoding as first live shadow-resource candidates.
- Select one implementation task with acceptance criteria and validation.
- Keep StandardMaterial shadow sampling deferred unless it is an explicit
  prerequisite.

### task-1829 — Audit live-resource boundary after diffuse IBL allocation

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `packages/webgpu` only for tiny corrective fixes.
Reference anchor:
the `task-1827` implementation, `docs/ARCHITECTURE.md`, and Decision 0009.

Acceptance criteria:

- Confirm diffuse IBL allocation stays renderer-owned and WebGPU-only.
- Confirm ECS/render snapshots contain no raw GPU handles.
- Confirm GLTF status distinguishes live resource allocation from shader
  sampling.

### task-1830 — Add IBL sampler GPU allocation resource

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path, and docs/research.
Reference anchor:
local `ibl-sampler-descriptor-readiness`, local `texture-resources`, and the
diffuse IBL allocation slice.

Acceptance criteria:

- Allocate renderer-owned IBL samplers from sampler descriptor readiness using
  an injected WebGPU-like device.
- Report stable sampler resource keys and diagnostics without raw handles in
  JSON helpers.
- Keep bind-group layout changes and shader sampling deferred.

### task-1831 — Add diffuse IBL resource summary bridge

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status path, targeted tests, and docs/research.
Reference anchor:
local diffuse IBL texture allocation helper and
`ibl-preparation-resource-summary`.

Acceptance criteria:

- Summarize diffuse IBL texture allocation, deferred specular prefiltering,
  sampler readiness, and shader sampling into a compact JSON-safe resource
  status object.
- Keep raw GPU handles out of JSON helpers.
- GLTF scene status exposes the summary beside detailed IBL reports.

### task-1832 — Allocate shadow depth texture resource

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_DEPTH_TEXTURE_RESOURCE_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path, and docs/research.
Reference anchor:
local `shadow-texture-resource`, local `texture-resources`,
`references/engine/src/scene/renderer/render-pass-shadow-directional.js`, and
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Create renderer-owned shadow depth texture/view resources from planned shadow
  texture descriptors using an injected WebGPU-like device.
- Report stable texture/view resource keys and diagnostics without raw GPU
  handles in JSON helpers.
- GLTF scene status distinguishes allocated shadow texture resources from
  deferred matrix computation, command encoding, and shader sampling.

### task-1833 — Audit live IBL resource cache direction

Status: completed 2026-05-19. See
`docs/research/LIVE_IBL_RESOURCE_CACHE_DIRECTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `packages/webgpu` only for tiny corrective fixes.
Reference anchor:
the diffuse IBL texture allocation helper, `createWebGpuApp` resource cache
shape, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Confirm where live IBL texture/sampler resources should be cached before more
  environment resources are allocated.
- Identify whether GLTF example module-scope caching should remain example-only.
- Add a concrete follow-up task if app resource cache integration is needed.

### task-1834 — Plan StandardMaterial IBL bind-group layout slice

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_IBL_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `standard-bind-group-layout`, `standard-material-ibl-shadow-binding-readiness`,
and the diffuse IBL texture resource helper.

Acceptance criteria:

- Compare adding IBL texture/sampler bind-group layout slots, resource binding
  descriptors, and shader WGSL sampling as candidate next steps.
- Select one implementation task with acceptance criteria and validation.
- Keep public custom material APIs deferred.

### task-1835 — Add shadow depth resource summary bridge

Status: completed 2026-05-19. See
`docs/research/GLTF_SCENE_SHADOW_DEPTH_RESOURCE_SUMMARY_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, GLTF scene status path, targeted tests, and docs/research.
Reference anchor:
local shadow depth texture allocation helper after `task-1832`,
`shadow-command-resource-summary`, and
`references/engine/src/scene/renderer/render-pass-shadow-directional.js`.

Acceptance criteria:

- Summarize shadow depth texture/view allocation, deferred pass submission,
  matrix upload, and shader sampling into a compact JSON-safe resource status
  object.
- Keep raw GPU handles out of JSON helpers.
- GLTF scene status exposes the summary beside detailed shadow reports.

### task-1836 — Audit GLTF live-resource status growth

Status: completed 2026-05-19. See
`docs/research/GLTF_LIVE_RESOURCE_STATUS_GROWTH_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, GLTF scene status/tests only for tiny corrective fixes.
Reference anchor:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
`docs/ARCHITECTURE.md`, and Decision 0009.

Acceptance criteria:

- Confirm the GLTF scene status remains navigable after adding live IBL and
  shadow resource reports.
- Identify any duplicated status fields that should be grouped or summarized.
- Add one concrete follow-up if status shape cleanup is needed.

### task-1837 — Add StandardMaterial IBL bind-group layout metadata

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_IBL_BIND_GROUP_LAYOUT_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-bind-group-layout`,
`standard-material-ibl-shadow-binding-readiness`, diffuse IBL texture/sampler
resource reports, and
`docs/research/STANDARD_MATERIAL_IBL_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`.

Acceptance criteria:

- Define a JSON-safe StandardMaterial IBL bind-group layout plan for diffuse
  irradiance texture, specular prefilter texture, and IBL sampler slots.
- Validate required/optional binding metadata without creating bind groups or
  changing WGSL.
- GLTF scene status reports the IBL layout plan as planned/deferred beside the
  existing shader-binding and pipeline-key readiness reports.

### task-1838 — Integrate IBL resources with the WebGPU app cache

Status: completed 2026-05-19 as a cache-path plan. See
`docs/research/IBL_WEBGPU_APP_CACHE_INTEGRATION_PLAN_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path if needed.
Reference anchor:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`,
`packages/webgpu/src/webgpu/ibl-texture-resource.ts`,
`packages/webgpu/src/webgpu/ibl-sampler-resource.ts`, and
`docs/research/LIVE_IBL_RESOURCE_CACHE_DIRECTION_AUDIT_2026_05_19.md`.

Acceptance criteria:

- Add or plan a renderer-owned app cache path for environment-derived diffuse
  IBL texture and IBL sampler resources using stable environment resource keys.
- Report IBL texture/sampler reuse through JSON-safe app diagnostics or a
  focused cache summary.
- Keep example-level module-scope caching out of the long-term frame-loop path.

### task-1839 — Plan first shadow matrix upload resource slice

Status: completed 2026-05-19. See
`docs/research/FIRST_SHADOW_MATRIX_UPLOAD_RESOURCE_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `directional-shadow-view-projection-plan`,
`shadow-matrix-buffer-descriptor`, `shadow-depth-texture-resource`, and
`references/engine/src/scene/renderer/render-pass-shadow-directional.js`.

Acceptance criteria:

- Compare matrix computation, matrix buffer allocation/upload, and pass
  descriptor integration as next shadow steps.
- Select one focused implementation task with acceptance criteria.
- Keep shadow pass command encoding and StandardMaterial shadow sampling
  deferred unless selected explicitly.

### task-1840 — Audit GLTF status grouping after IBL layout metadata

Status: completed 2026-05-19. See
`docs/research/GLTF_STATUS_GROUPING_AFTER_IBL_LAYOUT_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, GLTF scene status/tests only for tiny corrective fixes.
Reference anchor:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
`docs/research/GLTF_LIVE_RESOURCE_STATUS_GROWTH_AUDIT_2026_05_19.md`, and
Decision 0009.

Acceptance criteria:

- Confirm GLTF status remains navigable after the IBL layout metadata report.
- Identify detailed fields that can be replaced by compact summaries without
  losing test coverage.
- Add one focused cleanup task if status grouping needs implementation.

### task-1841 — Plan StandardMaterial shadow bind-group layout slice

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_SHADOW_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `shadow-depth-texture-resource`, `shadow-depth-resource-summary`,
`standard-material-ibl-shadow-binding-readiness`,
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`,
and `references/three.js/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js`.

Acceptance criteria:

- Compare shadow map texture/sampler layout metadata, shadow matrix buffer
  binding metadata, and shader sampling as candidate next steps.
- Select one implementation task with acceptance criteria and validation.
- Keep actual shadow pass submission deferred unless prerequisites are ready.

### task-1842 — Compute directional shadow view-projection matrices

Status: completed 2026-05-19. See
`docs/research/DIRECTIONAL_SHADOW_MATRIX_COMPUTATION_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `directional-shadow-view-projection-plan`,
`shadow-matrix-buffer-descriptor`, `@aperture-engine/simulation` math helpers,
and
`docs/research/FIRST_SHADOW_MATRIX_UPLOAD_RESOURCE_SLICE_PLAN_2026_05_19.md`.

Acceptance criteria:

- Compute deterministic directional shadow view, projection, and
  view-projection matrix arrays for the single directional shadow-map path.
- Keep matrix data JSON-safe and renderer-derived from extracted light/pass
  data.
- GLTF scene status distinguishes computed matrices from deferred GPU buffer
  allocation/upload and shadow pass submission.

### task-1843 — Add StandardMaterial shadow bind-group layout metadata

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_SHADOW_BIND_GROUP_LAYOUT_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `shadow-depth-texture-resource`, `shadow-matrix-buffer-descriptor`,
`standard-material-ibl-bind-group-layout`, and
`docs/research/STANDARD_MATERIAL_SHADOW_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`.

Acceptance criteria:

- Define JSON-safe StandardMaterial shadow bind-group layout metadata for a
  matrix buffer, shadow depth texture, and comparison sampler.
- Validate binding metadata without creating bind groups or changing WGSL.
- GLTF scene status reports shadow layout metadata as planned/deferred beside
  existing shadow depth and command summaries.

### task-1844 — Plan IBL bind-group resource descriptor slice

Status: completed 2026-05-19. See
`docs/research/IBL_BIND_GROUP_RESOURCE_DESCRIPTOR_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `standard-material-ibl-bind-group-layout`,
`diffuse-ibl-resource-summary`,
`IBL_WEBGPU_APP_CACHE_INTEGRATION_PLAN_2026_05_19.md`, and app texture/sampler
resource helpers.

Acceptance criteria:

- Compare IBL bind-group descriptor planning, app-cache integration, and
  specular prefilter allocation as candidate next steps.
- Select one implementation task with acceptance criteria.
- Keep WGSL IBL sampling deferred unless prerequisites are selected.

### task-1845 — Audit IBL/shadow layout metadata boundaries

Status: completed 2026-05-19. See
`docs/research/IBL_SHADOW_LAYOUT_METADATA_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, package files only for tiny corrective fixes.
Reference anchor:
`standard-material-ibl-bind-group-layout`, the planned shadow layout metadata,
`docs/ARCHITECTURE.md`, and Decision 0009.

Acceptance criteria:

- Confirm layout metadata remains descriptor-only and does not smuggle live GPU
  resources into JSON or ECS state.
- Confirm group/binding choices do not conflict with existing view, transform,
  material, and light groups.
- Recommend the next resource creation or shader binding task.

### task-1846 — Plan GLTF status compaction after matrix computation

Status: completed 2026-05-19. See
`docs/research/GLTF_STATUS_COMPACTION_AFTER_MATRIX_COMPUTATION_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
`GLTF_STATUS_GROUPING_AFTER_IBL_LAYOUT_AUDIT_2026_05_19.md`, and the
directional shadow matrix computation result.

Acceptance criteria:

- Identify duplicated GLTF status sections after computed shadow matrices land.
- Select one low-risk compaction or assertion cleanup task if needed.
- Preserve detailed status for active IBL/shadow contracts that still lack
  replacement summaries.

### task-1847 — Add StandardMaterial IBL bind-group descriptor planning

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_IBL_BIND_GROUP_DESCRIPTOR_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-material-ibl-bind-group-layout`, `standard-bind-group`,
`matcap-bind-group`, and
`docs/research/IBL_BIND_GROUP_RESOURCE_DESCRIPTOR_SLICE_PLAN_2026_05_19.md`.

Acceptance criteria:

- Add StandardMaterial IBL bind-group descriptor planning for group 4.
- Bindings match `standard-material-ibl-bind-group-layout.ts`.
- The plan reports diffuse texture and sampler keys when available.
- The plan reports a clear deferred/missing diagnostic for the specular
  prefilter texture key.
- GLTF scene status exposes the descriptor plan beside the layout metadata.
- No live bind-group creation and no WGSL sampling changes.

### task-1848 — Plan specular IBL resource allocation slice

Status: completed 2026-05-19. See
`docs/research/SPECULAR_IBL_RESOURCE_ALLOCATION_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `ibl-texture-preparation`, `ibl-texture-resource`,
`standard-material-ibl-bind-group`,
`references/engine/src/scene/graphics/env-lighting.js`, and
`references/three.js/src/extras/PMREMGenerator.js`.

Acceptance criteria:

- Compare specular texture allocation, full prefilter pass execution, and app
  cache integration as next steps.
- Select one focused implementation task with acceptance criteria.
- Keep WGSL IBL sampling deferred unless prerequisites are selected.

### task-1849 — Allocate specular IBL texture resources

Status: completed 2026-05-19. See
`docs/research/SPECULAR_IBL_TEXTURE_RESOURCE_IMPLEMENTATION_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `ibl-texture-resource`, `standard-material-ibl-bind-group`,
`docs/research/SPECULAR_IBL_RESOURCE_ALLOCATION_SLICE_PLAN_2026_05_19.md`,
`references/engine/src/scene/graphics/env-lighting.js`, and
`references/three.js/src/extras/PMREMGenerator.js`.

Acceptance criteria:

- Add a `SpecularIblTextureResourceReport` with JSON helpers.
- Allocate only specular IBL texture/view resources from planned specular slots.
- Report created texture count, resource keys, mip count, and deferred prefilter
  upload/pass state.
- Update GLTF scene status/readiness with `ibl.specularTextureResource`.
- Keep prefilter shader/pass execution, bind-group creation, and WGSL sampling
  deferred.

### task-1850 — Integrate IBL resources with the WebGPU app cache

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/app-environment-resources.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`,
`packages/webgpu/src/webgpu/ibl-texture-resource.ts`,
`packages/webgpu/src/webgpu/ibl-sampler-resource.ts`, and
`docs/research/IBL_WEBGPU_APP_CACHE_INTEGRATION_PLAN_2026_05_19.md`.

Acceptance criteria:

- Add an internal renderer-owned environment resource cache for diffuse IBL
  textures, specular IBL textures, and IBL samplers.
- Teach IBL texture/sampler resource helpers or a small adapter to report
  created/reused counts without exposing raw GPU handles.
- Replace GLTF scene module-scope `??=` IBL resource caching with app-owned
  cache state.
- Keep public app APIs, live bind-group creation, and WGSL sampling deferred.

### task-1851 — Create live StandardMaterial IBL bind-group resources

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-material-ibl-bind-group`, `standard-bind-group`,
`bind-group-layout-cache`, and app resource-cache helpers.

Acceptance criteria:

- Create live group 4 bind groups from valid IBL descriptor plans and layout
  resources.
- Report created/reused bind-group counts with JSON-safe diagnostics.
- GLTF scene status distinguishes valid descriptor plans from live bind-group
  creation.
- Keep WGSL IBL sampling deferred unless explicitly selected.

### task-1852 — Plan shadow matrix buffer upload resources

Status: completed 2026-05-19. See
`docs/research/SHADOW_MATRIX_BUFFER_UPLOAD_RESOURCE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `directional-shadow-matrix-computation`,
`shadow-matrix-buffer-descriptor`, `shadow-depth-texture-resource`,
`standard-material-shadow-bind-group-layout`, and shadow pass planning helpers.

Acceptance criteria:

- Compare shadow matrix buffer allocation/upload, shadow bind-group descriptor
  planning, and shadow pass command encoding as next steps.
- Select one focused implementation task with acceptance criteria.
- Keep shadow shader sampling deferred unless prerequisites are selected.

### task-1853 — Allocate shadow matrix buffer resources

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-matrix-buffer-resource.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `directional-shadow-matrix-computation`,
`shadow-matrix-buffer-descriptor`, `buffer`, and
`standard-material-shadow-bind-group-layout` helpers.

Acceptance criteria:

- Add a `ShadowMatrixBufferResourceReport` with JSON helpers.
- Pack computed directional shadow view-projection matrices into a contiguous
  `Float32Array` using descriptor offsets.
- Allocate/upload a renderer-owned storage buffer from the packed data and
  report created/reused counts without exposing raw GPU handles.
- Update GLTF scene status/readiness with `shadow.matrixBufferResource`.
- Keep shadow bind-group creation, shadow pass submission, and shader sampling
  deferred.

### task-1854 — Plan StandardMaterial shadow bind-group resources

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_SHADOW_BIND_GROUP_RESOURCE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `standard-material-shadow-bind-group-layout`,
`shadow-matrix-buffer-resource`, `shadow-depth-texture-resource`,
`shadow-pass-plan`, and `standard-material-ibl-bind-group` helpers.

Acceptance criteria:

- Compare shadow bind-group descriptor planning, live shadow bind-group
  creation, and first shadow pass command encoding.
- Select one focused implementation task with acceptance criteria.
- Keep shadow shader sampling deferred unless prerequisites are selected.

### task-1855 — Create StandardMaterial shadow bind-group descriptor plans

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/standard-material-shadow-bind-group.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-material-shadow-bind-group-layout`,
`shadow-matrix-buffer-resource`, `shadow-depth-texture-resource`, and
`standard-material-ibl-bind-group`.

Acceptance criteria:

- Add JSON-safe group 5 descriptor planning for shadow matrix buffer, shadow
  depth texture view, and shadow sampler resources.
- Report missing matrix/depth/sampler resources with stable diagnostics.
- Expose `shadow.bindGroupDescriptor` in the GLTF scene status.
- Keep live shadow bind-group creation and shader sampling deferred.

### task-1856 — Create live StandardMaterial shadow bind-group resources

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/standard-material-shadow-bind-group.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-material-shadow-bind-group-layout`, planned shadow group 5
descriptor helpers, `standard-material-ibl-bind-group`, and WebGPU resource
cache helpers.

Acceptance criteria:

- Create live group 5 shadow bind groups from valid descriptor plans and layout
  resources.
- Report created/reused bind-group counts with JSON-safe diagnostics.
- GLTF scene status distinguishes descriptor plans from live group 5 resources.
- Keep shadow pass submission and shader sampling deferred.

### task-1857 — Plan first shadow-map pass command encoding

Status: completed 2026-05-19. See
`docs/research/FIRST_SHADOW_PASS_COMMAND_ENCODING_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local `shadow-pass-plan`, `shadow-caster-draw-list-plan`,
`shadow-caster-command-plan-readiness`, `render-pass-command-executor`, and
reference shadow pass patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Compare depth-only pipeline selection, command encoding, and pass submission
  as next steps.
- Select one focused implementation task with acceptance criteria.
- Keep StandardMaterial shadow sampling deferred unless prerequisites are
  selected.

### task-1858 — Audit GLTF IBL/shadow live-resource boundary

Status: completed 2026-05-19. See
`docs/research/GLTF_IBL_SHADOW_LIVE_RESOURCE_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a small corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
GLTF scene status, IBL app cache, IBL bind-group resource, and shadow matrix
buffer resource helpers.

Acceptance criteria:

- Confirm live IBL and shadow resources remain renderer-owned and JSON-safe.
- Confirm ECS snapshots still carry stable handles/packets, not GPU handles.
- Check public tracker/backlog alignment and recommend the next implementation
  slice.

### task-1859 — Add shadow pass command encoding report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-pass-command-encoding-report.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
`docs/research/FIRST_SHADOW_PASS_COMMAND_ENCODING_PLAN_2026_05_19.md`,
local `shadow-pass-plan`, `shadow-caster-draw-list-plan`,
`shadow-caster-command-plan-readiness`, `shadow-depth-texture-resource`,
`shadow-matrix-buffer-resource`, and `render-pass-command-executor` helpers.

Acceptance criteria:

- Add a JSON-safe `ShadowPassCommandEncodingReport` over existing shadow pass
  plans, depth texture resources, shadow matrix buffer resources, caster draw
  lists, and command plans.
- Report one command-encoding record per pass when prerequisites are available.
- Report missing depth views, matrix buffers, caster lists, and command plans
  with stable diagnostics.
- Expose the report in the GLTF scene status/readiness while keeping
  StandardMaterial shadow sampling deferred.

### task-1860 — Audit shadow pass command-encoding boundary

Status: completed 2026-05-19. See
`docs/research/SHADOW_PASS_COMMAND_ENCODING_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a small corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`packages/webgpu/src/webgpu/shadow-pass-command-encoding-report.ts`,
`packages/webgpu/src/webgpu/shadow-caster-command-plan-readiness.ts`,
`packages/webgpu/src/webgpu/render-pass-command-executor.ts`, and reference
shadow-pass patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Confirm the command-encoding report remains JSON-safe and renderer-owned.
- Confirm it does not imply ECS owns GPU state or that shadow sampling is live.
- Recommend the next implementation slice and update tracker/backlog wording if
  needed.

### task-1861 — Add depth-only shadow caster pipeline descriptor metadata

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-caster-pipeline-descriptor.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path if useful.
Reference anchor:
local `standard-pipeline-descriptor`, `unlit-pipeline-descriptor`,
`shadow-pass-command-encoding-report`, `shadow-caster-command-plan-readiness`,
`references/engine/src/scene/renderer/shadow-renderer.js`, and
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Add JSON-safe descriptor metadata for the first depth-only directional shadow
  caster pipeline.
- Report required vertex buffer, index buffer, matrix buffer, depth format, and
  cull/depth state fields.
- Keep actual pipeline creation, pass submission, and StandardMaterial shadow
  sampling deferred.

### task-1862 — Add shadow pass attachment descriptor report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-pass-attachment-descriptor.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `shadow-pass-plan`, `shadow-depth-texture-resource`,
`render-pass-attachments`, `render-pass-lifecycle`, and reference shadow pass
attachment setup in `references/engine` and `references/three.js`.

Acceptance criteria:

- Add a JSON-safe report that maps planned shadow passes to depth attachment
  descriptors using live shadow depth texture views.
- Report missing depth views with stable diagnostics.
- Keep command encoder execution, pass submission, and shader sampling deferred.

### task-1863 — Add shadow caster frame-resource readiness report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-caster-frame-resource-readiness.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `render-pass-resources`, `queued-built-in-frame-resource-set`,
`shadow-caster-draw-list-plan`, and reference shadow caster resource binding in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Summarize which caster draw records have prepared mesh buffers, matrix buffer
  resource access, and a selected depth-only pipeline descriptor.
- Report missing mesh buffers, pipeline metadata, or matrix buffer resources
  with stable JSON-safe diagnostics.
- Keep draw command execution and pass submission deferred.

### task-1864 — Plan first live shadow pass encoder integration

Status: completed 2026-05-19. See
`docs/research/FIRST_LIVE_SHADOW_PASS_ENCODER_INTEGRATION_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope:
`docs/research`, backlog only.
Reference anchor:
local shadow command-encoding, attachment, pipeline-descriptor, frame-resource,
and render-pass command execution helpers, plus reference shadow pass execution
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Compare encoder integration, command-buffer submission, and shader sampling
  as follow-up candidates.
- Select exactly one implementation slice with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1865 — Add shadow pass encoder assembly report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-pass-encoder-assembly-report.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `frame-boundary`, `render-pass-lifecycle`, `render-pass-command-executor`,
`shadow-pass-attachment-descriptor`, `shadow-caster-frame-resource-readiness`,
and reference shadow pass execution patterns in `references/engine` and
`references/three.js`.

Acceptance criteria:

- Add a JSON-safe report for beginning planned shadow depth passes, executing
  prepared caster command records against a pass-like encoder, and ending the
  passes.
- Reuse existing render-pass lifecycle and command executor helpers where
  practical.
- Report missing attachment descriptors, frame resources, pass encoder methods,
  or command records with stable diagnostics.
- Keep command-buffer finish, queue submission, and StandardMaterial shadow
  shader sampling deferred.

### task-1866 — Add executable shadow caster command record planning

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-caster-command-record-plan.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `render-pass-commands`, `render-pass-command-executor`,
`shadow-caster-frame-resource-readiness`, and shadow pass command assembly
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Add a typed plan that maps ready shadow caster frame-resource records into
  executable `RenderPassCommand` records or stable missing-resource diagnostics.
- Preserve JSON-safe reporting of pipeline, bind-group, vertex-buffer,
  index-buffer, and draw command keys without exposing raw GPU handles.
- Expose command-record readiness in the GLTF scene status.
- Keep live command-buffer finish, queue submission, and shader sampling
  deferred.

### task-1867 — Add live depth-only shadow caster pipeline resource report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-caster-pipeline-resource.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local pipeline cache/resource helpers, `shadow-caster-pipeline-descriptor`, and
reference shadow pipeline setup in `references/engine` and `references/three.js`.

Acceptance criteria:

- Create or reuse a renderer-owned depth-only shadow caster pipeline resource
  from the descriptor metadata.
- Report created/reused pipeline counts and stable pipeline resource keys.
- Keep command-buffer finish, queue submission, and shader sampling deferred.

### task-1868 — Add shadow caster matrix bind-group resource report

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/shadow-caster-matrix-bind-group-resource.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local bind-group helpers, `shadow-matrix-buffer-resource`,
`shadow-caster-pipeline-descriptor`, and reference shadow matrix binding
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Create or reuse a renderer-owned bind group for the shadow caster matrix
  buffer layout.
- Report stable bind-group resource keys and created/reused counts.
- Keep StandardMaterial receiver shadow sampling separate from caster pass
  binding.

### task-1869 — Integrate shadow encoder assembly with executable commands

Status: completed 2026-05-19. See `examples/gltf-scene.js` and
`test/e2e/gltf-scene.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, e2e status expectations.
Reference anchor:
local `shadow-pass-encoder-assembly-report`, executable command record plan,
pipeline resource report, matrix bind-group resource report, and
`frame-boundary`.

Acceptance criteria:

- Feed executable shadow caster command records into the shadow encoder assembly
  report for the GLTF scene status.
- Report begun/executed/ended shadow passes with nonzero command and draw
  counts.
- Keep command-buffer finish, queue submission, and shader sampling deferred
  until a follow-up task.

### task-1870 — Audit live shadow encoder assembly boundary

Status: completed 2026-05-19. See
`docs/research/LIVE_SHADOW_ENCODER_ASSEMBLY_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a small corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, live shadow
encoder assembly reports, and reference shadow pass patterns.

Acceptance criteria:

- Confirm live shadow encoder assembly remains renderer-owned and ECS-derived.
- Confirm JSON status omits raw GPU handles and does not imply submitted shadow
  maps or receiver shader sampling.
- Recommend the next implementation slice.

### task-1871 — Add shadow pass command-buffer submission report

Status: completed 2026-05-19.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local `shadow-pass-encoder-assembly-report`, `frame-boundary`,
`render-pass-resources`, and shadow submission patterns in
`references/engine/src/scene/renderer/render-pass-shadow-directional.js` and
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Add a JSON-safe report that can finish an assembled shadow command encoder and
  optionally submit the resulting command buffer through an injected queue.
- Report finished/submitted command-buffer counts, deferred-submission
  diagnostics, and stable command-buffer keys without exposing raw GPU handles.
- Wire the GLTF scene status to show the first shadow command buffer is ready or
  submitted while keeping receiver shader sampling deferred.
- Cover missing encoder assembly, missing command encoder finish, missing queue,
  and successful finish/submit paths with targeted tests.

### task-1872 — Audit shadow pass submission boundary

Status: completed 2026-05-19. See
`docs/research/SHADOW_PASS_SUBMISSION_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a small corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, the shadow
submission report, and local render pass/frame-boundary helpers.

Acceptance criteria:

- Confirm submitted shadow command buffers remain renderer-owned derived state,
  not ECS or scene-graph state.
- Confirm JSON diagnostics do not expose raw GPU handles and clearly separate
  caster pass submission from receiver material sampling.
- Recommend whether the next implementation slice should be receiver sampling
  readiness, shader binding, or submission hardening.

### task-1873 — Plan StandardMaterial shadow receiver sampling readiness

Status: completed 2026-05-19. See
`docs/research/STANDARD_MATERIAL_SHADOW_RECEIVER_SAMPLING_READINESS_PLAN_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`docs/research`, `packages/webgpu` only if a tiny diagnostic correction is
needed.
Reference anchor:
local StandardMaterial WGSL/pipeline-key readiness, StandardMaterial shadow
bind-group resources, and receiver shadow sampling patterns in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Compare at least two receiver-side shadow sampling implementation slices.
- Select one narrow next task that preserves the existing ECS/render extraction
  boundary and WebGPU-only ownership.
- Identify shader inputs, bind groups, diagnostics, and e2e proof needed for the
  selected slice.

### task-1874 — Add StandardMaterial shadow receiver binding readiness

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/standard-material-shadow-receiver-binding-readiness.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local StandardMaterial WGSL/pipeline-key readiness, StandardMaterial shadow
bind-group resources, and receiver shadow sampling patterns in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Add a JSON-safe receiver binding readiness report proving StandardMaterial
  access to the matrix buffer, depth view, sampler, group 5 bind group, and
  command-buffer readiness status.
- Expose receiver binding readiness in the GLTF scene status and grouped shadow
  readiness phases.
- Keep WGSL receiver shadow sampling and visible shadow pixel proof deferred.

### task-1875 — Plan minimal StandardMaterial shadow shader sampling

Status: completed 2026-05-19. See
`docs/research/MINIMAL_STANDARD_MATERIAL_SHADOW_SHADER_SAMPLING_PLAN_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`docs/research`, `packages/webgpu` only if a tiny diagnostic correction is
needed.
Reference anchor:
local StandardMaterial WGSL/pipeline descriptors, receiver binding readiness,
and receiver shadow sampling patterns in `references/engine` and
`references/three.js`.

Acceptance criteria:

- Compare at least two minimal WGSL receiver shadow sampling slices.
- Select one narrow shader/resource task that uses the existing group 5 shadow
  binding and finished shadow command buffer.
- Identify deterministic e2e proof requirements before visible shadow pixels.

### task-1876 — Implement minimal receiver shadow factor

Status: completed 2026-05-19. See `packages/webgpu/src/webgpu/standard-shader.ts`
and `test/webgpu/standard-shader.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local StandardMaterial shadow group 5 bind-group resources, pipeline-key
readiness, WGSL shader modules, and receiver binding patterns in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Thread the live shadow matrix buffer, shadow depth texture view, and shadow
  sampler into the StandardMaterial receiver shader path.
- Add a minimal deterministic shadow factor while preserving existing
  non-shadow StandardMaterial behavior.
- Report shader shadow sampling readiness with stable resource keys and no raw
  GPU handles in JSON.
- Keep visible pixel proof focused and covered by targeted tests before the
  follow-up browser readback task.

### task-1879 — Rework shadow receiver bindings for maxBindGroups

Status: completed 2026-05-19. See `packages/webgpu/src/webgpu/standard-shader.ts`
and `test/webgpu/standard-shader.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local WebGPU app frame-resource orchestration, StandardMaterial light/material
bind groups, shadow command-buffer submission, receiver resource layout patterns
in `references/engine` and `references/three.js`, and browser WebGPU
`maxBindGroups` limits.

Acceptance criteria:

- Choose and implement a receiver resource layout that fits browser
  `maxBindGroups: 4` by using only bind groups `0` through `3`.
- Update the StandardMaterial shadow shader metadata, pipeline descriptor tests,
  and draw-list required bind groups so browser-created render pipelines do not
  exceed the device bind-group limit.
- Keep receiver resources renderer-owned and JSON-safe; do not place GPU handles
  in ECS snapshots or public status JSON.
- Preserve non-shadow StandardMaterial behavior and existing GLTF scene browser
  pixels while keeping live receiver sampling deferred until the next proof
  task.

### task-1880 — Create combined light/shadow group 3 resources

Status: completed 2026-05-19. See
`packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local StandardMaterial light bind-group resources, shadow receiver bindings,
pipeline layout/cache metadata, and combined light/shadow binding patterns in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Add a renderer-owned combined StandardMaterial group 3 bind group layout and
  bind group resource containing light floats, light metadata, shadow matrices,
  shadow depth texture view, and shadow comparison sampler.
- Preserve JSON-safe status output and do not expose raw GPU handles through ECS
  snapshots or public diagnostics.
- Keep the GLTF scene browser fixture rendering with no WebGPU validation
  warnings.

### task-1881 — Route combined light/shadow group 3 resources through app

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, targeted tests, e2e status
expectations.
Reference anchor:
local StandardMaterial app frame resources, queued built-in app route
collection, pipeline-scoped bind group selection, shadow command-buffer
submission, and receiver pass ordering patterns in `references/engine` and
`references/three.js`.

Acceptance criteria:

- Route `standard|shadowMap|...` draws to the combined group 3 light/shadow bind
  group only when all receiver resources are ready.
- Keep non-shadow StandardMaterial draws on the existing light group.
- Submit or schedule the GLTF shadow command buffer before the forward
  StandardMaterial pass that samples it.
- Preserve JSON-safe status output and existing GLTF scene browser pixels with
  no WebGPU validation warnings.

### task-1877 — Verify first visible receiver shadow pixels

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`examples/gltf-scene.js`, `test/e2e`, and focused WebGPU shader/resource code
only as needed.
Reference anchor:
local GLTF scene fixture, WebGPU readback helpers, and shadow receiver proof
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Add or update a GLTF scene browser proof that shows a deterministic receiver
  shadow difference with WebGPU readback or screenshot sampling.
- Keep diagnostics JSON-safe and explain whether the shadow pass was submitted
  and sampled.
- Preserve existing non-shadow GLTF scene expectations.

### task-1878 — Audit receiver shadow sampling boundary

Status: completed 2026-05-19. See
`docs/research/RECEIVER_SHADOW_SAMPLING_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, targeted tests only if a small corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
StandardMaterial shadow receiver resources, and relevant WebGPU reference
receiver-shadow patterns.

Acceptance criteria:

- Confirm receiver shadow sampling remains renderer-owned derived state and does
  not introduce scene-graph authority.
- Confirm submitted shadow maps, bind groups, and shader diagnostics stay
  JSON-safe.
- Recommend the next narrow shadow or GLTF fidelity task.

### task-1882 — Refine receiver shadow projection and bias

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and targeted shader tests.
Reference anchor:
StandardMaterial shadow receiver shader, GLTF scene shadow pass resources,
`references/engine/src/scene/renderer/shadow-renderer.js`, and
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Replace the current conservative receiver shadow term with a localized depth
  compare result that produces a deterministic caster/receiver pixel difference.
- Keep the existing browser-safe group 3 light/shadow bind group layout and app
  routing contract.
- Preserve JSON-safe diagnostics and the Playwright receiver-sampling-disabled
  versus enabled proof with no WebGPU validation warnings.

### task-1883 — Audit receiver shadow projection proof quality

Status: completed 2026-05-19. See
`docs/research/RECEIVER_SHADOW_PROJECTION_PROOF_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, and targeted tests only if a small
corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, StandardMaterial shadow receiver
shader/resource code, the GLTF scene e2e proof, and receiver shadow sampling
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Confirm the refined receiver shadow proof remains renderer-owned derived
  state and does not leak GPU handles into ECS or public JSON.
- Identify the remaining gap between the projected receiver envelope and a
  strict caster-depth-only shadow result.
- Recommend one narrow follow-up with acceptance criteria for improving shadow
  quality or debug visibility.

### task-1884 — Add receiver projection debug/status proof

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and targeted tests/docs as needed.
Reference anchor:
StandardMaterial receiver shadow shader, GLTF scene e2e status/readback helpers,
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`,
and `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Add JSON-safe diagnostics or a test-only visual/debug mode proving receiver
  and caster coverage in shadow projection space.
- Keep the combined group 3 light/shadow bind group and app route unchanged.
- Identify the projected receiver envelope as the remaining shader-quality gap
  and keep reduction/removal scoped to the follow-up task.
- Preserve no WebGPU validation warnings in the GLTF Playwright fixture.

### task-1885 — Tighten receiver envelope using projection coverage status

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and targeted shader/e2e tests.
Reference anchor:
`docs/research/RECEIVER_SHADOW_PROJECTION_PROOF_AUDIT_2026_05_19.md`, the
GLTF `shadow.projectionCoverage` status, StandardMaterial receiver WGSL, and
receiver shadow sampling patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Use the JSON-safe projection coverage records to choose a deterministic
  receiver/caster sample region for the GLTF shadow proof.
- Reduce the projected receiver envelope constants or replace part of the
  envelope with stricter depth-compare behavior.
- Preserve the combined group 3 route and no WebGPU validation warnings.
- Keep the disabled-versus-enabled Playwright receiver pixel proof stable.

### task-1886 — Replace remaining receiver envelope with caster-depth proof

Status: completed 2026-05-19. See
`docs/research/RECEIVER_SHADOW_STRICT_CASTER_DEPTH_BLOCKER_2026_05_19.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, and targeted shader/e2e tests.
Reference anchor:
GLTF `shadow.projectionCoverage` records, StandardMaterial receiver WGSL, shadow
depth texture submission path, and receiver shadow sampling patterns in
`references/engine` and `references/three.js`.

Acceptance criteria:

- Use projection coverage records to select or compute receiver/caster proof
  samples that are covered by the submitted shadow depth map.
- Replace the remaining projected envelope influence with a stricter
  depth-compare-driven receiver result, or document the exact missing depth
  evidence if this is blocked.
- Preserve the combined group 3 route, submitted shadow command buffer, and no
  WebGPU validation warnings.
- Keep the disabled-versus-enabled Playwright receiver pixel proof stable.

### task-1887 — Add shadow depth probe evidence for projection samples

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`, and targeted WebGPU
helpers/tests if needed.
Reference anchor:
`docs/research/RECEIVER_SHADOW_STRICT_CASTER_DEPTH_BLOCKER_2026_05_19.md`,
GLTF `shadow.projectionCoverage` records, submitted shadow depth texture
resources, and receiver shadow debug/readback patterns in `references/engine`
and `references/three.js`.

Acceptance criteria:

- Add JSON-safe `shadow.depthProbe` or equivalent debug proof keyed by the
  existing projection coverage records.
- Report receiver compare depth, sampled depth or compare result, and expected
  lit/shadowed classification without exposing raw GPU handles.
- Use the probe to identify at least one deterministic receiver/caster pair for
  strict shadow comparison.
- Preserve the combined group 3 route and no WebGPU validation warnings.

### task-1888 — Add visible strict receiver/caster shadow fixture

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`, and targeted shader/e2e
tests.
Reference anchor:
GLTF `shadow.depthProbe` strict pair records, StandardMaterial receiver WGSL,
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`,
and `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Add or adjust a small GLTF scene receiver sample/primitive so a visible
  StandardMaterial receiver pixel overlaps the probed caster footprint.
- Replace the remaining projected receiver envelope influence with strict
  depth-compare-driven receiver behavior for that visible proof.
- Playwright verifies the strict receiver/caster pair remains reported in
  `shadow.depthProbe` and the enabled-versus-disabled receiver pixel proof
  remains stable.
- Preserve the combined group 3 route and no WebGPU validation warnings.

### task-1889 — Audit strict receiver shadow proof

Status: completed 2026-05-19. See
`docs/research/STRICT_RECEIVER_SHADOW_PROOF_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, and tracker docs only.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, GLTF `shadow.depthProbe`
records, StandardMaterial receiver WGSL, and the strict receiver Playwright
proof.

Acceptance criteria:

- Confirm the strict receiver proof remains ECS-derived, renderer-owned,
  WebGPU-only, and JSON-safe.
- Confirm the projected receiver envelope was removed rather than hidden behind
  another fallback term.
- Recommend the next concrete IBL or shadow quality task with category,
  package/write-scope, reference anchor, and acceptance criteria.
- Run `pnpm run check:progress` if tracker pages change.

### task-1890 — Route StandardMaterial IBL group 4 through app

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`,
and targeted WebGPU tests.
Reference anchor:
local `standard-material-ibl-bind-group`, `standard-app-frame-resources`,
`built-in-material-app-resource-adapter`, strict shadow group 3 routing, and
Bevy/engine material resource binding patterns conceptually.

Acceptance criteria:

- Route ready StandardMaterial IBL group 4 resources through the app
  frame-resource/draw-list path without exposing raw GPU handles in JSON.
- GLTF status reports the route as ready when diffuse/specular IBL texture
  resources and IBL sampler resources are available.
- Preserve existing shadow group 3 routing, strict receiver pixel proof, and no
  WebGPU validation warnings.
- Keep actual IBL shader lighting contribution deferred to the next slice.

### task-1891 — Decide executable StandardMaterial IBL bind-group layout

Status: completed 2026-05-19. See
`docs/research/STANDARD_IBL_SHADER_BIND_GROUP_LIMIT_AUDIT_2026_05_19.md` and
`docs/DECISIONS.md` decision 0013.

Category: `audit-refactor`
Package/write-scope:
`docs/research`, `agent/BACKLOG.md`, and decision docs if a new architecture
choice is made.
Reference anchor:
local StandardMaterial group 4 app route from `task-1890`, local
`standard-material-ibl-bind-group` layout metadata, strict shadow group 3
routing, `docs/research/STANDARD_IBL_SHADER_BIND_GROUP_LIMIT_AUDIT_2026_05_19.md`,
and diffuse/environment lighting patterns in `references/engine` and
`references/three.js`.

Acceptance criteria:

- Decide whether executable IBL resources should extend combined group 3, merge
  into group 2, or use a gated high-bind-group variant.
- Document why the selected layout fits Chrome's `maxBindGroups: 4` browser
  proof and the ECS/render ownership boundary.
- Update the follow-up shader task so it does not require executable WGSL
  `@group(4)` on browsers limited to four bind groups.
- Preserve the existing JSON-safe group 4 app-frame route as a planning/resource
  identity unless a decision explicitly replaces it.

### task-1892 — Add first StandardMaterial diffuse IBL shader contribution

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-pipeline*`,
`examples/gltf-scene.js`, `test/webgpu`, and
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
Decision 0013's combined group 3 executable IBL layout, local
StandardMaterial group 4 app-frame route from `task-1890`, strict shadow group 3
routing,
`docs/research/STANDARD_DIFFUSE_IBL_SHADER_IMPLEMENTATION_PLAN_2026_05_19.md`,
and diffuse/environment lighting patterns in `references/engine` and
`references/three.js`.

Acceptance criteria:

- Add WGSL bindings for StandardMaterial diffuse IBL sampling using the
  browser-safe executable group 3 layout selected by Decision 0013.
- Include the executable IBL resources only for the IBL shader-capable
  StandardMaterial pipeline variant.
- GLTF Playwright proves a stable visible pixel difference from diffuse IBL
  contribution while preserving strict shadow receiver proof and no validation
  warnings.
- Keep specular prefilter and full PBR IBL contribution deferred.

### task-1893 — Audit IBL/shadow route ownership after diffuse IBL proof

Status: completed 2026-05-19. See
`docs/research/DIFFUSE_IBL_ROUTE_OWNERSHIP_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`; targeted tests only
if a tiny corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`docs/research/STANDARD_DIFFUSE_IBL_SHADER_IMPLEMENTATION_PLAN_2026_05_19.md`,
the `task-1892` implementation, and the relevant Bevy/render bridge ownership
constraints.

Acceptance criteria:

- Confirm the diffuse IBL executable group 3 bridge keeps ECS authoritative and
  GPU resources renderer-owned.
- Confirm group 4 remains only a JSON-safe planning/resource identity and is
  not bound by executable draw commands.
- Confirm the combined `iblDiffuse|shadowMap` route preserves strict shadow
  receiver proof and browser `maxBindGroups: 4` compatibility.
- Recommend exactly one next implementation slice for the glTF scene track.

### task-1894 — Audit specular IBL contract before shader sampling

Status: completed 2026-05-19. See
`docs/research/SPECULAR_IBL_CONTRACT_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`; targeted tests only
if a tiny corrective fix is required.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`,
`docs/research/DIFFUSE_IBL_ROUTE_OWNERSHIP_AUDIT_2026_05_19.md`,
`packages/webgpu/src/webgpu/ibl-texture-resource.ts`,
`packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`, and
environment/specular patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Decide whether the current specular IBL texture resource is sufficient for a
  narrow shader proof or whether a minimal renderer-owned prefilter/upload step
  must come first.
- Preserve the ECS/render ownership boundary and JSON-safe group 4 planning
  identity.
- Identify the exact pipeline-key, bind-group, WGSL, and Playwright proof
  requirements for the next implementation slice.
- Recommend exactly one follow-up task.

### task-1895 — Add minimal specular IBL texture upload readiness

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/ibl-texture-resource.ts`,
`packages/webgpu/src/webgpu/diffuse-ibl-resource-summary.ts` if needed,
`examples/gltf-scene.js`, and targeted `test/webgpu`.
Reference anchor:
`docs/research/SPECULAR_IBL_CONTRACT_AUDIT_2026_05_19.md`,
`references/engine/src/scene/graphics/reproject-texture.js`, and
`references/three.js/src/extras/PMREMGenerator.js`.

Acceptance criteria:

- Specular IBL texture resource reports distinguish allocation from proof
  upload/prefilter readiness in JSON-safe diagnostics.
- When a WebGPU queue is available, the renderer uploads deterministic
  placeholder radiance to the specular cube texture and labels it as a narrow
  proof placeholder, not full PMREM/GGX readiness.
- GLTF status exposes the specular proof-upload state while keeping full
  specular prefilter and full PBR IBL deferred.
- Targeted tests cover upload/no-upload behavior and JSON safety.

### task-1896 — Plan first specular IBL shader-readiness slice

Status: completed 2026-05-19. See
`docs/research/SPECULAR_IBL_SHADER_READINESS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`; no implementation
unless a tiny test/documentation correction is required.
Reference anchor:
`docs/research/SPECULAR_IBL_CONTRACT_AUDIT_2026_05_19.md`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`,
`references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`,
and `references/three.js/src/extras/PMREMGenerator.js`.

Acceptance criteria:

- Select the exact shader token, group 3 binding additions, resource-report
  readiness gates, and Playwright proof for a placeholder specular IBL shader
  slice.
- State why the slice is not full PMREM/GGX IBL and which diagnostics must
  remain deferred.
- Preserve group 4 planning identity and executable browser groups 0 through 3.
- Recommend exactly one implementation task.

### task-1897 — Implement placeholder specular IBL shader proof

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`,
`examples/gltf-scene.js`, `test/webgpu`, and
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`docs/research/SPECULAR_IBL_SHADER_READINESS_PLAN_2026_05_19.md`,
PlayCanvas reflection/environment chunks, and three.js PMREM roughness sampling
direction.

Acceptance criteria:

- Add an `iblSpecularProof` StandardMaterial shader/pipeline token gated by
  diffuse IBL readiness and specular proof-upload readiness.
- Extend the executable group 3 IBL layout with binding 7 for the specular proof
  cube texture while keeping group 4 as planning identity only.
- Add a small Fresnel-weighted placeholder specular reflection term and keep
  full PMREM/GGX and split-sum BRDF diagnostics deferred.
- GLTF Playwright proves a visible pixel delta with specular proof sampling
  enabled, preserves strict shadow proof, and binds no executable group 4.

### task-1898 — Audit IBL material-fidelity diagnostics after specular proof

Status: completed 2026-05-19. See
`docs/research/IBL_MATERIAL_FIDELITY_DIAGNOSTICS_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and tracker docs;
targeted tests only if a tiny corrective fix is required.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `task-1897` implementation,
PlayCanvas reflection/prefilter references, and three.js PMREM references.

Acceptance criteria:

- Confirm diffuse plus placeholder specular IBL diagnostics do not overstate
  full PBR, PMREM, split-sum BRDF, or skybox readiness.
- Confirm group 4 remains planning-only and executable browser draws bind only
  groups 0 through 3.
- Confirm GLTF pixel proofs cover diffuse, placeholder specular, and strict
  shadow receiver behavior without WebGPU validation warnings.
- Recommend exactly one next implementation slice for the glTF scene track.

### task-1899 — Add minimal uncompressed GLB container fixture path

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `simulation`
Package/write-scope: `packages/render` or `packages/simulation` if the existing
asset/source helpers live there, `examples/gltf-scene.js`, targeted tests.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`, local glTF scene
fixture code, Bevy asset-loading concepts in `references/bevy`, and glTF 2.0
GLB container rules.

Acceptance criteria:

- Add a minimal GLB container parser/fixture helper for uncompressed JSON plus
  BIN chunks needed by the current scene contract.
- Feed the existing GLTF scene data contract from the fixture path without
  introducing a scene graph or renderer-owned ECS state.
- Unsupported GLB/chunk cases produce structured diagnostics.
- Tests cover valid fixture parsing and at least two invalid container cases.

### task-1900 — Audit GLB fixture path package boundary

Status: completed 2026-05-19. See
`docs/research/GLB_FIXTURE_PATH_BOUNDARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`, Bevy glTF loader buffer
loading pattern, and the `task-1899` helper.

Acceptance criteria:

- Confirm the GLB fixture helper stays renderer-independent and headless-safe.
- Confirm the helper does not introduce scene graph, ECS side effects, or WebGPU
  ownership.
- Confirm invalid GLB input stops before import stages with structured
  diagnostics.
- Recommend one next GLB fixture/source-status task.

### task-1901 — Add browser GLTF scene GLB fixture status

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`docs/research/GLB_FIXTURE_PATH_BOUNDARY_AUDIT_2026_05_19.md`, local GLTF scene
fixture code, and existing Playwright GLTF scene status assertions.

Acceptance criteria:

- Route the browser GLTF scene root through a minimal parsed GLB fixture source.
- Publish only JSON-safe GLB fixture status in the example status object.
- Keep ECS authoring, mesh construction, and rendering behavior unchanged.
- Playwright verifies the GLB fixture source status.

### task-1902 — Add structured GLB buffer-source diagnostics

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets/gltf-report-driven-import.ts`
and targeted asset tests.
Reference anchor:
Bevy `load_buffers` GLB `Source::Bin` handling, glTF 2.0 buffer source rules,
and `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`.

Acceptance criteria:

- GLB report-driven import reports a structured diagnostic when buffer `0`
  requires bytes but the GLB has no BIN chunk.
- GLB report-driven import reports a structured diagnostic when a buffer uses an
  unsupported external URI without caller-provided bytes.
- Existing accessor decoding diagnostics remain intact and renderer-independent.
- Tests cover missing BIN and unsupported external-buffer URI cases.

### task-1903 — Add JSON-safe GLB import report serialization

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted JSON tests.
Reference anchor:
Existing `*ReportToJsonValue` helpers and the JSON-safe diagnostics rules in
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Add a JSON-safe projection for the GLB report-driven import wrapper that omits
  raw BIN bytes.
- Preserve container diagnostics, chunk summaries, and import stage summaries.
- Tests prove the serialized value contains no `ArrayBuffer`, `Uint8Array`, or
  raw binary payload.

### task-1904 — Add GLB bufferView image asset-mapping fixture

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `test/assets`.
Reference anchor:
Existing glTF asset-mapping image bufferView tests, Bevy glTF image loading
concepts, and `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`.

Acceptance criteria:

- A GLB fixture with an image `bufferView` can feed the existing asset-mapping
  report through caller-provided image data resolution.
- Missing image data remains a structured mapping diagnostic.
- The fixture path remains renderer-independent and does not allocate GPU
  resources.

### task-1905 — Audit GLB fixture source status after buffer diagnostics

Status: completed 2026-05-19. See
`docs/research/GLB_FIXTURE_SOURCE_STATUS_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and
`task-1902`/`task-1903` implementation.

Acceptance criteria:

- Confirm GLB diagnostics remain source-side and JSON-safe.
- Confirm external buffer/image support is not overstated as a full loader.
- Confirm package dependency direction and ECS/render ownership invariants.
- Recommend exactly one next implementation slice.

### task-1906 — Add minimal GLB index-buffer fixture coverage

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted asset tests.
Reference anchor:
Existing accessor decoding index tests, Bevy glTF mesh primitive loading
pattern, and glTF 2.0 accessor/index rules.

Acceptance criteria:

- A GLB fixture with POSITION and unsigned-short index accessors decodes through
  the report-driven import path.
- Mesh construction preserves index-buffer metadata without exposing raw bytes
  in JSON reports.
- Tests cover valid indexed mesh decoding and a malformed index buffer range.

### task-1907 — Document current GLB fixture limitations

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md`.

Category: `docs-tooling`
Package/write-scope: `docs`, `agent/BACKLOG.md`.
Reference anchor:
`docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`, current GLB fixture
helper, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Document that the current path is a fixture/source bridge, not full async
  file loading.
- List supported JSON/BIN behavior and explicitly deferred external URI,
  compression, validator, and image decoding work.
- Keep docs aligned with the public dashboard and next backlog task.

### task-1908 — Add malformed GLB chunk ordering coverage

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets/glb-container.ts`,
`test/assets/glb-container.test.ts`.
Reference anchor:
glTF 2.0 GLB container rules and existing container parser diagnostics.

Acceptance criteria:

- Tests cover duplicate JSON chunks, duplicate BIN chunks, and BIN-before-JSON
  ordering.
- Parser diagnostics remain structured and non-throwing.
- Existing valid JSON-only and JSON+BIN fixtures keep passing.

### task-1909 — Add GLB bufferView image JSON serialization coverage

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted JSON tests.
Reference anchor:
`task-1903` JSON-safe GLB import report projection and `task-1904` bufferView
image fixture.

Acceptance criteria:

- JSON serialization of a GLB bufferView image mapping omits decoded image byte
  payloads and GLB raw bytes.
- Chunk summaries, texture handle keys, and material texture bindings remain
  present.
- Tests cover valid and missing-image-data reports.

### task-1910 — Add GLB fixture source-status docs to the browser example

Status: completed 2026-05-19. See `examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene.html` or adjacent example docs,
`docs/index.html`.
Reference anchor:
Current `examples/gltf-scene.js` source status and
`docs/research/GLB_FIXTURE_SOURCE_STATUS_AUDIT_2026_05_19.md`.

Acceptance criteria:

- Browser example docs explain that `source.glbFixture` is JSON-safe fixture
  status, not full file loading.
- Deferred external URI/image decoding/compression behavior is stated clearly.
- Public tracker next-task language remains aligned.

### task-1911 — Add external-buffer resolver contract tests

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted asset tests.
Reference anchor:
Bevy glTF `load_buffers` behavior and current
`createGltfReportDrivenImportReportFromGlb` resolver hook.

Acceptance criteria:

- Caller-provided bytes for an external glTF buffer URI satisfy the GLB wrapper
  without `glbImport.externalBufferUnsupported`.
- Missing resolver bytes continue to produce the structured external-buffer
  diagnostic.
- Tests confirm the resolver is not called more than needed for repeated buffer
  references.

### task-1912 — Audit GLB parser diagnostics after chunk-ordering coverage

Status: completed 2026-05-19. See
`docs/research/GLB_PARSER_DIAGNOSTICS_AFTER_CHUNK_ORDERING_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
glTF 2.0 GLB container rules, `task-1908`, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Confirm malformed chunk ordering diagnostics remain non-throwing and
  structured.
- Confirm valid GLB fixture paths still feed import reports.
- Recommend exactly one next loader/source-contract slice.

### task-1913 — Add mixed GLB BIN plus external-buffer resolver coverage

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets/gltf-report-driven-import.ts`,
`test/assets/glb-container.test.ts`.
Reference anchor:
Bevy glTF buffer loading separation, glTF GLB buffer rules, and
`docs/research/GLB_PARSER_DIAGNOSTICS_AFTER_CHUNK_ORDERING_AUDIT_2026_05_19.md`.

Acceptance criteria:

- A GLB fixture can use the container BIN chunk for buffer `0` and
  caller-provided bytes for a second URI buffer.
- The external resolver is not called for the BIN-backed buffer `0`.
- Missing second-buffer resolver bytes still produce
  `glbImport.externalBufferUnsupported`.
- Targeted tests prove decoded POSITION and index data still feed mesh
  construction.

### task-1914 — Add GLB external-buffer JSON projection coverage

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted JSON tests.
Reference anchor:
`task-1911`, `task-1913`, and the JSON-safe GLB import report projection.

Acceptance criteria:

- JSON serialization of an externally resolved GLB report omits caller-provided
  external bytes and raw container bytes.
- Chunk summaries and decoded mesh summaries remain present.
- Missing external bytes keep the structured wrapper diagnostic in JSON.

### task-1915 — Document the GLB external-buffer resolver contract

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `docs/GLB_FIXTURE_LIMITATIONS.md`,
`examples/gltf-scene-source-status.md`, and public tracker wording.
Reference anchor:
`task-1911`, `task-1913`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Docs state that URI buffer bytes are caller-provided in the fixture bridge.
- Docs distinguish resolver contract tests from full async file loading.
- Deferred fetch, validator, image decoding, and compression behavior remains
  explicit.

### task-1916 — Add malformed GLB diagnostics JSON projection coverage

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted JSON tests.
Reference anchor:
`task-1908` chunk-ordering diagnostics and the JSON-safe GLB report projection.

Acceptance criteria:

- JSON projection for duplicate JSON, duplicate BIN, and BIN-before-JSON reports
  preserves diagnostic codes, severity, offsets, byte lengths, and chunk types.
- Invalid containers keep `importReport: null`.
- Serialized JSON contains no raw bytes or parsed JSON text.

### task-1917 — Audit mixed GLB buffer-source contracts

Status: completed 2026-05-19. See
`docs/research/MIXED_GLB_BUFFER_SOURCE_CONTRACT_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1913`, `task-1914`, `docs/ARCHITECTURE.md`, and Bevy glTF buffer loading
patterns.

Acceptance criteria:

- Confirm BIN-backed and caller-resolved external buffers stay source-side and
  renderer-independent.
- Confirm JSON-safe diagnostics distinguish missing external bytes from missing
  BIN bytes.
- Recommend exactly one next glTF scene source or loader contract slice.

### task-1918 — Add compact GLB source-status JSON helper

Status: completed 2026-05-19. See
`packages/render/src/assets/gltf-report-driven-import.ts` and
`test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets/gltf-report-driven-import.ts`,
targeted tests.
Reference anchor:
`docs/research/MIXED_GLB_BUFFER_SOURCE_CONTRACT_AUDIT_2026_05_19.md`,
existing browser `source.glbFixture` status shape, and JSON-safe report
projection helpers.

Acceptance criteria:

- Add a render-package helper that projects a GLB import report to compact
  source status with validity, byte length, chunk summaries, diagnostics, and
  import stage summaries.
- The helper omits raw bytes, parsed JSON text, WebGPU handles, and ECS state.
- Tests cover valid, malformed-container, and missing external-buffer reports.

### task-1919 — Route browser GLTF source status through the helper

Status: completed 2026-05-19. See `examples/gltf-scene.js`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, targeted example checks.
Reference anchor:
`task-1918`, current `examples/gltf-scene.js` source status, and Bevy-style
separation between source loading and ECS authoring.

Acceptance criteria:

- `examples/gltf-scene.js` uses the compact GLB source-status helper instead of
  hand-building `source.glbFixture`.
- Published status keeps the same JSON-safe fields.
- `pnpm run check:examples` passes.

### task-1920 — Add GLB source-status docs for malformed reports

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/GLB_FIXTURE_LIMITATIONS.md`, and public tracker wording.
Reference anchor:
`task-1918`, `task-1919`, and malformed GLB diagnostic coverage.

Acceptance criteria:

- Docs explain how malformed containers appear in compact source status.
- Docs state invalid containers keep `importStages` empty and do not run import
  stages.
- Public tracker recommended next task remains aligned.

### task-1921 — Add GLB source-status fixture coverage for external buffers

Status: completed 2026-05-19. See `test/assets/glb-container.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1918`, `task-1913`, and `task-1914`.

Acceptance criteria:

- Compact source status summarizes externally resolved reports without raw
  caller-provided bytes.
- Missing external bytes preserve wrapper diagnostics in compact status.
- Mixed BIN plus external-buffer chunk summaries remain stable.

### task-1922 — Audit GLB source-status helper adoption

Status: completed 2026-05-19. See
`docs/research/GLB_SOURCE_STATUS_HELPER_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1918`, `task-1919`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm compact source status is renderer-independent and JSON-safe.
- Confirm the browser example still does not claim full file loading.
- Recommend exactly one next source-loader or scene-contract task.

### task-1923 — Plan the async GLB source-loader boundary

Status: completed 2026-05-19. See
`docs/research/ASYNC_GLB_SOURCE_LOADER_BOUNDARY_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, tracker wording.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/GLB_SOURCE_STATUS_HELPER_ADOPTION_AUDIT_2026_05_19.md`,
Bevy glTF loader buffer separation, and existing GLB fixture/report contracts.

Acceptance criteria:

- Define responsibilities for an eventual async GLB source-loader boundary:
  fetching bytes, resolving external buffers, image decode handoff, diagnostics,
  and cache/error reporting.
- State that loaded bytes feed the existing GLB report-driven import contract
  and do not author ECS state or allocate WebGPU resources directly.
- Select exactly one implementation follow-up that is small enough for one
  focused run.

### task-1924 — Add GLB source-loader status shape tests

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-status.ts` and
`test/assets/glb-source-loader-status.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1923`, compact source-status helper, and existing loader orchestration
reports.

Acceptance criteria:

- Define a JSON-safe status shape for a future source-loader facade without
  performing fetches.
- Tests cover pending, loaded, failed, and externally blocked statuses.
- Status omits raw bytes and does not expose ECS or WebGPU state.

### task-1925 — Add a source-loader no-fetch fixture facade

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-facade.ts` and
`test/assets/glb-source-loader-facade.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1923`, `task-1924`, and the current GLB report-driven import wrapper.

Acceptance criteria:

- Add a no-fetch facade that accepts already provided GLB bytes and optional
  external buffer bytes, then returns source status plus the GLB import report.
- The facade must not call `fetch`, decode images, author ECS state, or allocate
  WebGPU resources.
- Tests cover valid bytes, invalid bytes, and missing external bytes.

### task-1926 — Document loader facade non-goals in example docs

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `docs/GLB_FIXTURE_LIMITATIONS.md`,
`examples/gltf-scene-source-status.md`, and public tracker wording.
Reference anchor:
`task-1925`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs distinguish the no-fetch source facade from full async loading.
- Docs explain how future fetch/decode work should feed the same report
  contract.
- Deferred validator, compression, image decoding, cache, reload, and unload
  work remains explicit.

### task-1927 — Audit source-loader boundary plan and facade

Status: completed 2026-05-19. See
`docs/research/SOURCE_LOADER_BOUNDARY_PLAN_AND_FACADE_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1923`, `task-1925`, `docs/NORTH_STAR.md`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Confirm the source-loader facade remains renderer-independent and
  ECS/WebGPU-side-effect free.
- Confirm JSON-safe status does not expose raw bytes.
- Recommend exactly one next GLB/glTF scene source task.

### task-1928 — Route browser GLTF fixture through the no-fetch source-loader facade

Status: completed 2026-05-19. See `examples/gltf-scene.js`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, targeted example checks.
Reference anchor:
`docs/research/SOURCE_LOADER_BOUNDARY_PLAN_AND_FACADE_AUDIT_2026_05_19.md`,
current `createGltfSceneGlbFixture`, and Bevy-style source loading before ECS
authoring.

Acceptance criteria:

- `examples/gltf-scene.js` uses `createNoFetchGlbSourceLoaderReport` for the
  inline GLB fixture.
- The example still extracts the parsed root for the existing ECS authoring
  path without adding scene graph state.
- Published `source.glbFixture` remains JSON-safe and includes loader facade
  status fields.
- `pnpm run check:examples` and targeted GLB tests pass.

### task-1929 — Add browser status assertion for source-loader facade fields

Status: completed 2026-05-19. See `test/e2e/gltf-scene.spec.ts`.

Category: `runtime-orchestration`
Package/write-scope: `test/e2e/gltf-scene.spec.ts`, targeted browser test.
Reference anchor:
`task-1928`, current GLTF scene source status, and JSON-safe browser diagnostics
rules.

Acceptance criteria:

- Playwright asserts `source.glbFixture.status === "loaded"` and
  `source.glbFixture.glbSourceStatus.valid === true`.
- The assertion confirms no raw byte fields are present.
- Existing GLTF scene pixel/readiness assertions keep passing.

### task-1930 — Document browser source-loader facade status

Status: completed 2026-05-19. See `examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/GLB_FIXTURE_LIMITATIONS.md`, and tracker wording.
Reference anchor:
`task-1928`, `task-1929`, and
`docs/research/SOURCE_LOADER_BOUNDARY_PLAN_AND_FACADE_AUDIT_2026_05_19.md`.

Acceptance criteria:

- Docs explain the browser example now routes through the no-fetch facade.
- Docs state that source-loader status is still provided-bytes status, not file
  loading.
- Public tracker next-task language remains aligned.

### task-1931 — Add GLB source-loader facade JSON projection coverage for malformed chunk ordering

Status: completed 2026-05-19. See
`test/assets/glb-source-loader-facade.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1925`, `task-1908`, and source-loader status tests.

Acceptance criteria:

- No-fetch facade status preserves duplicate JSON, duplicate BIN, and
  BIN-before-JSON diagnostics.
- Invalid containers keep nested compact GLB source status with empty
  import stages.
- Serialized facade status contains no raw bytes or parsed JSON text.

### task-1932 — Audit browser source-loader facade adoption

Status: completed 2026-05-19. See
`docs/research/BROWSER_SOURCE_LOADER_FACADE_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1928`, `task-1929`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm browser source status stays JSON-safe and does not claim full loading.
- Confirm ECS authoring still starts from parsed source data and existing
  command/replay contracts.
- Recommend exactly one next GLB/glTF scene source task.

### task-1933 — Plan report-driven scene-source output adoption

Status: completed 2026-05-19. See
`docs/research/REPORT_DRIVEN_SCENE_SOURCE_OUTPUT_ADOPTION_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, tracker wording.
Reference anchor:
`docs/research/BROWSER_SOURCE_LOADER_FACADE_ADOPTION_AUDIT_2026_05_19.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, current GLB report-driven import contract, and
Bevy glTF source-to-asset staging.

Acceptance criteria:

- Plan how no-fetch source-loader output should expose asset mapping, mesh
  construction, source registration, and ECS command-plan summaries over time.
- State which summaries are source/import diagnostics versus ECS authoring or
  WebGPU-owned state.
- Select exactly one implementation follow-up small enough for one focused run.

### task-1934 — Add source-loader output summary status tests

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-output-summary.ts` and
`test/assets/glb-source-loader-output-summary.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1933`, no-fetch source-loader facade, and compact JSON-safe status
helpers.

Acceptance criteria:

- Define a JSON-safe output summary for no-fetch facade reports with optional
  mesh-construction and asset-mapping summary sections.
- Tests cover absent summaries, present mesh summary, and invalid mesh summary.
- Raw bytes and ECS/WebGPU state remain omitted.

### task-1935 — Attach mesh-construction summary to no-fetch facade output

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-facade.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1934`, current mesh construction report JSON helpers, and the GLB scene
source contract.

Acceptance criteria:

- No-fetch facade status can include mesh count, primitive count, vertex/index
  summary, and validity when `createMeshAssets` is enabled.
- Summary is derived from the GLB import report and does not duplicate raw mesh
  arrays.
- Tests cover valid indexed and invalid mesh reports.

### task-1936 — Document scene-source output staging

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `docs/GLB_FIXTURE_LIMITATIONS.md`,
`examples/gltf-scene-source-status.md`, and tracker wording.
Reference anchor:
`task-1935`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain source-loader output summaries as diagnostics/readiness, not
  authoritative ECS or renderer state.
- Docs list deferred source registration and ECS command-plan consumption.
- Public tracker next-task language remains aligned.

### task-1937 — Audit scene-source output summary adoption

Status: completed 2026-05-19. See
`docs/research/SCENE_SOURCE_OUTPUT_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1935`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and Bevy glTF
source-to-asset staging.

Acceptance criteria:

- Confirm output summaries remain JSON-safe and renderer-independent.
- Confirm browser and tests do not treat summaries as ECS/game state.
- Recommend exactly one next GLB/glTF scene-source task.

### task-1938 — Publish source-loader output summary in browser GLTF status

Status: completed 2026-05-19. See `examples/gltf-scene.js`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, targeted example checks.
Reference anchor:
`docs/research/SCENE_SOURCE_OUTPUT_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`,
current no-fetch facade output, and JSON-safe browser source status.

Acceptance criteria:

- `source.glbFixture` includes the no-fetch facade `outputSummary`.
- Output summary remains compact and JSON-safe.
- Existing ECS authoring flow remains unchanged.
- `pnpm run check:examples` passes.

### task-1939 — Add Playwright assertion for browser source output summary

Status: completed 2026-05-19. See `test/e2e/gltf-scene.spec.ts`.

Category: `runtime-orchestration`
Package/write-scope: `test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`task-1938`, current GLTF scene source status assertions, and JSON-safe browser
diagnostics rules.

Acceptance criteria:

- Playwright asserts the browser source output summary is present and honestly
  reports absent mesh construction for the current non-buffer-backed fixture.
- Assertion confirms raw mesh arrays and typed-array payloads are absent.
- Existing GLTF scene browser checks keep passing.

### task-1940 — Document browser source output summary status

Status: completed 2026-05-19. See `examples/gltf-scene-source-status.md` and
`docs/GLB_FIXTURE_LIMITATIONS.md`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/GLB_FIXTURE_LIMITATIONS.md`, and tracker wording.
Reference anchor:
`task-1938`, `task-1939`, and
`docs/research/SCENE_SOURCE_OUTPUT_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`.

Acceptance criteria:

- Docs explain the browser `outputSummary` field.
- Docs state it is source/import readiness, not ECS or renderer state.
- Public tracker next-task language remains aligned.

### task-1941 — Add source output summary JSON coverage for invalid browser-shaped mesh input

Status: completed 2026-05-19. See
`test/assets/glb-source-loader-facade.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1934`, browser GLTF fixture mesh shape, and current accessor validation
diagnostics.

Acceptance criteria:

- Output summary reports invalid for a browser-shaped source fixture with a bad
  mesh accessor or buffer range.
- Diagnostics count is non-zero.
- Serialized summary omits raw source bytes and mesh arrays.

### task-1942 — Audit browser source output summary publication

Status: completed 2026-05-19. See
`docs/research/BROWSER_SOURCE_OUTPUT_SUMMARY_PUBLICATION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1938`, `task-1939`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm browser status publication stays JSON-safe and non-authoritative.
- Confirm no ECS/render ownership changed.
- Recommend exactly one next glTF scene source task.

### task-1943 — Plan buffer-backed GLB browser fixture slice

Status: completed 2026-05-19. See
`docs/research/BUFFER_BACKED_GLB_BROWSER_FIXTURE_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, tracker wording.
Reference anchor:
`docs/research/BROWSER_SOURCE_OUTPUT_SUMMARY_PUBLICATION_AUDIT_2026_05_19.md`,
current no-fetch source facade, and Bevy glTF source-to-mesh staging.

Acceptance criteria:

- Plan a narrow buffer-backed GLB fixture that can produce a ready
  mesh-construction summary through the no-fetch facade.
- Keep visible browser scene rendering and ECS authoring flow stable.
- Select exactly one implementation follow-up small enough for one focused run.

### task-1944 — Add buffer-backed GLB source fixture helper tests

Status: completed 2026-05-19. See `test/assets/glb-buffer-fixture.ts` and
`test/assets/glb-buffer-fixture.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1943`, current GLB indexed mesh fixtures, and no-fetch source facade.

Acceptance criteria:

- Add a reusable test helper or fixture for a minimal buffer-backed GLB triangle
  with POSITION and unsigned-short indices.
- No-fetch facade reports loaded source status and ready mesh-construction
  output summary.
- Serialized status and summary omit raw bytes and typed arrays.

### task-1945 — Publish ready mesh summary for a buffer-backed source fixture

Status: completed 2026-05-19. See `examples/gltf-scene.js`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`, targeted example and browser
status checks.
Reference anchor:
`task-1944`, browser GLTF source status, and current ECS authoring flow.

Acceptance criteria:

- Browser GLTF scene creates a secondary buffer-backed source fixture for
  source-status proof without changing visible scene rendering.
- `source.glbFixture.outputSummary.meshConstruction.status` can report `ready`
  for that buffer-backed fixture or a clearly named sibling status.
- Existing visible scene and ECS authoring path remain unchanged.

### task-1946 — Document buffer-backed source fixture limitations

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `docs/GLB_FIXTURE_LIMITATIONS.md`,
`examples/gltf-scene-source-status.md`, and tracker wording.
Reference anchor:
`task-1945`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs distinguish buffer-backed source summary proof from full scene loading.
- Deferred source registration, ECS command-plan routing, and visible rendering
  from GLB mesh assets remain explicit.
- Public tracker next-task language remains aligned.

### task-1947 — Audit buffer-backed source fixture summary

Status: completed 2026-05-19. See
`docs/research/BUFFER_BACKED_SOURCE_FIXTURE_SUMMARY_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1944`, `task-1945`, `docs/NORTH_STAR.md`, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Confirm buffer-backed source summaries remain JSON-safe and non-authoritative.
- Confirm visible browser rendering still uses the established ECS/render path.
- Recommend exactly one next GLB/glTF source-to-scene task.

### task-1948 — Plan no-fetch source-registration summary slice

Status: completed 2026-05-19. See
`docs/research/NO_FETCH_SOURCE_REGISTRATION_SUMMARY_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, tracker wording.
Reference anchor:
`docs/research/BUFFER_BACKED_SOURCE_FIXTURE_SUMMARY_AUDIT_2026_05_19.md`,
current source registration report helpers, and Bevy glTF source-to-asset
staging.

Acceptance criteria:

- Plan a report-only source-registration summary for no-fetch facade output.
- Keep actual registry mutation, ECS command replay, and WebGPU preparation
  deferred.
- Select exactly one implementation follow-up small enough for one focused run.

### task-1949 — Add source-registration output summary status tests

Status: completed 2026-05-19. See
`test/assets/glb-source-loader-output-summary.test.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1948`, current source registration report helpers, and no-fetch facade
output summaries.

Acceptance criteria:

- Define a JSON-safe summary shape for source registration readiness.
- Tests cover absent source registration, valid planned registration, and
  invalid dependency/texture registration summaries.
- Raw registry internals, ECS state, and GPU resources remain omitted.

### task-1950 — Attach source-registration summary to no-fetch facade output

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-facade.ts`.

Category: `simulation`
Package/write-scope: `packages/render/src/assets`, targeted tests.
Reference anchor:
`task-1949`, no-fetch facade output summary, and GLB source-registration
reports.

Acceptance criteria:

- No-fetch facade output can include source-registration summary when provided
  reports are available.
- Summary is derived from reports and does not mutate the registry.
- Tests cover absent and provided summaries.

### task-1951 — Document source-registration summary limitations

Status: completed 2026-05-19. See `docs/GLB_FIXTURE_LIMITATIONS.md` and
`examples/gltf-scene-source-status.md`.

Category: `docs-tooling`
Package/write-scope: `docs/GLB_FIXTURE_LIMITATIONS.md`,
`examples/gltf-scene-source-status.md`, and tracker wording.
Reference anchor:
`task-1950`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain source-registration summaries as report/readiness data only.
- Docs state actual registry mutation and ECS replay remain separate.
- Public tracker next-task language remains aligned.

### task-1952 — Audit source-registration summary adoption

Status: completed 2026-05-19. See
`docs/research/SOURCE_REGISTRATION_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1950`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and Bevy glTF
source-to-asset staging.

Acceptance criteria:

- Confirm source-registration summaries remain JSON-safe and non-authoritative.
- Confirm no registry, ECS, or WebGPU mutation moved into the source loader.
- Recommend exactly one next source-to-scene task.

### task-1953 — Plan no-fetch ECS command-plan summary slice

Status: completed 2026-05-19. See
`docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, tracker wording.
Reference anchor:
`docs/research/SOURCE_REGISTRATION_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`,
current glTF ECS authoring command-plan helpers, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Plan a report-only ECS command-plan summary for no-fetch facade output.
- Keep actual ECS command replay and visible rendering changes deferred.
- Add at least four concrete implementation/audit follow-up tasks.

### task-1954 — Add GLB source-loader ECS command-plan summary helper

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-output-summary.ts` and
`test/assets/glb-source-loader-output-summary.test.ts`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-output-summary.ts`,
`test/assets/glb-source-loader-output-summary.test.ts`.
Reference anchor:
`docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`, and Bevy glTF
scene/entity staging in `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Output summaries include an `ecsCommandPlan` section with absent, ready, and
  invalid states.
- The summary reports command counts, component counts, dependency count,
  skipped count, and diagnostics count.
- Tests prove the summary omits full commands, component payloads, ECS world
  state, raw arrays, and GPU handles.

### task-1955 — Thread ECS command-plan summaries through no-fetch facade

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-facade.ts` and
`test/assets/glb-source-loader-facade.test.ts`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-facade.ts`,
`test/assets/glb-source-loader-facade.test.ts`.
Reference anchor:
`task-1954`, the no-fetch source-registration summary pattern, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- `createNoFetchGlbSourceLoaderReport` accepts an optional
  `GltfEcsAuthoringCommandPlan`.
- Facade output attaches the compact command-plan summary without executing
  replay or mutating ECS/assets.
- Tests cover valid and invalid provided command plans and assert JSON output
  does not expose full commands or raw source data.

### task-1956 — Document no-fetch ECS command-plan summary status

Status: completed 2026-05-19. See
`examples/gltf-scene-source-status.md`, `docs/index.html`, and
`docs/render-pipeline-comparison.html`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1955`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain ECS command-plan summaries as report/readiness data only.
- Docs state actual ECS replay and visible scene authoring remain separate.
- Public tracker next-task language remains aligned.

### task-1957 — Audit ECS command-plan summary adoption

Status: completed 2026-05-19. See
`docs/research/ECS_COMMAND_PLAN_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1954`, `task-1955`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy glTF source-to-scene staging.

Acceptance criteria:

- Confirm command-plan summaries remain JSON-safe and non-authoritative.
- Confirm no registry, ECS world, command replay, render-world, or WebGPU
  mutation moved into the source loader.
- Recommend exactly one next source-to-scene task.

### task-1958 — Plan report-only ECS replay readiness status

Status: completed 2026-05-19. See
`docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1957`, `packages/render/src/assets/gltf-ecs-command-replay.ts`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Plan a status-only replay-readiness report that can explain why command replay
  is ready or blocked before actual execution.
- Keep ECS mutation, visible scene rendering, and WebGPU preparation deferred.
- Add concrete implementation and audit follow-up tasks.

### task-1959 — Add ECS replay readiness summary helper

Status: completed 2026-05-19. See
`packages/render/src/assets/gltf-ecs-command-replay-readiness.ts` and
`test/assets/gltf-ecs-command-replay-readiness.test.ts`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, targeted tests under
`test/assets`.
Reference anchor:
`docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-command-replay.ts`, and Bevy glTF scene
staging in `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Add a JSON-safe helper that derives replay readiness from a command plan
  without an ECS world.
- Cover absent, ready, invalid-plan, missing-entity, duplicate-entity,
  missing-parent, and unsupported-component cases.
- Tests assert the readiness summary omits full command payloads and raw ECS
  objects.

### task-1960 — Attach ECS replay readiness to no-fetch output summaries

Status: completed 2026-05-19. See
`packages/render/src/assets/glb-source-loader-output-summary.ts`,
`packages/render/src/assets/glb-source-loader-facade.ts`, and targeted tests.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-output-summary.ts`,
`packages/render/src/assets/glb-source-loader-facade.ts`, targeted tests.
Reference anchor:
`task-1959`, `docs/ARCHITECTURE.md`, and the existing source-registration and
command-plan summary patterns.

Acceptance criteria:

- No-fetch output summaries include an `ecsReplayReadiness` section.
- Facade output can publish readiness without calling
  `replayGltfEcsAuthoringCommands`.
- Tests prove no ECS world, registry, render-world, or WebGPU resource state is
  exposed.

### task-1961 — Document ECS replay readiness status

Status: completed 2026-05-19. See
`examples/gltf-scene-source-status.md`, `docs/index.html`, and
`docs/render-pipeline-comparison.html`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1960`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain replay readiness as report-only preflight data.
- Docs state actual ECS replay and visible GLB-derived rendering remain
  separate.
- Public tracker next-task language remains aligned.

### task-1962 — Audit ECS replay readiness adoption

Status: completed 2026-05-19. See
`docs/research/ECS_REPLAY_READINESS_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1959`, `task-1960`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy source-to-scene staging.

Acceptance criteria:

- Confirm replay readiness does not mutate ECS, assets, render-world, or WebGPU
  state.
- Confirm JSON outputs omit raw ECS world/entity maps and full command payloads.
- Recommend exactly one next source-to-scene task.

### task-1963 — Plan first controlled ECS replay execution surface

Status: completed 2026-05-19. See
`docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1962`, `packages/render/src/assets/gltf-ecs-command-replay.ts`,
`@aperture-engine/runtime` app facades, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Compare a test-only replay fixture, a headless runtime facade option, and a
  browser example path.
- Select one narrow execution surface that preserves ECS authority and keeps the
  renderer derived from snapshots.
- Add implementation and audit follow-up tasks.

### task-1964 — Add headless runtime GLTF command-plan replay facade

Status: completed 2026-05-19. See `packages/runtime/src/index.ts` and
`test/runtime/runtime.test.ts`.

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src/index.ts`, `test/runtime`.
Reference anchor:
`docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-command-replay.ts`,
`packages/runtime/src/index.ts`, and Bevy scene-handle spawning patterns.

Acceptance criteria:

- Add an explicit runtime helper that applies a provided glTF ECS command plan
  to a `SimulationApp` world.
- The helper delegates to the existing replay implementation and returns its
  report.
- Tests prove valid plans mutate the app world and invalid plans do not create
  entities.
- The source-loader facade remains report-only.

### task-1965 — Prove replayed GLTF commands can feed extraction headlessly

Status: completed 2026-05-19. See `test/runtime/runtime.test.ts`.

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src/index.ts`, `test/runtime`.
Reference anchor:
`task-1964`, `docs/ARCHITECTURE.md`, and existing extraction app tests.

Acceptance criteria:

- Use an `ExtractionApp` plus a ready command plan with mesh/material
  components.
- Apply the command plan, step/extract, and assert the render snapshot is
  derived from replayed ECS state.
- Keep WebGPU/browser rendering unchanged.

### task-1966 — Document controlled ECS replay execution surface

Status: completed 2026-05-19. See
`examples/gltf-scene-source-status.md`, `docs/index.html`, and
`docs/render-pipeline-comparison.html`.

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1964`, `task-1965`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs distinguish source-loader summaries, replay readiness, and explicit
  runtime replay execution.
- Docs state browser-visible GLB scene rendering remains deferred until a later
  slice.
- Public tracker next-task language remains aligned.

### task-1967 — Audit controlled ECS replay execution surface

Status: completed 2026-05-19. See
`docs/research/CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1964`, `task-1965`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy source-to-scene staging.

Acceptance criteria:

- Confirm replay execution lives in runtime/app orchestration, not source
  loading or WebGPU.
- Confirm ECS remains authoritative and rendering remains derived from
  extraction.
- Recommend exactly one next GLB source-to-scene task.

### task-1968 — Plan first browser-visible GLB-derived scene replay proof

Status: completed 2026-05-19. See
`docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1967`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare keeping visible fixture authoring unchanged, adding a headless-only
  browser status proof, and replaying one GLB-derived primitive into the visible
  scene.
- Select the narrowest browser proof that preserves the ECS/render boundary.
- Add implementation and audit follow-up tasks.

### task-1969 — Route GLTF browser scene replay through runtime facade

Status: completed 2026-05-19. See `examples/gltf-scene.js` and
`test/e2e/gltf-scene.spec.ts`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`,
`packages/runtime/src/index.ts`, `examples/gltf-scene.js`, and Bevy scene
spawning patterns.

Acceptance criteria:

- Replace direct browser example calls to `replayGltfEcsAuthoringCommands` with
  `applyGltfEcsCommandPlanToApp`.
- Publish JSON-safe replay status proving runtime facade execution succeeded.
- Playwright asserts the status and existing visible pixels remain stable.
- The no-fetch source-loader facade remains report-only.

### task-1970 — Audit browser runtime replay facade adoption

Status: completed 2026-05-19. See
`docs/research/BROWSER_RUNTIME_REPLAY_FACADE_ADOPTION_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1969`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`examples/gltf-scene.js`.

Acceptance criteria:

- Confirm browser replay execution goes through runtime orchestration.
- Confirm source-loader status remains report-only.
- Confirm rendering remains derived from ECS extraction and WebGPU owns only GPU
  resources.
- Recommend exactly one next browser GLB source-to-scene task.

### task-1971 — Plan buffer-backed GLB command-plan browser status proof

Status: completed 2026-05-19. See
`docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1970`, `examples/gltf-scene.js`,
`packages/render/src/assets/glb-source-loader-facade.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare a status-only buffer-backed command-plan proof with adding visible
  geometry.
- Select one narrow next slice with Playwright status expectations.
- Keep broad viewer behavior and external file loading deferred.

### task-1972 — Add buffer-backed GLB command-plan browser status proof

Status: completed 2026-05-19. See `examples/gltf-scene.js` and
`test/e2e/gltf-scene.spec.ts`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`task-1971`, the buffer-backed GLB fixture helper, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Browser status includes a buffer-backed GLB command-plan and runtime replay
  readiness proof without changing visible rendering.
- Playwright asserts command-plan/replay-readiness status and JSON safety.
- No external URL/file loading or WebGPU ownership moves into source loading.

### task-1973 — Audit buffer-backed GLB command-plan browser status proof

Status: completed 2026-05-19. See
`docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_AUDIT_2026_05_19.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1972`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the proof remains status-only unless the selected implementation
  explicitly renders geometry.
- Confirm ECS authority and render extraction boundaries remain intact.
- Recommend the next visible GLB-derived scene slice.

### task-1974 — Plan first visible buffer-backed GLB primitive replay

Status: completed 2026-05-19. See
`docs/research/FIRST_VISIBLE_BUFFER_BACKED_GLB_PRIMITIVE_REPLAY_PLAN_2026_05_19.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1973`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Define the smallest visible buffer-backed GLB primitive replay proof.
- Decide whether to reuse an existing material or add a minimal unlit material
  mapping for the buffer-backed primitive.
- Add implementation and audit follow-up tasks with Playwright status/pixel
  expectations.

### task-1975 — Add visible buffer-backed GLB primitive replay proof

Status: completed 2026-05-19. See `agent/COMPLETED.md`.

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, targeted render/runtime tests if needed.
Reference anchor:
`task-1974`, `docs/ARCHITECTURE.md`, and the established GLTF browser scene
fixture path.

Acceptance criteria:

- Replay one buffer-backed GLB-derived primitive into the visible browser scene.
- Playwright asserts source status, replay status, and a stable visible pixel or
  readback difference.
- Keep external loading, broad viewer behavior, and new material systems
  deferred.

### task-1976 — Audit visible buffer-backed GLB primitive replay proof

Status: superseded 2026-05-19 — removed from ready queue per MVP focus shift. The completed task-1975 has visible Playwright assertions that act as the standing audit; standalone audit markdown is no longer the deliverable shape per `agent/WAKE.md` §7. See `agent/HANDOFF.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1975`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm browser-visible GLB replay still follows ECS -> extraction -> WebGPU.
- Confirm source loading remains separate from runtime replay execution.
- Recommend the next glTF scene vertical-slice task.

### task-1977 — Plan buffer-backed GLB material mapping for visible replay

Status: superseded 2026-05-19 — removed from ready queue. Material mapping is now folded into the visible-feature task `task-2005`. See `agent/HANDOFF.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1976`, `packages/render/src/assets/gltf-asset-mapping.ts`,
`packages/render/src/assets/gltf-source-registration.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare minimal unlit material mapping with StandardMaterial mapping for the
  buffer-backed visible primitive.
- Select one narrow material/source registration follow-up.
- Add implementation and audit follow-up tasks.

### task-1978 — Add visible buffer-backed GLB primitive material mapping

Status: superseded 2026-05-19 — content promoted to `task-2005` with explicit reference anchors and visible pixel acceptance criteria under the MVP GLB-loading track. See `agent/HANDOFF.md`.

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, targeted tests.
Reference anchor:
`task-1977`, `docs/ARCHITECTURE.md`, and current glTF material mapping helpers.

Acceptance criteria:

- The visible buffer-backed primitive uses a material source mapped from its GLB
  root rather than borrowing an existing material handle.
- Browser status reports the material mapping/registration path.
- Playwright keeps the visible proof stable.

### task-1979 — Audit buffer-backed GLB material mapping replay

Status: superseded 2026-05-19 — removed from ready queue. Playwright pixel assertions on the visible material in `task-2005` are the standing audit per `agent/WAKE.md` §7. See `agent/HANDOFF.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1978`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm material source mapping remains renderer-independent.
- Confirm runtime replay remains separate from source loading.
- Recommend the next glTF scene vertical-slice task.

## Post-Unlit E2E Verification Targets

Do not start these until the unlit browser path above is working end-to-end and Playwright can verify real rendered pixels reliably. Once that foundation is stable, expand browser E2E coverage across the broader runtime surface:

- Geometry coverage: verify all built-in primitive meshes and mesh upload paths render correctly in browser.
- Material coverage: verify unlit variants first, then add matcap/standard/PBR material paths as they exist.
- Texture coverage: verify texture upload, sampling, UV correctness, and missing-texture diagnostics.
- Lighting coverage: verify directional, point, spot, ambient/environment lighting when those paths are implemented.
- Camera/render-target coverage: verify multiple cameras, viewport/scissor behavior, and offscreen/render-target flows.
- Visibility/sorting coverage: verify layers, hidden/disabled renderables, opaque ordering, and transparency ordering.
- Diagnostics coverage: verify Playwright failure output exposes enough frame status to explain blank canvases, missing resources, or unsupported WebGPU.

Each expansion should keep the same rule: ECS is authoritative, rendering is derived from snapshots/render-world state, and browser verification proves pixels plus JSON-safe frame diagnostics.

## Superseded / Rewritten Tasks

The following pre-gate tasks are superseded by the EliCS adoption and MVP synthesis, or rewritten into the ready tasks above:

- `task-0004 — Implement component registry and storage`: superseded by EliCS adoption; remaining Aperture-specific component work is in `task-0028` and `task-0033`.
- `task-0005 — Implement ECS query API`: superseded by EliCS adoption; query usage should be tested in component and extraction tasks.
- `task-0006 — Implement system schedule`: rewritten into targeted system tasks beginning with `task-0029` and `task-0035`.
- `task-0007 — Add command and event model`: deferred until after the transform/render extraction foundation or rewritten as an input/command task when interaction work begins.
- `task-0008 — Add transform component types`: rewritten as `task-0028`.
- `task-0009 — Implement transform resolution system`: rewritten as `task-0029`.
- `task-0010 — Add render authoring components`: rewritten as `task-0033`.
- `task-0011 — Define asset handle types`: rewritten as `task-0030`.
- `task-0012 — Define RenderPacket and RenderSnapshot`: rewritten as `task-0034`.
- `task-0013 — Implement RenderExtractSystem`: rewritten as `task-0035`.
- `task-0014 — Add architecture invariant tests or checks`: distributed into `task-0030`, `task-0034`, `task-0035`, and `task-0036`.
- `task-0015 — Add WebGPU support detection`: rewritten as `task-0036`.

## Backlog Maintenance Rules

At the end of a run:

- Mark completed task(s).
- Add new tasks if the backlog has fewer than five ready tasks.
- New tasks must align with roadmap and the MVP feature contract.
- New tasks after the lit spinning cube proof point must also align with
  `docs/MEDIUM_LONG_TERM_GOALS.md`.
- New tasks must include category, package/write-scope, reference anchor, and
  acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
- Keep a focused `audit-refactor` task in the queue after every three to five
  implementation tasks or any major package/API/render-pipeline boundary change.
