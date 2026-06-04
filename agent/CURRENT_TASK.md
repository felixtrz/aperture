# Current Task

> ## ▶ START HERE — M7 (scene persistence + authoring layer) — 🟡 in-progress 5/9
>
> Active /goal: **Implement Milestone M7**. Gate-green (408 files / 2273 tests @
> 78434a6d), working tree clean. Implement M7 in task-number order (deps are always
> lower-numbered): **T1 ✅ → T2 ✅ → T3 ✅ → T4 ✅ → T5 ✅ → T6 → T7 → T8 → T9**.
>
> - **M7-T1 ✅ done (c1509d62):** bidirectional transform hierarchy —
>   `packages/simulation/src/transform/hierarchy.ts` (`setParent` world-preserving
>   reparent via Bevy `reparented_to`, `getChildren`, `despawnRecursive`, cycle
>   rejection) + a derived `Children` component on the authoritative `Parent`.
> - **M7-T2 ✅ done (2f1f6b50):** `this.hierarchy` accessor
>   (`children`/`setParent`/`despawnRecursive`) on `ApertureSystemContext` resolving
>   refs via the shared barrel-free `resolveActiveEntity`
>   (`entities/lookup/resolve.ts`); `createApertureEntityHierarchy` now prefers the
>   `Children` index (no full ALL-entities scan; legacy `collectActiveEntities`
>   fallback retained). Proven by `test/app/hierarchy-accessor.test.ts` (4).
> - **M7-T3 ✅ done (54c3728f):** generic schema-driven component (de)serialization
>   codec in `packages/simulation/src/serialization/` —
>   `serializeEntityComponents`/`deserializeEntityComponents` via a `component.id`→
>   component allow-list registry; Entity fields as `index:generation` tokens,
>   `WorldTransform` excluded. Proven by `test/serialization/component-codec.test.ts` (4).
> - **M7-T4 ✅ done (fb1dac4b):** whole-world scene document save/load —
>   `saveScene`/`loadScene` round-trip an ECS world via a versioned
>   `ApertureSceneDocument` (oldId→newEntity remap of Entity-typed fields, `Children`
>   rebuilt from `Parent`, `resolveWorldTransforms`, formatVersion-gated, explicit
>   allow-list registry). Proven by `test/serialization/scene-roundtrip.test.ts` (3).
> - **M7-T5 ✅ done (78434a6d):** prefab register + instantiate —
>   `instantiatePrefab(world, document, {registry, transform?, overrides?})` deep-clones an
>   `ApertureSceneDocument` subtree (loadScene remap), returns the root + applies a root
>   transform override + per-prefab-id field overrides; `spawn.prefab` + `prefabs.register`
>   on the system context; `componentRegistryFromWorld` helper. Proven by
>   `test/serialization/prefab-instantiate.test.ts` (3) + `test/app/prefab-spawn-route.test.ts` (1).
> - **NEXT — M7-T6** (`render-bridge`, M, depends none): runtime material parameter mutation
>   via versioned asset re-registration — `patchStandardMaterial(prev, patch)` (+ unlit/matcap)
>   returns a NEW frozen asset; `materials.set(handle, patch)` on `ApertureSystemContext` reads
>   the asset, patches, and `assetsRegistry.markReady(handle, next)` (bumps version → re-prepares
>   the GPU material, no re-extraction). Full spec + Done-when: `docs/SOTA_ROADMAP.md` §`M7-T6`.
>
> Per-task bar (per the /goal): every Done-when ticked + named vitest/E2E proof with
> new coverage + `pnpm run check` green + heading `✅ done (date · commit)` + a
> completion-log row + the 📋 Status block updated. Commit each task separately. Do
> NOT start any milestone other than M7. `dof.spec.ts` is a documented SwiftShader
> timeout; on a macOS/dev box use the base headed-Chrome/real-GPU playwright config.
>
> The M3-T7 detail below is retained for reference. `dof.spec.ts` is a documented
> pre-existing SwiftShader timeout; on a macOS/dev box use the base
> `playwright.config.ts` headed-Chrome/real-GPU config (xvfb is unavailable here).

## ✅ M3-T5 is done (ad296a4) — and the old "spot blocked" diagnosis was wrong

All four shadow caster folds (csm / point / spot / multi-light) now fold their
depth-only caster passes into the SINGLE forward encoder under `?graph=1` and are
pixel-proven under SwiftShader (receivers darken vs a receiver-disabled baseline,
zero validation warnings).

**ROOT-CAUSE CORRECTION (retracts the entire prior handoff):** the spot and
multi-light folds rendered black NOT because of a SwiftShader "depth-only clear
dropped in a shared encoder" bug. That theory was disproved by simply running the
csm fold test — csm folds the _identical_ depth-only shadow passes into the same
shared encoder and renders correctly. The real cause: the **spot and multi-light
examples were never wired for the fold** (no `?graph=1` / `useFrameGraph` /
`createShadowCasterGraphPasses`; only csm and point were). The synthetic
`commandBufferSubmission` depth probe that suggested "folded depth = 0" was a probe
artifact (read before the real submit), not real evidence. The fix was to replicate
the proven csm/point wiring in the two missing examples.

