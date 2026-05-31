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

## Next — M3-T4 (forward + multi-target route → graph)

Make `assembleWebGpuAppFrameBoundaries` (`app/frame-boundaries.ts`) build ONE
FrameGraph spanning all render targets, replace the local
submittedTargetCounts/loadExistingTarget logic with the compiler's
renderTargetMap inference (verify SAME load/store via a vitest golden), make
transmission-grab + MSAA resolve declared graph writes, and flip `useFrameGraph`
default ON for the queued-built-in route once camera-clear-load-matrix +
multi-camera specs are green. Reuse the T3 primitives (buildFrameBoundaryTargetPlan

- resolveRenderBoundary + the report-synthesis-from-encode pattern).

Then T5 (shadows into the encoder); T6 (TAA history) after T3; T7 (public
addRenderPass/addComputePass + custom-pass example) last (depends T4, T2).

See the Resume notes in docs/SOTA_ROADMAP.md for the full T4 step list +
watch-outs.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
