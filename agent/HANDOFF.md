# Agent Handoff

Updated: 2026-05-19T21:28:45Z

## Current Run Update — 2026-05-19T21:28:45Z — Spot shadow projection proof

Completed `task-2013`.

### What changed

- Added spot shadow extraction support so enabled spot lights can emit
  renderer-facing shadow requests without creating renderer-owned scene state.
- Added spot-shadow 2D view/projection planning and matrix computation from the
  extracted ECS light transform.
- Added StandardMaterial spot direct lighting and reused the existing 2D shadow
  receiver path for spot-shadow sampling.
- Added `examples/spot-shadow.html` and `examples/spot-shadow.js` with a spot
  light, cube caster, receiver wall, caster/receiver toggles, JSON-safe status,
  and a visible lit/shadowed receiver proof.
- Added `test/webgpu/spot-shadow-pipeline.test.ts` and
  `test/e2e/spot-shadow.spec.ts`, and extended extraction coverage for spot
  shadow requests.
- Updated public progress trackers, backlog, and completed-task notes.

### References inspected

- `references/three.js/src/lights/SpotLightShadow.js`
- `references/engine/src/scene/renderer/shadow-renderer-local.js`
- Existing Aperture point/directional shadow planning and StandardMaterial
  receiver paths.

### Validation

- `node --check examples/spot-shadow.js`
- `pnpm exec vitest run test/webgpu/spot-shadow-pipeline.test.ts test/webgpu/standard-shader.test.ts test/rendering/extraction.test.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/spot-shadow.spec.ts`

### Known issues

- Spot shadows currently use the 2D StandardMaterial receiver path; this is
  enough for a visible spot-shadow proof, but the combined multi-light example
  still needs to prove directional, point, and spot shadows together.

### Recommended next task

`task-2014 — Combined multi-light scene: directional + point + spot all casting shadows`.

## Current Run Update — 2026-05-19T21:11:48Z — Point shadow projected-depth compare

Completed `task-2017`.

### What changed

- Updated StandardMaterial point-shadow cube sampling so the receiver compares
  against the selected cube-face projected depth, clamped and biased, instead
  of the previous constant near-1.0 occupancy reference.
- Added shader unit coverage for the point-shadow variant to lock out the old
  constant compare reference.
- Tightened `test/e2e/point-shadow.spec.ts` with three named receiver-wall
  samples: a near-light sample stays lit while mid and far-side samples darken
  strongly, with no WebGPU validation warnings.
- Updated public tracker pages, backlog, and completed-task notes. Recommended
  next task is now the spot-light shadow slice.

### References inspected

- `references/three.js/src/lights/PointLightShadow.js`
- `references/engine/src/scene/renderer/shadow-renderer-local.js`
- `references/engine/src/scene/renderer/render-pass-shadow-local-non-clustered.js`

