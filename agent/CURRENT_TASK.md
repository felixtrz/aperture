# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md` (its 📋
Status block + completion log + Resume notes are authoritative; ignore
agent/BACKLOG.md per the active directive).

Work the M3 tasks in dependsOn order, one at a time, committing each separately.
Do not start any other milestone.

## Done

- **M3-T1** (`107c61d`) — pure, headless FrameGraph data model + `compileFrameGraph`.
  Proof: `test/webgpu/frame-graph-compile.test.ts` (6 pass).
- **M3-T2** (`924003c`) — single-encoder executor `executeFrameGraph` + the
  `frame-boundary.ts` keystone split (`encodeFrameBoundaryInto` +
  legacy-preserving `assembleFrameBoundary` wrapper) + compute executor +
  multi-pass metrics. Proof: `test/webgpu/frame-graph-execute.test.ts` (5 pass).
- **M3-T3** (`1f6721f`) — post stack behind `useFrameGraph` (default OFF):
  `assembleWebGpuAppPostProcessedSwapchainTargetViaGraph` builds the same per-pass
  boundaries via `buildFrameBoundaryTargetPlan` → `resolveRenderBoundary`
  payloads → `executeFrameGraph` once → byte-identical reports; flag threaded
  through the app; examples/post-effects `?graph=1`. Proofs: post-frame-graph.test.ts
  (#2), post-graph-parity.test.ts (#3, simple + bloom), post-effects.spec.ts
  "FrameGraph path matches…" (#4, real-GPU pixel+report parity on SwiftShader).
- **M3-T4** (`6aa330a`) — forward + multi-target route through ONE encoder.
  `assembleWebGpuAppFrameBoundaries` (`app/frame-boundaries.ts`) builds ONE
  FrameGraph spanning all render targets behind `useFrameGraph` (default OFF;
  legacy multi-submit untouched + reachable via flag); the compiler's
  renderTargetMap inference subsumes the local submittedTargetCounts/loadExistingTarget
  load/store logic; the transmission-grab pass is folded in as a render node
  registered before the main target node (grab+main share one encoder). Threaded
  through `createApertureApp` (`?graph=1`). All 5 Done-when ✅, validated on real
  SwiftShader GPU or vitest: #1 camera-clear-load-matrix (896b5fc), #2 split-screen
  (7c0f0fc) + camera-viewport-grid (6ac4ccd), #3 frame-graph-multi-target.test.ts
  (8e9df63), #4 clustered-lights (5ad6d3f) + csm-directional-shadow (16ef314),
  #5 multi-target one-buffer + transmission-grab fold (6aa330a). Zero validation
  warnings.

## In progress — M3-T5 (shadow casters into the single frame encoder, deps T4 done)

> ⏸️ **PAUSED 2026-05-31 due to environment tool-output corruption — see the ⛔
> BLOCKER at the top of agent/HANDOFF.md.** Engine mechanism `85e7bdb` is SOUND
> (vitest 7/7 verified clean). Commit `6885e15` is an INCOMPLETE no-op (csm example
> wiring never persisted). Remaining T5 work = actually wire the 4 example
> migrations (csm/point/spot/multi-light) + their `?graph=1` E2E proofs, then mark
> done. Branch pushed at 6885e15 (verified via .git plumbing). Do NOT mark M3-T5
> done — it is NOT done.

**SCOPE DECISION (user: "Full scope now", 2026-05-31):** The roadmap assumed
shadow casters flow through an engine-internal path. REALITY (verified): all four
named specs (csm-directional/point/spot/multi-light) set
`autoStandardMaterialShadowReceiverResources: false` and HAND-ROLL their shadow
caster pipelines in EXAMPLE code via the public lower-level APIs, submitting their
OWN caster command buffer, then pass the engine only pre-baked receiverResources.
The engine forward route (sampling the maps) already passes with graph ON (T4 #4).
So full T5 = a NEW public surface to hand caster passes to the engine + migrate all
4 hand-rolled examples/specs.

DESIGN (generic engine fold, reused by all shadow types):

1. **`app/shadow-caster-graph-pass.ts`** (new): public `ShadowCasterGraphPass`
   type `{ key, depthView, depthClearValue?, depthLoadOp, depthStoreOp, commands,
width?, height?, depthFormat? }` + a `createShadowCasterGraphPasses({
passAttachments, commandRecords, depthTextureResources })` helper that pairs each
   ShadowPassDepthAttachmentDescriptor with its commands (by passKey) + resolves the
   depth view via resolveShadowDepthTextureAttachmentView. Depth-only render pass
   data, encoder-agnostic.
2. **Thread `shadowCasterGraphPasses?`** through renderSnapshot → queued-built-in-frame
   → assembleWebGpuAppFrameBoundaries.
3. **frame-boundaries.ts**: when forwardGraph active + shadowCasterGraphPasses present,
   for each pass: declareTransient(`shadow:<key>`, depth descriptor) + addRenderPass
   writing it (attachment = depthLoadOp) + a resolveRenderBoundary payload with a
   DEPTH-ONLY attachment plan (createRenderPassAttachmentPlan({colorTargets:[],
   depthTarget})) + the caster commands. Each opaque target node adds
   `reads: [...shadow keys]` (line 963 reads:[]) so the compiler orders shadows
   first. Synthesize shadow boundaries from exec.nodes[].encode (mirror grab synthesis).
   encodeFrameBoundaryInto SUPPORTS depth-only (verified: empty colorTargets + depth).
4. **Examples** (csm/point/spot/multi-light): when `?graph=1`, build
   ShadowCasterGraphPass[] via the helper + pass to renderSnapshot, SKIP their own
   caster submission. → shadows+opaque in ONE command buffer.
5. **Proofs**: 4 specs graph ON (one buffer + shadows correct + zero warnings) +
   vitests (#3 compiler orders shadow<opaque via read edge, remove edge ⇒ reorder;
   #2 no separate submit / commandBuffers===1; #5 store inference).

WATCH-OUTS: shadow depth needs depthStoreOp='store' (always for shadows; compiler
store-on-no-clear also infers it from the opaque read edge). Cube/point = 6 face
nodes (faceIndex → arrayLayer in resolveShadowDepthTextureAttachmentView via
viewKey). Keep legacy (example-submitted) path when graph OFF.

Then T6 TAA history wiring (model done `11b9518`); T7 (public
addRenderPass/addComputePass + custom-pass example) last (deps T4, T2).

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
