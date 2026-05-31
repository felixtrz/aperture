# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 3 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md` (its 📋
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
  #1/#5 (dof.spec.ts) = documented SwiftShader timeout; covered by the
  post-effects graph E2E. Gate green (396 files / 2225 tests).

## In progress — M3-T4 (forward + multi-target route → graph)

**Integration LANDED (`5ad6d3f`):** `assembleWebGpuAppFrameBoundaries`
(`app/frame-boundaries.ts`) now builds ONE FrameGraph spanning all render targets
behind `useFrameGraph` (default OFF; legacy untouched). Proven on real GPU
(clustered-lights graph E2E) + headless #3 (load/store == legacy
submittedTargetCounts) + #5 (multi-target ⇒ one command buffer). REMAINING: #1/#2
camera multi-target E2E (thread `useFrameGraph` through `createApertureApp` — those
examples use the generated harness), #4 csm/glb `?graph=1` runs, #5 fold
transmission-grab into the same encoder. Also: T6 history model (`11b9518`, #1/#4)

- its TAA route wiring.

Then T5 (shadows into the encoder, deps T4); T7 (public
addRenderPass/addComputePass + custom-pass example) last (deps T4, T2).

See the Resume notes in docs/SOTA_ROADMAP.md for the precise T4-remaining steps +
the T6 history work + watch-outs.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