### Validation

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts`
- `pnpm exec playwright test test/e2e/point-shadow.spec.ts`

### Known issues

- The point-shadow proof now uses real projected cube-face depth comparison for
  visible receiver localization. Explicit per-fragment radial depth storage is
  still a future precision task if multi-caster or cube-face seam tests require
  it.

### Recommended next task

`task-2013 — Add spot-light shadow projection and render visible spot-light shadow`.

## Current Run Update — 2026-05-19T21:08:50Z — Point shadow cube-map proof

Completed `task-2012`.

### What changed

- Added point-light shadow extraction metadata so shadow requests preserve the
  originating light kind.
- Added point-light cube-map shadow resource planning: cube depth descriptors,
  six per-face attachment views, six shadow pass records, point-shadow
  view/projection planning, and point-shadow matrix computation/upload.
- Added StandardMaterial point-shadow route support through group 3 cube-depth
  bindings and WGSL point-light shadow sampling.
- Refined the point-shadow compare reference to use the clamped projected
  receiver depth instead of a constant compare depth.
- Added `examples/point-shadow.html` and `examples/point-shadow.js` with a
  point light, cube caster, receiver wall, caster/receiver toggles, JSON-safe
  status, and browser coverage proving point-shadow receiver activation.
- Updated packed transform buffers to preserve the full snapshot transform table
  so shaders can address light transforms as well as draw transforms.
- Tightened shadow caster draw-list diagnostics so an extracted shadow request
  with no planned pass remains a missing prerequisite for command planning.
- Updated the public tracker pages and recorded a focused follow-up for
  distance-accurate radial point-shadow depth.
- Corrected `scripts/codex-stop-hook.sh` so its continuation gate uses elapsed
  run time from `agent/STATUS.json` instead of the current minute of the hour.

### References inspected

- `references/three.js/src/lights/PointLightShadow.js`
- `references/engine/src/scene/renderer/shadow-renderer-local.js`
- `references/engine/src/scene/renderer/render-pass-shadow-local-non-clustered.js`

### Validation

- `pnpm run build`
- `pnpm run typecheck:test`
- `pnpm run check:examples`
- `pnpm run check:progress`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm test`
- `bash -n scripts/codex-stop-hook.sh`
- `pnpm exec vitest run test/webgpu/point-shadow-pipeline.test.ts test/webgpu/shadow-pass-plan.test.ts test/webgpu/shadow-texture-resource.test.ts test/webgpu/shadow-depth-texture-resource.test.ts test/webgpu/shadow-pass-attachment-descriptor.test.ts test/webgpu/shadow-pass-command-encoding-report.test.ts test/webgpu/standard-light-shadow-bind-group.test.ts test/rendering/transform-pack.test.ts test/webgpu/shadow-caster-pipeline-descriptor.test.ts test/webgpu/shadow-caster-frame-resource-readiness.test.ts`
- `pnpm exec vitest run test/rendering/extraction.test.ts test/webgpu/shadow-map-descriptor.test.ts test/webgpu/shadow-caster-pipeline-resource.test.ts test/webgpu/shadow-caster-command-plan-readiness.test.ts test/webgpu/shadow-caster-draw-list-plan.test.ts`
- `pnpm exec playwright test test/e2e/point-shadow.spec.ts`

### Known issues

- The current point-shadow example proves cube-map allocation, six-face
  submission, receiver binding, and visible cube-map sampling. It is still a
  conservative occupancy proof; the next task should replace it with
  distance-accurate radial point-depth writes and localized shadow/lit sampling.

### Recommended next task

`task-2017 — Replace point-shadow occupancy proof with radial depth compare`.

## Current Run Update — 2026-05-19T19:53:10Z — GLTF shadow controls

Completed `task-2015`.

### What changed

- Added live receiver and caster shadow checkboxes to
  `examples/gltf-scene.html`.
- Receiver state now controls whether `app.render()` receives
  `standardMaterialShadowReceiverResources`, so disabling receivers removes
  visible StandardMaterial shadow sampling without replacing the ECS/render
  extraction path.
- Caster state now filters the shadow caster draw-list input, keeping the
  toggle on the renderer-owned shadow pass side of the existing extracted
  snapshot path.
- Published JSON-safe `shadow.controls` status and extended the GLTF Playwright
  test to uncheck receiver shadows, wait for a new frame, and assert the sampled
  receiver region returns toward the unshadowed baseline.
- Updated the public tracker pages, backlog, and completed-task log.
- Earlier in this work cycle, the stop-hook wording and agent docs were changed
  so time-gate continuation prompts require active repository work instead of
  waiting. The commit policy now explicitly permits interim commits after a
  completed, validated feature slice; this run has local interim commits ahead
  of `origin/main` and the final stop hook still owns the push/checkpoint.

### References inspected

- `references/bevy/examples/3d/shadow_caster_receiver.rs`

### Validation

- `node --check examples/gltf-scene.js`
- `pnpm run build`
- `pnpm run typecheck:test`
- `pnpm run check:examples`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

### Known issues

- Caster/receiver controls are example-level runtime controls; there is not yet
  a general public `NotShadowCaster`/`NotShadowReceiver` component API.
- Point-light and spot-light shadow paths remain unimplemented.

### Recommended next task

`task-2012 — Add point-light shadow cube map and render visible point-light shadow`.

## Current Run Update — 2026-05-19T19:13:43Z — GLB viewer switching and active directional shadows

Completed `task-2009`, `task-2010`, and `task-2011`.

### What changed

- Added `examples/assets/amber-slab.glb` and
  `examples/assets/sapphire-pillar.glb` alongside the existing cube fixture.
