# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 1 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md` (its 📋
Status block + completion log + Resume notes are authoritative; ignore
agent/BACKLOG.md per the active directive).

Work the M3 tasks in dependsOn order, one at a time, committing each separately.
Do not start any other milestone.

## Done

- **M3-T1** (`107c61d`) — pure, headless FrameGraph data model + `compileFrameGraph`
  (topo order, store-on-no-clear load/store inference, descriptor-keyed transient
  aliasing, JSON-safe report; cycle ⇒ ok:false, no throw) + `ComputePassCommand`
  union. Proof: `test/webgpu/frame-graph-compile.test.ts` (6 pass). Gate green
  (393 files / 2217 tests).

## Next

- **M3-T2** (depends T1, done) — single-encoder executor
  `render/graph/frame-graph-execute.ts` + the `frame-boundary.ts` refactor
  (extract `encodeFrameBoundaryInto`; keep `assembleFrameBoundary` as a
  legacy-preserving wrapper so `test/webgpu/frame-boundary.test.ts` stays
  byte-identical). Then T3 (post stack) → T4 (forward/multi-target) → T5
  (shadows); T6 (TAA history) after T3; T7 (public addRenderPass/addComputePass
  + custom-pass example) last (depends T4, T2).

See the Resume notes in docs/SOTA_ROADMAP.md for the concrete T2 step list.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
