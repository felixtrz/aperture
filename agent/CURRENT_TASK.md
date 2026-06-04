# Current Task

> ## ▶ START HERE — M3-T7 (capstone) — 🟡 in-progress: API+wiring DONE, EXAMPLE+E2E remain
>
> M3 is **6/7** done; the **M3-T7 capstone is in-progress**, gate-green (402 files /
> 2253 tests @ 2a12985b). The **entire public API + execution wiring is committed**:
>
> - `7d890b57`/`9acbfdb2`: `user-pass.ts` foundation — the signed-off D1 pass shape,
>   registry, encode-ctx recorder, `buildUserPassNode(s)`. Done-when #3 + #2's
>   execution mechanism proven in `test/webgpu/user-pass.test.ts`.
> - `3349eb9a`: **live wiring** — `app.addRenderPass/addComputePass/removePass` +
>   `userPassRegistry` on `WebGpuApp` (`create-webgpu-app.ts`); the graph post path
>   (`post-processing.ts`) builds registered passes after the scene node (resolvers
>   map `scene-color`→offscreen scene texture, `depth`→depth attachment), render
>   passes write scene-color (LOAD, depth-tested overlay over the scene), compute
>   passes dispatch in-frame — all in ONE post command buffer + an additive
>   `graph` report. Proven in `test/webgpu/post-user-pass-graph.test.ts`.
> - `2a12985b`: `graph` report threaded to `report.renderTargets[0].graph` (order +
>   per-pass kind/ran/executedCommands, JSON-safe) + `addRenderPass`/etc. surfaced
>   through `createApertureApp` (Done-when #5).
>
> **REMAINING to finish M3-T7 (then M3 is COMPLETE):**
>
> 1. **The `custom-graph-pass` example** — `examples/custom-graph-pass.{worker,main,html}.js`
>    - scene. Create the app with `useFrameGraph:true` + a `createWebGpuCopyPostEffect`
>      present pass (so the graph post path engages — it needs effects.length>0 AND an
>      offscreen scene-color). Register via `app.addComputePass` a luminance-histogram
>      (own `device.createComputePipeline` guarded by capability; a storage buffer the
>      encode binds + `ctx.view("scene-color")`) and via `app.addRenderPass` a
>      depth-tested overlay (own line/triangle pipeline; `reads:["depth"]`,
>      `writes:[{handle:"scene-color",attachment:"load"}]`; encode `ctx.setPipeline`+`ctx.draw`).
>      Publish `report.renderTargets[0].graph` + a histogram readback into status.
> 2. **`test/e2e/custom-graph-pass.spec.ts`** — overlay pixels where expected + scene
>    elsewhere (Done-when #1), `status.graph.order` has the custom node between the
>    scene node and the first post node, the compute `ran`/`executedCommands>0`, frame
>    `commandBuffers===1` (Done-when #2). Run on the base headed-Chrome/real-GPU config
>    here (xvfb unavailable); cloud uses `scripts/webgpu-e2e.sh` under SwiftShader.
> 3. **Auto-wrap note (Done-when #4)** — the post path already runs `WebGpuPostEffect[]`
>    as graph nodes; the post-effects E2E is unchanged (user-pass changes are a no-op
>    when none are registered). Confirm + document.
> 4. **Done-marking** — tick all M3-T7 Done-when, mark the heading ✅ done, flip the M3
>    milestone row to done + Proof ✅, append a completion-log row, update the Status block.
>
> Public API shape is SIGNED OFF (D1) — implement exactly. `dof.spec.ts` is a
> documented pre-existing SwiftShader timeout. Do NOT start any milestone other than M3.

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