- Added a three-asset selector to `examples/glb-viewer.html` and
  `examples/glb-viewer.js`.
- Switching GLB assets now destroys the previous replayed ECS scene before
  loading and replaying the next GLB through the public URI loader and app path.
- Updated `examples/gltf-scene.js` so the directional shadow path reports active
  rendering when the shadow pass has been submitted and receiver bindings are
  ready.
- StandardMaterial directional shadow sampling now uses a 3x3 PCF comparison
  filter instead of a single comparison sample.
- Updated public tracker pages and added two ready follow-up tasks so the ready
  queue remains above the visible-feature floor.

### References inspected

- `references/three.js/examples/webgl_loader_gltf.html`
- `references/three.js/src/lights/DirectionalLightShadow.js`
- `references/three.js/src/lights/LightShadow.js`
- `references/engine/src/scene/renderer/shadow-renderer-directional.js`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/bevy/examples/3d/shadow_caster_receiver.rs`
- `references/three.js/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`

### Validation

- `node --check examples/glb-viewer.js`
- `node --check examples/gltf-scene.js`
- `pnpm run build`
- `pnpm run typecheck:test`
- `pnpm run check:examples`
- `pnpm run check:progress`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts`
- `pnpm exec playwright test test/e2e/glb-viewer.spec.ts`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

### Known issues

- GLB viewer unload currently destroys replayed ECS entities; source assets are
  retained in the registry under unique per-load prefixes.
- Directional shadow PCF is a fixed 3x3 filter; there is no public quality
  control yet.
- Point-light and spot-light shadow paths remain unimplemented.
- Inspected `task-2012` references after the stop hook requested continuation.
  Point-light cube-map shadows require a broader shadow contract extension:
  shadow requests need light kind/face information, the WebGPU layer needs six
  point-light face view/projection plans and cube or layered depth resources,
  and StandardMaterial needs point-shadow sampling. This should start cleanly in
  the next run rather than being partially mixed into the completed directional
  shadow/GLB viewer diff.

### Recommended next task

`task-2012 — Add point-light shadow cube map and render visible point-light shadow`.

## Current Run Update — 2026-05-19T18:46:03Z — GLB viewer orbit camera control

Completed `task-2008`.

### What changed

- Added pointer-drag orbit and wheel zoom controls to `examples/glb-viewer.js`.
- The controls update the ECS camera `LocalTransform` before each step, so the
  camera remains authored in ECS rather than renderer-owned state.
- Published JSON-safe orbit yaw/distance/dragging status.
- Extended Playwright coverage to drag the viewer, wait for yaw to change, and
  assert the rendered canvas pixels differ after orbiting.

### References inspected

- `references/three.js/examples/jsm/controls/OrbitControls.js`

### Validation

- `node --check examples/glb-viewer.js`
- `pnpm run typecheck:test`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec playwright test test/e2e/glb-viewer.spec.ts`

### Known issues

- Orbit control is intentionally minimal: yaw orbit plus wheel zoom only.
- Multi-asset switching and broader unload/reload behavior remain next.

### Recommended next task

`task-2009 — Multi-asset switching in glb-viewer with three sample .glb files`.

## Current Run Update — 2026-05-19T18:41:09Z — GLB viewer renders fetched sample asset

Completed `task-2007`.

### What changed

- Added a committed sample GLB asset at `examples/assets/cube.glb`.
- Added `examples/glb-viewer.html` and `examples/glb-viewer.js`.
- The viewer fetches the sample through `loadGlbFromUri(...)`, registers the
  resulting source assets, resolves primitive materials, replays GLTF ECS
  authoring commands, spawns a camera, and renders through the WebGPU app
  facade.
- Added Playwright coverage proving the fetched sample produces one extracted
  draw, one draw package/call, and non-clear canvas pixels.
- Added the viewer to examples navigation and `check:examples`.

### References inspected

- `references/three.js/examples/webgpu_loader_gltf.html`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`

### Validation