**The example-fold pattern (the T5 template, for reference):** in `*.main.js` —
`const useFrameGraph = exampleParams.get("graph") === "1";` + a module-level
`let pendingShadowCasterGraphPasses = null;`; pass `useFrameGraph: true` to
`createWebGpuApp`; add `shadowCasterGraphPasses: null` to the frame `loop`; in
`renderSnapshot` spread `...(useFrameGraph && loop.shadowCasterGraphPasses ?
{ shadowCasterGraphPasses: loop.shadowCasterGraphPasses } : {})`; after
`publishFrameStatus`, `loop.shadowCasterGraphPasses = pendingShadowCasterGraphPasses`
(one frame of latency); gate the legacy caster submit with
`submit: …casterEnabled && !useFrameGraph`; build the passes with
`aperture.createShadowCasterGraphPasses({ passAttachments, depthTextureResources:
<the report>, commandRecords: <plan>.commandRecords })`. Multi-light builds passes
per bundle inside `createShadowBundle` and concatenates directional + spot + point
into one list. The `?graph=1` E2E proof mirrors csm's fold test: baseline
`?graph=1&disable-shadow-receiver=1` vs `?graph=1`, drive frames by COUNT (graph
mode gates the legacy caster submit off so `shadow.rendering.supported` is false),
assert the receiver darkens, `expectNoWarnings()`.

## ✅ M3-T6 is done (d598e59f) — TAA color history through the graph

TAA color history is now a `declareHistory` double-buffered pool
(`createFrameGraphHistoryResource`) owned by the graph post path, replacing the
per-effect ping/pong closure. The graph post path admits TAA when motion vectors
are available as a scene attachment (writes them as the scene node's 2nd color
target), sources the TAA write from `pool.current()` and the history read from
`pool.previous()`, and swaps the pool exactly once after the single execute; it
declines to legacy when motion vectors fall back (`motionVectorColorFormat`
null), so `WebGpuAppMotionVectorFallbackReason` (computed upstream in
`queued-built-in-frame.ts`) is unchanged. `requiresColorHistory` on
`WebGpuPostEffect` + `history` on the prepare options carry it; legacy path
untouched (default `useFrameGraph` OFF). Proven by `frame-graph-history.test.ts`
(compileFrameGraph two-frame: previous→N-1's current, distinct buffer),
`post-history-graph.test.ts` (route-level no-aliasing + fallback decline + pool
stays 2), and `test/e2e/taa.spec.ts` `?graph=1` (real-GPU convergence,
scene-attachment motion vectors, zero validation warnings). The historical
planning notes below are retained for reference.

`webgpu-render` · effort **M** · depends: M3-T3 (sanctioned to run alongside T4/T5).
Full spec: `docs/SOTA_ROADMAP.md` §`M3-T6`.

**Already landed (11b9518):** the history MODEL — `createFrameGraphHistoryResource`
in `render/graph/frame-graph-history.ts` (double-buffer `current()` / `previous()` /
`swap()`). Done-when **#1** (two-frame compile: previous read resolves to frame N-1's
buffer, current write targets a different physical texture) and **#4** (history pool
stays exactly 2 buffers over 10 frames, no leaks) are ✅ via
`test/webgpu/frame-graph-history.test.ts`.

**Remaining Done-when:**

- **#2** An E2E/render-control TAA convergence proof: static scene + camera jitter →
  the TAA output converges (consecutive-frame pixel delta at sampled readback points
  decreases below a threshold), demonstrating history is carried across frames
  through the graph. Likely `test/e2e/taa.spec.ts` with a `?graph=1` variant.
- **#3** TAA still falls back correctly under the graph path — status reports the same
  `WebGpuAppMotionVectorFallbackReason` values (msaa / sprite / skybox reasons).

**Remaining wiring:** route TAA's color history through the graph. The bail to relax
is `graphEligible` at `app/post-processing.ts:112-121` (it currently bails to legacy
when `effect.history` / `effect.motionVectors` are set — i.e. TAA). `post-taa.ts`
should declare a read of the history handle's `previous` view + a write of its
`current` view (instead of fixed ping/pong); the executor binds the correct buffer
per frame. Replace the hand-threaded history in `resource-cache.ts`
(`WebGpuAppPostPassCache.previous*`) for TAA color with the
`createFrameGraphHistoryResource` pool.

**Watch out (from the task §):** history must persist (a POOL, not a transient);
the first frame `previous() === null` must short-circuit (no-history fallback);
the swap must happen exactly once per frame at end-of-execute (not per node) or a
frame referencing history twice reads inconsistent data; history double-buffering
must survive canvas resize (reallocate both buffers, drop stale history that frame,
or you get ghosting). Keep motion-vector GEOMETRY history as-is (out of scope) —
scope this to TAA COLOR history only. Keep `useFrameGraph` default OFF.

**Study:** `references/three.js/src/nodes/display/PassNode.js` (`_previousTextures` /
`getPreviousTexture`, concepts only — do not copy).

## ▶ M3-T7 — capstone (after T6)

Public `addRenderPass` / `addComputePass` / `removePass` on `WebGpuApp` (and through
`createApertureApp` in `packages/app`) + a custom-pass example proving a compute
histogram read of scene-color and a depth-tested wireframe overlay node inserted
after `'opaque'`. The public API shape is SIGNED OFF (M3 §"Design decisions D1") —
implement exactly that shape, do not improvise. Full spec + Done-when:
`docs/SOTA_ROADMAP.md` §`M3-T7`.

## Run protocol reminders

- One task at a time, in dependsOn order; commit each completed task separately.
- Per-task acceptance: every Done-when box ticked; named proof passes with new
  coverage; `pnpm run check` green (typecheck + lint + prettier + vitest — vitest
  passing alone is NOT the gate); architectural invariants (ECS-authoritative, no
  scene graph, headless/worker-safe, WebGPU-only); heading carries
  `✅ done (date · commit)` + a completion-log row; 📋 Status block updated.
- Honesty: never mark a task done on a red gate or unrun proof. If a proof cannot run
  in this environment, say so and use a stated alternative. If blocked, record it and
  stop.
