# Aperture — Actionable Roadmap

**Status:** strictly-actionable backlog · generated 2026-06-08 · branch `gap-fixes-batch-1`
**Purpose:** a goal-mode-ready roadmap. Every item below is implementable now in its phase — prerequisites are sequenced into earlier phases, so there are **no blockers in this list**. Items that genuinely cannot or should not be auto-implemented are called out separately under [Excluded](#excluded--not-in-this-roadmap).
**Source:** derived from `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` (the source-verified 2026-06-08 backlog). `AI-N` ids are stable across both docs; that doc holds the full evidence and current per-item status flags.

## How to use this roadmap

- Work **phase by phase, in order**. Within a phase, respect each item's `Depends on`. Nothing depends on a later phase.
- An item is **done** when all of its acceptance criteria are met, each proven by a committed test or runnable example, and `pnpm run check` is green.
- Every item must uphold the **Global invariants** below — they are acceptance criteria for _all_ work and never budge.
- Where an item's behavior isn't fully fixed by aperture's own code, match or beat the named **reference** engine in `references/`.

## Global invariants — acceptance criteria for every item (non-negotiable)

1. **ECS is the single source of truth.** Rendering, physics, spatial, etc. are _derived_ views. Never introduce a hidden scene graph as a renderer source of truth.
2. **Simulation-authoritative, worker-by-default.** ECS simulation/logic runs in the worker; the main thread does rendering + input forwarding + IO only. No WebGPU in the sim worker; no ECS mutation on the main thread; changes stay worker-snapshot-friendly.
3. **Render is a pure function of the extracted snapshot.** The renderer consumes `RenderSnapshot`s and never reaches back into ECS.
4. **Deterministic where it matters.** Fixed-step sim; no wall-clock time or nondeterministic RNG in deterministic paths; same inputs → same snapshots.
5. **Loud over silent.** Any unsupported / clamped / approximated / deferred configuration emits a _structured diagnostic_; it never silently no-ops. (A diagnostic is necessary but not sufficient — see the AC style note.)
6. **Backend-neutral facades.** Physics/spatial public APIs stay backend-agnostic; backend-specific code stays in its package; no new cross-package boundary violations (`check:boundaries`).
7. **TypeScript-first, WebGPU-only.**
8. **Tested + green.** Every item ships with tests and leaves `pnpm run check` green (boundaries, typecheck, typecheck:test, lint, format, tests).

> **Acceptance-criteria style (from `AGENTS.md`):** criteria are **visible-feature / observable behavior** proven by a test or example — _what the engine can now do_ — not "a status field equals X" or "a diagnostic count equals N". Diagnostics are required by invariant 5 but are never the _primary_ acceptance criterion.

---

## Phase 1 — Foundations & quick wins

_High-leverage, low-coupling fixes with no prerequisites — frame-time, release, input footguns, honest diagnostics, and the benchmark harness that later phases lean on._

### AI-3 · Guarantee parented rigid bodies resolve a world pose and drop the parented rejection

**Status: ✅ DONE (2026-06-09)** — see `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` batch 9.

**Priority** P3 · **Effort** S · **Depends on** none

**Change.** The forward (parent-local -> world) and reverse (world -> parent-local) pose conversions already exist (ecs-sync.ts physicsTransformForEntity ~515-540 and localTransformFromPhysicsResult ~370-418), and stepPhysicsWorld already calls resolveWorldTransforms(world) before collecting commands (ecs-sync.ts:213). The only residual is the fallback: resolveWorldTransforms (simulation transform/resolution.ts) only processes entities that ALREADY have WorldTransform (query required:[LocalTransform,WorldTransform]), so a parented RigidBody lacking a WorldTransform still hits source:'local' and is flagged parented:true and rejected (ecs-sync.ts:466-467; backend.ts physicsBodyCommandHasUnsupportedParentedBody ~750-753 and the unsupported feature at ~547-557). Ensure parented RigidBody/Collider entities are guaranteed a WorldTransform before physics sync (register/add WorldTransform in collectPhysicsCommands or its setup so resolveWorldTransforms resolves them), then remove the parented:true branch in ecs-sync.ts and the physics.rigidBody.parentedBody.unsupported feature path in backend.ts.

**Acceptance criteria:**

- A test parents a dynamic RigidBody (with only LocalTransform + a child/own Collider, no pre-added WorldTransform) under a translated+rotated parent, steps the physics world, and the body simulates at the correct WORLD position (parent transform composed into the pose) rather than being skipped.
- After a step, that same parented body's LocalTransform is written back so its resolved world pose matches the backend pose to within 1e-4 (verifying the reverse world->parent-local conversion round-trips through writeback).
- collectPhysicsCommands no longer emits parented:true for a parented body that has (or is auto-given) a WorldTransform, and collectUnsupportedPhysicsBodyFeatures returns no physics.rigidBody.parentedBody.unsupported feature for that body (asserted via the public unsupported-feature collector, not an internal status field).
- A regression test confirms a non-parented (root) RigidBody still syncs from LocalTransform unchanged (no behavior change for the common case).

**Reference.** Rapier rigid-body world/local pose model (rapier3d-compat RigidBody.translation()/rotation()): bodies are world-space, so parented ECS authoring must compose to world before sync and decompose back on writeback — matching that contract; PlayCanvas (references/engine rigid-body component) likewise drives the backend in world space.

**Invariants.** Invariant 1/3 (ECS is source of truth; backend is a derived view): the world pose is derived from ECS WorldTransform, no hidden scene graph. Invariant 4 (determinism): conversion is pure matrix math, no wall-clock/RNG. Invariant 5 (loud): removing the rejection must not silently swallow genuinely non-invertible parent matrices — keep a structured diagnostic for the truly non-decomposable case rather than dropping the body.

### AI-11 · Skip the per-frame GPU drain when no readback is pending

**Status: ✅ DONE (2026-06-09)** — see `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` batch 9.

**Priority** P1 · **Effort** M · **Depends on** none

**Change.** Gate the unconditional `await waitForSubmittedWork(...)` (report.ts:596) at each frame path's submit site so it only runs when a CPU readback is actually needed: skip it when `boundaries.occlusionQueryCount === 0 && boundaries.gpuTimingReadbacks.length === 0 && boundaries.readbackBoundary === null`. Apply in frame-loop.ts:940, sprite-frame.ts:232 (readback-only, so gate purely on readbackBoundary), custom-wgsl-frame.ts:334, mixed-custom-wgsl-frame.ts:493, and queued-built-in-frame.ts:470. Leave picking-frame.ts:342 untouched (it precedes a real pick-id buffer + error-scope readback). Extract a small `requiresSubmittedWorkDrain(boundaries)` helper in report.ts next to `waitForSubmittedWork` so all five sites stay identical.

**Acceptance criteria:**

- A built-in frame rendered against a mock device whose queue.onSubmittedWorkDone is a spy, with no readbackSamples and no occlusion/timing queries, completes without ever awaiting onSubmittedWorkDone (spy call count 0) and still returns a valid render report.
- A frame that requests readbackSamples awaits onSubmittedWorkDone exactly once and returns the same mapped readback pixels as before the change (byte-identical to a golden captured from the current code path).
- A frame with occlusion-query draws awaits onSubmittedWorkDone and produces an occlusionQueries report with status 'ready' and the same visible/occluded render-id partition as today, and the occlusion feedback state advances identically.
- The sprite frame path, which has no occlusion or timing readbacks, drains only when readbackBoundary is non-null, proven by a test that renders a sprite frame both with and without readbackSamples and asserts the drain spy is called 0 vs 1 times.
- picking-frame still awaits onSubmittedWorkDone before reading the pick-id buffer, proven by an existing/added pick test that resolves a non-null picked entity id.

**Reference.** Bevy render extract/prepare pipeline (references/bevy/crates/bevy_render): GPU readback is pulled only by systems that requested a buffer copy, never as a blanket post-submit barrier. Match Bevy by making the CPU<-GPU sync demand-driven rather than per-frame.

**Invariants.** Invariant 3 (renderer consumes extracted snapshots, never reaches back into ECS) and 5 (loud over silent) are load-bearing: the gate is a pure no-op-avoidance over the same boundaries object, readback/occlusion/timing reports and their diagnostics are byte-identical when a readback IS requested, so unsupported/clamped paths still emit their structured diagnostics. No change to snapshot extraction, so worker-snapshot-friendliness (invariant 2) is preserved.

### AI-17 · Apply the shared output-stage tonemap/encode contract to every built-in material family

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Generalize the output color-space + tonemap WGSL injection so it is family-agnostic instead of standard-only. Today `applyOutputTonemapToStandardShader` (packages/webgpu/src/output/output-stage-tonemap.ts:145-183) keys off the standard-specific marker `return vec4f(color, alpha);`, and pipeline-resources.ts:62-67,124-135 hard-codes `tonemap:none`/`outputColorSpace:linear` for unlit/matcap/debug-normal (and sprite/text/ui/particle pipelines never receive tonemap/encode at all). Add a reusable `applyOutputStageToBuiltInShader(shader, operator, outputColorSpace)` helper in output-stage-tonemap.ts that wraps each shader's existing fragment entry point (renames `fs_main`/`fs`, emits a thin entry calling `apertureOutputColorSpace(apertureOutputTonemap(inner.rgb))` while preserving alpha) rather than depending on the standard return string; thread `tonemap?`/`outputColorSpace?` options through createUnlitRenderPipelineResource, createMatcapRenderPipelineResource, createDebugNormalRenderPipelineResource, createSpriteRenderPipelineResource, createMsdfTextRenderPipelineResource, createUiQuadRenderPipelineResource, and createParticleRenderPipelineResource the same way standard-pipeline.ts:114-121 does, and stop forcing `tonemap:none`/`linear` in pipeline-resources.ts for the non-standard kinds (passing options.app.tonemap/outputColorSpace, still 'none'/'linear' on the HDR-scene-buffer path so the single post-tonemap.ts encode point stays authoritative).

**Acceptance criteria:**

- An unlit material rendered to a non-HDR 8-bit swapchain produces the sRGB-encoded output color (matching a standard material fed the same linear input), proven by a webgpu test asserting the unlit pipeline shader code contains `apertureOutputColorSpace(apertureOutputTonemap(` and the pipeline cache key carries `output-color:srgb` (extending test/webgpu/output-stage-tonemap.test.ts / a new unlit-pipeline encode test).
- matcap, debug-normal, sprite, msdf-text, ui-quad, and particle pipelines each emit the tonemap+color-space wrapper when a non-default operator/color space is requested, proven by a parameterized test over every family asserting the wrapped fragment compiles (entry point preserved, alpha untouched) and the cache key includes both the tonemap and output-color tokens.
- Requesting `tonemap:none`+`outputColorSpace:linear` (the HDR-scene-buffer path) leaves each family's shader byte-identical to today, proven by a test comparing the unwrapped shader output so post-tonemap.ts remains the single encode point when HDR is active.
- A tonemap-showcase-style scene containing an unlit/sprite object reports the same outputColorSpace pipeline key (`output-color:srgb`) for the non-standard draw as for standard draws, extending test/e2e/tonemap-showcase.spec.ts to assert encode parity across families.

**Reference.** three.js src/renderers/shaders/ShaderLib (meshmatcap.glsl.js:104-106, meshbasic.glsl.js:108-110, points.glsl.js:80-82) — every material family terminates its fragment with identical `<tonemapping_fragment>`+`<colorspace_fragment>` chunks. Match that single family-agnostic output-stage contract instead of aperture's current standard-only injection.

**Invariants.** Inv 7 (WebGPU-only, TS-first) and Inv 5 (loud over silent): the encode must be applied or explicitly skipped per route, never silently dropped for a family — the HDR path defers to the post stage, the LDR path encodes in-material, and both are test-asserted. Inv 3 holds: this is pure renderer-side shader/pipeline wiring consuming the already-extracted snapshot, with no reach-back into ECS.

### AI-18 · Surface deferred clustered shadow/cookie sampling as a structured host diagnostic

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** Make the silent clustered-shadow/cookie fallback loud. When SHADOW*REQUEST/COOKIE_REQUEST is set but the selected pipeline variant cannot sample, local-light-cluster-metadata.ts:117-118,167-168 sets the *\_SAMPLING*DEFERRED flag and standard-shader-light-sampling.ts:392-410 emits only the near-1.0 sentinel (0.99999994) — host-undetectable. The cluster summary already classifies this: shadow/cookie `status:'metadata-only'` with `fallbackReason:'clustered-local-shadow-sampling-not-implemented'`/`'clustered-local-cookie-sampling-not-implemented'` (local-light-cluster-metadata.ts:209-260). Surface it as a structured RenderDiagnostic: in the local-light-cluster report path that consumes the descriptor's `shadowCookieMetadata` summary (packages/webgpu/src/app/report.ts:410-452 createWebGpuAppLocalLightClusterReport, building from createLocalLightClusterDescriptor), emit `webGpuApp.clusteredLocalShadowSamplingDeferred` / `webGpuApp.clusteredLocalCookieSamplingDeferred` warning diagnostics (with the light count and fallbackReason) whenever shadow/cookie status is `metadata-only`, threading them into the WebGpuApp frame report.diagnostics array alongside the existing `webGpuApp.*` codes. Keep the sentinel as the in-shader visual cue but stop it being the only signal.

**Acceptance criteria:**

- Rendering a scene with a clustered point/spot light that has a shadow request whose pipeline variant does not support clustered shadow sampling produces a `webGpuApp.clusteredLocalShadowSamplingDeferred` warning diagnostic carrying the deferred light count, proven by a webgpu test feeding a snapshot with shadowRequests but no supported shadow resource (extending test/webgpu/local-light-clusters.test.ts).
- The same scene with a cookie-textured local light whose variant lacks cookie sampling produces a `webGpuApp.clusteredLocalCookieSamplingDeferred` diagnostic, proven by a test asserting the diagnostic appears when cookie status is `metadata-only`.
- When the selected variant DOES support sampling (supported shadow/cookie resources present), no deferred diagnostic is emitted and the existing sampling-ready behavior is unchanged, proven by an assertion that the diagnostics array contains neither deferred code for a sampling-ready snapshot.
- The diagnostic message text includes the underlying fallbackReason string from the cluster summary so the host can tell shadow-not-implemented from cookie-not-implemented, proven by a test asserting the message contains `clustered-local-shadow-sampling-not-implemented` / `clustered-local-cookie-sampling-not-implemented`.

**Reference.** Bevy crates/bevy_pbr/src/cluster/mod.rs + render/pbr_lighting.wgsl — Bevy resolves clustered light shadow/cookie sampling against the actually-bound resources and never silently substitutes a near-white sentinel for an unsatisfiable request. Match Bevy's honesty by making the unsatisfiable request observable host-side rather than only a shader sentinel.

**Invariants.** Inv 5 (loud over silent) is the load-bearing invariant: an approximated/deferred sampling config must emit a STRUCTURED diagnostic, not just the 0.99999994 sentinel. Inv 3 respected: the diagnostic is derived from the extracted snapshot's cluster descriptor summary on the render side; no ECS reach-back. Inv 6: stays inside the webgpu backend package, no new cross-package boundary.

### AI-47 · Add a wheel input event kind and a worker-side UiScroll wheel/drag mapping system

**Priority** P1 · **Effort** L · **Depends on** none

**Change.** Add canvas.addEventListener('wheel', ...) in packages/app/src/browser/input.ts (alongside the pointer listeners at lines 49-89) emitting a new {kind:'wheel', deltaX, deltaY} event via forwardInput; add ApertureGeneratedWheelInputEvent to the ApertureGeneratedInputEvent union in packages/app/src/input/types.ts (lines 73-79) and handle it in InputResourceImpl.#applyEvent (state.ts lines 116-164), accumulating a per-frame wheel delta signal that resets in advanceFrame() (it is reset-frame state like keyboard edges). Add a worker-side system that reads the resource wheel delta + active pointer drag and writes clamped UiScroll.offset (the existing mutable ECS Vec2 component in authoring-components-core.ts:197-204) on the hovered scroll node, with optional inertia decay. extraction-ui.ts readScrollOffset (lines 556-567) already reads the live ECS UiScroll.offset, so the renderer needs no change beyond confirming it reflects the mutated value. Optionally expose the wheel delta so the orbit controller (controllers/orbit-camera.ts wheelToZoom/zoom) can dolly.

**Acceptance criteria:**

- A new test in test/app/input-state.test.ts feeds {kind:'wheel', deltaX, deltaY} through advanceInputResource and observes the resource report that exact wheel delta for the frame, then zero on the next advanceFrame() with no event (proving per-frame reset, not accumulation).
- A worker-side scroll-system test creates an entity with UiScroll{enabled:true, offset:[0,0]}, runs a frame with a downward wheel delta over that node, and asserts the entity's UiScroll.offset advanced by the mapped amount; a second test with a large delta asserts the offset is clamped to the content/viewport bound rather than overscrolling.
- An extraction test (extending an existing UI extraction test) sets UiScroll.offset to a non-authored runtime value and asserts the extracted UI snapshot shifts child layout by that mutated offset, confirming the renderer consumes live ECS scroll state.
- A test asserts wheel events are forwarded but produce no scroll mutation when UiScroll.enabled is false (loud-but-inert: no silent offset drift).

**Reference.** PlayCanvas keyboard-mouse-source.js \_onWheel (reads event.deltaY into a per-frame delta) and scroll-view/component.js \_onMouseWheel + SCROLL_MODE_CLAMP \_clampScrollValue (clamp to [0, maxScroll]) and friction-based inertia (\_velocity \*= 1-friction). Match its per-frame-delta + clamped-scroll semantics; we keep the offset in ECS rather than a DOM scroll-view.

**Invariants.** Invariants 1/2/3: scroll state stays in the ECS UiScroll component (single source of truth), the mapping system runs worker-side reading the input resource and mutating ECS only, and the renderer's extraction-ui keeps reading the extracted offset without reaching back into ECS. Invariant 5: an unsupported/disabled scroll node is reported loud (inert), never silently advanced.

### AI-72 · Cut the first real v\* release and enable a changelog

**Priority** P1 · **Effort** M · **Depends on** none

**Change.** Flip `changelog` in .changeset/config.json from `false` to a generator (`@changesets/changelog-github` with repo config, or the bundled `@changesets/cli` changelog), add it as a devDependency, then run `changeset version` to consume the 14 staged .changeset/_.md, bumping the fixed group (packages/_/package.json, currently all 0.1.0) and writing per-package CHANGELOG.md. Push a v* tag so release.yml's publish job (gated `startsWith(github.ref,'refs/tags/v')`, .github/workflows/release.yml:49-80) runs `pnpm run release:publish` -> `changeset publish`, which packs each package converting the `workspace:^` inter-package specs to concrete versions (already enforced by scripts/check-package-publish-readiness.mjs checkWorkspaceDependencySpecs at :215-223 and verified in the packed tarball at :195). NOTE: scope said `workspace:*`but the repo actually uses`workspace:^`.

**Acceptance criteria:**

- Running `pnpm run version-packages` (changeset version) on the 14 staged changesets bumps every fixed-group package from 0.1.0 in lockstep and writes a CHANGELOG.md per package whose entries are sourced from the changeset summaries; a test/script asserts the changelog files exist and are non-empty after version.
- After `changeset version`, the .changeset/ directory contains no consumed \*.md changesets (only config.json remains), provable by a check script that counts staged changesets == 0.
- `pnpm run check:release-config` stays green with the new `changelog` generator value (extend scripts/check-release-config.mjs checkChangesetConfig to accept the generator instead of asserting `false`), proving the release-config gate validates the changelog setting.
- Packing the published packages (`pnpm run check:publish:pack`) produces tarballs whose package.json dependency specs are concrete semver, not `workspace:^`, so an external `npx @aperture-engine/cli create` resolves @aperture-engine/\* from the registry — asserted by the existing packed-dependency inspection.
- `pnpm run check` remains green end-to-end with the changelog generator enabled and the version bump applied.

**Reference.** changesets (config schema `changelog` field + @changesets/changelog-github) and PlayCanvas references/engine/.github/workflows/publish.yml for tag-gated publish; match changesets' fixed-group lockstep versioning and tag-triggered publish.

**Invariants.** Invariant 8 (tested + green): the bump must leave `pnpm run check` (incl. check:release-config, check:publish) green. Invariant 5 (loud over silent): the release-config gate must actively validate the new changelog generator rather than silently accepting any value. No runtime/architecture invariants touched — this is build/release tooling only.

### AI-76 · Commit render/extraction micro-benchmarks and a vitest bench harness

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Add committed vitest benchmarks using the `bench` API (vitest 4.1.6 exposes `export { bench }`) covering extraction (extractRenderSnapshot in packages/render/src/rendering/extraction.ts), transform packing (transform-pack-scratch.ts / transform-pack.ts), frustum culling (extraction-culling.ts), draw-list/package coalescing (draw-package.ts), and GPU buffer upload + command-encode (packages/webgpu indirect-draw / frame-boundary writeBuffer paths) at multiple scene scales (e.g. 10/100/1k/10k entities, mirroring Bevy's extract bench). Place the files in the existing top-level test tree (test/rendering/_.bench.ts, test/webgpu/_.bench.ts) NOT under packages/_/src — package tsconfig.json uses include:["src/\*\*/_.ts"] and would emit them into dist and break check:publish; the vitest bench glob `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)` already finds them in test/. Add a `"bench": "vitest bench"` script to package.json and a scene-scale frame-time assertion harness with CI budget thresholds (e.g. fail when median writeBuffer time per frame exceeds a documented budget and encode exceeds its budget).

**Acceptance criteria:**

- `pnpm run bench` discovers and runs the committed benchmarks and reports per-scale timings for extraction, transform packing, frustum culling, draw-list coalescing, and buffer upload/encode without erroring.
- A committed budget test (run under the normal `vitest run` / `pnpm test` gate, not only `bench`) builds a synthetic N-entity scene, runs extraction + transform packing for several frames, and fails if the measured per-frame writeBuffer-equivalent work or encode work exceeds the documented threshold, proving the budget is enforced in CI.
- Running the extraction benchmark at increasing entity counts (e.g. 100 vs 10k) shows monotonically increasing total time, demonstrating the harness measures real scene-scale cost rather than fixed overhead.
- The benchmark scene builder reuses the public extraction/packing APIs (extractRenderSnapshot, the transform-pack scratch) and produces a RenderSnapshot whose report counts match the constructed entity count, so the benchmark exercises the production path.
- `pnpm run check` stays green with the new files present (boundaries, typecheck, typecheck:test, lint, format, tests), confirming bench files live outside the package builds and headless packages import no WebGPU globals.

**Reference.** Bevy references/bevy/benches/benches/bevy_render/extract_render_asset.rs: scales the extracted payload across [10,100,1k,10k,100k] with Throughput::Elements and iter_custom time measurement. Match its multi-scale, time-budgeted structure using vitest `bench` (Tinybench) as the JS equivalent; beat it by adding committed CI budget thresholds rather than ad-hoc local runs.

**Invariants.** Invariant 8 (tested + green) is the whole point of this item. Invariant 4 (determinism) is load-bearing for the budget test: the synthetic scene must be built from fixed inputs so the same scene yields the same snapshot counts run-to-run; timing assertions use a generous documented budget, not wall-clock equality, to stay deterministic-friendly. Invariant 6/7: render/webgpu benches respect package boundaries (no WebGPU globals leak into render-package benches).

### AI-86 · Replace machine-specific doc paths with portable references

**Priority** P3 · **Effort** M · **Depends on** none

**Change.** Per-doc curation replacing every hardcoded machine-specific home-directory absolute path with a portable form. AUDIT CORRECTION: the scope undercounted the affected set — 12 docs contain the path, not 5: docs/DEVELOPER_API_PROPOSAL.md(4), docs/MVP_3D_CONCEPTS.md(3), docs/FRAMEWORK_GAP_ACTION_ITEMS.md(2), docs/INPUT_STATE_AND_ACTION_PLAN.md(5), docs/SOTA_ROADMAP.md(3), docs/SPATIAL_QUERY_RESHAPE_PROPOSAL.md(1), docs/RAG_REFERENCE_PLAN.md(15), docs/ROADMAP.md(3), docs/WEBXR_IMPLEMENTATION_PLAN.md(7), docs/research/MATH_LIBRARY_DECISION.md(2), docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md(16), docs/research/MESH_GEOMETRY_COVERAGE.md(26). Two path roots: (a) `aperture-reference-libs/{Babylon.js,gl-matrix,wgpu-matrix}` — these engines are NOT in scripts/setup-references.sh REPOS (which restores bevy/engine/three-mesh-bvh/three.js/uikit/three.quarks at pinned SHAs, lines 64-71), so they need an upstream URL+SHA citation or removal; (b) `immersive-web-sdk` — a private project with no public equivalent, must be de-referenced or noted as non-restorable. In-repo references (bevy/three.js/etc.) become repo-relative `references/...` paths. Add a CI guard (a node script) that scans the docs tree for absolute home-directory paths and fails.

**Acceptance criteria:**

- A repo-relative checkout of aperture on any machine can follow every reference path that points to a setup-references-restored engine: a guard script greps `docs/**/*.md` and finds zero `references/<engine>/...` paths whose engine is absent from scripts/setup-references.sh REPOS.
- A new CI/check script (wired into `pnpm run check`) scans the docs tree for absolute home-directory paths and exits non-zero if any remain, proving no machine-specific path can regress in; running it after the edits exits 0.
- Babylon.js / gl-matrix / wgpu-matrix references (not restored by setup-references.sh) are each replaced by an upstream URL pinned to a SHA or explicitly marked as an external/non-restored citation, verified by the guard script finding no bare `aperture-reference-libs/` paths.
- All 12 affected docs build/lint clean (prettier `format:check` stays green) after the path rewrites.
- The private `immersive-web-sdk` paths are removed or annotated as non-public, verified by the guard finding zero `immersive-web-sdk` absolute paths in docs/.

**Reference.** aperture's own scripts/setup-references.sh pinned-SHA convention (the project's portable-reference contract); match it by citing upstream URL+SHA the same way REPOS does for any engine not restored locally.

**Invariants.** Invariant 5 (loud over silent): rather than a silent find/replace, a CI guard makes a regressed machine-path FAIL loudly. Invariant 8: must leave `pnpm run check`/format:check green. Docs-only change — no runtime invariants affected, but the guard upholds reproducibility for contributors restoring references.

### AI-87 · Prefilter every authored env map (cubemap-direct as well as equirect) so the IBL placeholder is unreachable

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** Route direct-cubemap environment maps through the PMREM prefilter so the unsupported-placeholder branch is unreachable for any authored env map. Today specularSourcesForAsset (packages/webgpu/src/app/app-environment-resources.ts:748-793) only yields a SpecularIblPmremSource from an explicit `asset.specularPmremSource` or from the equirect-derived cube (equirectProjection); an asset carrying a direct cubemap via `asset.diffuseSource.sourceTexture` (DiffuseIblCubeSource, ibl-texture-resource-types.ts:35-43) but no equirect/specular source returns undefined, so ibl-texture-resource-specular.ts:506-526 builds a placeholder cube via createDefaultSpecularIblUpload and the deferred warnings at :550-566 fire. Fix: (1) in specularSourcesForAsset, when there is no equirect projection and no explicit specularPmremSource, derive a PMREM source from the direct cube (`asset.diffuseSource.sourceTexture`/faceSize/format) so createSpecularIblPmremTextureResource runs on it; (2) once every authored path reaches the prefilter, downgrade/remove the stale 'deferred'/'unsupported' messaging in ibl-resource-descriptor.ts:179-196, ibl-texture-resource-specular.ts:550-566, and diffuse-ibl-resource-summary.ts:197-217 (keep a real diagnostic only for genuinely missing/unprepared sources).

**Acceptance criteria:**

- An environment asset supplied as a direct cubemap (no equirectSource, no explicit specularPmremSource) produces a prefiltered specular IBL texture resource (`resource.prefiltered === true`) instead of the placeholder cube, proven by a webgpu test feeding a cubemap diffuseSource through prepareWebGpuAppEnvironmentAssets and asserting the specular resource is prefiltered (extending test/webgpu/app-environment-resources.test.ts / specular-ibl-texture-resource.test.ts).
- That cubemap-direct asset no longer emits `iblTextureResource.specularProofUploadPlaceholder` or `iblTextureResource.specularPrefilteringDeferred`, proven by a test asserting those codes are absent from the diagnostics when a cube sourceTexture is present.
- An equirect-source asset and an explicit specularPmremSource asset continue to prefilter exactly as before (no regression), proven by the existing equirect/PMREM assertions still passing plus a parameterized check that all three source kinds (equirect, explicit pmrem, direct cube) report prefiltered specular.
- When an asset genuinely has no usable source (no equirect, no specular, no cube sourceTexture), a single truthful 'source not prepared' diagnostic is still emitted rather than the misleading 'prefiltering deferred' message, proven by a test feeding a sourceless asset.

**Reference.** three.js src/extras/PMREMGenerator.js — `fromEquirectangular()` (153) and `fromCubemap()` (169) both route through the same `_fromTexture` prefilter (260), so a direct cubemap is GGX-prefiltered identically to an equirect-derived cube and never falls back to an unfiltered placeholder. Match that universal prefilter coverage.

**Invariants.** Inv 5 (loud over silent): the fix removes a silent placeholder/deferral for a fully-authored input and reserves diagnostics for genuinely missing sources, so the remaining diagnostic is truthful. Inv 3/6 respected: all work is renderer-side env-resource preparation inside the webgpu package consuming extracted environment assets; no ECS reach-back and no cross-package boundary change.

---

## Phase 2 — Render graph & post-processing correctness

_Make the public render-graph/user-pass API work on the default path and give the post stack real normals + live camera params._

### AI-12 · Run user passes in the forward FrameGraph route (not just the post route)

**Priority** P1 · **Effort** L · **Depends on** none

**Change.** In packages/webgpu/src/app/frame-boundaries.ts, inside the `forwardGraph !== null` block (currently lines ~201-236 for shadows and the per-target registration ~653-678), read `options.app.userPassRegistry.list()` (filtering `enabled !== false`) and turn each descriptor into a graph node via `buildUserPassNode` (user-pass.ts) with forward-route resolvers (view: scene-color = the forward target texture view, depth = depthAttachment.view; createBindGroup via the device), inserting render passes between the forward/opaque target node and present with LOAD over the forward color (mirroring post-processing.ts:835-925), and declaring transient buffers for compute-pass writes. Reuse the same `webgpu.userPass.renderWriteCoercedToSceneColor` coercion diagnostic for non-scene-color render writes. Then update the `audit B4` comments in app.ts:497-521 once the forward path runs registered passes; either wire the legacy multi-submit path in frame-loop.ts or document the legacy path as graph-only in the comment.

**Acceptance criteria:**

- With useFrameGraph on and NO post effects (forward route), a user render pass added via app.addRenderPass draws a depth-tested overlay that appears in the rendered pixels where expected and leaves the scene intact elsewhere, proven by an e2e pixel assertion in test/e2e/custom-graph-pass.spec.ts exercising the forward (no-post) route
- With useFrameGraph on and no post effects, a user compute pass added via app.addComputePass runs in the same single submit and produces its output (e.g. a populated histogram buffer the example reads back), with its node appearing between the scene node and present in the reported graph order in custom-graph-pass.spec.ts
- A user render pass declaring a write to a handle other than scene-color is still drawn (over scene-color with LOAD) and emits the webgpu.userPass.renderWriteCoercedToSceneColor warning rather than being dropped, asserted by a unit test in test/webgpu over the forward route
- Forward-route user passes execute in registry insertion order and respect before/after ordering sugar, demonstrated by a unit test that registers two passes and observes the compiled node order
- A no-user-pass forward frame still renders byte-identically to before this change (no extra nodes, same single submit), verified by an existing forward-route pixel/report e2e remaining green

**Reference.** Bevy render graph node insertion (references/bevy/crates/bevy_render/src/render_graph) + PlayCanvas FramePass beforePasses/afterPasses (references/engine/src/platform/graphics/frame-pass.js, already cited in user-pass.ts): match their model of injecting user nodes by declared read/write edges into one ordered graph. Beat them by surfacing a structured coercion diagnostic instead of silently honoring/ignoring the write.

**Invariants.** Invariants 3 + 5 + 6 are load-bearing: the user-pass resolvers map only extracted RenderSnapshot-derived target/depth views (renderer never reaches back into ECS); non-honored render writes must emit a structured diagnostic (loud over silent); the public addRenderPass/addComputePass API and the GPU-free user-pass authoring model stay backend-neutral (no WebGPU types leak into the descriptor).

### AI-19 · Emit a packed view-space normal G-buffer target and thread a live view uniform into post prepare()

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Emit a packed view-space normal target from the lit/forward pass mirroring the existing motion-vector/indirect-color second-attachment machinery: add a normalColorFormat plumbing path (standard-pipeline.ts / standard-pipeline-descriptor.ts) and a normal-channel shader variant (new file alongside standard-indirect-channel-shader.ts) that writes encoded view-space normal to a dedicated attachment, allocate the target in post-processing.ts (both the legacy ~lines 150-280 and graph ~680-810 emission regions). In packages/webgpu/src/post/post-pass.ts add `readonly normal?: WebGpuPostPassTextureResource` to WebGpuPostEffectPrepareOptions (~line 69), a `requiresNormal?: boolean` flag on WebGpuPostEffect (~line 149), and a `readonly view?: { near; far; fovYRadians; projection }` live uniform field on prepareOptions sourced from the extracted snapshot camera (options.target.view) and passed at the two effect.prepare call sites (post-processing.ts:357 and :1000). In post-ssao.ts replace the baked NEAR_PLANE/FAR_PLANE/TAN_HALF_FOV_Y WGSL constants (lines 446-448) and the depth-reconstructed viewNormal (lines 504-513) with a real normal sample (when prepareOptions.normal is present) and bound view-uniform values, degrading to the current depth reconstruction when normal is absent.

**Acceptance criteria:**

- A lit scene rendered with the normal G-buffer enabled produces a normal target whose sampled values match the surface orientation (e.g. a front-facing quad reads ~+Z in view space), proven by an e2e/unit pixel assertion on the normal attachment
- An SSAO effect that sets requiresNormal samples the real normal target and yields occlusion that matches geometry-based expectation on a test scene (crease darkening) better than the depth-derivative reconstruction, proven by a pixel-comparison e2e against a reference image
- Changing the camera near/far/fovY between frames changes SSAO output accordingly (the view uniform is live), proven by a test rendering two frames with different camera params and asserting differing AO pixels — no shader recompile is required
- When the route does not provide a normal target, an SSAO effect that requested it emits a structured diagnostic and still renders via the depth-reconstructed fallback, proven by a unit test in test/webgpu/post-pass.test.ts
- A frame with no normal-requesting effect renders byte-identically to before (no extra attachment emitted), verified by an existing post e2e staying green

**Reference.** three.js SSRShader tNormal + cameraNear/cameraFar/cameraProjectionMatrix uniforms (references/three.js/examples/jsm/shaders/SSRShader.js:39-83,117-122 — real packed normal via unpackRGBToNormal, live camera uniforms) and Bevy normal prepass target NORMAL_PREPASS_FORMAT Rgb10a2Unorm (references/bevy/crates/bevy_core_pipeline/src/prepass/mod.rs:58,387-407): match their dedicated packed-normal target + live view uniforms, replacing aperture's baked constants and depth-derivative normals.

**Invariants.** Invariants 1 + 3 + 4 + 5 are load-bearing: the normal target is a DERIVED view written by the lit pass, and the live view uniform is sourced strictly from the extracted RenderSnapshot camera (renderer never reads ECS); same camera inputs must yield the same normal/AO pixels (determinism); a missing normal target must emit a structured diagnostic and fall back rather than silently producing wrong AO.

### AI-20 · Rewrite SSR as general screen-space reflection (real normals + live view, drop floor mask + mirror fallback)

**Priority** P2 · **Effort** L · **Depends on** AI-19

**Change.** In packages/webgpu/src/post/post-ssr.ts, set requiresNormal and consume the AI-19 plumbing: remove the floor-specific receiverMask (line 525-528) so reflections are computed for all surfaces; remove the vertical-mirror fallback block (lines 572-576) that fakes a reflection when ray-march misses; replace the depth-reconstructed viewNormal (the cross-derivative function at 487-496, called at line 532) with the real view-space normal sampled from AI-19's normal target; and replace the baked NEAR_PLANE/FAR_PLANE/TAN_HALF_FOV_Y WGSL constants (emitted from construction options at lines 48-58, defined at lines 419-421) with the live view uniform threaded through prepareOptions.view from AI-19. Keep a graceful degraded path (depth-reconstructed normal) only when the normal target is absent, surfaced via diagnostic.

**Acceptance criteria:**

- SSR produces a plausible reflection on a NON-floor reflective surface (e.g. a vertical reflective wall) where the old floor-mask path produced none, proven by an e2e pixel assertion in a new/updated ssr scene
- A ray-march miss no longer fabricates a vertical-mirror reflection: a surface with nothing to reflect shows the unmodified source color, proven by a pixel test comparing a miss region to the input
- Reflections respond to surface orientation from the real normal target (a tilted reflector reflects a different region than a flat one), proven by a pixel-comparison e2e on two reflector orientations
- Changing camera near/far/fovY at runtime changes SSR ray-march results via the live view uniform with no shader recompile, proven by a two-frame test asserting differing reflection pixels
- When no normal target is supplied, SSR falls back to depth-reconstructed normals and emits a structured diagnostic rather than rendering incorrectly, proven by a unit test in test/webgpu

**Reference.** three.js SSRShader (references/three.js/examples/jsm/shaders/SSRShader.js:117-122,138-146,223 — getViewNormal from tNormal, view-march using cameraNear/cameraFar/cameraProjectionMatrix, no floor mask or mirror fallback): match its general screen-space reflection using a real normal G-buffer and live camera uniforms, replacing aperture's floor-masked + mirror-fallback approximation.

**Invariants.** Invariants 3 + 4 + 5 are load-bearing: SSR is a derived post pass that must read only the extracted normal target + snapshot-derived view uniform (never ECS); identical camera/scene inputs must yield identical reflections (determinism); dropping the fake mirror fallback removes a silent approximation, and the remaining depth-reconstruction fallback must emit a structured diagnostic when used.

### AI-23 · Realize transient texture aliasing via a shared descriptor+slot-keyed pool in the executor

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Add a per-frame shared transient texture pool keyed by descriptorKey+slot. In packages/webgpu/src/render/graph/frame-graph-execute.ts, where transient write/read handles are resolved to GPU views (the resolveAttachment path in encodeRenderNode, ~lines 247-287, and a new transient resolver), consult CompiledFrameGraph.aliasing (the FrameGraphAliasingAssignment.aliasedFrom/slot already computed in frame-graph-compile.ts:462-543) so transients with non-overlapping lifetimes that share a slot reuse one pooled GPUTexture instead of allocating one per handle, with correct load/store + first-use clear handling. Since today's forward/post routes allocate transients upstream in frame-boundaries.ts (declareTransient + buildFrameBoundaryTargetPlan) and resolve via resolveRenderBoundary, either move transient texture realization into the executor pool or have the route consult an exported pool keyed by the compiled aliasing. Update the frame-graph-compile.ts:83-90 'ANALYSIS ONLY (audit L15)' doc comment to state the executor now consumes the assignments.

**Acceptance criteria:**

- A frame graph with two transient color textures of identical descriptor and disjoint lifetimes executes correctly and allocates exactly ONE physical GPUTexture for both (the second aliases the first), proven by a unit test counting device.createTexture calls in test/webgpu
- Two transients with OVERLAPPING lifetimes (one is read after the other is written, both live simultaneously) each get their own physical texture and the rendered result is correct, proven by a unit test asserting two distinct textures and a pixel/report check
- Transients with differing descriptors (size/format/sampleCount) never share a pooled texture, asserted by a unit test that varies the descriptor key and observes separate allocations
- An end-to-end forward+post route (e.g. test/e2e/post-effects.spec.ts) renders pixel-identically to the pre-aliasing baseline while using fewer transient texture allocations, proven by the existing post-effects pixel e2e staying green
- A pooled texture reused across slots is correctly re-cleared on its next first write (no stale contents bleed through), proven by a unit test that writes pass A, reuses the slot in pass B with a clear, and asserts B's pixels

**Reference.** Bevy transient/render-graph resource reuse + three.js PassNode history lifetime model (references/three.js/src/nodes/display/PassNode.js, already cited in frame-graph-compile.ts) and PlayCanvas FrameGraph.\_compilePasses store rules (references/engine/src/scene/frame-graph.js): match Bevy's liveness-based aliasing by actually realizing the saving the compiler already computes.

**Invariants.** Invariants 1 + 4 + 5 are load-bearing: pooling is a renderer-internal memory optimization that must not become a second source of truth and must produce identical derived pixels (determinism — same inputs yield the same snapshot pixels); any handle that cannot safely alias (descriptor mismatch, overlapping lifetime, unresolved) must fall back to its own allocation loudly rather than silently corrupting contents.

### AI-25 · Make the FrameGraph route config-driven, flip the default on at parity, and gate it in e2e

**Priority** P3 · **Effort** S · **Depends on** AI-12

**Change.** With AI-12 landed (forward route now runs user passes), finish the two residuals. (1) Flip the default to ON: change useFrameGraph default in packages/webgpu/src/app/create-webgpu-app.ts:109 once the forward graph covers the relevant routes (no-post / shadow / transmission-grab / now user passes), with the route still falling back to legacy for any uncovered case. (2) Optionally retire the ?graph=1 URL override in packages/app/src/browser/frame-graph-route.ts:9-14 in favor of the render.frameGraph config option (or document why both remain). Ensure the graph route is exercised by the gating e2e set in .github/workflows/ci.yml (extend the M3 render-graph job, currently scoped at ci.yml:84-97, to include post-effects.spec.ts / taa.spec.ts / camera-clear-load-matrix.spec.ts under the graph route).

**Acceptance criteria:**

- A browser app created with no explicit useFrameGraph option renders through the single-encoder graph route by default and the rendered scene is pixel-identical to the prior legacy default, proven by an e2e in test/e2e (e.g. camera-clear-load-matrix.spec.ts) running with the default config
- Setting render.frameGraph: true (no query string) enables the graph route reproducibly, and setting it false forces legacy, proven by a unit test over resolveUseFrameGraph plus an e2e that loads without ?graph=1
- The CI render-graph job runs post-effects, taa, and custom-graph-pass specs through the graph route and they pass on SwiftShader, verified by the updated .github/workflows/ci.yml job invoking those specs
- A route the forward graph does not cover still falls back to legacy and renders correctly with no regression, proven by an existing e2e for that route staying green under the new default

**Reference.** n/a (fixed by aperture spec — the M3 design decision to make the graph route config-driven and default-on at parity; informed by Bevy's always-on render-graph default in references/bevy where the graph is the only path).

**Invariants.** Invariants 4 + 8 are load-bearing: flipping the default must not change derived output (same snapshot inputs yield the same pixels as the legacy path) and must keep pnpm run check + the e2e gating set green; the config option keeps behavior reproducible without wall-clock/URL nondeterminism.

---

## Phase 3 — Dirty-tracking & GPU-driven scale

_Stop paying O(all entities) every frame: incremental transforms/uploads, persistent caches, spatial broad-phase, and GPU-driven draws._

### AI-6 · Route multi-pick / large-scene bounds raycasts through a membership-diffed EntityBoundsBvh

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** In packages/app/src/spatial/index.ts createSpatialQueries, construct and own an EntityBoundsBvh (packages/simulation/src/spatial/entity-bounds-bvh.ts) alongside the linear bounds array. On setBounds, membership-diff the incoming SpatialRaycastableBounds against the current set: rebuild via createEntityBoundsBvh only when entity membership changes, and otherwise call bvh.updateBounds(entity, ...)+refitDirty for transform-only changes. Route raycastAll (and raycastFirst once the registered bounds count exceeds a tuned threshold) through bvh.raycast, keeping raycastBoundsHit/Hits (packages/app/src/spatial/bounds.ts) for tiny counts. EntityBoundsBvh today only exposes updateBounds/refitDirty/count with no incremental add/remove, so the membership path must recreate the structure (or add an add/remove API in entity-bounds-bvh.ts) — confirm and pick one in the impl. Add facade tests under test/app/.

**Acceptance criteria:**

- A new test in test/app/spatial-queries.test.ts registers many bounds entities (e.g. 500), then raycastFirst/raycastAll return exactly the same entities, distances, and ordering as the existing linear path for the same rays (parity asserted against raycastBoundsHits output).
- After setBounds reports only transform changes (same entity membership), a follow-up raycast returns hits reflecting the moved bounds, proving updateBounds+refitDirty were applied without a full rebuild (verified by a test that moves an entity and asserts the new nearest hit).
- After setBounds adds and removes entities, raycastAll never returns a removed entity and does return a newly added one (membership-diff correctness test).
- raycastAll still honors layerMask, maxDistance, query.entities filtering, and Pickable blocksLower/priority ordering identically to the linear path (asserted in the parity test with those options set).
- Below the configured count threshold the facade still produces identical results, so small scenes are unaffected (test with a 2-entity scene asserting byte-identical hit list to the linear scan).

**Reference.** three-mesh-bvh (references/three-mesh-bvh/src/core/MeshBVH.js refit() at :504 + bvhcast/shapecast) for refit-vs-rebuild membership policy; match its incremental-refit semantics (refit dirty nodes, full rebuild only on topology/membership change) for the entity-bounds broadphase.

**Invariants.** Invariant 6 (backend-neutral facade) is load-bearing: EntityBoundsBvh stays in the simulation package and the app facade only consumes it through its public API — no new cross-package leak. Invariant 4 (determinism): hit ordering must stay identical (distance then stable source order) so same inputs yield same picks. Acceptance is stated as observable raycast results, not internal node/dirty-flag state.

### AI-13 · Own and thread a persistent RenderExtractionCache across frames

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** Instantiate one RenderExtractionCache per app/extraction-app instance and pass it as options.cache into every extractRenderSnapshot call. In packages/runtime/src/index.ts createExtractionApp (currently calls extractRenderSnapshot(app.world, app.assets, { frame }) at :325 and :329 with NO cache) create the cache via createRenderExtractionCache() alongside app.world and pass { frame, cache } to both extract and stepAndExtract. Thread the same per-instance cache through packages/app/src/advanced.ts extract/stepAndExtract (which today just delegate to lowLevel). The cache, writeback (extraction-mesh-cache-writeback.ts) and cache-hit branch (extraction-meshes.ts:60-89) already exist; only the per-instance ownership/threading is missing.

**Acceptance criteria:**

- A two-frame extraction through createExtractionApp().stepAndExtract / .extract on a static scene produces a snapshot byte-identical to a cold full extraction of the same world (mesh draws, transforms, bounds), proving the persistent cache is correctness-transparent — named test in test/rendering/extraction.test.ts or a new test/runtime/ test.
- After repeated steps with no entity mutations, the engine reuses cached per-entity mesh-draw packets so the second extraction does less work than the first: a named test asserts the static-frame extraction wall time is materially below a frame where every entity is mutated (mirroring extraction.test.ts measureCachedExtraction at :591-607), through the app-owned cache rather than a local throwaway.
- Mutating one entity's transform between two app.extract calls re-extracts only that entity while the others stay served from cache, and the resulting draw for the mutated entity reflects the new world matrix — proven by a named test inspecting the changed draw's worldTransformOffset/transforms slice.
- Destroying an entity between frames evicts its cache entry so a subsequent extraction omits its draw and does not leak (cache.meshDrawEntities no longer contains the dead key), verified by a named test.

**Reference.** references/bevy crates/bevy_render/src/extract_component.rs + crates/bevy_pbr/src/render/mesh.rs RenderMeshInstances (a persistent render-world resource carried across frames, drained/reextracted only for changed entities). Match: persist the extraction cache for the app lifetime instead of per-call; beat Bevy's coarseness by keeping byte-identical output.

**Invariants.** Invariant 3 (renderer consumes extracted snapshots, never reaches into ECS): the cache lives on the extraction side and only stores derived packet templates, never ECS handles the renderer dereferences. Invariant 4 (determinism): cached output must remain byte-identical to cold extraction for identical inputs — the primary acceptance test enforces this so caching cannot perturb deterministic snapshots.

### AI-21 · Add a broad-phase frustum-cull acceleration over world AABBs in extraction

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Add a broad-phase acceleration structure (BVH/grid over per-entity world AABBs) that is consulted before the per-entity plane test. Today extraction-culling.ts isVisibleInAnyMatchingView is invoked once per entity from extraction-meshes.ts (:72 cache-hit and :112 fresh path), extraction-sprites.ts, and extraction-particles.ts — an O(entities x planes) linear scan per view. Build/refit the structure once per frame from the same world AABBs the extractors already compute (createBoundsPacket / readWorldMatrix), then for each view descend the structure to produce the visible candidate set, and update MutableViewCullStats (tested/culled/included) consistently. Keep the existing per-entity plane test as the leaf test so results are bit-identical to the current scan. Preserve the frustumCulling:false opt-out and layerMask matching.

**Acceptance criteria:**

- The existing 'culls renderables outside all matching camera frustums and reports per-view stats' test (test/rendering/extraction.test.ts:1139) continues to pass unchanged: the same entity survives, bounds length is 1, and cullStats {tested,culled,included} are reported per view.
- A new large-scene test scatters many meshes (e.g. 1000) with most outside the frustum and asserts the visible meshDraws set is exactly the in-frustum subset — identical to the result of the linear isVisibleInAnyMatchingView path on the same scene.
- Cameras that opt out of frustum culling (frustumCulling:false) still include every layer-matching entity, verified by the existing opt-out test plus the broad-phase path.
- Sprites and particles obey the same broad-phase visibility (a new test placing a sprite and a particle emitter outside the frustum asserts they are culled, matching mesh behavior).
- Per-view cullStats.tested counts only entities that reached the leaf plane test, demonstrating the broad-phase pruned candidates (asserted by tested < total entity count in the large-scene test while included matches the linear ground truth).

**Reference.** Bevy CPU visibility/frustum culling (references/bevy/crates/bevy_render/src/view/visibility + check_visibility frustum.intersects_obb) and the GPU-driven cull path (references/bevy/crates/bevy_pbr/src/render/mesh_preprocess.wgsl) for AABB-vs-frustum broad-phase structure; match Bevy's per-view candidate pruning while keeping our exact-plane leaf test as ground truth.

**Invariants.** Invariant 1/3: culling stays a derived extraction view over ECS world AABBs; no scene graph is introduced and the renderer is not consulted. Invariant 4: the broad-phase must be a pure function of the snapshot's world AABBs + view planes so identical inputs cull identically (no wall-clock/RNG). Invariant 5: any entity the structure cannot place (degenerate AABB) must fall back to the leaf test, never be silently dropped. Acceptance is visible (which draws survive), not a status field.

### AI-22 · Make indirect drawing GPU-driven and toggleable through the app render path

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Two parts. (1) Plumbing: thread enabled/minInstanceCount from app render config through prepareWebGpuAppIndirectDrawCommands (packages/webgpu/src/app/frame-boundary-support.ts:44-62, which currently drops them) into prepareIndirectDrawCommands (indirect-draw-commands.ts already accepts options.enabled/options.minInstanceCount), forwarding from the four call sites: frame-loop.ts:913, queued-built-in-frame.ts:420, custom-wgsl-frame.ts:307, mixed-custom-wgsl-frame.ts:465; surface enabled/minInstanceCount as render config in create-webgpu-app.ts. (2) GPU-driven culling: add a compute pass that writes the indirect-argument buffer on-GPU (per-instance visibility -> instanceCount/firstInstance), replacing the CPU writeIndirectArguments fill in indirect-draw-commands.ts for the GPU-capable path, with a CPU fallback when the feature/path is unavailable. Optionally add multiDrawIndexedIndirect when supported.

**Acceptance criteria:**

- With indirect drawing disabled via config, the prepared command list is byte-equivalent to the direct draw commands (status 'disabled') — asserted by a test that flips the config and compares command kinds, extending test/webgpu/indirect-draw-commands.test.ts.
- minInstanceCount threaded from config changes which draws become indirect: a test with minInstanceCount=500 leaves a 100-instance draw direct and converts a 1000-instance draw to drawIndexedIndirect.
- A GPU compute culling test feeds N instances with a known visibility pattern and asserts the resulting indirect-argument buffer contains the expected per-draw instanceCount (e.g. culled instances drop the count), proving args are produced on-GPU rather than from the CPU fill.
- When the GPU-driven path is unavailable (no createBuffer / unsupported feature), the pipeline falls back to correct CPU-built indirect args and still renders the full instance set (fallback parity test asserting identical visible draw output).
- All four frame paths (frame-loop, queued-built-in, custom-wgsl, mixed-custom-wgsl) forward the config so a single config toggle is observable in each path's prepared command list (parameterized test over the four entry points).

**Reference.** Bevy GPU-driven rendering (references/bevy/crates/bevy_pbr/src/render/build_indirect_params.wgsl + gpu_preprocess.rs / mesh_preprocess.wgsl) which writes IndirectParameters on-GPU from a compute pass; match its compute-writes-indirect-args model and its CPU-preprocess fallback (no_gpu_preprocessing.rs).

**Invariants.** Invariant 2/7: the compute culling pass is WebGPU-only and lives in the renderer (main thread), consuming the extracted snapshot — no sim-worker WebGPU, no ECS access. Invariant 5: an unsupported GPU-driven path must emit a structured indirectDraw diagnostic and fall back, never silently skip draws. Invariant 8: ships with tests and keeps check green. Criteria are visible (which draws render / argument-buffer contents), not 'status===created'.

### AI-24 · Add a MeshLodGroup component with screen-error / distance LOD selection in extraction

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Add a render-authoring MeshLodGroup component (per-level mesh ids + distance and/or screen-error thresholds) in packages/render/src/rendering/authoring-components-spatial.ts + authoring-types.ts + authoring-create-interaction.ts. In the mesh-selection path (extraction-mesh-entity-state.ts, which today only reads Mesh.meshId), when an entity has a MeshLodGroup pick the level by world-space distance / projected screen error using computeViewDepth (extraction-culling.ts) and the entity's bounding sphere radius against the matching view, then feed the selected MeshHandle into the existing submesh/draw path (extraction-meshes.ts / extraction-mesh-submeshes.ts). Note: the existing simplifiedMeshId field lives on MeshQueryAcceleration and is a SPATIAL-QUERY proxy, not render LOD — keep it as-is and introduce the LOD group as a distinct render concept (decision documented in the component doc).

**Acceptance criteria:**

- A new test in test/rendering creates an entity with a MeshLodGroup of two mesh levels and a camera near the entity, then asserts the extracted meshDraws reference the level-0 (high-detail) mesh handle.
- Moving the camera far (or shrinking the entity) past the configured threshold makes the same entity's meshDraws reference the level-1 (simplified) mesh handle — proving distance/screen-error selection switches levels.
- An entity without a MeshLodGroup is unaffected and renders its Mesh.meshId exactly as before (regression test asserting unchanged draw output).
- The selected LOD level is consistent for all submeshes of the entity within a frame and matches the per-view selection (test asserting every submesh draw points at the chosen level's mesh handle).
- A level whose mesh handle is missing/not-ready emits a structured render diagnostic and falls back to the next available level (or base mesh) rather than dropping the entity silently (test asserting both the diagnostic and that a draw is still produced).

**Reference.** Bevy LOD/visibility-range selection (references/bevy visibility_range / VisibilityRange screen-size based switching) for screen-error/distance level selection thresholds; match its hysteresis-free distance band selection (we can leave crossfade out for v1).

**Invariants.** Invariant 1/3: LOD selection is a derived extraction decision over ECS authoring components; the chosen mesh is just a different snapshot handle, not a renderer-owned graph. Invariant 4: selection must be a deterministic function of camera/view + entity transform (uses computeViewDepth, no wall-clock), so identical inputs pick identical levels. Invariant 5: a missing level is a loud diagnostic + fallback, never a silent no-op. Criteria are observable (which mesh handle is drawn), not a status field.

### AI-30 · Reuse persistent extraction scratch arrays instead of fresh number[] per frame

**Priority** P3 · **Effort** M · **Depends on** AI-76

**Change.** Hoist the per-call `number[]` accumulators in extractRenderSnapshot (packages/render/src/rendering/extraction.ts:56-67 — transforms, bones, morph*, instanceTints, instanceAttributes, quadInstance*, viewMatrices) into reusable scratch carried on RenderExtractionCache, reset to length 0 each frame, following the transform-pack-scratch.ts persistent-buffer pattern. The returned snapshot already copies each accumulator into a fresh `new Float32Array(...)` / `new Uint32Array(...)` (extraction.ts:162-182), so the returned typed arrays stay per-frame-owned and the next frame's reuse cannot alias them; appendCachedMeshDrawEntity only pushes into the live accumulator (it stores its own copied worldMatrix in the cache), so the reuse is also safe against the mesh cache writeback. When options.cache is absent, fall back to fresh arrays so callers without a cache are unaffected. Gate the change on the AI-76 extraction benchmark showing reduced allocation/GC churn.

**Acceptance criteria:**

- Calling extractRenderSnapshot twice in a row with the same world and the same RenderExtractionCache yields two snapshots whose transforms/instanceTints/viewMatrices typed arrays are distinct object instances with identical contents (no aliasing between consecutive frames).
- Mutating a returned snapshot's transforms array does not affect the next frame's extraction output, proving the per-frame copy boundary is intact after scratch reuse.
- An extraction run with a populated mesh cache (appendCachedMeshDrawEntity path) plus newly-changed entities produces the same meshDraws, bounds, and packed transforms as the pre-change implementation for the identical world (golden comparison).
- Calling extractRenderSnapshot WITHOUT a cache still works and returns correct snapshots, confirming the fresh-array fallback path.
- The AI-76 extraction benchmark, run before and after, shows a measurable drop in array allocations per frame at scale (e.g. fewer than one new scratch number[] allocated per extraction call beyond the final typed-array copies).

**Reference.** Bevy references/bevy/crates/bevy_render extract/prepare: extraction systems reuse render-world component storage across frames rather than reallocating per frame; aperture's own transform-pack-scratch.ts already embodies this (persistent data buffer reset per pack). Match that internal pattern for the extraction accumulators.

**Invariants.** Invariant 3/2 are load-bearing: the renderer consumes extracted RenderSnapshots, and snapshots must remain worker-snapshot-friendly — the returned typed arrays must stay independently owned (copied) so they can cross the worker boundary / transfer-list / SAB paths without aliasing the next frame's scratch. Invariant 4: extraction stays deterministic (same world -> same snapshot) since scratch is fully reset each frame. Reuse is an internal allocation optimization only; no observable output change.

### AI-60 · Dirty-flag transform propagation, incremental spatial index, and one resolve/refresh per step

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Three coupled changes. (1) Make packages/simulation/src/transform/resolution.ts recompute only dirty subtrees: track per-entity transform/structural dirtiness (reuse the version signal from AI-67) and skip re-resolving entities whose local transform and ancestors are unchanged, instead of recomputing every entity every call. (2) Make packages/app/src/systems/spatial-index-population.ts populateSpatialIndexFromWorld incremental: per-entity add/update/remove against an owned EntityBoundsBvh (createEntityBoundsBvh/updateBounds/refitDirty/count already exist in packages/simulation/src/spatial/entity-bounds-bvh.ts) instead of rebuilding the full bounds/meshes arrays and calling setBounds/setMeshes wholesale each pass. (3) Collapse redundant calls in packages/app/src/advanced.ts: resolveWorldTransforms at :178 duplicates the resolve inside lowLevel.step (packages/runtime/src/index.ts:304), and refreshSpatialIndex runs three times (:168 init, :179 pre-step, :183 post-step) — restructure so resolve + spatial refresh happen exactly once per step at the correct phase (after fixed-step physics writeback) while preserving the existing BVH per-mesh cache + prune at spatial-index-population.ts:101.

**Acceptance criteria:**

- A scene with a deep parent chain where only a leaf's local transform changes recomputes only that leaf's subtree world transforms while untouched siblings/ancestors keep their prior world matrices object/value-stable — proven by a named test in test/ counting resolved entities or asserting unchanged-entity world matrices are not rewritten.
- Across a full app.step, resolveWorldTransforms runs once and the spatial index refresh runs once (not the current 2x resolve / 3x refresh), yet every spatial query (raycast/overlap) returns results consistent with post-physics world transforms — proven by a named test that asserts query results match the resolved world state and (via instrumentation/spy) that resolve/refresh are invoked once.
- Moving one entity updates only its entry in the spatial index incrementally (its world-AABB and BVH leaf refit) while other entities' bounds entries are untouched, and a raycast hits the moved entity at its new position — proven by a named test against the incremental EntityBoundsBvh path.
- Despawning an entity removes it from the spatial index without a full rebuild and subsequent queries no longer hit it, while the per-mesh BVH cache is pruned for dead meshes (no leak) — verified by a named test.
- Spatial query results after the incremental refresh are identical to results from a full from-scratch rebuild of the same world, proven by a named equivalence test so incrementalization does not change query behavior.

**Reference.** references/bevy crates/bevy_transform propagate_transforms (dirty/changed-filtered hierarchy propagation) and crates/bevy_render extract/prepare scheduling (resolve-once-per-frame ordering). Match Bevy's change-filtered transform propagation and single-pass-per-frame ordering; beat the current full-rebuild spatial refresh with incremental add/update/remove.

**Invariants.** Invariant 1 (ECS source of truth): WorldTransform stays the derived authoritative output; dirty flags are bookkeeping, not a second transform store. Invariant 2 (sim-authoritative ordering): the single resolve/refresh must land after fixed-step physics writeback and before interaction/extraction so worker-snapshot ordering is preserved. Invariant 4 (determinism): incremental resolve must yield world matrices identical to a full resolve for the same inputs, and the spatial-equivalence test enforces incremental == full-rebuild query results. Invariant 6 (backend-neutral facade): the spatial facade's setBounds/setMeshes contract and EntityBoundsBvh stay backend-agnostic.

### AI-62 · Track indexed vector-view writes in ECS change detection, not just .set()

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Replace the `.set`-only wrapper in patchVectorView (packages/simulation/src/ecs/index.ts:156-173) with a Proxy that traps numeric-index assignment (`view[i] = x`) and bumps the entity version, while still tracking `.set()`. Cache the proxy per underlying subarray in `patchedVectorViews` (currently a WeakSet of raw views) — switch it to a WeakMap<rawView, proxy> so getVectorView returns a stable proxy and elics' internal subarray identity/caching is preserved. The proxy `set` trap converts numeric keys, writes through to the target, then calls bumpEntityVersion(entity); non-numeric property writes pass through unchanged. Add a regression test in test/ecs/entity-version.test.ts (the existing case at :48 only exercises `.set()`).

**Acceptance criteria:**

- A test that does `entity.getVectorView(LocalTransform, "translation")[1] = 5` increments world.entityVersion(entity) by exactly one, just as `.set([..])` does today.
- Reading an element back through the same vector view returns the value written by indexed assignment, confirming the proxy writes through to the real backing storage (no data loss).
- Calling getVectorView twice for the same component+key returns a view with stable identity (=== ) so existing callers that hold the view across frames keep working, and a subsequent `.set()` on it still bumps the version exactly once.
- resolveWorldTransforms still produces a single version bump per changed entity (no double-count from both the proxy traps in writeColumn and the explicit markEntityChanged), proven by an updated version of the existing 'marks resolved transforms only when output changes' test.
- A non-numeric/length read on the proxied view (e.g. view.length) returns the underlying typed-array length and does NOT bump the version, proving only mutating numeric writes are tracked.

**Reference.** Bevy references/bevy/crates/bevy_ecs/src/change_detection/traits.rs:468-469: `Mut<T>::deref_mut` calls `self.set_changed()` so ANY mutable access through the smart pointer flags the component changed. Match that guarantee — aperture's indexed-write proxy makes `view[i]=x` flag the entity exactly as Bevy's deref_mut flags the component, closing the gap where only `.set()` was tracked.

**Invariants.** Invariant 1/2/4 are load-bearing: ECS is the source of truth, so change detection must be complete and deterministic — same mutation must always bump the version the same amount, regardless of write style, so that worker-extracted snapshots reflect every mutation and cannot silently drop a frame's change (which would otherwise make rendering a stale derived view). Invariant 5: no silent miss of a tracked mutation.

### AI-64 · Wire RenderSnapshotUpdateSchedule / per-entity version into dirty-range transform buffer uploads

**Priority** P2 · **Effort** XL · **Depends on** AI-66, AI-13, AI-67

**Change.** Skip or sub-range the per-frame world-transform GPU upload when transforms are unchanged or only partially changed. (a) In packages/webgpu/src/materials/standard/standard-app-frame-resources.ts add a transforms content/version skip mirroring the localLightClusterContentUnchanged skip (:294-318) so the unconditional worldTransforms writeBufferData at :406-410 is bypassed when the packed transform content matches the cached frame. (b) In packages/render/src/rendering/transform-pack.ts writePackedSnapshotTransforms replace the unconditional scratch.data.set(snapshot.transforms) at :77 with min/max dirty-offset tracking (driven by AI-67's transform-version per renderId/offset) and emit a contiguous dirty range on PackedSnapshotTransforms, with a full-write fallback above a dirty-fraction threshold. (c) Feed that dirty range through frame-boundary-support.ts into the AI-66 writeBufferSubData primitive instead of the whole-buffer write.

**Acceptance criteria:**

- A static scene (no transform changes between frames) issues zero world-transform buffer bytes on the second frame while still rendering identical geometry — a named test in test/webgpu/ asserts the transform writeBuffer call count/bytes drop to zero on the unchanged frame and the produced draws are unchanged.
- Moving a single entity in a large scene uploads only a contiguous sub-range covering that entity's 64-byte matrix (plus any threshold padding), not the whole transform buffer — proven by a named test inspecting the recorded (bufferOffset, size) against a multi-entity world.
- When a large fraction of entities move in one frame the path falls back to a single full-buffer write rather than many tiny sub-range writes — verified by a named test crossing the dirty-fraction threshold.
- Rendered output (packed transform floats reaching the GPU) is byte-identical between the dirty-range path and a forced full-upload path for the same world state, proven by a named equivalence test so the optimization never changes pixels.

**Reference.** references/bevy crates/bevy_render/src/render_resource/buffer_vec.rs write_buffer_range + crates/bevy_pbr/src/render/mesh.rs (per-instance MeshUniform uploads gated on changed instances). Match Bevy's change-gated partial transform upload; beat it by emitting one coalesced dirty range with a full-write fallback.

**Invariants.** Invariant 3 (renderer consumes extracted snapshots): the dirty range is derived from snapshot/extraction-side versions (AI-67), the renderer never reads ECS to decide what changed. Invariant 4 (determinism): same world state must yield identical GPU transform bytes whether full or partial upload is taken — the equivalence test enforces this. Invariant 5 (loud): a skip must be a true no-change skip, not a silent drop of a real update; the static-vs-moved tests guard correctness. Depends on AI-66 (sub-range primitive), AI-67 (transform-version dirty signal), AI-13 (persistent cache for cross-frame comparison).

### AI-65 · Generalize dirty-range / skip uploads to view, light, and material buffers

**Priority** P3 · **Effort** L · **Depends on** AI-64

**Change.** After AI-64 establishes the transform dirty-range mechanism, replicate the per-buffer change-version skip + sub-range path for the other dynamic uniforms in packages/webgpu/src/materials/standard/standard-app-frame-resources.ts: the view uniform writeBufferData (:401-405), the light float/metadata buffers (:411-420), and material uniforms — each guarded by its own content/version comparison modeled on the localLightClusterContentUnchanged skip (:294-318), using the AI-66 writeBufferSubData primitive and shared helpers added to packages/webgpu/src/app/app-frame-resource-utils.ts.

**Acceptance criteria:**

- A frame where only the camera view changes uploads the view uniform but skips the light and material buffer writes, while a frame where only a light changes uploads the light buffer but skips the view write — both proven by named tests counting per-buffer writeBuffer calls.
- A fully static frame (no view/light/material change) issues zero dynamic-uniform buffer bytes for all three families on the second frame yet renders identical output, verified by a named test.
- Changing a single light in a many-light buffer uploads only that light's sub-range rather than the whole light buffer, proven by a named test inspecting recorded (bufferOffset,size).
- For each buffer family, the bytes reaching the GPU under the skip/sub-range path are byte-identical to a forced full-upload of the same state, proven by a named equivalence test per family so no rendering output changes.

**Reference.** references/bevy crates/bevy_render/src/render_resource/uniform_buffer.rs + buffer_vec.rs write_buffer_range, and Bevy's per-resource change-gated uniform writes. Match Bevy's change-gated uniform uploads across view/light/material; beat it by reusing one shared sub-range/skip helper across families.

**Invariants.** Invariant 4 (determinism): equivalence tests guarantee skip/sub-range uploads produce identical GPU bytes to a full upload for the same state. Invariant 5 (loud over silent): a skip is only taken when the content/version comparison proves no change, so a real update is never silently dropped — the per-family change tests enforce this. Invariant 3: change decisions come from extracted snapshot content, not ECS reads. Builds directly on AI-64's transform dirty-range scaffolding and the AI-66 primitive.

### AI-66 · Add a dirty-range-aware buffer upload primitive

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** Extend the upload wrapper in packages/webgpu/src/app/app-frame-resource-utils.ts so callers can write a sub-range of a GPU buffer. Today writeBufferData (:18-31) hardcodes queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength). Add a sibling writeBufferSubData (or extend writeBufferData with optional bufferOffset + dataOffset/length) that forwards bufferOffset and a clamped (dataOffset,length) window to queue.writeBuffer — the QueueWriteBufferDeviceLike interface (:33-43) already declares the 5-arg signature, so only the wrapper plus a typed-array slicing helper are new. Keep the existing full-write call working unchanged. This is the enabling primitive consumed by AI-64/AI-65.

**Acceptance criteria:**

- Writing a contiguous element range into the middle of a buffer issues exactly one queue.writeBuffer call with the correct destination byte offset and a byte length equal to the range — proven by a named test in test/webgpu/ against a fake device that records (buffer, bufferOffset, dataOffset, size) arguments.
- Bytes outside the written range are left untouched on a stub backing buffer while the in-range bytes match the source slice — verified by a named test comparing the simulated GPU buffer before/after.
- A zero-length / empty dirty range performs no queue.writeBuffer call and reports the write as successful no-op, verified by a named test (no spurious GPU traffic).
- The pre-existing full-buffer write path (offset 0, whole length) continues to produce a single identical queue.writeBuffer call, proven by an existing-behavior regression test so AI-66 is backward compatible.

**Reference.** references/bevy crates/bevy_render/src/render_resource/buffer_vec.rs write_buffer_range (:196-215, :413-442): queue.write_buffer(buffer, start_offset_bytes, &bytes[range]) with a range-bigger-than-buffer guard. Match this sub-range upload primitive (offset + sliced bytes + bounds check) one-for-one in TypeScript/WebGPU.

**Invariants.** Invariant 7 (WebGPU-only): the primitive stays a thin queue.writeBuffer wrapper with no backend leakage. Invariant 5 (loud over silent): an out-of-range/over-capacity sub-range must not silently clamp into corruption — the wrapper returns false / surfaces the failure rather than writing garbage, and a test covers the rejected range. Pure additive primitive with no consumer behavior change yet (AI-64/65 consume it).

### AI-67 · Separate transform-only updates from full packet rebuilds in mesh extraction

**Priority** P3 · **Effort** L · **Depends on** AI-13

**Change.** Introduce a transform-version distinct from the structural entityVersion so a matrix-only change does not invalidate the whole cached mesh-draw packet. In packages/simulation/src/transform/resolution.ts writeWorldTransform (:220-222) bump a dedicated per-entity transform counter (add markEntityTransformChanged/entityTransformVersion to the versioned world in packages/simulation/src/ecs/index.ts) instead of (or in addition to) markEntityChanged for matrix-only writes. In packages/render/src/rendering/extraction-meshes.ts cache-hit branch (:65-89) and extraction-mesh-cache.ts/extraction-mesh-cache-writeback.ts, store and compare the transform-version separately: when ONLY the transform changed, keep the cached MeshDrawPacketTemplate/draws and re-emit just the transform + recomputed bounds (re-run createBoundsPacket with the new world matrix) without rebuilding material slots/submeshes.

**Acceptance criteria:**

- Moving an entity every frame (transform-only) reuses its cached draw packet template and material/submesh structure while still emitting the updated world matrix and refreshed world-AABB/sphere bounds — a named test asserts the packet's renderId/material/submesh fields are object-identical across frames while worldTransformOffset bounds reflect the move.
- A transform-only animation of many entities extracts faster than a full structural rebuild of the same entities: a named perf test (alongside extraction.test.ts measureCachedExtraction) shows transform-only frames cost materially less than frames that change material/mesh, because the packet template path is skipped.
- Changing a structural field (material id, mesh id, layer mask, visibility) still triggers a full packet rebuild and the new material/submesh appears in the draw — proven by a named test that flips a material and observes the changed draw.
- Frustum culling stays correct after a transform-only move: an entity moved out of all view frusta is dropped from the snapshot and one moved back in reappears, verified by a named test (the recomputed bounds must feed isVisibleInAnyMatchingView).

**Reference.** references/bevy crates/bevy_ecs/src/component/tick.rs + change_detection (Bevy tracks added vs changed ticks per component so consumers distinguish kinds of change). Match: separate a transform-only dirty signal from structural change so the render extractor can take a cheap fast path, mirroring Bevy's per-component change granularity.

**Invariants.** Invariant 1 (ECS is source of truth): the transform-version is derived bookkeeping in the versioned world, never a second authoritative transform store. Invariant 4 (determinism): the fast path must yield byte-identical transforms/bounds to a full rebuild for the same world matrix; the acceptance tests assert equality, so the optimization cannot change deterministic snapshot output. Builds on AI-13's persistent cache.

---

## Phase 4 — Physics fidelity & honest capabilities

_Close the collider/joint/query gaps and make the deterministic backend either complete or honestly flagged._

### AI-2 · Compute applyForce/applyImpulse lever arm from the world center of mass

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** torqueForForceAtPoint/entityCenter in packages/app/src/systems/physics.ts:783-799 currently take the lever arm relative to LocalTransform.translation (the parent-local body ORIGIN), which is wrong for off-COM bodies and for parented/world-space points. Add a backend accessor — bodyWorldCom(entity): PhysicsVec3|null (and bodyWorldPose for parented bodies) — to the PhysicsBackend interface (packages/physics/src/backend.ts:435-483, optional method), implement it in physics-rapier (packages/physics-rapier/src/backend.ts/bodies.ts reading entry.body.worldCom()/translation()/rotation(), confirmed available in rapier3d-compat@0.19.3 RigidBody.worldCom():282-286) and in the test backend (derive COM from the body transform + collider offsets in test-backend). Then rewrite torqueForForceAtPoint to compute crossVec3(subVec3(worldPoint, backend.bodyWorldCom(entity) ?? worldOrigin), force), using the latest synced/readback COM available app-side at the applyForce call sites (physics.ts:291-318).

**Acceptance criteria:**

- A test applies a force at a world-space point offset from the COM of a dynamic body whose COM is displaced from its origin (e.g. an off-center collider), steps the sim, and observes the body acquire the correct angular velocity sign/magnitude consistent with cross(point - worldCom, force) — distinguishable from the old origin-based torque.
- Applying a force whose line of action passes exactly through the world COM produces zero induced angular velocity after a step (no spurious spin), where the old origin-based code would have spun the body.
- For a parented body, applyForce at a fixed world point produces the same induced torque regardless of the parent's transform (the lever arm is world-space, not parent-local), proven by a test comparing two parent transforms.
- backend.bodyWorldCom returns a finite COM for an active dynamic body and null for an unknown/unsynced entity, exercised through the public physics access facade rather than an internal field.

**Reference.** Rapier rigid-body dynamics: RigidBody.worldCom() / applyImpulseAtPoint apply torque as cross(point - worldCom, impulse) (rapier3d-compat dynamics/rigid_body.d.ts). Matching Rapier's own at-point semantics; PlayCanvas RigidBodyComponent.applyForce(force, point) (references/engine) uses the same world-COM lever-arm convention.

**Invariants.** Invariant 2/3 (worker/SAB-friendly, renderer/app reads derived state): COM is read from the backend's last synced/readback snapshot — the scope's noted timing constraint — so applyForce stays a synchronous ECS accumulation into ExternalForce/ExternalImpulse and does not reach into the live backend mid-step. Invariant 6 (backend-neutral facade): bodyWorldCom is added to the neutral PhysicsBackend interface; the worldCom() read stays inside physics-rapier.

### AI-4 · Add minimal sphere contact + positional joint resolution to the test backend

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** The test backend step() (packages/physics/src/test-backend/backend.ts:241-303) integrates each dynamic body independently with NO contact resolution and never reads the populated joints map (built at sync ~193 but only consumed for debug lines/cleanup). All test colliders are modeled as spheres (bodies.ts testColliderForDescriptor uses boundingRadiusForShape, ~63-70), yet TEST_PHYSICS_BACKEND_CAPABILITIES advertises compoundColliders:true and characterController:true (backend.ts:39-49). Add sphere-sphere and sphere-vs-static-plane positional contact resolution (penetration push-out + restitution-scaled normal velocity response) and a basic positional/impulse joint solver (distance/fixed anchor constraint using the joints map + collider radii) inside step(), so dynamic bodies actually stop interpenetrating and jointed bodies stay coupled. Reuse the colliderCenter/radius helpers in bodies.ts; keep the existing per-body integrate path for the unconstrained case.

**Acceptance criteria:**

- A test drops a dynamic sphere onto a static plane/large sphere and after stepping the sphere rests on (does not pass through) the surface — final penetration below a small epsilon — where today it falls straight through.
- Two dynamic spheres on a collision course separate (resolve penetration with a restitution-consistent normal velocity) instead of overlapping after the step.
- Two bodies linked by a distance/fixed joint remain within the authored anchor distance (constraint error below epsilon) after several steps when one body is pushed, proving the joints map is consumed in step().
- A determinism test runs the same contact/joint scenario twice with identical inputs and gets bit-identical body transforms (no wall-clock/RNG in the new solver).
- Existing test-backend integrate/query tests (test/physics/test-backend.test.ts, character-controller.test.ts) still pass unchanged.

**Reference.** PlayCanvas collision/contact response model (references/engine framework/components/collision + rigid-body) and Rapier's positional contact + impulse-joint solver semantics — matching a minimal but honest version so the advertised compoundColliders/characterController capabilities are backed by real step-time resolution rather than a no-op.

**Invariants.** Invariant 4 (determinism): the solver must be fixed-step, iteration-ordered deterministically (sort bodies/joints by entity ref as the readback already does) with no wall-clock/RNG. Invariant 5 (loud): if a contact/joint shape combination is unsupported by the minimal solver, emit a structured diagnostic rather than silently skipping. Invariant 6: stays entirely inside the test-backend package behind the neutral PhysicsBackend.step contract.

### AI-5 · Wire BVH-vs-BVH sweep and per-mesh BVH readiness into the SpatialQueries facade

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** The closestPoint/overlapSphere/overlapBox/overlapCapsule facade surfaces already landed (createSpatialQueries in packages/app/src/spatial/index.ts; commits 265d6bf7/f07ba5e2/34257fd6). Two pieces remain. (1) Add castShapeFirst/castShapeAll (BVH-vs-BVH sweep) to SpatialQueries: surface MeshBvh.bvhcast (simulation spatial/mesh-bvh.ts:1272) through a new module under packages/app/src/spatial/ plus methods in createSpatialQueries and the SpatialQueries interface (types.ts). NOTE: aperture's bvhcast currently takes only MeshBvhCastOptions and compares both BVHs in their OWN local spaces (no relative transform), so for world-correct cross-entity casts add an optional bToA relative-transform param to bvhcast in simulation, mirroring three.js-mesh-bvh's bvhcast(otherBvh, matrixToLocal, ...) (references/three-mesh-bvh/src/core/MeshBVH.js:661); the facade composes bToA = meshFromWorld_A \* worldFromMesh_B from the existing meshQueryTransforms. (2) Add explainReadiness() to the facade reporting per-mesh BVH readiness (present/absent/stale) — no such surface exists today (grep-confirmed). (3) Add facade tests under test/app/ for the sweep + readiness.

**Acceptance criteria:**

- castShapeFirst returns the first entity whose BVH-backed mesh overlaps a swept query mesh and null when nothing overlaps; a test with two registered meshes confirms it picks the overlapping one and skips the disjoint one.
- castShapeAll returns every overlapping entity (e.g. a query mesh straddling two registered meshes returns both), and meshes without a BVH are skipped exactly as the overlap\* family already skips them.
- A cross-entity sweep where the two meshes have DIFFERENT world transforms (distinct worldFromMesh) reports overlap iff they actually overlap in WORLD space — proving the bToA relative transform is applied (a test that would give a false positive/negative under naive local-vs-local comparison).
- explainReadiness() reports, per registered mesh, whether its BVH is present and usable for sweeps vs absent, and a test asserts a mesh registered without a bvh is reported not-ready while one with a bvh is reported ready (used to explain why a cast returned no hits).

**Reference.** three-mesh-bvh MeshBVH.bvhcast(otherBvh, matrixToLocal, callbacks) (references/three-mesh-bvh/src/core/MeshBVH.js:651-764) — matching its relative-transform contract so cross-entity world-space sweeps are correct, which aperture's transform-less bvhcast cannot currently express.

**Invariants.** Invariant 3 (renderer/queries consume derived data): the facade reads the extracted SpatialRaycastableMesh set (setMeshes), never ECS directly. Invariant 5 (loud): explainReadiness makes BVH-missing/stale cases observable instead of silently returning empty sweeps. Invariant 6: the bvhcast relative-transform addition lives in the simulation spatial package behind the existing MeshBvh API; the facade stays in packages/app and remains backend-agnostic. Invariant 4: bvhcast traversal is deterministic, no wall-clock/RNG.

### AI-7 · Map a backend-neutral generic constraint and a true min/max distance joint in Rapier

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Add a backend-neutral generic-constraint axis/mask descriptor to PhysicsJointDescriptor (packages/physics/src/backend.ts:99-120) plus its authoring fields in components.ts and ecs-sync.ts, and map it in packages/physics-rapier/src/joints.ts jointData by replacing the throw at 123-126 with RAPIER.JointData.generic(anchorA, anchorB, axis, axesMask) — confirmed available in rapier3d-compat@0.19.3 (impulse_joint.d.ts JointData.generic + JointAxesMask:48). Also implement a true distance joint with separate min/max: today 'distance' maps to JointData.rope (one-sided max only, joints.ts:117-122); add a min/max distance via a spring/limit-backed constraint (JointData.spring exists at impulse_joint.d.ts:201, or rope+lower limit) so a minimum separation is enforced too. On landing the generic mapping, replace the joint.generic unsupported diagnostic (backend.ts:645-658) with the real mapping.

**Acceptance criteria:**

- A test authors a generic joint that locks a chosen subset of axes (e.g. lock all translations, free one rotation) and, after stepping, body B's motion is constrained exactly along the unlocked axes and blocked along the locked ones (measured against body A's frame).
- A distance joint authored with both min and max keeps the inter-body distance within [min, max] after the bodies are pushed apart AND pulled together — proving two-sided enforcement, where the old rope mapping only capped the maximum.
- Authoring a generic joint no longer produces a physics.joint.unsupported / joint.generic feature from collectUnsupportedPhysicsJointFeatures (verified through the public unsupported-feature collector).
- Existing fixed/spherical/revolute/prismatic joint tests still pass and the authoring enum round-trips 'generic' and 'distance' through ecs-sync without loss.

**Reference.** Rapier impulse-joint API: JointData.generic(anchor1, anchor2, axis, axesMask:JointAxesMask) and JointData.spring/rope (rapier3d-compat dynamics/impulse_joint.d.ts:200-257) — matching Rapier's own generic-axis-mask constraint model and using spring/limit for two-sided distance.

**Invariants.** Invariant 6 (backend-neutral facade): the generic axis/mask descriptor is added to the neutral PhysicsJointDescriptor + authoring components; the JointAxesMask translation stays inside physics-rapier joints.ts. Invariant 5 (loud): any generic axis combination Rapier cannot represent must still emit a structured diagnostic rather than silently dropping the constraint. Invariant 4: pure descriptor->JointData mapping, deterministic.

### AI-8 · Deliver paired frameB + break-force enforcement for Rapier joints within the pinned API

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** VERIFIED API CONSTRAINT: rapier3d-compat@0.19.3 exposes NO per-joint impulse readback (no joint.impulses(); RawImpulseJointSet has no impulse getter) and NO motor force ceiling (jointConfigureMotor\* take no max-force arg, setLimits has no force bound) in either the high-level or raw bindings. So the original 'joint.impulses() + motor max-force' plan is not implementable on the pinned version. Deliver the achievable, honest pieces in packages/physics-rapier/src/joints.ts: (1) encode paired non-fixed frameB for spherical/revolute/prismatic by applying frameB to anchorB/axis (jointData 89-128) so body-B local frames are respected; (2) enforce breakForce by deriving an effective constraint force from per-step readback already available — contact-force events are enabled (colliders.ts:148-152) and body velocities/anchor separation are readable — and when the threshold is exceeded, destroy the joint and emit a truthful jointBreak PhysicsEvent (the 'jointBreak' kind already exists, backend.ts:184-195) wired through systems/physics.ts jointBreakEvent (644-659). Flip ONLY the capability flags this truthfully satisfies — pairedNonFixedFrameB:true and (break path) automaticBreakForce:true — in backend.ts:45-48,57-60, and remove/replace the now-covered unsupported diagnostics (backend.ts:680-694 frameB; 660-678 breakForce). Keep jointImpulseReadback:false and motorForceLimits:false honest, with their diagnostics retained, documenting them as gated on a Rapier version bump.

**Acceptance criteria:**

- A revolute (or spherical) joint authored with a non-identity frameB orients body B's constrained frame correctly: a test rotates the frameB and observes body B's rest orientation change accordingly, where the old code ignored frameB for non-fixed kinds.
- A joint with a finite breakForce survives an under-threshold load but, when an over-threshold load is applied, the joint is destroyed and exactly one jointBreak PhysicsEvent for that joint entity is observable through the public physics events facade, after which the two bodies move independently.
- collectUnsupportedPhysicsJointFeatures no longer reports joint.frameB or joint.breakForce as unsupported for the Rapier backend, while it STILL reports motor max-force / impulse-readback as unsupported (asserting honesty on the version-gated features), verified via the public collector.
- RAPIER_PHYSICS_BACKEND_CAPABILITIES reports pairedNonFixedFrameB and automaticBreakForce as true and jointImpulseReadback/motorForceLimits as false, and a test confirms an authored motorMaxForce still surfaces a structured diagnostic (loud-not-silent).
- Existing joint tests (fixed/spherical/revolute/prismatic) remain green.

**Reference.** Rapier impulse-joint frames (JointData spherical/revolute/prismatic anchors+local frames, rapier3d-compat impulse_joint.d.ts) and contact-force event readback (ActiveEvents.CONTACT_FORCE_EVENTS already set in colliders.ts). The break-force approximation matches PlayCanvas joint breakForce semantics (references/engine framework/components/joint) without depending on Rapier APIs absent from the pinned 0.19.3 build.

**Invariants.** Invariant 5 (loud over silent) is load-bearing: features genuinely unsupported on the pinned Rapier (motor max-force, true joint-impulse readback) MUST keep emitting structured diagnostics and their capability flags must stay false — flipping a flag without a real implementation would violate this. Invariant 4: break detection runs on deterministic per-step readback (no wall-clock). Invariant 6: all Rapier-specific frame/force handling stays in physics-rapier; the neutral interface only gains truthful capability bits + the existing jointBreak event.

### AI-10 · Cook convex-hull / trimesh / heightfield query shapes for overlap and shape-cast

**Priority** P3 · **Effort** M · **Depends on** none

**Change.** packages/physics-rapier/src/shapes.ts queryShape (9-28) throws for 'convexHull'/'trimesh'/'heightfield', so overlapShape and castShape silently degrade for asset-backed query volumes. Build the RAPIER query Shapes — new RAPIER.ConvexPolyhedron(positions), new RAPIER.TriMesh(positions, indices, flags), new RAPIER.Heightfield(rows-1, cols-1, heights, scale, flags) (all confirmed in rapier3d-compat@0.19.3 geometry/shape.d.ts:384-499) — mirroring the collider cooking in colliders.ts (convexHull via convexHull/positions, trimesh, heightfield via requireTriangleMeshGeometry/requireHeightfieldGeometry, colliders.ts:61-110). Change queryShape to accept the PhysicsColliderGeometryProvider and thread it through the three call sites: queries.ts:43 (castShapeFirstByCollider / overlap), backend.ts:344 (overlapShape) and backend.ts:401 (castShapeFirst), reusing the colliderGeometryProvider already plumbed into createRapierPhysicsBackend (backend.ts:103-126).

**Acceptance criteria:**

- An overlapShape query using a convexHull query volume (backed by a geometry provider mesh) returns the entities it actually intersects — a test places a body inside the hull and gets a hit, and a body outside gets no hit.
- A castShapeFirst sweep with a trimesh query shape returns a hit with a plausible time-of-impact against a target collider, where the same call previously threw / returned nothing.
- A heightfield query shape overlaps bodies sitting above the field and misses bodies below it, exercising the rows/cols/heights/scale cooking path.
- When a convexHull/trimesh/heightfield query shape is used but no colliderGeometryProvider was supplied, the query emits the same structured 'provider missing' diagnostic the collider path uses (loud, not a thrown crash), verified by a test.

**Reference.** Rapier query shapes: RAPIER.ConvexPolyhedron / TriMesh / Heightfield constructors and World.intersectionsWithShape / castShape (rapier3d-compat geometry/shape.d.ts:384-499). Mirrors the cooking already proven for colliders in colliders.ts; matches Rapier's own shape-query model.

**Invariants.** Invariant 6 (backend-neutral facade): the provider-threaded queryShape and all Rapier shape construction stay inside physics-rapier; the public query API surface (PhysicsShape, overlap/cast options) is unchanged. Invariant 5 (loud): missing-geometry-provider for asset-backed query shapes emits a structured diagnostic instead of throwing or silently returning empty.

---

## Phase 5 — Platform: input, text & UI

_Multi-pointer, gamepad, chords, editable text/IME, focus/keyboard nav, flex/grid layout, and shaping._

### AI-44 · Forward pointerId/pointerType/button and model multiple concurrent pointers

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** In packages/app/src/browser/input.ts forwardInput callers (lines 49-89), stop hard-coding pointer:'primary': map event.button (0->primary, 1->middle, 2->secondary), read event.pointerType ('mouse'|'touch'|'pen'), and forward event.pointerId so multiple concurrent pointers are distinguishable. Extend ApertureGeneratedPointerInputEvent in packages/app/src/input/types.ts (lines 20-25) with pointerId, optional button and pointerType fields. In packages/app/src/input/state.ts replace the single pointer.primary object (lines 72-77) and the non-primary early-return (lines 124-127) with an indexed pointer map keyed by pointerId (retaining a primary accessor for back-compat). In packages/app/src/interaction/pointer-events.ts, extend the single #hovered/#down state machine (lines 65-67) so a PointerInteractionState instance can be driven per pointerId (or hold a per-id sub-state) while preserving the existing single-pointer API.

**Acceptance criteria:**

- A state test sends two pointer events with distinct pointerIds (one pressed at position A, one at position B) and asserts both pointers are tracked simultaneously with independent position/pressed state, where today the second is dropped.
- A test forwards a pointerdown with button:2 and asserts the resulting event carries pointer:'secondary' (and button:1 -> 'middle', button:0 -> 'primary'), proving button mapping.
- A test asserts event.pointerType ('mouse'/'touch'/'pen') is surfaced on the pointer event and readable from the input resource for the active pointer.
- An existing-behavior test confirms the legacy pointer.primary accessor and primary-button drag/click flow in pointer-events still pass unchanged (no regression for single-mouse apps).

**Reference.** PlayCanvas multi-touch-source.js (\_pointerEvents = new Map<number, PointerEvent>() keyed by pointerId; reads pointerType and per-pointer coords) and mouse-event.js button-to-name mapping. Match its keyed multi-pointer model and pointerType plumbing.

**Invariants.** Invariants 2/4: browser/input.ts stays main-thread IO-only (forwards events, no ECS mutation); the multi-pointer map lives in the worker-side input resource and is deterministic given the same event sequence. Invariant 5: invalid/unknown pointer button values must be reported, not silently coerced.

### AI-45 · Add a composition-aware DOM text input bridge and an editable UI text model

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** On the main thread, extend installGeneratedInputForwarding (packages/app/src/browser/input.ts:39-134) to mount a hidden offscreen contenteditable/textarea overlay and install input/beforeinput/compositionstart/compositionupdate/compositionend + selectionchange listeners, forwarding a NEW {kind:'text'|'composition'} variant added to the ApertureGeneratedInputEvent union (packages/app/src/input/types.ts:73-79) and validated/guarded in packages/app/src/input/events.ts isGeneratedInputEvent (lines 80-109). In packages/app/src/input/state.ts InputResourceImpl.#applyEvent (lines 116-164) consume the new event into a per-frame text/composition/caret+selection surface exposed on InputResourceBase (types.ts:191-207) and ApertureInputSummary; add an editable text authoring component + UiTextInput edit fields (render UiText / UiTextInput at packages/render/src/rendering/authoring-types.ts:272 are render-only today) backing a string + caret/selection that the bridge mutates. Keep DOM strictly main-thread; only the serializable text/composition event crosses worker.postMessage.

**Acceptance criteria:**

- Typing 'abc' into a focused editable UI text field appends those characters to the field's text in document order, provable by a unit test that feeds three {kind:'text'} events through advanceInputResource and asserts the resulting field text is 'abc'.
- An IME composition sequence (compositionstart -> two compositionupdate -> compositionend) yields an in-progress preedit string during the updates and a single committed insertion after end, provable by a test that drives the composition events and asserts both the live preedit value mid-sequence and the final committed text.
- Backspace / delete and a multi-character selection replacement update both the text and the caret/selection range, provable by a test that sets a selection range then applies a text event and asserts the new text and caret index.
- isGeneratedInputEventMessage accepts a well-formed text/composition message and rejects a malformed one (missing required fields), provable by an events.ts validator test covering both branches.
- A reset event clears any in-progress composition and selection state, provable by a test asserting the field has no live preedit after a reset.

**Reference.** uikit references/uikit/packages/uikit/src/text/input/hidden-input.ts (offscreen hidden <input>/<textarea> overlay driving input + focus + selectionchange) and references/uikit/packages/uikit/src/text/selection/\* (caret/selection ranges). Match its hidden-overlay composition capture; beat it by keeping the editable model in the ECS-forwarded input resource rather than a DOM-bound signal so it stays worker-snapshot-friendly.

**Invariants.** Invariants 2 and 4 are load-bearing: DOM/IME listeners and the hidden overlay live only on the main thread and forward a serializable event over postMessage; no DOM or wall-clock reaches the sim worker, and the editable text state lives in the worker-side input resource so identical event streams produce identical state. Invariant 5: an unknown/unconfigured editable target emits a structured diagnostic rather than silently dropping text.

### AI-46 · Add a UI focus subsystem with keyboard/gamepad tab + directional navigation

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Add focusable + tab-order/group fields to UI authoring (new focus fields on UiNode or a dedicated focus authoring component in packages/render/src/rendering/authoring-components-core.ts, mirrored into the extracted UiNodePacket / a focus packet in extraction-ui.ts so focus order/region data is worker-derived). Add a worker-safe focus model + Tab/Shift+Tab/Home/End cycling and Enter/Space (+ gamepad D-pad/A) activation to the interaction runtime: createInteractionAccess (packages/app/src/interaction/access.ts) gains focusedEntity()/focus(entity)/onFocus/onBlur/onActivate plus a navigate(action) entry, the PointerInteractionState neighbor in packages/app/src/interaction/pointer-events.ts is extended with focus/activate events, and runInteractionFrame (packages/app/src/interaction/system.ts:26) consumes context.input.keyboard/gamepad nav each frame (not just pointer.primary). Surface focus-ring visuals through extraction-ui.

**Acceptance criteria:**

- Pressing Tab moves focus to the next focusable UI entity in ascending tab order and Shift+Tab moves to the previous, wrapping at the ends, provable by a test that registers three focusable entities and asserts the focused entity after each navigate(Next)/navigate(Previous) including wrap-around.
- Pressing Enter or Space while a focusable UI entity is focused fires an activate event for exactly that entity, provable by a test that focuses an entity, applies an activate key, and asserts a single onActivate callback for that entity ref.
- Gamepad D-pad navigation and the confirm button drive focus movement and activation equivalently to keyboard, provable by a test feeding a gamepad snapshot and asserting focus change + activation.
- A disabled or non-visible focusable entity is skipped during navigation, provable by a test that toggles Enabled/visible off and asserts navigation steps past it.
- The currently focused entity is reported via focusedEntity() and reflected as a focus-state field in the extracted UI snapshot, provable by an extraction test asserting the focus flag on the focused node packet.

**Reference.** Bevy references/bevy/crates/bevy_input_focus/src/tab_navigation.rs (TabIndex / TabGroup / NavAction Next/Previous/First/Last with wrap + modal groups) and directional_navigation.rs for D-pad/spatial nav, plus references/bevy/crates/bevy_ui/src/focus.rs (Interaction states gated by visibility). Match Bevy's TabIndex/TabGroup ordering and visibility gating.

**Invariants.** Invariants 1, 2, 3 are load-bearing: focus order/regions are derived from ECS authoring and extracted snapshot data (no main-thread render scene-graph as source of truth); the focus state machine runs in the worker-side interaction runtime consuming forwarded keyboard/gamepad input. Invariant 4: navigation is deterministic from the same input + focus order. Invariant 5: navigating with no focusable entities emits a structured diagnostic instead of silently no-op'ing.

### AI-49 · Add gamepad haptics, pointer-lock relative look, and a custom controller remapping surface

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** In packages/app/src/input/gamepads.ts add a custom-mapping adapter: replace the hardcoded GAMEPAD_BUTTON_INDICES (lines 16-34) with a per-device override so non-'standard' controllers currently disconnected at lines 185-201 can be remapped (button/axis index map keyed by gamepad id) instead of dropped. Expose a haptics method on the device/state; since browser/input.ts:201-218 strips vibrationActuator from the structured-clone snapshot, the haptics call must be invoked main-thread (add a playEffect-backed pulse(intensity, duration, options) wrapper in browser/input.ts that looks up the live navigator.getGamepads()[index].vibrationActuator), with the worker resource exposing a request that the main thread fulfills. In packages/app/src/browser/input.ts add requestPointerLock on pointerdown and a pointerlockchange listener that forwards movementX/movementY as a relative look delta (a new relative-pointer event or reuse the wheel-style per-frame delta) for FPS mouse-look. Thread a per-device mapping override through packages/app/src/input/bindings.ts so gamepadButtonPressed/gamepadStickValue honor the remap.

**Acceptance criteria:**

- A gamepads test feeds a connected snapshot with a non-'standard' mapping plus a supplied custom button/axis map and asserts the device drives actions correctly (e.g. its remapped 'south' button reads pressed), where today the device is disconnected and inert.
- A test confirms a standard-mapped controller still works unchanged when no custom map is supplied (default GAMEPAD_BUTTON_INDICES behavior preserved).
- A main-thread haptics test stubs navigator.getGamepads()[index].vibrationActuator.playEffect and asserts a pulse(intensity, duration) request resolves to it being called with the matching duration/magnitude (and resolves false/no-op with a diagnostic when no actuator exists).
- A pointer-lock test simulates a pointerlocked pointermove with movementX/movementY and asserts a relative look delta is forwarded (distinct from the absolute normalized pointer position), and that exiting lock stops emitting relative deltas.

**Reference.** PlayCanvas game-pads.js GamePad.pulse() (vibrationActuator.playEffect with strong/weakMagnitude+startDelay) and updateMap/resetMap/custom_maps + PRODUCT_CODES/getMap for non-standard remapping; Mouse.enablePointerLock -> requestPointerLock and keyboard-mouse-source.js using native event.movementX/Y when document.pointerLockElement matches. Match the pulse signature, the custom-map override, and locked-vs-unlocked movement handling.

**Invariants.** Invariant 2: haptics actuator handles cannot cross the worker boundary, so the snapshot stays clone-friendly and the actuator call is performed main-thread on a forwarded request; no WebGPU/actuator state leaks into the sim. Invariant 5: unsupported actuators and unmapped non-standard pads emit a structured diagnostic rather than silently no-op.

### AI-50 · Add chord / modifier / hold / double-tap binding kinds to the input action system

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** Add declarative binding kinds to the InputActionBinding union in packages/app/src/config/index.ts (lines 154-164; note config.ts is just `export * from ./config/index.js`): chord (multi-key AND), modifier-gated, hold/long-press (press held >= duration), and double-tap/sequence (edge within a window). Validate each in packages/app/src/config/validation.ts validateInputBinding (extend the switch before the default throw at lines 251-253). Add per-binding cross-frame timing/edge state in packages/app/src/input/state.ts #resolveActions (lines 233-280) and resolver helpers in packages/app/src/input/bindings.ts (bindingPressed at lines 30-63 currently has no chord/timing awareness) — chord checks all sub-codes pressed; hold compares accumulated held-time; double-tap tracks last release timestamp. Use the deterministic per-frame time the resolver is already given (no wall clock), and add config helpers (input.chord/input.hold/input.doubleTap) mirroring the existing input.key/input.gamepadButton builders.

**Acceptance criteria:**

- A test configures a chord binding (e.g. Control+KeyS) and asserts the button action fires only when both codes are pressed in the same frame and not when only one is held.
- A hold/long-press test holds a key across multiple advanceInputResource frames with a fixed per-frame time step and asserts the action becomes pressed exactly once the accumulated held time crosses the configured threshold, and not before.
- A double-tap test issues press/release/press within the configured window (driven by the resolver's deterministic time) and asserts the action fires; the same sequence spread beyond the window does not fire.
- A validation test asserts a malformed chord/hold/double-tap binding (e.g. empty chord codes or non-finite duration) throws the structured invalidBinding error at config time rather than silently passing.

**Reference.** PlayCanvas keyboard.js edge model (isPressed/wasPressed/wasReleased via \_keymap vs \_lastmap snapshot in update()) for frame-edge timing; aperture extends it into declarative chord/hold/double-tap kinds (no PlayCanvas declarative equivalent — we beat it with config-authored timing bindings). Determinism uses the resolver's fixed-step time, not Date.now.

**Invariants.** Invariant 4: hold/double-tap timing reads the deterministic per-frame sim time only (no wall clock / Date.now), so identical event+time sequences produce identical action edges. Invariant 5: unsupported/malformed binding kinds throw a structured config error at validation, never silently no-op.

### AI-51 · Drive per-pointer picking in the interaction system over the multi-pointer state

**Priority** P3 · **Effort** L · **Depends on** AI-44

**Change.** Build on AI-44's indexed multi-pointer model. In packages/app/src/interaction/system.ts runInteractionFrame, replace the single context.input.pointer.primary read (line 26) and single raycast (lines 51-60) with iteration over all active pointers from the input resource's pointer map, casting a camera ray per pointer and feeding each into a per-pointerId PointerInteractionState. In packages/app/src/interaction/pointer-events.ts, extend the state machine (the single #hovered/#down at lines 65-67, already touched by AI-44) so each active pointerId owns independent hover/down/drag state, and tag dispatched PointerInteractionEvents with their pointerId so consumers can disambiguate (extend access.ts processFrame dispatch at lines 147-161). Optionally add a collider-source pick default replacing source:'bounds' at system.ts line 53. Retire stale pointers when their id leaves the active set so dangling down/drag states are released.

**Acceptance criteria:**

- An interaction-route test drives two simultaneous pressed pointers (distinct pointerIds) over two different entities in one frame and asserts both entities receive their own down/click events, where today only the primary pointer is picked.
- A test asserts each dispatched PointerInteractionEvent carries the originating pointerId, so a handler can distinguish which finger/cursor produced enter/down/drag.
- A test asserts that when one pointer drags entity A while another hovers entity B, the drag delta and hover state remain independent (no cross-talk between per-pointer states).
- A test asserts that removing a pointer from the active set (pointerup/cancel) releases its down/drag state and emits the matching up/dragEnd for that pointerId only, leaving other pointers' states intact.

**Reference.** PlayCanvas multi-touch-source.js per-pointerId Map (\_pointerEvents) iterated each frame, plus element-input.js per-pointer hit-test dispatch. Match its independent-per-pointer hover/press/drag tracking; aperture casts an ECS spatial ray per pointer instead of DOM hit-testing.

**Invariants.** Invariants 1/3: per-pointer picking still queries the ECS-derived spatial index and the extracted UI layout (no hidden scene graph, no reach-back into ECS from the renderer). Invariant 4: with AI-44's deterministic pointer map, identical multi-pointer event sequences yield identical per-pointer event streams. Invariant 5: an unpickable/stale pointer is released loudly via its up/dragEnd, never silently abandoned.

### AI-52 · Integrate text shaping + bidi + font-fallback for MSDF text

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** In packages/render/src/text/msdf-font-atlas.ts, replace the per-char LTR token layout (layoutChar ~798-863, measureToken ~865-897) and the diagnose-and-drop path (diagnoseUnsupportedShaping ~1016-1039) with a shaping pipeline: a HarfBuzz-style wasm shaper (adapter-isolated), a Unicode bidi reordering pass, grapheme-cluster segmentation, and a multi-atlas fallback chain. Extend MsdfFontAtlasGlyph/MsdfFontAtlasAsset and font loading (msdf-font-atlas.ts:78-115) to hold an ordered fallback font set so glyphs missing from the primary atlas resolve from a fallback before emitting a missingGlyph diagnostic. Keep the shaper behind a pure interface so it stays worker-safe and deterministic.

**Acceptance criteria:**

- An RTL string (e.g. Arabic/Hebrew) is laid out right-to-left with glyphs in correct visual order, provable by a layout test asserting the x-progression of glyph positions decreases across the run.
- A combining-mark sequence is positioned as a single grapheme cluster rather than dropped, provable by a test asserting the base + mark produce stacked glyphs at the same advance position (no unsupportedShaping drop).
- A code point absent from the primary atlas but present in a configured fallback font renders from the fallback atlas/page, provable by a test asserting the emitted glyph references the fallback page rather than producing a missingGlyph diagnostic.
- A mixed LTR+RTL (bidi) line orders runs correctly, provable by a test asserting the relative order of the LTR run and RTL run in the laid-out glyph sequence.
- Plain ASCII LTR text produces the same advances/positions as the pre-change layout, provable by a regression test comparing glyph quads for an ASCII string against the legacy layout.

**Reference.** uikit references/uikit/packages/uikit/src/text/ (shaping/segmentation/layout) and references/uikit/packages/uikit/src/text/utils.ts for grapheme/segmentation handling; HarfBuzz-style shaping + Unicode bidi as the conceptual model. Match uikit's shaped multi-font text layout, beating the current ASCII-LTR-only path.

**Invariants.** Invariants 4 and 5 are load-bearing: shaping must be deterministic (same string + fonts -> same glyph layout, no wall-clock/RNG) since it feeds render snapshots, and any still-unsupported script or missing fallback glyph emits a structured diagnostic instead of silently dropping characters. Invariant 2: the wasm shaper runs in the snapshot-producing path and stays worker-safe (no DOM/WebGPU).

### AI-53 · Adopt a Taffy-compatible flex/grid layout solver behind the UI layout adapter

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Extend UiLayoutMode (packages/render/src/rendering/authoring-types.ts:102-108) and the UiNode component (authoring-components-core.ts:127-147) with flex/grid modes plus grow/shrink/basis/wrap + justify-content/align-items/align-self/align-content fields, widen UiLayoutModePacket (packages/render/src/rendering/snapshot-packet-types.ts:130) and the extracted UiNodePacket, and replace the cursor-based row/column flow in packages/render/src/rendering/extraction-ui.ts (layoutChildren cursor advance ~166-228 and computeUiNodeMetrics ~231-303) with an adapter-isolated minimal Taffy-compatible flex/grid solver per M6 Open Decision #1 (docs/M6_UI_PARTICLES_NOTES.md:503-511). Keep the solver pure/worker-safe and feeding the same UiNodePacket rect/clip/contentRect outputs so hit-test and render consume it unchanged.

**Acceptance criteria:**

- A row container with three flex children whose grow factors are 1/2/1 distributes free space proportionally, provable by an extraction test asserting each child's computed rect width matches the proportional split within tolerance.
- justify-content (start/center/space-between) and align-items (start/center/stretch) reposition/resize children within the container, provable by a test asserting child main-axis offsets and cross-axis sizes for each option.
- flex-wrap wraps overflowing children onto a new line/track and advances the cross axis, provable by a test with children exceeding container width asserting the wrapped child's cross-axis position.
- A grid container with a 2x2 template places children into the correct cells, provable by a test asserting each child's rect maps to its grid cell.
- Existing absolute/row/column layouts produce byte-identical rects to the pre-change extractor for unchanged authoring, provable by a regression test comparing extracted UiNodePackets against the legacy flow.

**Reference.** uikit references/uikit/packages/uikit/src/flex/node.ts and flex/yoga.ts (Yoga/Taffy flex model: FlexDirection, justify/align, grow/shrink/basis, wrap, Overflow) plus references/uikit/packages/uikit/src/flex/schema.ts properties, anchored to docs/M6_UI_PARTICLES_NOTES.md Open Decision #1. Match the Yoga flex semantics for grow/shrink/justify/align/wrap.

**Invariants.** Invariants 1, 2, 3: layout stays a pure derivation from ECS authoring computed in the worker-side extraction pass and emitted into the snapshot the renderer/hit-test consume; no new renderer-owned scene graph. Invariant 6: the solver is adapter-isolated so the layout backend choice does not leak into public facades. Invariant 5: unsupported/clamped layout properties emit a structured render diagnostic rather than silently falling back.

### AI-54 · Add clipboard integration for in-engine editable text fields

**Priority** P3 · **Effort** L · **Depends on** AI-45

**Change.** Add a new clipboard module under packages/app/src/input/ that wires navigator.clipboard.readText/writeText behind a user-gesture-guarded action and installs main-thread copy/cut/paste DOM handlers on the hidden text overlay introduced by AI-45 (packages/app/src/browser/input.ts). Copy/cut read the AI-45 selection model to produce clipboard text and forward a paste as the AI-45 {kind:'text'} transport event so the editable field's caret/selection update consistently with typed input. Surface a clipboard-capability + denied-permission structured diagnostic on the input resource.

**Acceptance criteria:**

- Copy on a field with a non-empty selection writes the selected substring to the clipboard, provable by a test with a stubbed clipboard asserting writeText received exactly the selected text.
- Cut writes the selection to the clipboard and removes it from the field, updating the caret, provable by a test asserting both the clipboard write and the resulting field text/caret.
- Paste inserts clipboard text at the caret / over the current selection, provable by a test that seeds clipboard text, applies a paste, and asserts the field text and new caret position.
- Clipboard access invoked without a user gesture or when permission is denied emits a structured diagnostic and leaves the field text unchanged, provable by a test that rejects the clipboard read/write and asserts the diagnostic plus unchanged text.
- Copy/cut with an empty selection is a no-op (no clipboard write), provable by a test asserting writeText is not called.

**Reference.** uikit references/uikit/packages/uikit/src/text/selection/ranges.ts + state.ts (selection range model that copy/cut read) and references/uikit/packages/uikit/src/components/input.ts (selectionRange-driven text edits). Match its selection-range-driven copy/cut/paste; beat it by routing paste through the same forwarded text-event transport as keyboard input.

**Invariants.** Invariants 2 and 5: navigator.clipboard and copy/cut/paste DOM events are main-thread only and forward a serializable text event to the worker-side editable model (AI-45), keeping the sim worker DOM-free; denied/ungestured clipboard access emits a structured diagnostic rather than silently failing. Invariant 4: paste applies through the same deterministic text-event path so editable state stays reproducible. AI-45 lands the selection/editable model this depends on, so there is no unmet blocker.

---

## Phase 6 — Determinism, scheduling & worker transport

_A real sim clock + input ring, a richer scheduler with named phases/plugins, and the SAB transport's remaining surface._

### AI-55 · Add a fixed-rate sim clock with frame-stamped snapshots and renderer backpressure

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Replace the wall-clock delta + setTimeout(tick,0) in packages/app/src/worker/loop.ts tick (:127-141) with a fixed-rate clock+accumulator that drives stamped sim frames; add a distinct sim-frame id to each snapshot (publishGeneratedWorkerSnapshot / report.nextFrame in worker/snapshot.ts:73-135, threaded into shared-snapshot-transport.ts writeFrame via HeaderIndex.Frame) separate from the publish counter; and add an ack/backpressure message type to SIMULATION_WORKER_PROTOCOL (runtime/simulation-worker.ts:4-10) with a handler on the worker port so the renderer can throttle the producer. fixedStep options are already plumbed (loop.ts:46,71) but only feed app.step substeps, not loop cadence.

**Acceptance criteria:**

- Given a recorded sequence of identical input frames, two worker runs at the same target Hz produce snapshots whose sim-frame ids and transform buffers match byte-for-byte, proven by a deterministic test in test/runtime or test/app driving the loop with a fake clock.
- A test that advances a fake clock by N\*fixedDelta in one large jump observes exactly N stamped sim frames published (not one), demonstrating the accumulator consumes backlog instead of dropping or stretching time.
- Each published snapshot exposes a sim-frame stamp distinct from the per-publish counter; a test asserts the stamp increments by one per simulated step while a skipped (no-op) publish does not advance it.
- When the renderer sends the new ack/backpressure message after K unacked frames, a test observes the worker stops emitting new snapshots until an ack arrives, then resumes — verified through the SimulationMessagePort mock.
- The shared-array-buffer transport round-trips the sim-frame stamp: a writeFrame/readLatestFrame test confirms the reader recovers the same stamp written by the worker.

**Reference.** Bevy bevy_app RunFixedMainLoop + FixedMain (crates/bevy_app/src/main_schedule.rs): match its accumulator-driven fixed-step loop that runs FixedMain zero-to-many times per render tick; beat Bevy by additionally frame-stamping the cross-thread snapshot and adding explicit renderer->producer backpressure (Bevy keeps render in a SubApp with implicit pipelining).

**Invariants.** Upholds determinism (inv 4): fixed-step cadence with no wall-clock in the deterministic path means same inputs -> same stamped snapshots. Stays worker-snapshot-friendly (inv 2): the clock lives in the sim worker; backpressure is a message, not WebGPU or ECS access on the wrong thread. Snapshots remain the only renderer input (inv 3). Any clamping (accumulator overflow) emits a structured diagnostic, not a silent drop (inv 5).

### AI-56 · Add an SAB frame-stamped input ring with deterministic per-frame drain

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Add a SharedArrayBuffer input-ring transport in packages/runtime/src (a seqlock/atomic ring of frame-stamped, coalesced input samples, analogous to shared-snapshot-transport.ts). Replace the per-event postMessage in packages/app/src/browser/input.ts forwardInput (:136-141) with ring writes; replace the pendingInput.push in worker/start.ts:62 and the pendingInput.splice(0) drain in worker/snapshot.ts:77 with a deterministic per-frame ring drain inside advanceGeneratedInputFrame (input/events.ts). Stamp each sample with the producing/consuming sim frame to enable replay/lockstep (pairs with AI-55 frame stamping). Keep the postMessage path as a fallback when SAB/cross-origin isolation is unavailable.

**Acceptance criteria:**

- Given a fixed list of frame-stamped input samples written to the ring, a worker replay drains exactly the samples whose stamp matches each sim frame and produces identical InputResource state across two runs, proven by a deterministic test in test/runtime or test/app.
- A producer that writes more samples than the ring capacity within one frame coalesces or reports overflow via a structured diagnostic (never silently loses an event without signaling), asserted by a capacity-overflow test.
- A concurrent read/write seqlock test (writer mid-update) shows readers never observe a torn sample — they either get the prior consistent frame or retry — mirroring the snapshot transport's sequence test.
- When SAB/cross-origin isolation is unavailable, a test confirms input still flows through the postMessage fallback and the worker drains it per frame, so no environment regresses.
- An end-to-end test sends pointer + keyboard samples through the ring and asserts the resulting per-frame input summary matches what the legacy postMessage path produced for the same sequence.

**Reference.** Bevy's Messages/Events double-buffer drained once per frame in PreUpdate (event update systems) — match its deterministic per-frame event consumption; the SAB seqlock ring mirrors aperture's own shared-snapshot-transport.ts (Atomics sequence parity) rather than postMessage event spraying.

**Invariants.** Upholds determinism (inv 4): inputs are stamped and drained per fixed sim frame, so same inputs -> same snapshots and lockstep replay is possible. Worker-by-default (inv 2): main thread only writes raw samples into the ring; ECS mutation from input happens in the worker drain. Loud over silent (inv 5): ring overflow and SAB-unavailable both emit structured diagnostics with a working fallback.

### AI-57 · Add a declarative ECS scheduler with named sets, before/after, and run conditions

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Layer a declarative scheduler over elics integer priority. Extend ApertureSystemDescriptor / ApertureSystemScheduleMetadata in packages/app/src/systems.ts (:278-293) with set / before / after / runIf fields; build a topological resolver in advanced.ts resolveApertureSystemModules (:228-236) that compiles set+before+after constraints down to a total order and emits stable elics priorities for registerApertureSystemModules (:238-260); thread run-conditions into the per-frame loop (wrap the elics system update, which today only checks isPaused in world.js:65-71) so a system is skipped when its runIf returns false. Detect and report cycles/contradictory constraints as structured diagnostics.

**Acceptance criteria:**

- Given systems A.before(B) and C.after(B) declared in any registration order, a test asserts they execute in A,B,C order regardless of declaration order, proving constraint-driven ordering independent of raw priority.
- Given a named set 'movement' with two members and a system declared after('movement'), a test asserts the dependent system runs only after both set members have run that frame.
- A system with runIf returning false is observably skipped for that frame (its query side effects do not occur) and runs again when the condition flips true, proven by a counter test across frames.
- A contradictory constraint set (A.before(B) and B.before(A), or a set cycle) produces a structured diagnostic naming the involved systems and does not silently pick an arbitrary order, asserted by a test.
- Existing priority-only systems keep their current relative order after the resolver change, proven by a regression test over a mixed priority+constraint registration.

**Reference.** Bevy bevy_ecs schedule: in_set/before/after on IntoScheduleConfigs (crates/bevy_ecs/src/schedule/config.rs) and run_if conditions (examples/ecs/run_conditions.rs, condition.rs). Match Bevy's named-set + ordering-constraint + run-condition model and its cycle detection; compile down to elics priorities rather than replacing the executor.

**Invariants.** ECS stays the single source of truth (inv 1): this orders systems, it does not add a scene graph. Determinism (inv 4): the resolver produces a stable total order from the same constraints, and run conditions must be pure/deterministic in deterministic paths. Worker-safe (inv 2): scheduling logic runs wherever systems run (the worker) with no renderer reach-back. Cycles/contradictions are loud (inv 5). No cross-package boundary added — resolver lives in app over elics (inv 6).

### AI-58 · Expose built-in frame phases as named schedule anchors

**Priority** P2 · **Effort** L · **Depends on** AI-57

**Change.** Publish stable named anchor constants for the engine's built-in step boundaries so user systems/effects can target them via the AI-57 before/after scheduler: from packages/runtime/src/index.ts step() expose anchors at afterPhysicsWriteback (after fixedStep.step:303), afterTransformResolution (after resolveWorldTransforms:304), and beforeSkinning (before updateSkeletonPalettes:307); and from app advanced.ts step() (:177-188) expose input/update/postUpdate boundaries. Extend ApertureEffectPhase in systems/effects.ts:5 (currently "input"|"update"|"postUpdate") and have the AI-57 resolver accept these anchor names in before/after / runIf so systems and effects resolve relative to them.

**Acceptance criteria:**

- A system declared after(afterTransformResolution) observes resolved WorldTransform values for the current frame (not stale), proven by a test reading a transform the resolver just wrote.
- A system declared before(beforeSkinning) runs before skeleton palettes are computed, asserted by a test that mutates a joint and confirms the change is reflected in that frame's palette.
- An effect scheduled on a new anchor-derived phase flushes at the correct boundary relative to the built-in step phases, proven by an ordering test against flushApertureSystemEffects timing.
- Targeting an unknown/misspelled anchor name produces a structured diagnostic listing the available anchors rather than silently running at default priority, asserted by a test.
- Anchor constants are exported from the public app/runtime surface and a test imports and uses them to schedule a system, proving they are first-class and stable.

**Reference.** Bevy main_schedule.rs named schedule labels (First/PreUpdate/Update/PostUpdate/Last, Fixed\* labels) and MainScheduleOrder.insert_after (examples/ecs/custom_schedule.rs): match Bevy's named built-in phase anchors that user systems order against; aperture's anchors map onto its worker step() boundaries.

**Invariants.** Determinism (inv 4): anchors are fixed boundaries in the deterministic step, so ordering against them is reproducible. Renderer derives from snapshots only (inv 3): anchors order sim work, not rendering. Worker-by-default (inv 2): all anchors are points in the worker step. Unknown-anchor is loud (inv 5). Builds on AI-57 so the prerequisite resolver/run-condition surface already exists (no unmet blocker).

### AI-59 · Introduce a packaged-feature Plugin abstraction with a build/finish/cleanup lifecycle

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Add a plugin module (e.g. packages/app/src/systems/plugin.ts) exporting createPlugin/definePlugin that bundles components + resources + systems + render-passes + config behind build/finish/cleanup lifecycle hooks. Add an addPlugin/plugins entry to CreateApertureAppOptions in advanced.ts (:45-54) and an install loop in createApertureApp that runs build then finish (and registers cleanup) before the app is returned; migrate registerApertureAppComponents (systems/components.ts:37-45) and the loose ApertureSystemModule registration (advanced.ts:238-260) onto the plugin path. Enforce single-install-by-name with a structured diagnostic on duplicates.

**Acceptance criteria:**

- A test installs a custom plugin that registers a component, a system, and config, then spawns an entity and steps the app — the plugin's system observably runs and mutates the component, proving the bundle was fully installed.
- The built-in components are migrated: a test confirms an app created with the default plugin set still has transform/metadata/render-authoring/app components registered (no regression vs registerApertureAppComponents).
- Adding the same plugin twice emits a structured duplicate-plugin diagnostic naming the plugin and installs it only once, asserted by a test.
- A plugin's cleanup hook runs on app teardown and releases its resources (e.g. an effect handle / fixed-step task), proven by a test asserting the cleanup callback fired and the resource is gone.
- A plugin's finish hook runs after all plugins' build hooks (so cross-plugin dependencies resolve), asserted by an ordering test with two interdependent plugins.

**Reference.** Bevy Plugin trait lifecycle (crates/bevy_app/src/plugin.rs): build -> ready -> finish -> cleanup, is_unique()/name() duplicate detection, and PluginGroup (DefaultPlugins). Match Bevy's lifecycle and duplicate-by-name rule; aperture's default component/system registration becomes the equivalent of DefaultPlugins.

**Invariants.** ECS single source of truth (inv 1): plugins register ECS components/systems, not a parallel scene graph. Worker-by-default (inv 2): plugin build/finish run during app construction in the worker; render-pass contributions stay snapshot-derived (inv 3). Backend-neutral (inv 6): plugin API lives in app and does not leak backend-specific types. Duplicate install is loud (inv 5). Determinism preserved (inv 4): plugin install order is deterministic and ordering of contributed systems flows through the AI-57-style scheduler/priority.

### AI-61 · Expose a configurable target Hz / publish cadence on the worker loop

**Priority** P2 · **Effort** M · **Depends on** AI-55

**Change.** Surface the fixed-rate cadence introduced by AI-55 as a configurable target: read a targetHz/loopHz field off SimulationWorkerStartOptions (runtime/simulation-worker.ts:12-19) and thread it into the AI-55 accumulator loop in packages/app/src/worker/loop.ts tick (:127-141), replacing any hard-coded rate; optionally coordinate publish cadence with the render-side rAF via the AI-55 ack channel. This is the narrow configurable-rate subset of AI-55, layered on the clock AI-55 lands.

**Acceptance criteria:**

- Given startOptions with targetHz=30 versus targetHz=60 over the same fake-clock duration, a test observes roughly half as many published sim frames in the 30 Hz run, proving the rate is honored.
- A test omitting targetHz confirms the loop falls back to the documented default rate (matching AI-55's fixed cadence) rather than free-running per setTimeout.
- An invalid targetHz (0, negative, NaN) is rejected with a structured diagnostic at startup rather than silently defaulting, asserted by a test reading the worker error/diagnostic message.
- With AI-55 backpressure enabled, a test shows the effective publish cadence never exceeds targetHz even when the consumer acks faster than that rate.

**Reference.** Bevy Time<Fixed> timestep configuration (bevy_time) + RunFixedMainLoop cadence (crates/bevy_app/src/main_schedule.rs): match Bevy's configurable fixed timestep period; AI-61 exposes the equivalent rate knob on the worker start options.

**Invariants.** Upholds determinism (inv 4): targetHz selects the fixed cadence, not a wall-clock-derived variable step, so replay stays reproducible. Worker-only (inv 2): the rate is consumed inside the sim worker; main thread only forwards the option. Invalid config is loud (inv 5).

### AI-68 · Design and prototype a parallel system scheduler with conflict analysis

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Gate behind a design doc first: extend docs/ADVANCED_ORCHESTRATION.md (today documents only the worker/main split, no parallelism section) with a parallel-scheduling design. Then add read/write component-access conflict analysis over the component model in packages/simulation/src (per-system declared component access -> compatibility test), a worker-pool job graph that runs non-conflicting systems concurrently, wired into runtime step() (index.ts:295-308) and the worker loop (app/worker/loop.ts), backed by SAB-backed component storage usable across threads. Systems declare access via the AI-57-style descriptor so conflict sets are derivable.

**Acceptance criteria:**

- A unit test of the conflict analyzer asserts two systems with disjoint component access are reported compatible while two writing the same component are reported conflicting.
- A scheduling test shows that for a known set of non-conflicting systems the produced job graph permits concurrent execution, while conflicting systems are serialized — verified by the resolved batches, not wall-clock timing.
- A determinism test runs the same world+inputs through the parallel scheduler twice (and against the serial scheduler) and asserts identical resulting component state, proving parallelism does not change results.
- A system that declares access it does not actually have (or aliases a write) is caught by the conflict model and surfaced as a structured diagnostic rather than racing, asserted by a test.
- docs/ADVANCED_ORCHESTRATION.md gains a parallel-scheduling section describing the access model, job graph, and SAB storage constraints, and the design is referenced by the implementation tests.

**Reference.** Bevy MultiThreadedExecutor (crates/bevy_ecs/src/schedule/executor/multi_threaded.rs): per-system component_access_set conflict bitsets + is_compatible() to run non-conflicting systems on a ComputeTaskPool. Match its access-based conflict analysis and parallel dispatch; aperture adds SAB-backed storage for the worker-pool variant.

**Invariants.** Determinism where it matters (inv 4) is the load-bearing invariant: parallel execution must yield bit-identical results to the serial fixed-step path, enforced by conflict analysis that serializes any read/write or write/write overlap. ECS single source of truth (inv 1) and worker-by-default (inv 2) are preserved: SAB component storage stays the authoritative ECS state across the worker pool, no WebGPU in sim, renderer still consumes snapshots only (inv 3). Undeclared/aliased access is loud (inv 5). Conflict model stays in simulation; no backend boundary crossed (inv 6).

### AI-69 · Emit COOP/COEP dev-server headers from the vite-plugin and thread SAB transport through the generated scaffold

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** In packages/vite-plugin/src/index.ts configureServer, install a config-gated Connect middleware that sets Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp on dev-server responses (matching the recipe already proven in scripts/serve-examples.mjs lines 167/232). This requires extending the ApertureViteDevServer interface in packages/vite-plugin/src/dev-session.ts:14-38 to expose server.middlewares (the Connect app, currently untyped). Add a sab/crossOriginIsolated opt-in to ApertureVitePluginOptions so the headers are off by default (embedded-page safe) and only emitted when requested. Then thread a transport field through StartGeneratedBrowserAppOptions (packages/app/src/browser/app.ts:28-39) into the createWebGpuApp call (currently app.ts:92-99 passes no transport) and into the scaffold generator in packages/vite-plugin/src/virtual-modules.ts so a generated app can request transport:'shared-array-buffer'. Update docs/SHARED_ARRAY_BUFFER_TRANSPORT.md with the production COOP/COEP recipe.

**Acceptance criteria:**

- A new vite-plugin test drives the plugin's configureServer with a fake Connect server and asserts that, with the isolation opt-in enabled, a request handled by the registered middleware carries Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp.
- The same test asserts that with the opt-in OFF (default) no COOP/COEP middleware is registered, so embedded/iframe hosting keeps working unchanged.
- A test asserts the middleware is not installed when command === 'build' (parity with the existing build short-circuit in configureServer).
- A generated-scaffold/browser-app test confirms that setting transport:'shared-array-buffer' in StartGeneratedBrowserAppOptions reaches createWebGpuApp with mode 'shared-array-buffer', and that omitting it leaves the transport on the default transferable path (no transport key forwarded).
- An app-level test confirms that on a non-isolated host the requested shared-array-buffer transport reports the typed transport fallback diagnostic (requested shared-array-buffer / active transferable) instead of throwing, so rendering still starts.

**Reference.** Matches the COOP+COEP recipe already shipped in scripts/serve-examples.mjs (which exercises examples/sab-cube.html) and documented in docs/SHARED_ARRAY_BUFFER_TRANSPORT.md; aligned with MDN's crossOriginIsolated requirement. No external engine analog needed.

**Invariants.** Inv5 (loud-over-silent): the existing typed transport fallback diagnostic must still fire on non-isolated hosts; the headers are config-gated so unsupported hosting degrades visibly, never silently. Inv2/Inv7: pure main-thread dev-server + scaffold plumbing, no WebGPU in the sim worker and no ECS mutation; TypeScript/WebGPU-only. Inv8: ships with tests and must keep pnpm run check green.

### AI-70 · Extend SAB transport to the remaining packet families so sprite/particle/UI/skybox/fog/skinning frames no longer fall back to transferable

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** The sourceAssets send-on-change postMessage gating is already landed (packages/app/src/worker/snapshot.ts:91-92, covered by test/app/asset-mirror.test.ts:104), so the residual work is: (1) avoid the per-frame registry.list().filter().map() scan in serializeSourceAssetRegistry (packages/app/src/asset-mirror.ts:43-55,101-118) when no asset version changed, returning an empty result without allocating; and (2) add shared-packet/byte-region encoders for the families that currently force a transferable fallback in hasUnsupportedSharedSnapshotPayload (packages/app/src/worker/snapshot.ts:188-205): spriteDraws, particleEmitters, uiNodes, uiHitRegions, skyboxes, fogs, instanceAttributePackets plus the byte buffers bones, morphTargetWeights/Deltas, morphInstanceDescriptors and instanceAttributes. This means adding fixed-stride packet codecs + word constants in packages/render/src/rendering (snapshot-packed-encoder.ts, snapshot-packed-codecs.ts, snapshot-packed-decoder.ts, snapshot-packed-encoding-constants.ts, header), bumping SNAPSHOT_PACKET_ENCODING_VERSION, extending SharedSnapshotFrameInput/writeFrame/readLatestFrame and the layout in packages/runtime/src/shared-snapshot-transport.ts:53-96 for the new byte regions, reconstructing the families in readWebGpuAppSharedSnapshot in packages/webgpu/src/app/app-snapshot-transport.ts, and dropping the now-handled checks from hasUnsupportedSharedSnapshotPayload.

**Acceptance criteria:**

- A render round-trip test encodes a snapshot containing spriteDraws, particleEmitters, uiNodes, uiHitRegions, skyboxes and fogs through encodeSnapshotPackets and decodes it via decodeSnapshotPackets, recovering each family's fields byte-for-byte equal to the input.
- An app-snapshot-transport test (extending test/webgpu/app-snapshot-transport.test.ts) writes a frame carrying skinning data (bones, morphTargetWeights/Deltas, morphInstanceDescriptors) and instanceAttributes through the SAB writer, then readWebGpuAppSharedSnapshot returns those exact typed-array regions to the renderer.
- A worker-snapshot test (extending test/app patterns) confirms that a snapshot with sprites/particles/UI now publishes via the shared-array-buffer path (createSharedSnapshotMessage returns non-null) instead of falling back to transferable.
- An asset-mirror test asserts serializeSourceAssetRegistry with a delta state returns the empty-entries result on a steady-state frame without re-serializing entries (e.g. a spy/wrapped registry confirms map() is not invoked when no version changed).
- A capacity test asserts that a frame whose new-family payload exceeds the allocated SAB region throws the typed RangeError and the publisher cleanly falls back to the transferable path (createSharedSnapshotMessage returns null), so the frame is never silently dropped.

**Reference.** Builds on aperture's own packed-encoding contract (snapshot-packed-encoder.ts / SHARED_ARRAY_BUFFER_TRANSPORT.md, FEAT-02/03 SAB history) which already encodes views/meshDraws/lights/environments/shadowRequests/bounds/quadBatches; extends the same SeqLock double-buffer scheme to the content families. Conceptually parallels Bevy's render extract/prepare phase (references/bevy) packing every extracted family into GPU-bound buffers rather than leaving some on a slow path.

**Invariants.** Inv2/Inv3: the renderer still consumes only the extracted snapshot via readWebGpuAppSharedSnapshot and never reaches back into ECS; encoding stays worker-side. Inv4: codecs are deterministic fixed-stride word/byte writes, so identical snapshots yield identical SAB frames. Inv5: capacity overflow surfaces the typed RangeError and a visible transferable fallback instead of dropping families silently. Inv8: ships with the named round-trip/capacity tests and keeps pnpm run check green (version bump keeps encoder/decoder in lockstep).

---

## Phase 7 — glTF / asset pipeline breadth

_Lights/cameras, sparse attributes, PBR-next, primitive modes, extra attributes, morph tangents, instancing, CORS, plus scene save/load, bake, and export._

### AI-32 · Plan Light + Camera ECS authoring commands from node.camera / KHR_lights_punctual

**Priority** P2 · **Effort** L · **Depends on** none

**Change.** Carry light/camera references through traversal and emit Light/Camera addComponent commands. (1) Add readonly cameraIndex/lightIndex to GltfTraversedNode in gltf-scene-traversal-types.ts and populate them in gltf-scene-traversal-nodes.ts (read rawNode.camera and rawNode.extensions.KHR_lights_punctual.light via mapOptionalIndex). (2) Extend GltfEcsAuthoringComponentName + GltfEcsAuthoringComponentValue in gltf-ecs-authoring-command-plan-types.ts with 'Light'/'Camera' plus GltfLightCommandValue (kind directional|point|spot, color, intensity, range, innerConeAngle, outerConeAngle) and GltfCameraCommandValue (projection perspective|orthographic, fovYRadians, near, far, aspect/orthographicHeight) mirroring the existing Light/Camera authoring components in rendering/authoring-components-camera-light.ts. (3) Emit those commands in gltf-ecs-authoring-command-plan(.ts/-entities.ts) for nodes carrying a light/camera, resolving the punctual light defs from root.extensions.KHR_lights_punctual.lights. (4) Add 'KHR_lights_punctual' to SUPPORTED_ROOT_EXTENSIONS in gltf-root.ts so a required-extension glTF still validates. (5) Add Light/Camera switch cases in gltf-ecs-command-replay-components.ts calling entity.addComponent(Light,…)/(Camera,…). Shares the punctual-light parse with AI-33.

**Acceptance criteria:**

- A glТF with a node referencing a KHR_lights_punctual directional light produces an ECS authoring command plan whose node entity carries a Light addComponent command with kind 'directional' and the source color/intensity, and replaying it onto a World yields an entity with the Light component populated (proven in test/assets/gltf-ecs-authoring-command-plan.test.ts + gltf-ecs-command-replay.test.ts).
- A node with a point or spot light maps to LightKind point/spot with range (and innerConeAngle/outerConeAngle for spot) carried through to the replayed Light component (named test asserts both kinds).
- A node.camera referencing a perspective camera produces a Camera addComponent command whose replayed entity has CameraProjection.Perspective with fovYRadians/near/far matching the glTF camera def; an orthographic camera maps to CameraProjection.Orthographic with orthographicHeight (named replay test).
- A glTF that lists KHR_lights_punctual in extensionsRequired validates (gltfRoot report.valid === true) and reaches traversal/command planning instead of being rejected as an unsupported required extension (test/assets/gltf-scene-traversal.test.ts).
- Nodes without camera/light emit no Light/Camera commands and the existing mesh/transform command output is byte-for-byte unchanged in the command-plan JSON snapshot (gltf-ecs-authoring-command-plan-json.test.ts).

**Reference.** three.js examples/jsm/loaders/GLTFLoader.js GLTFLightsExtension (lines ~660-740): directional/point/spot mapping with range and spot inner/outer cone, and per-node extensions.KHR_lights_punctual.light reference. Match its light-type + spot-cone semantics, mapping into aperture's existing Light/Camera authoring components rather than three Object3D instances.

**Invariants.** Inv1/3: lights & cameras become ECS components via replayable authoring commands, not a renderer scene graph. Inv5: unsupported light.type or malformed punctual def must emit a structured authoring/traversal diagnostic, never silently drop. Inv6: stays in the render gltf-import package, reusing existing render authoring components. Inv8: ships with command-plan + replay tests and keeps pnpm run check green.

### AI-33 · Synthesize light/camera scene intents from KHR_lights_punctual during import

**Priority** P2 · **Effort** M · **Depends on** AI-32

**Change.** In createGltfSceneImportContractReport (gltf-scene-import-contract.ts) add a parse step that reads root.extensions.KHR_lights_punctual.lights plus the per-node light/camera refs surfaced by AI-32's traversal to synthesize GltfSceneDirectLightIntent[] and GltfSceneCameraIntent[], then merge them with options.directLights/options.cameras as overrides (today lines 94-95/118-119 just spread options.\* ?? []). Extend GltfSceneDirectLightIntent.kind in gltf-scene-import-contract-types.ts beyond 'directional' to 'directional'|'point'|'spot' (add range / cone fields). Update createGltfSceneImportContractSummary so cameraCount/directLightCount count parsed intents, and update gltf-scene-import-contract-diagnostics.ts so missingDirectLightIntent / missingCameraIntent fire only when NEITHER parsed nor caller-supplied intents exist.

**Acceptance criteria:**

- Importing a glTF that defines KHR_lights_punctual lights and a node.camera, with NO options.directLights/options.cameras supplied, produces an import-contract report whose directLights/cameras arrays contain the parsed intents (color/intensity/kind, projection/near/far) and whose summary directLightCount/cameraCount reflect them (test/assets/gltf-scene-import-contract.test.ts).
- With parsed lights present, the report has no missingDirectLightIntent diagnostic; a glTF with no punctual lights and no caller-supplied lights still surfaces missingDirectLightIntent (named test asserts both directions).
- A point and a spot punctual light each yield a GltfSceneDirectLightIntent with kind 'point'/'spot' and the source range (and cone angles for spot), proving the widened union round-trips through the report JSON (gltf-scene-import-contract.test.ts).
- Caller-supplied options.directLights/options.cameras still override/append to the parsed set (a supplied light appears in the report even when the glTF also defines lights), so existing callers are not regressed (named test).
- The import-contract report JSON projection remains JSON-safe with the new intent fields (gltf-report-json style assertion in the contract test).

**Reference.** three.js GLTFLoader GLTFLightsExtension \_loadLight (range default 0, spot.innerConeAngle/outerConeAngle defaults). Match its defaulting so missing range/cone fields produce the same spec defaults in our synthesized intents.

**Invariants.** Inv1/3: intents are descriptive import metadata feeding ECS authoring, not renderer state. Inv5: the missing\*Intent diagnostics stay loud but become accurate (fire only when truly absent), and malformed light defs emit a diagnostic. Inv4: parse is pure over the root JSON (deterministic, same input -> same intents). Inv8: covered by import-contract tests, check stays green.

### AI-34 · Apply KHR sparse-accessor overrides on the primitive vertex-attribute decode path

**Priority** P2 · **Effort** S · **Depends on** none

**Change.** Extend sparse support from the float reader (already done in gltf-accessor-float-reader.ts) to the renderable primitive path. In gltf-accessor-validation-accessors.ts replace the early null-return on accessor.sparse (lines 39-47) with validation of sparse.count and the sparse.indices/.values bufferViews, recording the sparse reference on GltfValidatedAccessorReference (extend gltf-accessor-validation-types.ts). Then in the primitive decode (gltf-accessor-decoding.ts decodeAccessor / gltf-accessor-decoding-source.ts) apply the index/value substitution onto the decoded element bytes after the base read, reusing the same component-read logic. Malformed sparse becomes a hard gltfAccessor error (not a deferral warning); a valid sparse accessor decodes its substituted vertices.

**Acceptance criteria:**

- A primitive whose POSITION accessor uses a valid KHR sparse block decodes to a vertex stream where exactly the sparse-indexed vertices carry the override values and all other vertices keep the bufferView base values (new case in test/assets/gltf-accessor-sparse.test.ts driving the primitive decode path).
- A pure-sparse POSITION accessor (no bufferView) decodes with zero-filled base plus the sparse substitutions, yielding a renderable mesh primitive (named test, mirroring the float-reader behavior).
- A malformed sparse block (out-of-range index, missing indices/values bufferView, or non-unsigned index componentType) makes the primitive accessor validation fail with a structured gltfAccessor error and the primitive is skipped, instead of the old silent deferral warning (named test asserts the error code).
- A primitive with no sparse accessor decodes byte-for-byte identically to before this change (regression assertion in gltf-mesh-primitive / accessor decoding tests).

**Reference.** glTF 2.0 sparse-accessor spec and three.js GLTFLoader loadAccessor (lines ~3101-3191): read sparse.indices (unsigned componentType) and sparse.values, overwrite base elements by index. Match its substitution semantics on the primitive vertex path (the float reader already matches it for skin/animation accessors).

**Invariants.** Inv5: upgrade from a silent deferral to either a real validated decode or a hard structured error — never a silent no-op. Inv4: decode is deterministic over the buffer bytes. Inv8: extends the existing sparse test and keeps the accessor validation/decoding suites green.

### AI-35 · Define a self-contained on-disk scene format with file/URL loader and asset rebinding

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Extend ApertureSceneDocument in packages/simulation/src/serialization/scene-document.ts with a versioned, content-addressed asset manifest (entries keyed by AssetHandle kind+id from packages/simulation/src/assets/types.ts, each carrying a content hash and optional inline base64 bytes), and add a new packages/simulation/src/serialization/scene-loader.ts that pairs a writer (document -> bytes) with an async loader that accepts an injected byte fetcher (no node:fs in the simulation package, keeping it worker-safe). The loader rebinds MeshHandle/MaterialHandle/TextureHandle through an AssetRegistry-backed resolver so handle-bearing components resolve against assets reconstructed from the manifest rather than requiring a re-import of the original glTF into the same registry; finish the elics storage-binding decoupling sketched at scene-document.ts:104-113 by routing all component (re)registration through component-registry.ts. Add a thin file-I/O command in packages/cli/src/commands/ that reads/writes the container from disk using the loader's injected fetcher.

**Acceptance criteria:**

- A scene authored in one world, written to a single self-contained byte payload, then loaded into a FRESH world (with no prior glTF import) reproduces every entity's transform hierarchy AND its MeshHandle/MaterialHandle/TextureHandle-bearing components resolving to live, queryable assets — proven by a named round-trip test that asserts getMesh/getMaterial on the reloaded handles returns the same asset payload as the source.
- Loading a document whose asset manifest entry has a content hash that does not match its embedded bytes emits a structured diagnostic (code under aperture.scene.\*) and refuses to bind that asset, rather than silently binding corrupt data — proven by a tamper test that flips a manifest byte and asserts the diagnostic plus an unbound handle.
- An external/URL-backed asset (manifest entry with a uri and no inline bytes) loads correctly when the injected byte fetcher supplies the bytes, and reports a structured missing-asset diagnostic (not a throw) when the fetcher returns nothing — proven by a test driving both branches with a stub fetcher.
- The new loader contains no node:fs / DOM import and check:boundaries stays green for the simulation package; the only filesystem access lives in the new CLI command, verified by a CLI test that writes a scene file and reads it back into an equivalent world.
- Loading an unknown container formatVersion instantiates nothing and returns the existing aperture.scene.unknownFormatVersion diagnostic, preserving the current fail-loud contract — proven by an extended version-guard test.

**Reference.** three.js GLTFExporter writeGLB + getPaddedBufferSize (references/three.js/examples/jsm/exporters/GLTFExporter.js) for the embedded-buffer container shape, and gltf-transform's content-addressed resource model for the manifest/hash design; match a self-contained single-file payload with deterministic round-trip rebinding.

**Invariants.** Upholds ECS-as-source-of-truth (the document is a derived snapshot of ECS state, never a parallel scene graph) and worker-snapshot-friendliness (loader stays free of node:fs/WebGPU so it runs in the sim worker; all real file I/O is injected and lives in CLI). Determinism: stable id ordering and content hashing keep same-input -> same-bytes. Loud-over-silent: hash mismatch and missing-asset paths emit structured diagnostics instead of binding corrupt or empty assets.

### AI-36 · Add an offline `aperture bake` asset-optimization command wrapping glTF encoders

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Add packages/cli/src/commands/bake.ts exporting runBakeCommand, wired into the dispatcher in packages/cli/src/cli.ts (add a `command === "bake"` branch alongside the existing create/adapter/dev/mcp/tool/reference branches at lines 55-106) and documented in mainHelp() (line 134). The command takes an input glTF/GLB and emits an optimized glTF/GLB by wrapping net-new offline encoder dependencies (gltf-transform for Draco/meshopt geometry compression + welding/decimation, and toktx/basisu for KTX2 texture encoding) — these are net-new because all current asset code under packages/render/src/assets (ktx2-basis-transcoder.ts, draco-decoder.ts, meshopt-decoder.ts) is runtime browser-side DECODE only. Selectable passes via flags (--ktx2, --draco, --meshopt, --decimate=<ratio>) with a structured diagnostic when a requested pass cannot run (missing native toktx binary, unsupported input).

**Acceptance criteria:**

- Running `aperture bake <in.glb> --meshopt -o <out.glb>` produces a valid GLB that re-imports through the existing gltf loader to the same vertex/index counts as the input, and whose primitive carries the EXT_meshopt_compression extension — proven by a CLI test that bakes a fixture and re-parses both files, asserting geometry equality and the extension's presence.
- Running the bake command with `--ktx2` rewrites material base-color textures to KTX2/Basis images whose bytes transcode successfully through the existing createBasisUniversalKtx2Transcoder path — proven by a test that bakes a textured fixture and feeds an emitted texture back through the runtime transcoder to a non-empty decoded image.
- `--decimate=0.5` emits a mesh with strictly fewer triangles than the input while still re-importing as a valid mesh — proven by a CLI test asserting the reduced triangle count and a successful re-parse.
- Requesting a pass whose toolchain is unavailable (e.g. toktx binary not on PATH) exits non-zero with a structured ApertureCliError code (aperture.cli.bake.\*) naming the missing tool, and does NOT write a partial output file — proven by a test that stubs an unavailable encoder.
- `aperture bake --help` and `aperture --help` both list the bake command and its flags — proven by a help-output test, and the dispatcher returns the unknownCommand error unchanged for unrelated commands.

**Reference.** gltf-transform (Document/transforms: weld, draco, meshopt, simplify) and KhronosGroup toktx/basisu for KTX2 encoding; this is the offline-encode counterpart to three.js GLTFExporter and matches gltf-transform's CLI optimize pipeline (Draco/meshopt + KTX2) for output size.

**Invariants.** Backend-neutral and boundary-clean: all net-new encoder deps live only in packages/cli (an IO/tooling package), never in the headless simulation/render packages, so check:boundaries and the WebGPU-only runtime are untouched. Loud-over-silent: unavailable toolchains and unsupported inputs emit structured CLI diagnostics and fail without writing partial files, never a silent no-op. Output remains standards-compliant glTF/GLB so the existing import path (the ECS-derived consumer) round-trips it.

### AI-37 · Add a glTF/GLB writer and an ECS-scene-to-glTF file exporter

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Add a standards-compliant glTF/GLB writer under packages/render/src/assets (e.g. gltf-exporter.ts plus gltf-exporter-glb-writer.ts), the write-side counterpart to the existing reader in glb-container.ts / glb-container-chunks.ts / glb-container-utils.ts: emit the 12-byte GLB header (magic 0x46546C67, version 2), a 0x20-padded JSON chunk and a 0x00-padded BIN chunk, both 4-byte aligned. Build the JSON (buffers/bufferViews/accessors/meshes/materials/nodes/scenes) from render-side MeshAsset/MaterialAsset data (gltf-mesh-asset-construction-types.ts vertexStreams/indexBuffer, materials/\*). Add an ECS-scene-to-file exporter that walks the simulation scene serialization (packages/simulation/src/serialization/scene-document.ts) and the AI-35 on-disk asset manifest to feed mesh/material/transform data into the writer, so a saved Aperture scene becomes a portable glTF/GLB. Optionally surface it as an `aperture export` CLI command under packages/cli/src/commands/, reusing the AI-36 CLI scaffolding.

**Acceptance criteria:**

- A scene built in ECS (nodes with transforms + a mesh primitive + a PBR material) exported to GLB re-imports through the existing parseGlbContainer + gltf loader to an equivalent world: same node hierarchy, same vertex/index counts, and matching base-color factor — proven by a named ECS->GLB->ECS round-trip test.
- The emitted GLB passes the engine's own parseGlbContainer with zero error diagnostics, with a JSON chunk padded with 0x20 and a BIN chunk padded with 0x00 to 4-byte alignment and a header byteLength equal to the file length — proven by a writer test asserting chunk alignment and a clean parse.
- A mesh with multiple primitives and a 16- vs 32-bit index buffer exports accessors with the correct componentType and min/max bounds, re-importing to identical geometry — proven by a test covering both index widths.
- Exporting a node referencing an unsupported/unmapped material feature emits a structured diagnostic (aperture.export.\*) describing the approximation/omission and still produces a loadable GLB, rather than silently dropping data or throwing — proven by a test exercising an unsupported feature.
- The exporter reads only render-side asset data and the serialized scene document (never reaching back into a live ECS world from the renderer); a name-checked test confirms the GLB is produced purely from a RenderSnapshot/MeshAsset + ApertureSceneDocument input.

**Reference.** three.js GLTFExporter writeGLB path and getPaddedBufferSize (references/three.js/examples/jsm/exporters/GLTFExporter.js lines ~485-740) and PlayCanvas gltf-exporter.js buildJson/buildGlb (references/engine/src/extras/exporters/gltf-exporter.js, magic 0x46546C67) — match their GLB chunk layout/alignment and spec-compliant accessor/bufferView emission.

**Invariants.** Renderer-consumes-snapshots: the writer builds GLTF solely from extracted MeshAsset/MaterialAsset + the serialized ApertureSceneDocument and never reads a live ECS world, preserving the extract boundary; ECS stays the source of truth and the exported file is a derived view. Loud-over-silent: unsupported/approximated material features emit structured diagnostics rather than silent drops. TypeScript-first and boundary-clean: writer lives in the render package reusing the existing GLB container constants; no WebGPU types are pulled in, keeping check:boundaries green.

### AI-38 · Parse + render the remaining PBR-next material extensions

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Add KHR_materials_emissive_strength, KHR_materials_specular, KHR_materials_anisotropy, KHR_materials_variants, and KHR_animation_pointer to SUPPORTED_MATERIAL_EXTENSIONS in gltf-material-extensions.ts. Add per-extension parse helpers in gltf-material-standard-extension-fields.ts (and field plumbing in gltf-material-builders.ts / gltf-material-standard-fields.ts): emissiveStrength scales emissiveFactor; specular -> specularFactor/specularColorFactor (+ textures); anisotropy -> anisotropyStrength/anisotropyRotation (+ texture). Extend StandardMaterialAsset in materials/types.ts with the new fields, thread them into the standard-material uniform buffer + PBR shader sampling, and sample clearcoatNormalTexture in the shader (removing the warning currently emitted at gltf-material-extensions.ts:34-41). Surface KHR_materials_variants (variant name list + per-primitive material mappings) and KHR_animation_pointer as parsed-but-structured (loud diagnostic if a feature is approximated) rather than unsupported-extension warnings.

**Acceptance criteria:**

- A material using KHR_materials_emissive_strength maps to a StandardMaterialAsset whose effective emissive equals emissiveFactor \* emissiveStrength, observable in the prepared standard-material uniform buffer (test/materials/gltf-material.test.ts + a standard-material buffer test).
- A material with KHR_materials_specular yields the parsed specularFactor/specularColorFactor (and bound textures) on the StandardMaterialAsset and they reach the uniform buffer (named material test).
- A material with KHR_materials_anisotropy yields anisotropyStrength/anisotropyRotation on the asset, and a render proof-point shows the anisotropic specular response differing from the isotropic baseline (named webgpu/material proof-point test).
- A clearcoat material that supplies clearcoatNormalTexture no longer emits the gltfMaterial.unsupportedOptionalExtension warning and the texture binding is present on the asset / sampled by the shader (named material test asserts the binding and absence of the warning).
- A glTF declaring KHR_materials_variants exposes the variant names and per-primitive material mappings through the material/import report, and KHR_animation_pointer is recognized (no unsupportedRequiredExtension error when listed) (named test).

**Reference.** three.js GLTFLoader extension classes: GLTFMaterialsEmissiveStrengthExtension (~859), GLTFMaterialsSpecularExtension (~1296), GLTFMaterialsAnisotropyExtension (~1398), GLTFMaterialsVariantsExtension. Match their factor/texture parsing and emissive-strength multiply; meet or beet three's anisotropy/specular coverage in the PBR shader.

**Invariants.** Inv5: any extension feature that is parsed-but-approximated (e.g. variants beyond the active mapping, animation_pointer targets we do not yet drive) must emit a structured diagnostic, never silently no-op. Inv1/3: materials stay backend-neutral assets consumed by the renderer via snapshots. Inv7/8: WebGPU-only shader changes ship with material + render tests and keep check green.

### AI-39 · Import non-triangle glTF primitive modes (points, lines, strips, fans)

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** Widen mapTopology in gltf-mesh-primitive-planning.ts (currently mode 4 only, return type 'triangle-list' | null) to map glTF modes 0->point-list, 1->line-list, 2->line-loop (convert to line-list), 3->line-strip, 4->triangle-list, 5->triangle-strip, 6->triangle-fan. Change the planned primitive topology field (GltfPlannedMeshPrimitiveAsset.topology in gltf-mesh-primitive-types.ts) and the mesh submesh topology to the full MeshTopology union (already defined in mesh/types.ts). For triangle-fan (and optionally triangle-strip when the pipeline can't take strip topology) add index reindexing into triangle-list during mesh-asset construction; pass strip/line/point topology through to MeshSubmeshDescriptor.topology so the render pipeline selects the matching primitive topology. Keep the unsupportedPrimitiveMode diagnostic only for genuinely invalid mode values.

**Acceptance criteria:**

- A primitive with mode 0 (POINTS) builds a MeshAsset whose submesh topology is 'point-list' and renders without the unsupportedPrimitiveMode warning (test/mesh/primitive.test.ts or test/assets/gltf-mesh-primitive.test.ts).
- A primitive with mode 1 (LINES) builds a submesh with topology 'line-list', and mode 3 (LINE_STRIP) builds 'line-strip', with the source index/vertex counts preserved (named test).
- A triangle-fan primitive (mode 6) is reindexed into a triangle-list whose triangle count equals vertexCount-2 (or indexCount-2), producing the same visible triangles as the fan, verified against an explicit small fan fixture (named mesh-construction test).
- A triangle-strip primitive (mode 5) is rendered either via strip topology or strip->list reindexing such that adjacent triangles share the strip's winding, proven on a 4-vertex strip fixture (named test).
- A primitive with an invalid/unknown mode value still produces the structured gltfMesh.unsupportedPrimitiveMode diagnostic and is skipped (regression assertion).

**Reference.** three.js GLTFLoader toTrianglesDrawMode + TriangleStripDrawMode/TriangleFanDrawMode handling (lines ~3842-3863) and WEBGL_CONSTANTS modes (~2184). Match its strip/fan->triangle-list conversion winding; aperture already has the MeshTopology variants three lacks a direct line/point equivalent for.

**Invariants.** Inv5: invalid modes still emit a structured diagnostic; supported modes stop being silently skipped. Inv1/3: topology is mesh-asset data consumed by the renderer through snapshots, no scene graph. Inv8: ships with primitive/mesh-construction tests; index-conversion math is deterministic; check stays green.

### AI-40 · Import JOINTS_1/WEIGHTS_1 (8-influence skinning) and extra TEXCOORD/COLOR slots

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** mesh/types.ts already declares JOINTS_1/WEIGHTS_1 in MeshVertexSemantic and joints1/weights1 in MeshSkinningSchema, but the importer never reads them. Add JOINTS_1/WEIGHTS_1, TEXCOORD_2, and COLOR_1 to GltfMeshPrimitiveAttributeSemantic + GltfMeshPrimitiveAttributeReferences in gltf-mesh-primitive-types.ts, read them in gltf-mesh-primitive-attributes.ts via mapGltfMeshPrimitiveAttributeReference (and include them in compression flatten + the optional-attribute-error filter), add TEXCOORD_2/COLOR_1 to MeshVertexSemantic, build their vertex-stream attributes in gltf-mesh-asset-vertex-streams.ts / -source-streams / -formats (uint8x4|uint16x4 for JOINTS_1, unorm8x4|unorm16x4|float32x4 for WEIGHTS_1), populate MeshSkinningSchema.joints1/weights1, and extend the skinning shader/layout + joint-palette read (rendering/extraction-mesh-deformation.ts) to blend the second 4-influence palette.

**Acceptance criteria:**

- A glTF primitive carrying JOINTS_1/WEIGHTS_1 builds a MeshAsset whose vertexStreams include both joints/weights palettes and whose MeshSkinningSchema has joints1 'JOINTS_1' and weights1 'WEIGHTS_1' (test/assets/gltf-mesh-asset-construction.test.ts).
- A skinned vertex influenced by 8 joints deforms using all eight influences: a render/deformation test shows a vertex with non-zero weight in the second palette moving according to that joint, distinct from the 4-influence result (test/webgpu or rendering deformation test).
- A primitive with TEXCOORD_2 and COLOR_1 surfaces both as mesh vertex attributes with the correct formats, alongside TEXCOORD_0/1 and COLOR_0 (named construction test).
- A primitive with only JOINTS_0/WEIGHTS_0 still builds an identical 4-influence MeshAsset (no joints1/weights1 in the schema), proving backward compatibility (regression assertion).
- Mismatched palette presence (JOINTS_1 without WEIGHTS_1) emits a structured mesh/skinning diagnostic and falls back to 4-influence rather than producing a malformed stream (named test).

**Reference.** glTF 2.0 skinning spec (multiple JOINTS_n/WEIGHTS_n sets, each VEC4) and three.js GLTFLoader attribute mapping (ATTRIBUTES table incl. JOINTS_1/WEIGHTS_1/TEXCOORD_2/COLOR_1). Match three's 8-influence support; aperture's MeshSkinningSchema already reserves the joints1/weights1 slots.

**Invariants.** Inv5: a partial/mismatched second palette must emit a structured diagnostic and degrade loudly, not silently. Inv1/3: skinning data is mesh-asset + ECS Skin state consumed via snapshot extraction. Inv7/8: WebGPU skinning-shader changes ship with construction + deformation tests, check stays green.

### AI-41 · Import morph TANGENT deltas and drive a full-N morph render path

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** In gltf-morph-target-import.ts add a TANGENT branch alongside NORMAL: decode target.TANGENT as VEC3 deltas into a target-major tangentDeltas Float32Array and surface tangentDeltas/hasTangents on GltfImportedPrimitiveMorphTargets; carry them into MeshMorphTargetData (mesh/types.ts) which already holds positionDeltas/normalDeltas. Wire the N-target storage-buffer render path so all targets (not just the first one or two via vertex attributes) drive the vertex shader from MeshMorphTargetData indexed by (target, vertex), including tangent reconstruction, consuming MorphTargetWeights in rendering/extraction-mesh-deformation.ts and the morph vertex shader. Map gltf-mesh-primitive-morph-targets.ts / MeshMorphTargetDescriptor.tangentSemantic for the first targets too.

**Acceptance criteria:**

- Importing a primitive whose morph targets include TANGENT produces MeshMorphTargetData with non-zero tangentDeltas laid out target-major and hasTangents true (test/assets/gltf-mesh-asset-construction.test.ts or a morph-import test).
- A mesh with more than two morph targets renders all N targets via the storage-buffer path: with weights set so a high-index target is fully active, the deformed positions match that target's deltas, proving targets beyond the vertex-attribute cap are applied (test/webgpu morph render/deformation test).
- Morphed tangents are reconstructed: a vertex with a fully-active tangent-bearing target shows the morphed tangent (not the rest tangent) feeding normal mapping (named render test).
- A primitive with only position morph deltas (no TANGENT) still imports and renders, with tangentDeltas absent/zero-filled and no spurious diagnostic (regression assertion).
- Weights vector length mismatched to target count emits a structured morph diagnostic and clamps rather than reading out of bounds (named test).

**Reference.** glTF 2.0 morph-target spec (POSITION/NORMAL/TANGENT deltas; TANGENT delta is VEC3 even though the base attribute is VEC4) and three.js GLTFLoader morph handling + morphtarget shader chunks. Match three's TANGENT-delta + multi-target weighting; the all-N storage-buffer layout matches aperture's documented MeshMorphTargetData follow-up.

**Invariants.** Inv5: weight/target mismatches emit structured diagnostics, not silent clamps without notice. Inv1/3: morph weights live in ECS (MorphTargetWeights) and deltas in mesh assets, consumed by the renderer via snapshot extraction. Inv7/8: WebGPU morph shader + tests ship together, check stays green.

### AI-42 · Import EXT_mesh_gpu_instancing into per-instance ECS entities

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** Add 'EXT_mesh_gpu_instancing' to SUPPORTED_ROOT_EXTENSIONS in gltf-root.ts. In gltf-scene-traversal-nodes.ts read node.extensions.EXT_mesh_gpu_instancing.attributes (TRANSLATION/ROTATION/SCALE accessor indices) and surface the decoded per-instance transforms on GltfTraversedNode (e.g. instanceTransforms: TRS[] or instanceAccessor refs), decoding via decodeGltfFloatAccessor (gltf-accessor-float-reader.ts). In gltf-ecs-authoring-command-plan(.ts/-entities.ts/-primitives.ts) emit one child entity per instance row with its own LocalTransform + Mesh/Material commands (under the instanced node), so each glTF instance becomes a distinct ECS entity. Emit a structured diagnostic for mismatched instance attribute counts.

**Acceptance criteria:**

- A node with EXT_mesh_gpu_instancing carrying N TRANSLATION rows produces N instance entities in the command plan, each with a LocalTransform reflecting its row and a Mesh/Material component, and replaying yields N entities (test/assets/gltf-ecs-authoring-command-plan.test.ts + gltf-ecs-command-replay.test.ts).
- Instances combining TRANSLATION/ROTATION/SCALE compose into the expected per-instance TRS (a row's rotation+scale appears on its entity's LocalTransform), proven on an explicit 3-instance fixture (named test).
- A glTF listing EXT_mesh_gpu_instancing in extensionsRequired validates (gltfRoot report.valid true) and is imported instead of rejected (test/assets/gltf-scene-traversal.test.ts).
- Instancing attributes with mismatched row counts (e.g. 4 translations but 3 scales) emit a structured diagnostic and the node falls back to a single non-instanced entity rather than producing a malformed plan (named test).
- A node without the extension produces exactly one entity as before (regression assertion in the command-plan JSON snapshot).

**Reference.** EXT_mesh_gpu_instancing spec and three.js GLTFLoader GLTFMeshGpuInstancing.createNodeMesh (lines ~1686-1740): reads attributes.{TRANSLATION,ROTATION,SCALE} accessors. Match its attribute decoding; aperture expands instances into ECS entities (ECS-as-truth) rather than a three InstancedMesh.

**Invariants.** Inv1: each instance is a real ECS entity authored via replayable commands, not a hidden renderer construct. Inv5: mismatched/invalid instance attributes emit a structured diagnostic. Inv4: accessor decode is deterministic over the buffer bytes. Inv8: ships with command-plan + replay + traversal tests, check stays green.

### AI-43 · Resolve cross-origin GLB buffer/image URIs via CORS instead of rejecting

**Priority** P3 · **Effort** M · **Depends on** none

**Change.** In glb-uri-external-fetch-resolve.ts replace the hard origin-mismatch rejection in resolveSameOriginUrl (lines 86-97) with CORS-aware resolution: accept absolute cross-origin URLs (and relative URLs resolved against sourceUrl), returning ok:true so the resolved href flows to the fetch path, governed by a caller policy (e.g. options.crossOrigin: 'allow' | 'same-origin', defaulting to allowing CORS). Thread the policy + fetch mode through glb-uri-fetch-bytes.ts / glb-uri-image-\* and the LoadGlbFromUri fetcher contract in glb-uri-loader-types.ts so the browser fetch uses mode:'cors' with appropriate credentials, and rename the now-misleading same-origin helpers. Update docs/GLB_FIXTURE_LIMITATIONS.md to document cross-origin CORS resolution as supported.

**Acceptance criteria:**

- A GLB referencing a cross-origin external buffer URI resolves to that absolute href and the buffer is fetched through the provided fetcher, decoding mesh accessors successfully (test/assets glb-uri external-fetch test exercising a cross-origin URL).
- A cross-origin image URI resolves and is fetched/decoded the same way, with the resolved url surfaced on LoadGlbFromUriExternalImageStatus (named test).
- A relative URI still resolves against the source GLB URL exactly as before (regression assertion).
- When the caller opts into a same-origin-only policy, a cross-origin URI is rejected with the structured unsupportedBufferUri/unsupportedImageUri diagnostic (proving the policy is enforced, not hard-coded) (named test).
- A cross-origin fetch that fails (CORS/network) surfaces the existing structured bufferFetchFailed/imageFetchFailed diagnostic rather than throwing (named test).

**Reference.** three.js FileLoader/ImageLoader + GLTFLoader external resource resolution, which resolve URIs relative to the glTF path and fetch cross-origin with CORS (crossOrigin / withCredentials). Match its cross-origin fetching behavior under an explicit aperture policy.

**Invariants.** Inv5: blocked (policy-rejected) and failed cross-origin fetches still emit structured diagnostics, never a silent drop. Inv1/3: the loader produces source/import reports only — no GPU resources or scene graph (per GLB_FIXTURE_LIMITATIONS ownership boundary). Inv8: ships with external-fetch resolution tests and updated docs; check stays green.

---

## Phase 8 — Content & advanced lighting

_Real particle simulation, positional indirect lighting / probes, procedural sky, area-light LTC, and wide-gamut/HDR output._

### AI-14 · Add positional indirect lighting: hemisphere/SH ambient + parallax reflection probes + irradiance volumes

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Today indirect light is a single flat ambient term (standard-shader-source.ts:629-630 just adds lightRadiance for LIGHT_KIND_AMBIENT) plus one global PMREM environment (standardDiffuseIblTexture/standardSpecularIblTexture sampled in standard-shader-ibl-sampling.ts). Generalize this into positional indirect lighting in three layers: (1) Add a Hemisphere/SH ambient light kind by extending PackedLightKindId (light-packing.ts:26-33) + LightKind (authoring-types.ts:22-29) + the WGSL ambient branch so ambient is evaluated as a sky/ground hemisphere (or L1 SH) weighted by the surface normal instead of a constant. (2) Generalize the single env to N parallax-corrected reflection probes: extend the specular IBL resource (ibl-texture-resource-specular.ts) and app-environment-resources plumbing to hold a probe array with per-probe AABB/transform, and select+parallax-correct the reflection ray in standard-shader-ibl-sampling.ts. (3) Add an SH irradiance-volume (ambient-cube/DDGI-lite) ECS component + extractor (new authoring-components-camera-light.ts component + new extraction-\* module producing a snapshot packet) and a WGSL trilinear lookup that contributes per-fragment diffuse GI. Lights/probes/volumes with no GPU support or unbaked data emit a structured diagnostic and fall back to the existing single-env path.

**Acceptance criteria:**

- A scene authored with a Hemisphere/SH ambient light tints an up-facing fragment toward the sky color and a down-facing fragment toward the ground color: a standard-shader render-control test (alongside test/webgpu/standard-shader.test.ts) drives two opposite normals through fs_main and asserts the two output colors differ in the expected direction (a single flat ambient could not produce this).
- Two reflection probes with different cubemap content and disjoint world AABBs produce different specular reflections for fragments inside each probe's box: a render/packing test feeds two probe packets and asserts the sampled reflection switches based on fragment position, and that the reflection vector is parallax-corrected (a fragment off the probe center reflects toward the probe box, not the infinite-distance direction).
- An irradiance-volume component baked with a known directional gradient lights a moving fragment differently at two interior sample positions: a render test asserts the trilinearly-interpolated GI contribution changes with world position within the volume bounds and clamps (no bleed) at the edges.
- packLightPackets round-trips the new Hemisphere/SH kind and probe/volume references through the snapshot codec without corrupting existing directional/point/spot/rect-area packets: light-packing.test.ts asserts byte layout of pre-existing kinds is unchanged and the new kind decodes to its sky/ground (or SH) coefficients.
- A probe or irradiance volume referencing an unbaked/unsupported asset renders the scene using the existing single global environment and emits a structured diagnostic naming the offending entity (proven by an extraction test asserting the fallback packet plus the diagnostic, not a silent black result).

**Reference.** Bevy bevy_pbr/src/light_probe (irradiance_volume.rs/.wgsl ambient-cube basis + light_probe.wgsl light_probe_iterator selecting nearest probe by world position, and reflection_probe parallax). Match: per-position probe/volume selection + parallax-corrected reflection + normal-weighted hemisphere ambient, replacing the single flat ambient + single global PMREM.

**Invariants.** Inv1/3: probes/volumes are extracted into RenderSnapshot packets and consumed by the renderer; no scene graph and no ECS read-back from the renderer. Inv2: extraction runs in the sim/extract path, GPU sampling stays in WGSL on the main thread. Inv5: unbaked/unsupported probes fall back to the global env and emit a structured diagnostic rather than no-op. Inv8: WGSL builders + packing changes are pure/testable and ship with the named render-control and packing tests.

### AI-15 · Stateful particle integration (velocity/age/forces, lifetime spawn-kill) + view-space billboarding

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Rewrite the analytic-only GPU particle kernel into a stateful per-particle simulation and make quads face the camera. In packages/webgpu/src/render/particles/particle-pipeline.ts PARTICLE_COMPUTE_WGSL cs_main, read the prior ParticleData from the read_write storage buffer at binding 1 (currently written but never read), then advance with semi-implicit Euler: integrate velocity (apply gravity + per-emitter force/drag), advance position by velocity*dt, advance age by dt, and re-seed (spawn) a slot whose age exceeds lifetime from an emitter shape (point/sphere/cone) instead of forcing positionSize.z=0.0. Extend the ParticleParams struct + createParticleParamData in packages/webgpu/src/app/particles.ts (currently writes absolute time at floats[2] and a single STORAGE+COPY_DST state buffer in getOrCreateParticleEmitterGpuState ~line 403-461) to thread a per-frame dt, gravity vec3, drag, and initial velocity range so integration is deterministic across frames. In PARTICLE_RENDER_WGSL vs_main (lines 150-163) transform the particle center through the view matrix and add the rotated quad offset in view space (mvPosition.xy += quad*size) before projection, replacing the fixed world-XY quad. Thread the new velocity/gravity/force/dt fields through extraction-particles.ts ParticleEmitterPacket + createParticleParamData and the ParticleEffectAsset gravity field that already exists in packages/render/src/assets/particles.ts.

**Acceptance criteria:**

- A unit test on PARTICLE_COMPUTE_WGSL (extending test/webgpu/particle-pipeline.test.ts) proves the kernel READS its prior slot (e.g. references particles[index].positionSize as an input to integration) and integrates velocity into position and age over dt, rather than recomputing position purely from frame/time as today.
- A frame-resource test (extending test/webgpu/particle-frame-resources.test.ts) drives two successive frames with a fixed dt and the SAME emitter seed and shows a particle's packed position advances by approximately velocity\*dt between frames (stateful carry-over), and a particle whose accumulated age exceeds the effect lifetime is respawned near the emitter origin rather than persisting.
- createParticleParamData writes a finite per-frame dt and the effect gravity vector into the param buffer, verified by a test that inspects the packed ParticleParams floats for a known emitter/effect (no absolute-wall-clock value leaks into the deterministic param path).
- A render-WGSL test asserts vs_main builds the quad in view space facing the camera (multiplies the particle center by the view matrix and offsets in view-space XY using view.cameraPosition / view basis) and no longer hard-codes the quad into the world XY plane, so a billboard faces the camera from any view angle.
- The gpu-particles example/e2e (test/e2e/gpu-particles.spec.ts) still renders visible additive particles over the clear color (center pixel distinct from background) after the rewrite, confirming the stateful path produces on-screen output.

**Reference.** three.quarks: packages/quarks.core/src/Particle.ts (age/life, died = age >= life), packages/three.quarks/src/ParticleSystem.ts:1035-1040 (position.addScaledVector(velocity, delta); age += delta) and behaviors ApplyForce.ts / GravityForce.ts (velocity.addScaledVector(force, magnitude*delta)) for semi-implicit Euler integration; packages/three.quarks/src/shaders/particle_vert.glsl.ts (mvPosition = viewMatrix * center; mvPosition.xy += rotatedPosition) for view-space billboarding. Match this integration + billboard model on-GPU.

**Invariants.** Inv4 (determinism) is load-bearing: integration must use the threaded per-frame dt + emitter seed, never wall-clock time or nondeterministic RNG, so identical inputs yield identical particle state across frames (the hash-based seeding stays deterministic). Inv3: the kernel/shader read only from extracted RenderSnapshot-derived param/state buffers (ParticleEmitterPacket), never back into ECS. Inv1/2: ECS ParticleEmitter authoring stays the source of truth; the GPU state buffer is a derived view filled from the snapshot on the render thread, with no WebGPU in the sim worker. Inv5: any clamped/unsupported emitter shape or capacity overflow emits a structured particleFrame diagnostic rather than silently no-opping.

### AI-16 · Depth-test particles against scene geometry (read-only depth, additive blend preserved)

**Priority** P2 · **Effort** S · **Depends on** AI-15

**Change.** In packages/webgpu/src/render/particles/particle-pipeline.ts createParticleRenderPipelineDescriptor (depthStencil block, lines 437-441), change depthCompare from 'always' to 'less-equal' while keeping depthWriteEnabled:false so additively-blended particles are occluded by nearer opaque scene geometry but still composite without writing depth. The particle render commands are already appended into the shared frame boundary that binds the scene depth attachment (assembleWebGpuAppFrameBoundaries depthAttachment.view in packages/webgpu/src/app/frame-boundaries.ts, populated by the prior opaque pass), so no binding change is required; only confirm/keep that depth target wired. This is independent of AI-15's stateful sim but sequenced after it to avoid pipeline-descriptor churn conflicts.

**Acceptance criteria:**

- test/webgpu/particle-pipeline.test.ts asserts the render pipeline descriptor uses depthCompare 'less-equal' with depthWriteEnabled false (updating the existing line-96 assertion that currently expects 'always'), proving particles read scene depth without writing it.
- A frame-resource/boundary test confirms the particle render commands execute inside a render pass whose depthStencilAttachment view is the same scene depth target produced by the opaque scene pass (the depth buffer particles test against is actually bound).
- The gpu-particles e2e (test/e2e/gpu-particles.spec.ts) shows a particle emitter placed behind opaque geometry is occluded (the pixel sample over the occluder stays at the geometry color, not brightened by the additive particle) while an unoccluded emitter still brightens its pixels over the clear color.
- Additive blending is unchanged: the descriptor's color/alpha blend state remains add/src-alpha/one (verified by the same descriptor test), so depth-testing does not regress the transparent composite.

**Reference.** three.quarks: packages/three.quarks/src/BatchedRenderer.ts billboard render path uses depthTest:true, depthWrite:false for additive billboard particles (transparent depth-read, no depth-write). Match that read-only-depth contract for screen-correct occlusion of additive particles.

**Invariants.** Inv3: the depth resource consumed is the snapshot-derived scene depth attachment already assembled for the frame; particles do not reach back into ECS. Inv8: ships with the updated pipeline-descriptor test plus an e2e occlusion check, leaving pnpm run check green. Inv5: depth format/attachment mismatches already surface as structured frame-boundary diagnostics, which this change preserves rather than silently rendering without depth. No hidden scene graph (Inv1) is introduced; this is purely render-pass state on a derived view.

### AI-26 · Replace disk/sphere area-light approximations with true LTC and add a tube shape + area-light shadowing

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Only the rect shape currently uses real LTC (ltcEvaluateRect in standard-shader-source.ts:420-463); disk and sphere fall back to ad-hoc analytic form factors (diskAreaLightFormFactor:465-480, sphereAreaLightFormFactor:482-495) and reuse the shared scalar specular path areaLightLtcScalarScale (line 567) instead of a per-shape LTC specular. Implement Heitz disk LTC (project the LTC-transformed disk to its bounding ellipse and evaluate the clipped form factor) and a Karis sphere/tube representative-point model with per-shape specular, replacing those two functions and routing non-rect specular through the new per-shape evaluators. Add a Tube shape id to PackedAreaLightShapeId (light-packing.ts:38-42) + AreaLightShape (authoring-types.ts:33-37) + packedAreaLightShapeId mapping. Add an area-light shadow path under packages/webgpu/src/shadows/ (a representative-point shadow caster / projected occlusion for area lights, following the existing spot/point shadow plan modules).

**Acceptance criteria:**

- A disk area light produces a measurably more accurate, shape-aware diffuse+specular falloff than the old form-factor approximation: a standard-shader render-control test (alongside test/webgpu/standard-shader.test.ts) evaluates fs_main for a grazing vs head-on configuration and asserts the disk LTC result matches expected LTC behavior (smooth roughness-dependent specular highlight) where the old approximation produced a flat/incorrect lobe.
- A tube/line light authored with width != height illuminates a fragment as an elongated highlight: a packing + shader test round-trips the new Tube shape id through packLightPackets and asserts the WGSL emits AREA_LIGHT_SHAPE_TUBE and evaluates the tube model (the highlight stretches along the tube axis, unlike the symmetric sphere case).
- Sphere and tube specular highlights track surface roughness via the LTC matrix sample rather than the shared scalar scale: the shader test asserts evaluateAreaLight references the per-shape LTC specular for sphere/tube (not only areaLightLtcScalarScale) and that increasing roughness widens the highlight.
- An object behind an opaque occluder relative to a rect or disk area light receives reduced area-light radiance: a shadows test drives the new area-light shadow plan and asserts the shadowed fragment's area-light contribution is attenuated while an unshadowed fragment is not.
- Existing rect area-light output is byte-identical: standard-shader.test.ts still asserts ltcEvaluateRect / areaLightLtcMatrix usage for the rect path and the rect WGSL is unchanged by the disk/sphere/tube rewrite.

**Reference.** three.js src/nodes/functions/BSDF/LTC.js (LTC_Evaluate + LTC_ClippedSphereFormFactor) for the disk/rect LTC form, and Karis 'Real Shading in UE4' representative-point sphere/tube model. Beat aperture's current diskAreaLightFormFactor/sphereAreaLightFormFactor analytic approximations with genuine per-shape LTC/representative-point specular.

**Invariants.** Inv6: the new shape id + shadow path stay inside packages/webgpu (backend) behind the existing area-light packing facade; authoring only gains an enum value. Inv1/3: shadow occlusion derives from extracted shadow requests, not ECS read-back. Inv5: an area light requesting shadows on an unsupported path emits a structured diagnostic and renders unshadowed rather than failing. Inv8: WGSL is generated by pure builders covered by the named shader + packing + shadows tests, leaving pnpm run check green.

### AI-27 · Add a sun-driven procedural sky/atmosphere model renderable as background and feeding IBL ambient

**Priority** P3 · **Effort** L · **Depends on** none

**Change.** extraction-skyboxes.ts only handles a textured cubemap Skybox (it requires a texture asset, extraction-skyboxes.ts:74-83). Add a SkyAtmosphere authoring component (authoring-components-camera-light.ts + authoring-types.ts: sun direction/turbidity/ground albedo/Rayleigh+Mie or Preetham params) and a sibling extractor (new extraction-sky-atmosphere.ts alongside extraction-skyboxes.ts) producing a SkyAtmospherePacket on the snapshot. Add a WGSL sky pass under packages/webgpu/src/render (a fullscreen analytic sky evaluated per-direction from the sun vector) that renders as the scene background, mirroring the existing skybox-pipeline integration. Feed the same analytic sky into IBL ambient by convolving/baking it into the existing diffuse+specular environment resources so lit surfaces pick up the sky color (reuse the irradiance-convolution / equirect-to-cube pipelines). A SkyAtmosphere combined with a conflicting textured Skybox on the same camera resolves deterministically and emits a structured diagnostic.

**Acceptance criteria:**

- Rotating the sun direction changes the rendered sky background: a sky-pass shader/render test evaluates the analytic sky WGSL for a fixed view ray at two sun directions and asserts the horizon/zenith colors differ as expected (bright near the sun disc, blue-shifted at zenith for a daytime config).
- A scene with a SkyAtmosphere but no textured Skybox still renders a non-black background: an extraction test asserts extractSkyAtmosphere emits a SkyAtmospherePacket with the authored sun/params and the background pass consumes it (no missing-texture diagnostic, unlike the textured-skybox path).
- The procedural sky contributes to surface lighting: a render test places a matte surface under a configured sky with no explicit lights and asserts the surface's ambient/diffuse-IBL term takes on the sky's tint (proving the sky feeds IBL, not just the background).
- Changing turbidity/atmosphere parameters produces a visibly different sky and ambient tint: the shader test asserts two distinct parameter sets yield distinct background and convolved-ambient colors.
- When both a SkyAtmosphere and a textured Skybox target the same camera, the renderer picks the documented winner deterministically and emits a structured diagnostic naming both entities (proven by an extraction test, not a silent override).

**Reference.** Bevy bevy_pbr/src/atmosphere (bruneton_functions.wgsl, sky_view_lut.wgsl, render_sky.wgsl) and bevy_light/src/atmosphere.rs sun-driven Rayleigh+Mie model; Preetham/Hosek analytic sky as the simpler alternative. Match Bevy's sun-direction-driven analytic sky rendered as background and feeding image-based ambient.

**Invariants.** Inv1/3: SkyAtmosphere is an ECS component extracted into a snapshot packet; the sky pass + IBL bake derive from that packet with no ECS read-back. Inv4: the analytic sky is a pure function of authored params + sun vector (no wall-clock), so identical inputs yield identical sky/ambient. Inv5: conflicting sky sources emit a structured diagnostic. Inv8: extractor + WGSL builder are unit-testable and ship with the named tests.

### AI-29 · Add a wide-gamut/HDR output path: Display-P3 / Rec.2020 color spaces, rgba16float extended-gamut canvas, PQ/HLG encode

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** OUTPUT_COLOR_SPACES is only ['linear','srgb'] (output-stage-color-space.ts:1) and createOutputColorSpaceWgsl only emits identity or sRGB OETF. NOTE: the scope's claim that 'no context.configure call exists' is STALE -- initialize-webgpu.ts:165 already calls context.configure, but its colorSpace type is hardcoded to 'srgb' (WebGpuCanvasContextLike.configure at :74-82 and displayColorSpace?: 'srgb' at :95). The work: (1) extend OUTPUT_COLOR_SPACES with 'display-p3' and 'rec2020' and add linear-sRGB->linear-P3 / linear-sRGB->linear-Rec.2020 matrix conversions plus PQ and HLG encode functions in createOutputColorSpaceWgsl. (2) Add HDR-target tonemap operators (and a scene-referred HDR bypass) in output-stage-tonemap.ts / post-tonemap.ts. (3) Widen WebGpuCanvasContextLike.configure colorSpace + displayColorSpace to accept 'display-p3', plumb an rgba16float extended-gamut canvas configuration (GPUCanvasConfiguration colorSpace:'display-p3' + toneMapping:{mode:'extended'}) through initialize-webgpu.ts, and thread the chosen output space through create-webgpu-app.ts (resolveOutputColorSpace at :53) and pipeline-resources.ts/attachments.ts so the scene-render format and final tonemap stage agree. Unsupported gamut/format requests fall back to srgb 8-bit and emit a structured diagnostic.

**Acceptance criteria:**

- Selecting outputColorSpace 'display-p3' emits a shader that maps a saturated linear-sRGB color into the wider P3 gamut: an output-stage-color-space test (alongside test/webgpu/output-stage-tonemap.ts) asserts createOutputColorSpaceWgsl('display-p3') contains the linear-sRGB->P3 matrix and that a pure-red input maps to the expected P3 primary, distinct from the srgb path output.
- Selecting 'rec2020' with a PQ or HLG encode emits the corresponding transfer function: the color-space test asserts the Rec.2020 matrix plus the PQ (or HLG) encode appears in the WGSL and that a known luminance maps to the expected encoded value.
- Creating an app with a wide-gamut HDR request configures the canvas as rgba16float with colorSpace:'display-p3' and toneMapping mode 'extended': a webgpu-app/initialize test (alongside test/webgpu/webgpu-app.test.ts) asserts the recorded context.configure call carries that format, colorSpace, and toneMapping mode, and that the scene render format is rgba16float.
- The HDR tonemap path preserves values above 1.0 for scene-referred HDR output instead of clamping to SDR: a post-tonemap test asserts the extended/bypass operator passes a >1.0 input through (unlike the existing reinhard/aces SDR operators that compress into [0,1]).
- Requesting an unsupported gamut or rgba16float on a non-extended canvas falls back to srgb 8-bit and emits a structured diagnostic naming the requested space: a webgpu-app test asserts the resolved output space, the swapchain format, and the diagnostic (not a silent black/garbled frame).

**Reference.** three.js renderers/webgpu/WebGPUBackend.js (context.configure with toneMapping:{mode:'extended'} when outputType is HalfFloatType) and math/ColorManagement.js XYZ-bridge matrices for LinearDisplayP3 / LinearRec.2020. Match three.js's extended-gamut WebGPU canvas configuration and color-space conversion matrices, adding PQ/HLG encode on top.

**Invariants.** Inv7: WebGPU-only, TypeScript-first -- conversions are WGSL emitted by pure string builders. Inv5: unsupported gamut/format requests degrade to srgb 8-bit with a structured diagnostic rather than silently no-op. Inv8: color-space and tonemap WGSL are produced by pure functions covered by the named output-stage and webgpu-app tests, and the existing srgb/linear output stays byte-identical so pnpm run check remains green.

---

## Phase 9 — CI rigor & ecosystem

_Real-GPU CI matrix, golden images, coverage/security gates, API docs/site, framework bindings, devtools, HMR, and the official MCP SDK._

### AI-71 · Expand CI e2e coverage with sharding and a real-GPU OS matrix

**Priority** P1 · **Effort** L · **Depends on** none

**Change.** Replace the 4 hard-coded specs in .github/workflows/ci.yml e2e job (lines 91-98: post-effects, taa, custom-graph-pass, camera-clear-load-matrix) with a sharded matrix over the full test/e2e suite (145 spec files). Add `strategy.matrix.shard: [1/N,2/N,...]` and pass `playwright test --config=playwright.ci.config.ts --shard=${{matrix.shard}}` (keep the existing xvfb-run + SwiftShader Linux fallback, dof.spec.ts already excluded via testIgnore). Add a separate macOS runner job (runs-on: macos-latest) running the same suite against real Metal-backed Chrome for true-GPU coverage. playwright.ci.config.ts already sets timeout:150000 and workers:1; keep per-test timeout and merge shard reports (add a blob/json reporter + a report-merge step or upload per-shard artifacts). Heavy clustered-lights / multi-cascade-shadow specs that exceed budget under SwiftShader should land on the macOS GPU shard.

**Acceptance criteria:**

- The CI e2e job runs the entire test/e2e suite split across N shards (not 4 named specs): each shard invokes `playwright test --shard=i/N` and the union of shards executes every non-ignored \*.spec.ts, provable by the merged Playwright report listing all suite specs as run.
- A macOS matrix job executes the same suite on real Metal GPU and surfaces a distinct device label in its report, so GPU-only render paths (clustered lights, multi-cascade shadows) that SwiftShader skips/times-out are actually exercised — provable by those specs reporting executed (not skipped) on the macOS shard.
- Each shard enforces the 150s per-test timeout from playwright.ci.config.ts and the job fails (not hangs) if a spec exceeds it, provable by a deliberately-slow fixture test timing out cleanly.
- Per-shard failure artifacts (traces/screenshots under test-results/playwright-ci) upload on failure and the merged report attributes each failure to its shard, demonstrated on a forced failing spec.
- The SwiftShader Linux shards remain green for the existing 4 baseline specs (post-effects, taa, custom-graph-pass, camera-clear-load-matrix), proving no regression in the previously-gated coverage.

**Reference.** Playwright sharding (`--shard` + blob report merge) and PlayCanvas references/engine/.github/workflows/ci.yml multi-job matrix structure; beat the current 4-spec gate by covering the full 145-spec suite plus a real-GPU OS lane.

**Invariants.** Invariant 4 (determinism): sharding must not introduce cross-test ordering dependence — specs stay independent so any shard split yields the same pass/fail. Invariant 8 (tested + green): CI gate must stay actionable/green. Invariant 7 (WebGPU-only): the macOS lane exercises the real WebGPU backend; renderer still consumes snapshots only (Invariant 3).

### AI-74 · Adopt Playwright toHaveScreenshot golden baselines on a pinned deterministic renderer

**Priority** P2 · **Effort** L · **Depends on** AI-71

**Change.** Add `expect(canvas).toHaveScreenshot()` golden baselines for canonical scenes (lit mesh, shadows, tonemap, post-effects) captured against the pinned SwiftShader render in playwright.ci.config.ts. Configure deterministic capture: set `use.screenshot`/a `snapshotPathTemplate` + `expect.toHaveScreenshot.maxDiffPixelRatio` tolerance in playwright.ci.config.ts (currently no snapshotDir/snapshot config), force a fixed viewport (already 960x640) and a stable frame (drive the example to a known frame via the render-control harness — scripts/render-control.mjs already screenshots `#aperture-canvas` at :802-804 and the examples expose `__APERTURE_EXAMPLE_STATUS__`). Commit baselines under test/e2e/**snapshots**/ generated on the SwiftShader CI image, and run these screenshot specs inside the AI-71 sharded SwiftShader lane (NOT the macOS GPU lane, whose pixels differ) so the baseline backend stays pinned.

**Acceptance criteria:**

- A new screenshot spec asserts `toHaveScreenshot` for a lit-mesh scene against a committed baseline under test/e2e/**snapshots**/ and passes on the pinned SwiftShader runner within the configured maxDiffPixelRatio, proving deterministic golden comparison works end-to-end.
- Introducing a visible regression (e.g. a forced tonemap/exposure change in the example) makes the corresponding screenshot spec FAIL with a diff artifact, demonstrating the baseline actually catches render changes rather than always passing.
- Baselines are pinned to the SwiftShader backend: the screenshot specs are scoped to the SwiftShader shard and excluded from the macOS GPU lane (or use a backend-keyed snapshot path), provable by the spec config restricting projects and the macOS lane not attempting the comparison.
- Re-running the screenshot suite twice on the same commit produces identical pass results with zero diff, proving capture determinism (fixed viewport + fixed frame via render-control / status gating).
- `pnpm run check` and the e2e CI gate stay green with the new **snapshots** baselines committed.

**Reference.** Playwright `toHaveScreenshot` (snapshotPathTemplate + maxDiffPixelRatio) and three.js references/three.js/test/e2e (deterministic-injection.js seeded RNG/clock + image.js compare(threshold)); match three.js's determinism approach and Playwright's built-in pixel-diff tolerance.

**Invariants.** Invariant 4 (determinism): same inputs -> same snapshots is exactly what the golden test proves; baselines pinned to one backend (SwiftShader) to keep determinism. Invariant 3: the renderer is driven via examples consuming RenderSnapshots; the test reads canvas pixels, never ECS. Depends on AI-71 so the sharded SwiftShader lane exists to host these specs.

### AI-75 · Distinguish environment-cannot-test from feature-broken and gate skip counts

**Priority** P2 · **Effort** M · **Depends on** AI-71

**Change.** Replace the unconditional `test.skip(true, ...)`-on-missing-readback pattern (orthographic-camera.spec.ts:123, physics-character.spec.ts:159,198, and the readback gate shared across the suite) with a suite-level capability probe. Extend test/e2e/readback-status.ts with a `requireReadbackCapability()` (or a `test.beforeAll` capability gate) that distinguishes 'this environment genuinely lacks current-texture readback' (legitimate skip) from 'readback is expected here but returned transparent/absent' (a real FAILURE). Wire a known-capable signal: on the SwiftShader CI lane (and the AI-71 macOS GPU lane) readback IS expected, so a missing/transparent readback must fail rather than silently skip. Emit a machine-readable skip summary (Playwright JSON reporter) and add a CI step in .github/workflows/ci.yml that parses it and fails if the runtime skip count exceeds an allowed budget for the capable env.

**Acceptance criteria:**

- On the SwiftShader CI lane (a readback-capable env), the orthographic-camera and physics-character pixel specs assert their readback samples instead of skipping — provable by those specs reporting executed-with-assertions (not skipped) in the CI report.
- When readback is expected but returns transparent/absent samples, the spec FAILS with a diagnostic instead of calling test.skip(true,...), demonstrated by a fixture that forces an empty readback and observing a failure (not a skip).
- In a genuinely incapable environment (no current-texture readback), the same specs skip with a structured reason and the suite stays green — proving the capability probe still allows legitimate environment skips.
- A CI step parses the Playwright JSON report and fails the job when the runtime skip count on a capable env exceeds the configured budget, demonstrated by temporarily lowering the budget below the actual skip count and observing a red gate.
- `expectSceneReadbackStatus`/`expectClearReadbackStatus` in readback-status.ts gain the capability-aware path and the existing readback specs still pass through it, proving no regression to the shared helper.

**Reference.** Playwright JSON reporter + test.skip/capability-gate semantics, and three.js references/three.js/test/e2e/check-coverage.js (programmatic post-run gating of test results); match the convention of gating skip/coverage counts in CI rather than trusting per-test skips.

**Invariants.** Invariant 5 (loud over silent): the core of this item — an unsupported-but-expected readback must emit a STRUCTURED failure/diagnostic, never a silent skip/no-op. Invariant 8: gate stays green for legitimate skips. The acceptance criteria are behavioral (spec executes/fails/skips by env), not 'skip count == N' as the sole criterion. Depends on AI-71 so the capable SwiftShader/macOS lanes exist to enforce the 'expected-capable' branch.

### AI-77 · Enable vitest coverage with per-package thresholds in the CI gate

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** Add `@vitest/coverage-v8` (matching the vitest ^4.1.6 already in root devDependencies) as a root devDependency, then add a `test.coverage` block to vitest.config.ts (provider:'v8', reporter:['text','lcov'], include:['packages/*/src/**'], exclude test/dist/references already mirrored from the existing test.exclude) with `thresholds` — a global floor plus per-package (`perFile`/glob) floors so a regression in any single package fails. Add a `test:coverage` script (`vitest run --coverage`) and run it in CI: either fold `--coverage` into the `pnpm test` invoked by `pnpm run check`, or add a dedicated coverage step in .github/workflows/ci.yml's Workspace check job. Upload the lcov report as an artifact.

**Acceptance criteria:**

- Running `pnpm run test:coverage` (vitest run --coverage) produces an lcov + text coverage report scoped to packages/\*/src and exits 0 when thresholds are met, proving coverage instrumentation works against the real test suite.
- Dropping coverage below a configured threshold (e.g. temporarily deleting a covered test or lowering the threshold under actual coverage in vitest.config.ts) makes the coverage run FAIL, demonstrating the gate actually enforces the floor rather than reporting only.
- Per-package thresholds are enforced independently: a coverage drop confined to one package fails the gate even if global coverage stays above the global floor, provable by configuring a per-package threshold and regressing only that package.
- The coverage run respects the existing exclude set (test/e2e, dist, references) so reference-engine and e2e code never count toward or against coverage, verified by the report's file list excluding those paths.
- CI's Workspace check job runs coverage and uploads the lcov artifact, and `pnpm run check` stays green with coverage enabled.

**Reference.** Vitest @vitest/coverage-v8 (v8 provider + thresholds config) and three.js references/three.js/test/e2e/check-coverage.js for the convention of programmatic coverage gating in CI; match Vitest's per-glob threshold enforcement.

**Invariants.** Invariant 8 (tested + green): coverage thresholds extend the green-gate contract. Coverage instrumentation is dev/CI-only and runs the existing headless vitest suite — it does not run WebGPU in the sim path (Invariant 2/7 untouched) and adds no runtime behavior. Behavioral criteria (run passes/fails on real coverage deltas), not 'a coverage number equals X' as a status field.

### AI-78 · Add dependency audit + code scanning to CI

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** Add .github/dependabot.yml with two ecosystems — `npm` (root + per-package, the monorepo is pnpm-workspace so target `/`) and `github-actions` (for the workflow action pins) — on a weekly schedule with grouped minor/patch updates, mirroring references/bevy/.github/dependabot.yml's grouped+scheduled shape. Add a dependency-audit step running `pnpm audit` (scoped to production deps of the published packages + CLI runtime deps: playwright/tar/ts-morph/vite) either as a step in .github/workflows/ci.yml or a new .github/workflows/security.yml. Add a CodeQL job (new workflow or job) scanning the TypeScript/JavaScript source, modeled on references/three.js/.github/workflows/codeql-code-scanning.yml (init -> autobuild -> analyze, security-events:write permission, scheduled + PR triggers).

**Acceptance criteria:**

- A committed .github/dependabot.yml validates against GitHub's schema and declares both the npm and github-actions ecosystems on a weekly schedule with grouped updates, provable by a schema-validation check (e.g. a CI lint step or `dependabot` action-lint) passing.
- A CI dependency-audit step runs `pnpm audit` over the published packages' + CLI's production dependencies and fails the job on a vulnerability at/above the configured severity, demonstrated by the step exiting non-zero against a seeded/known-vulnerable fixture (or a lowered severity floor).
- A CodeQL job analyzes the TypeScript/JavaScript sources on PR + schedule and uploads SARIF results to code scanning, provable by the workflow completing the analyze step and producing a results artifact.
- The audit step is scoped so dev-only/reference tooling does not block the gate (production-dependency scope), verified by the audit command's resolved dependency set excluding devDependencies/references.
- Existing CI (`Workspace check` + e2e) remains green with the new security workflow/jobs added, proving the additions do not break the current gate.

**Reference.** GitHub dependabot (references/bevy/.github/dependabot.yml — grouped, scheduled, multi-ecosystem) and CodeQL (references/three.js/.github/workflows/codeql-code-scanning.yml — init/autobuild/analyze + security-events permission); match both shapes adapted to the pnpm/TS monorepo.

**Invariants.** Invariant 8 (tested + green): the new jobs must keep CI actionable and green. Invariant 5 (loud over silent): a discovered vulnerability or code-scanning alert surfaces as a loud CI failure/alert rather than passing silently. CI/tooling-only — no runtime, ECS, renderer, or backend-facade code touched (Invariants 1-7 untouched).

### AI-80 · Generate API reference and publish a public docs + runnable example site

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Add a generated API-reference + docs/example site over the published package surface. Wire TypeDoc (or @microsoft/api-extractor) across the typed packages built by the root `build` script in package.json (each package's package.json exports), emitting versioned API HTML. Build a public docs site distinct from docs/index.html (which is the status dashboard) and turn the internal harness examples/index.html into a hosted runnable gallery driven by a checked-in manifest. Add `docs:build`/`docs:api` scripts and a `check:docs` gate that mirrors the existing scripts/check-example-gallery.mjs (which already enforces that examples/index.html links every example .html). This is SOTA M11-T5 (docs/SOTA_ROADMAP.md:2587), not-started.

**Acceptance criteria:**

- Running the new `docs:api` script over the published packages emits an API-reference HTML/JSON tree, and a test asserts the generated reference contains the public entry symbols (e.g. createSystem, defineComponent, saveScene) extracted from each package's exports — proving the reference is generated from the typed surface, not hand-written.
- A new check (extending scripts/check-example-gallery.mjs) fails if any examples/\*.html runnable page is missing from the hosted gallery manifest/index, proving every example stays linked and runnable (not a screenshot); the check passes on the current example set.
- The docs-site build produces a self-contained static output (api reference + example gallery landing) under a dist dir, and a test asserts the output exists, links to each published package's API page, and is separate from docs/index.html (the status dashboard is untouched).
- `pnpm run check` stays green with the new docs/api generation and gate wired in (typecheck, lint, format, tests, boundaries).

**Reference.** three.js docs/examples site + PlayCanvas developer site (per SOTA M11-T5 Study); matching three.js's generated-reference-plus-runnable-gallery model rather than static screenshots — beat it by gating that every example stays runnable via check:docs.

**Invariants.** Inv-7 (TypeScript-first/WebGPU-only): API reference is generated from the typed package surface. Inv-8: ships with a docs/gallery check wired into `pnpm run check`. Docs/gallery are pure outputs of existing packages — no ECS source-of-truth change (Inv-1) and no renderer reaching back into ECS (Inv-3).

### AI-81 · Ship an R3F-style React binding that maps declarative props to ECS commands

**Priority** P2 · **Effort** XL · **Depends on** none

**Change.** Create a new workspace package packages/react (`@aperture-engine/react`) registered in pnpm-workspace.yaml (currently `packages/*` already globs it once it exists) providing a React reconciler/hook layer that translates declarative JSX into ECS commands. Drive it through the existing command surface — the `aperture:command` event + ApertureGeneratedCommand channels in packages/app/src/commands.ts and the SpawnCommands shape in packages/app/src/systems/spawn/commands.ts (mesh/light/camera/gltf/physics) — and the devtools entity tools (ecs_set_component_field) for updates, NOT a mutable scene graph. Add a runnable React example and wire packages/app exports so the binding reaches startGeneratedBrowserApp (packages/app/src/browser/app.ts). SOTA M11-T2 (docs/SOTA_ROADMAP.md:2533), not-started.

**Acceptance criteria:**

- A React example component declaratively renders an entity (e.g. <Mesh .../> or <Entity><Mesh/></Entity>), and a test asserts that mounting it enqueues the corresponding ECS spawn command (matching the SpawnCommands.mesh path) so the entity appears in an ecs_find_entities / snapshot result — proving declarative React drives ECS state.
- Updating a prop on a mounted React element (e.g. changing a transform/material field) issues an ecs_set_component_field-style mutation against the existing entity rather than respawning it, proven by a test that the entity ref is stable and only the changed field differs in an ecs_diff.
- Unmounting a React element despawns its backing entity (and only that entity), proven by a test asserting the entity is absent from a follow-up ecs_find_entities while siblings remain.
- A boundaries test / check:boundaries run confirms packages/react imports only the ECS/command facade (no @aperture-engine/webgpu, no direct world mutation on the main thread), proving the binding smuggles in no hidden scene graph.

**Reference.** @react-three/fiber's react-reconciler host-config model (named in SOTA M11-T2 Study); the locally vendored references/uikit/packages/react (src/index.tsx) is the closest available React-reconciler-over-a-non-DOM-tree analog — match its create/update/remove instance lifecycle but bind it to ECS commands instead of a retained tree.

**Invariants.** Inv-1/Inv-2 (load-bearing): React props become ECS commands forwarded to the sim worker; no mutable scene graph and no main-thread ECS mutation. Inv-6: lives in its own package consuming the backend-neutral command facade. Inv-5: unsupported props emit a structured diagnostic. Inv-8: example + tests + green check.

### AI-82 · Swap the reference RAG hash-embedding for a real local embedding model behind cosineSimilarity

**Priority** P2 · **Effort** M · **Depends on** none

**Change.** The docs-honesty half already landed (docs/AI_TOOLING.md:54 now says lexical/hashed bag-of-words, and the on-disk contract in packages/cli/src/reference/model.ts already honestly reads `aperture-reference-hash-embedding` / `hashed-token-sum`). Remaining scope is the FULL close: replace the FNV-1a hashed bag-of-words in embedReferenceText (packages/cli/src/reference/embedding.ts:3) with a real local embedding model (ONNX / transformers.js, e.g. all-MiniLM-L6-v2, 384-dim) behind the unchanged cosineSimilarity interface (embedding.ts:36, consumed at packages/cli/src/reference/search.ts:108). Update MODEL_CONTRACT (model.ts: provider/model/pooling + revision bump to v2) and the build path (build.ts) that writes chunk embeddings; the revision bump makes the on-disk index a model-mismatch (status.ts:79) so warmup transparently rebuilds. Add the model dependency to packages/cli/package.json.

**Acceptance criteria:**

- A test feeds a query whose meaning matches a chunk via different vocabulary (a true synonym/paraphrase, not a shared token) and asserts the new embedding ranks that chunk above an unrelated lexically-similar chunk — a result the hashed bag-of-words cannot produce, proving real semantic retrieval.
- An index built under the old `aperture-reference-hash-embedding` contract is detected as model-mismatch by status.ts and is rebuilt by `aperture reference warmup`, after which a search succeeds — proven by a test that drives the old→new transition without a crash.
- A determinism test embeds the same text twice through embedReferenceText and asserts identical 384-d vectors, and that cosineSimilarity of identical inputs is 1, preserving the existing interface contract (no signature change at the call sites in search.ts).
- `pnpm run check` is green: the existing test/cli/reference.test.ts still passes (updated for the new contract) and the model load path is covered.

**Reference.** n/a (fixed by aperture spec) — the cosineSimilarity / ApertureReferenceModelContract interface and the model-mismatch rebuild flow are already defined in aperture's own reference code; behavior is pinned by that contract, not an external engine.

**Invariants.** Inv-5 (load-bearing): the contract honestly records the model (revision v2) and an outdated index emits a structured model-mismatch rather than silently returning stale scores. Inv-4: embedding stays deterministic for identical inputs. Inv-8: reference.test.ts updated and green. Confined to packages/cli (Inv-6).

### AI-83 · Build a human-facing in-browser inspector on the existing MCP/devtools backend

**Priority** P2 · **Effort** XL · **Depends on** AI-81

**Change.** Build a human-facing inspector (entity tree, component editor, viewport selection, stats overlay, scene save/reload) reusing the agent devtools backend, NOT a new backend. The backend already exposes everything via the worker bridge (packages/app/src/worker/devtools/entities.ts: ecs*find_entities, ecs_get_entity, ecs_get_hierarchy, ecs_set_component_field, ecs_get_component_schema; picking in packages/app/src/browser/devtools/picking.ts; camera*\* and pause/resume/step in bridge.ts) reachable through the ApertureMcpRuntime in packages/app/src/browser/devtools/runtime.ts. Add a new editor package built with the AI-81 React binding, mount it from startGeneratedBrowserApp (packages/app/src/browser/app.ts) via virtual-module wiring in packages/vite-plugin/src/virtual-modules.ts, and expose M7 saveScene/loadScene (packages/simulation/src/serialization/scene-document.ts) as new ecs_scene_save/ecs_scene_load devtools tools (not yet present) so the editor can save/reload. SOTA M11-T4 (docs/SOTA_ROADMAP.md:2569).

**Acceptance criteria:**

- An E2E/test opens a scene, clicks the viewport, and asserts the inspector selects the picked entity (via the existing pick path returning an entity ref) and shows its components — proving viewport selection drives the entity tree off the devtools backend.
- Editing a component field in the inspector issues an ecs_set_component_field through the existing bridge and the change is reflected in a follow-up ecs_get_entity, proving the editor mutates ECS via the agent backend rather than a private path.
- The editor saves the current scene and reloads it (new ecs_scene_save/ecs_scene_load tools over saveScene/loadScene), and a test asserts the reloaded world's entity/component set matches the saved document, proving open→edit→save→reload round-trips.
- A stats overlay reports live entity count / frame timing sourced from existing render+app diagnostics, proven by a test asserting the overlay value tracks a known entity-count change — and a boundaries check confirms the editor package adds no ECS mutation on the main thread.

**Reference.** references/engine PlayCanvas editor model (examples/src/examples/misc/editor.\*.mjs: selector / gizmo-handler / controls) named in SOTA M11-T4 Study, plus the Babylon inspector; match PlayCanvas's pick→select→edit→gizmo loop but drive it through aperture's existing MCP/devtools tools instead of a bespoke editor backend.

**Invariants.** Inv-2/Inv-3 (load-bearing): the inspector reads RenderSnapshots/diagnostics and mutates only through worker devtools commands — no main-thread ECS write, no WebGPU-in-worker. Inv-1: ECS stays the source of truth; selection/save derive from it. Inv-6: reuses the backend-neutral devtools bridge. Inv-8: E2E + unit tests, green check.

### AI-84 · Implement state-preserving system HMR through the vite-plugin

**Priority** P3 · **Effort** XL · **Depends on** none

**Change.** Add state-preserving hot reload of systems via the plugin so editing a system updates the running app without wiping ECS world state. Add handleHotUpdate to the plugin object in packages/vite-plugin/src/index.ts (lines 71-112) that, on a discovered system-module change (system-discovery.ts identifies system files), invalidates the virtual:aperture/worker-systems module and signals a system-only reload over the existing aperture:devtools WS (dev-session.ts) instead of a full page reload. Emit `import.meta.hot.accept` in the generated VIRTUAL_WORKER_ENTRY / VIRTUAL_BROWSER_ENTRY strings in packages/vite-plugin/src/virtual-modules.ts (~lines 57-85). Add a worker-side system reload path: today packages/app/src/worker/start.ts builds systems once via runGeneratedWorkerLoop/setApp — add a re-register entry that swaps the system set against the live world (preserving entities/components) rather than reconstructing it. Asset HMR is a follow-on. SOTA M11-T3 (docs/SOTA_ROADMAP.md:2551).

**Acceptance criteria:**

- A test that spawns entities, then triggers a system-module hot update, asserts the entities and their component values survive the reload (same entity refs, same data) while the swapped system's new logic runs — proving world state is preserved across system HMR.
- Editing a system file invalidates only virtual:aperture/worker-systems (and re-registers systems) without a full document reload, proven by a unit test on handleHotUpdate returning the system module set / not the page, and a test that the generated worker/browser entries contain import.meta.hot.accept.
- Changing a system's scheduling priority via hot reload re-orders execution against the live world in the next fixed step, proven by a deterministic test on update order before/after the swap.
- A boundaries/typecheck run confirms the reload path stays worker-side and pulls no WebGPU into the sim worker; `pnpm run check` is green.

**Reference.** Vite HMR API (handleHotUpdate + import.meta.hot.accept), named in SOTA M11-T3 Study; this is a Vite-plugin-shaped task with no game-engine reference — match Vite's accept-module-without-full-reload contract and add the world-preserving system swap on top.

**Invariants.** Inv-2/Inv-4 (load-bearing): reload re-registers systems inside the worker against the live world, preserving ECS state, and the fixed-step loop stays deterministic post-swap; no WebGPU enters the worker. Inv-1: ECS world remains the single source of truth across reload. Inv-5: an unsupported change still falls back to full reload with a structured diagnostic. Inv-8: tested + green.

### AI-85 · Adopt the official MCP SDK in the CLI MCP server

**Priority** P3 · **Effort** M · **Depends on** none

**Change.** Replace the hand-rolled JSON-RPC stdio loop in packages/cli/src/mcp.ts (manual newline buffer parser, hardcoded MCP_PROTOCOL_VERSION, hand switch-dispatch over initialize/tools/list/tools/call) with the official @modelcontextprotocol/sdk (Server + StdioServerTransport, server.registerTool). Keep the existing tool contracts intact: the toolDefinitions() list and the APERTURE_REFERENCE_TOOL_CONTRACT spread (from reference.js) still drive registration, and each call still routes through the callApertureTool bridge (devtools-client.js) returning the same { content:[{type:text}], structuredContent } shape. Add @modelcontextprotocol/sdk to packages/cli/package.json dependencies (currently has none of it).

**Acceptance criteria:**

- A test drives the SDK-backed server over an in-memory/stdio transport and asserts tools/list returns the same tool name+inputSchema set as the current toolDefinitions() (browser*\*, ecs*\_, input\_\_, camera*\*, render*\*, and the reference contract tools) — proving the contract surface is unchanged after the SDK swap.
- A tools/call test for a representative tool (e.g. ecs_find_entities) returns the same { content:[{type:'text'}], structuredContent } payload produced by callApertureTool, proving the bridge behavior is preserved.
- An initialize request through the SDK reports the aperture serverInfo (name + APERTURE_CLI_VERSION) and tools capability, proving the server identity/capabilities are intact.
- A malformed/unknown-method request returns a well-formed JSON-RPC error from the SDK rather than crashing the process, proven by a test; `pnpm run check` (including check:boundaries and the cli tests) stays green with the new dependency.

**Reference.** Official @modelcontextprotocol/sdk (Server + StdioServerTransport + registerTool); match the SDK's transport/dispatch and capability negotiation while preserving aperture's existing tool contracts and callApertureTool bridge — replacing the bespoke loop, not the tool semantics.

**Invariants.** Inv-5: the SDK returns structured JSON-RPC errors instead of silent drops on bad input. Inv-6/Inv-8: change is confined to packages/cli, keeps the documented tool contracts, and ships with tests + green check; no impact on ECS/render invariants (Inv-1/2/3) since the CLI only bridges to the existing devtools tools.

---

## Excluded — not in this roadmap

These are deliberately **out of the goal-mode scope**. They are not blockers and (mostly) not infeasible — each needs a decision you own, or contradicts a recorded one. Listed so nothing is silently dropped.

### Needs your product / North-Star decision before any code (buildable, large, deferred by scope)

- **Audio subsystem** (Web Audio: `AudioListener`/`AudioSource` ECS components, spatialization off the transform graph, main-thread audio). Not on the North Star. To include: add it as a new phase and a `@aperture-engine/audio` package goal.
- **Networking / replication / multiplayer.** The sim-authoritative fixed-step design is a good netcode foundation, but no transport/replication is scoped.
- **Accessibility (ARIA / accessibility tree / screen-reader).** Canvas UI needs a hidden semantic DOM bridge; interacts with AI-45/AI-46 once those land.
- **Internationalization (locale / RTL / message catalog / Intl formatting).** App-framework concern; pairs with AI-52 (text shaping) and AI-53 (layout).

> To opt any of these in: tell me which, and I'll author phased items + acceptance criteria for them grounded in the references (PlayCanvas audio/UI, Bevy, etc.) and append them here.

### Explicit non-goals (recorded "do NOT add")

- **FBX / OBJ / USD / USDZ / PLY / STL / VRM import** — `docs/SOTA_ROADMAP.md` explicitly defers these; glTF/GLB 2.0 is the chosen format.
- **WebP / AVIF textures** (`EXT_texture_webp/avif`) — explicitly "do NOT add" for now; png/jpeg/ktx2 only.
- **Gaussian-splat / 3D-capture rendering** — out of scope per the engine comparison + SOTA roadmap.

### Recorded engineering decisions (changing them means revisiting the decision, not "fixing a gap")

- **Keep the compute BRDF/DFG LUT unbound; use the analytic Karis DFG** (DECISION 0017). The validated GPU LUT exists but is intentionally not sampled. Reversing this is a rendering-quality decision, not a backlog item.
- **Keep the dedicated physics-worker route non-default.** Simulation-worker physics is the deliberate default; promotion needs an explicit decision (PHY-01/PHY-03).

### Already done — do not re-implement

Landed in `gap-fixes-batch-1` or the prior remediation wave (see `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` Implementation Log): **AI-1** (primitive-collider scale), **AI-9** (O(1) collision-handle index), **AI-28** (data-driven MSAA), **AI-31** (fly camera), **AI-48** (reject non-primary pointer bindings), **AI-63** (change-detection map bound), **AI-79** (`check:progress` non-fatal); plus the closed cluster: asset-backed colliders, SAB write side, equirect→PMREM IBL, transfer-list snapshot, `check:examples`. The partials whose _first slice_ already landed (AI-5, AI-25, AI-34, AI-41, AI-70, AI-82, AI-86, AI-87) appear above as their **remaining** slice only.