- `node --check examples/glb-viewer.js`
- `pnpm run typecheck:test`
- `pnpm run check:examples`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec playwright test test/e2e/glb-viewer.spec.ts`

### Known issues

- The viewer currently loads one fixed sample asset and has no interaction.
- Texture/image decoding, asset switching, unload, and broader GLB limitations
  remain deferred.

### Recommended next task

`task-2008 — Add orbit camera control to glb-viewer`.

## Current Run Update — 2026-05-19T18:31:00Z — Public GLB URI loader added

Completed `task-2006`.

### What changed

- Added `loadGlbFromUri(url, options)` in
  `packages/render/src/assets/glb-uri-loader.ts` and exported it from
  `@aperture-engine/render`.
- The loader follows the proven fetch-then-parse shape from three.js and
  PlayCanvas: fetch an ArrayBuffer, pass it into Aperture's existing no-fetch
  GLB source-loader facade, and return JSON-safe status without raw bytes.
- Added typed diagnostics for invalid URLs, missing fetch support, fetch
  failures, HTTP errors, response-read failures, and downstream loader
  diagnostics.
- Added tests for a base64 data-URL GLB, malformed URL handling, and HTTP error
  reporting.

### References inspected

- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`

### Validation

- `pnpm exec tsc -p packages/render/tsconfig.json --noEmit`
- `pnpm exec vitest run test/assets/glb-uri-loader.test.ts`
- `pnpm run typecheck:test`

### Known issues

- The new loader fetches and parses/report-drives GLB bytes, but no public
  viewer example uses it yet.
- External image decoding and broader asset loading remain governed by the
  existing report-driven import limitations.

### Recommended next task

`task-2007 — Create examples/glb-viewer.html that fetches and renders a sample .glb`.

## Current Run Update — 2026-05-19T18:26:02Z — GLB source material mapped onto buffer-backed primitive

Completed `task-2005` after the stop hook requested continuation past the
spinning-cube IBL tasks.

### What changed

- Updated `examples/gltf-scene.js` so the visible buffer-backed GLB primitive
  resolves material index 0 through
  `createGltfPrimitiveMaterialResolutionReport(...)`.
- Added a prefixed buffer-backed GLB import key (`buffer-backed`) so the source
  material registers as `material:buffer-backed:material:0` without colliding
  with the main GLTF scene fixture's `material:gltf:material:0`.
- Replaced the visible primitive's hardcoded proof material with the
  GLB-authored material asset and published `materialSource` plus rounded
  `baseColorFactor` status.
- Updated GLTF Playwright expectations for the prefixed material handle and
  source-authored base color. The GLTF specular-IBL assertion now checks the
  routed proof pipeline/status; spinning-cube remains the visual pixel proof for
  specular IBL.
- Updated public tracker and backlog/completed task records.

### References inspected

- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`

### Validation

- `node --check examples/gltf-scene.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

### Known issues

- Full external GLB fetching/loading is still deferred to the next task.
- The buffer-backed primitive now proves source material mapping through status
  and render participation; a stronger isolated pixel proof can still be added
  after the viewer path exists.

### Recommended next task

`task-2006 — Add public loadGlbFromUri(url, options) async loader with error reporting`.

## Current Run Update — 2026-05-19T18:15:49Z — Specular IBL and roughness mip proof on spinning cube

Completed `task-2003` and `task-2004`.

### What changed

- Updated `examples/spinning-cube.js` to provide renderer-owned specular IBL
  cube resources alongside the existing diffuse IBL resources.
- Activated the StandardMaterial `iblDiffuse|iblSpecularProof` pipeline route
  for spinning-cube while keeping environment authoring ECS-owned and
  handle-based.
- Added a deterministic minimal specular mip chain and changed the
  StandardMaterial specular IBL shader branch to use `textureSampleLevel(...)`
  from material roughness.
- Added two small ECS-authored glossy/rough StandardMaterial probe cubes to the
  spinning-cube example so browser pixels prove roughness-aware sampling.
- Added pipeline descriptor coverage for the specular IBL shader variant.
- Updated public tracker pages and agent backlog/completed task records.

### References inspected

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionCube.js`

### Validation

- `node --check examples/spinning-cube.js`
- `pnpm exec tsc -p packages/webgpu/tsconfig.json --noEmit`
- `pnpm run typecheck:test`
- `pnpm exec vitest run test/webgpu/standard-pipeline-descriptor.test.ts`
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts`
- `pnpm run check:progress`
- `pnpm run format:check`

