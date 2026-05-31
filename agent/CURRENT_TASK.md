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

## Next — M3-T5 (shadow casters into the single frame encoder, deps T4 done)

Wire each ShadowPassPlan (directional cascade / point face×6 / spot) as a render
PassNode that runs BEFORE the opaque node in the SAME FrameGraph, reusing
`shadow-caster-command-record-plan.ts` RenderPassCommand lists + the plan's
depthLoadOp/depthStoreOp. Declare the opaque/forward node as READING the shadow
depth handles so the compiler orders shadows first (store-on-no-clear sets the
shadow node's depthStoreOp='store' because opaque reads it) and the receiver
samples a single-encoder-consistent depth map. Flip shadow-pass-plan submission
to 'ready' in the graph path so the separate shadow submit is no longer invoked.
NOTE csm-directional-shadow already passes with graph ON for the FORWARD route
(16ef314, T4 #4) — T5 must keep it green AND fold the caster passes in.

Reuse the T4 plumbing in `frame-boundaries.ts` (forwardGraph + addRenderPass +
forwardGraphPayloads + the per-node-encode synthesis); the transmission-grab
merge (6aa330a) is the closest template. See the Resume notes in
docs/SOTA_ROADMAP.md for the full T5 plan, watch-outs, and proofs.

Then T6 TAA history wiring (model done `11b9518`); T7 (public
addRenderPass/addComputePass + custom-pass example) last (deps T4, T2).

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