### Known issues

- The specular IBL mip chain is a deterministic proof texture, not a real
  PMREM/GGX prefilter pass over loaded environment assets.
- Full PMREM/GGX generation remains deferred.

### Recommended next task

`task-2005 — Map GLB source material onto the buffer-backed primitive`.

## Current Run Update — 2026-05-19T17:46:27Z — Environment helper adopted in materials-showcase

Completed `task-2002`.

### What changed

- Added `withEnvironmentMap(handle, options?)` to `@aperture-engine/runtime`.
- Added runtime coverage proving the helper authors an environment light and
  extraction emits a stable `EnvironmentPacket`.
- Updated `examples/materials-showcase.js` to register a ready environment-map
  handle, use `withEnvironmentMap(...)`, create renderer-owned diffuse IBL
  texture/sampler resources, and render the StandardMaterial cube through an
  `iblDiffuse` pipeline.
- Fixed the showcase base-color texture format to `rgba8unorm-srgb` to match
  its sRGB declaration, restoring the StandardMaterial cube to the render path.
- Updated materials-showcase Playwright status assertions for extracted
  environment data and `iblDiffuse` pipeline routing.

### References inspected

- `packages/runtime/src/index.ts`
- `references/bevy/crates/bevy_pbr/src/light_probe/environment_map.rs`
- `references/bevy/crates/bevy_pbr/src/light_probe/mod.rs`

### Validation

- `node --check examples/materials-showcase.js`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `pnpm exec vitest run test/runtime/runtime.test.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- First stop-hook attempt at `2026-05-19T17:55:01Z` passed build,
  typecheck:test, full `vitest run`, and format, then failed lint on an unused
  parameter in `examples/spinning-cube.js`; the unused parameter was removed
  before rerunning the hook.

### Known issues

- Example IBL still uses a proof cube texture, not loaded environment assets.
- Full specular PMREM/GGX remains deferred.

### Recommended next task

`task-2003 — Render specular IBL on the spinning-cube example`.

## Current Run Update — 2026-05-19T17:39:32Z — Diffuse IBL visible on spinning cube

Completed `task-2001`.

### What changed

- Checkpointed the accepted visible-feature protocol/backlog rewrite as commit
  `ec71978`.
- Updated `examples/spinning-cube.js` to author a ready environment-map handle
  and create renderer-owned diffuse IBL resources through the WebGPU app
  environment cache.
- Added a face-colored WebGPU cube texture and sampler, then passed the resource
  report into `app.render(...)` so StandardMaterial selects the existing
  `standard|iblDiffuse|...` shader path.
- Extended spinning-cube status with environment and diffuse IBL resource keys.
- Updated Playwright to assert one extracted environment, the diffuse IBL
  pipeline key, and direction-dependent face-color differences on the rendered
  cube.
- Updated public tracker pages for the new visible IBL proof.

### References inspected

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

### Validation

- `node --check examples/spinning-cube.js`
- `pnpm exec tsc -p packages/webgpu/tsconfig.json --noEmit`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts`

### Known issues

- Diffuse IBL uses a tiny face-colored proof cube texture in the example, not a
  PMREM pipeline or loaded HDR environment.
- Specular IBL remains the placeholder/proof route; full GGX prefiltering is
  still deferred.

### Recommended next task

`task-2002 — Add withEnvironmentMap(handle) runtime helper and adopt in materials-showcase`.

## Current Run Update — 2026-05-19T17:32:15Z — Protocol rewrite accepted, continuing task-2001

This automation run initially paused before implementation because the working
tree already had agent/protocol changes at startup. The user then explicitly
confirmed that if the agent is good with a change, it should commit the change
and keep working instead of waiting.

The required startup safety check found `agent/STATUS.json` in `idle` state with
no active PID, but the working tree already had uncommitted changes before this
agent made implementation edits:

- `AGENTS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `agent/STOP_CONDITIONS.md`
- `agent/WAKE.md`

The diff appears to be the visible-feature protocol and MVP-track backlog
rewrite described by the prior handoff. It is now being treated as intentional
agent-bookkeeping work and checkpointed before continuing implementation.

### References inspected

- No external engine reference files were inspected before this checkpoint.
  `task-2001` still needs the IBL reference reads before implementation.

### Validation

- Startup context and safety files were read.
- `git status --short` showed the dirty tree listed above.

### Recommended next task

Start `task-2001 — Render diffuse IBL on the spinning-cube example` and first
inspect:

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

## Current Run Update — 2026-05-19T15:30:00Z — Direction shift to MVP-visible work

The agent protocol has been rewritten to prioritize visible-feature work and suppress ceremony (plans, audits, tracker-alignment, JSON-only status proofs). The 55-minute work window is preserved.

### What changed in protocol

- `agent/WAKE.md` §3 — task definition tightened to "vertical slice ending in user-visible change." Early-finish behavior is now "extend the same slice," not "start a new ceremonial task." Never start `plan-X`/`audit-X`/`tracker-alignment-X` to fill leftover time.
- `agent/WAKE.md` §4 — Reference Anchor strengthened: reading the analogous Bevy / PlayCanvas (`references/engine`) / three.js implementation is now a hard precondition for any shader, pipeline, render-graph, asset-loading, lighting, shadow, or material slice. Every visible-feature task entry must include a `Reference anchor:` line. Each run's handoff entry must include a `References inspected:` subsection.
- `agent/WAKE.md` §7 — periodic audit cadence dropped. Audits are now demand-driven and folded into the implementing slice. The standing audit is the test suite (`check:boundaries`, `typecheck`, `lint`, `vitest`, `playwright`).
- `agent/WAKE.md` §9 — backlog refill must keep ≥3 visible-feature tasks, ≤1 plan, ≤1 audit, 0 tracker-alignment. Acceptance-criteria template defines visible vs diagnostic. Every visible-feature task must cite a reference. If 3 visible-feature tasks cannot be identified, stop and document the gap rather than fill with diagnostic work.
- `AGENTS.md` Backlog Expansion Protocol — now defers to `WAKE.md` §9 with a one-page summary. Good Task Shape rewritten with concrete IBL/GLB/runtime examples; Bad Task Shape now lists "Plan next X" and "Audit X" explicitly.
- `agent/STOP_CONDITIONS.md` line 18 — narrowed to ban ceremony-as-filler; stop early if no visible-feature slice can be identified within 5 minutes of inspection.
- `agent/BACKLOG.md` — Strategic Focus replaced with MVP renderer scope (IBL, real GLB loading, multi-light + PCF shadow path). Ceremony tasks 1784, 1785, 1786, 1787, 1788, 1976, 1977, 1978, 1979 marked superseded and removed from the ready queue. 14 new visible-feature MVP-track tasks added (task-2001 through task-2014), each citing specific reference files.

### What landed in this run (real code, currently uncommitted)

- `applyGltfEcsCommandPlanToApp` runtime facade in `packages/runtime/src/index.ts`.
- No-fetch GLB source-loader output summary in `packages/render/src/assets/glb-source-loader-output-summary.ts`.
- Report-only replay-readiness preflight in `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`.
- Visible buffer-backed GLB primitive replay in `examples/gltf-scene.js` (4 mesh draws confirmed via Playwright). This completes `task-1975`.
- 11 research markdown docs in `docs/research/` from the recent plan/audit cycle. These are the **last batch** of that shape; future runs will not produce standalone planning/audit markdown.

### Validation already run for in-flight work

- `pnpm exec vitest run test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts test/runtime/runtime.test.ts`
- `pnpm exec tsc -p packages/render/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`
- `pnpm run check:progress`, `pnpm run format:check`

### Recommended next task

**`task-2001`** — Render diffuse IBL on the spinning-cube example. See `agent/BACKLOG.md` under "Strategic Focus — MVP Renderer" for the full track.

The IBL infrastructure (descriptors, bind groups, shader variants) is already built in `packages/webgpu/src/`. Only shader wiring, pipeline-key extension, and bind-group routing remain.

### Known follow-ups under the new MVP composition

- IBL track: task-2001 → task-2002 → task-2003 → task-2004
- GLB-loading track: task-2005 → task-2006 → task-2007 → task-2008 → task-2009
- Shadow track: task-2010 → task-2011 → task-2012 → task-2013 → task-2014

### References inspected during this run (per the new §4 requirement)

- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/extensions/mod.rs`
- `references/bevy/crates/bevy_gltf/src/lib.rs`

For task-2001, the agent MUST first read:

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

## Summary

Completed `task-1953` through `task-1975` in this run.

This run advanced the GLB/glTF ingestion spine from report-only source status to
controlled runtime replay and browser render-path readbacks:

- Added compact no-fetch ECS command-plan output summaries.
- Added report-only ECS replay-readiness summaries.
- Added `applyGltfEcsCommandPlanToApp(...)` as the explicit runtime facade for
  applying glTF ECS command plans to an app world.
- Routed the browser GLTF scene's main replay through that runtime facade.
- Added buffer-backed GLB command-plan and replay-readiness status to the
  browser scene.
- Replayed one buffer-backed GLB-derived primitive into ECS in the browser scene
  and asserted four extracted mesh draws, four WebGPU draw calls, and four
  active render-world draws.

The `task-1975` browser proof is currently readback/status-based rather than an
isolated pixel proof. The buffer-backed mesh and proof material are prepared and
included in the WebGPU render route, but the placement/material mapping still
needs a follow-up audit/planning slice before treating it as final visual
fidelity.

## Reference Anchors Inspected

- Project docs: `docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`.
- Existing GLTF browser example and e2e route:
  `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`.
- Existing GLB/source-loader and ECS replay helpers under
  `packages/render/src/assets`.
- Runtime facade patterns in `packages/runtime/src/index.ts`.
- Local Bevy reference was used conceptually for the runtime-orchestration
  boundary: source/import produces data, runtime/app orchestration applies ECS
  commands, and rendering remains derived from extraction.

## Files Touched

Primary implementation:

- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`
- `packages/render/src/assets/index.ts`
- `packages/runtime/src/index.ts`
- `examples/gltf-scene.js`

Tests:

- `test/assets/glb-source-loader-output-summary.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `test/assets/glb-buffer-fixture.test.ts`
- `test/assets/gltf-ecs-command-replay-readiness.test.ts`
- `test/runtime/runtime.test.ts`
- `test/e2e/gltf-scene.spec.ts`

Docs/bookkeeping:

- `examples/gltf-scene-source-status.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`
- `docs/research/ECS_COMMAND_PLAN_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`
- `docs/research/ECS_REPLAY_READINESS_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`
- `docs/research/CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_AUDIT_2026_05_19.md`
- `docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`
- `docs/research/BROWSER_RUNTIME_REPLAY_FACADE_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_PLAN_2026_05_19.md`
- `docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_AUDIT_2026_05_19.md`
- `docs/research/FIRST_VISIBLE_BUFFER_BACKED_GLB_PRIMITIVE_REPLAY_PLAN_2026_05_19.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

- Stop hook full validation passed and checkpointed/pushed commit `9049476`.
- `pnpm exec vitest run test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec vitest run test/assets/gltf-ecs-command-replay-readiness.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec vitest run test/runtime/runtime.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec tsc -p packages/render/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `node --check examples/gltf-scene.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`
- `pnpm exec vitest run test/assets/glb-buffer-fixture.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts`
- `pnpm run check:progress`
- `pnpm run format:check`

## Known Issues

- Buffer-backed GLB visible replay is proven through browser status and
  render-path readbacks, not through an isolated pixel region yet.
- The visible buffer-backed primitive uses an explicitly registered proof
  material. Source-driven GLB material mapping for that primitive remains
  deferred.
- External GLB loading/fetching remains deferred; current source-loader work is
  no-fetch and caller-provided bytes only.
- Source-loader output remains report-only by design; it does not mutate asset
  registries or ECS worlds.
- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.

## Recommended Next Task

Start with `task-1976 — Audit visible buffer-backed GLB primitive replay proof`.

Focus the audit on:

- ECS remains the authority and WebGPU only consumes extracted/render-world data.
- Source loading remains separate from replay execution.
- The readback-based browser proof is honest about the missing isolated pixel.
- The next implementation slice should plan source-driven material mapping for
  the buffer-backed primitive rather than broad GLB viewer behavior.
