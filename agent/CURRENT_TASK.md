# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 2 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md` (its 📋
Status block + completion log + Resume notes are authoritative; ignore
agent/BACKLOG.md per the active directive).

Work the M3 tasks in dependsOn order, one at a time, committing each separately.
Do not start any other milestone.

## Done

- **M3-T1** (`107c61d`) — pure, headless FrameGraph data model + `compileFrameGraph`
  (topo order, store-on-no-clear load/store inference, descriptor-keyed transient
  aliasing, JSON-safe report; cycle ⇒ ok:false, no throw) + `ComputePassCommand`
  union. Proof: `test/webgpu/frame-graph-compile.test.ts` (6 pass).
- **M3-T2** (`924003c`) — single-encoder executor `executeFrameGraph`
  (`render/graph/frame-graph-execute.ts`) + the `frame-boundary.ts` keystone
  split (extracted `encodeFrameBoundaryInto`; `assembleFrameBoundary` is now a
  legacy-preserving wrapper, `frame-boundary.test.ts` byte-identical-green) +
  compute executor + multi-pass metrics. Proof:
  `test/webgpu/frame-graph-execute.test.ts` (4 pass). Gate green (394 files /
  2221 tests).

## In progress — M3-T3 (post-stack graph port)

Two proven groundwork commits landed; the orchestrator port itself remains:

- **`bd383f3`** — executor `FrameGraphResources.resolveRenderBoundary(node)`
  hook: a route hands the single-encoder executor a fully-resolved boundary
  payload; it threads it into the one shared encoder verbatim. Tested.
- **`16eec77`** — extracted `buildFrameBoundaryTargetPlan` from
  `assembleFrameBoundary` (behavior-preserving) so the post-graph builder builds
  byte-identical attachments per node.

Remaining: the `useFrameGraph` branch in `app/post-processing.ts` (build nodes +
payloads + `executeFrameGraph` once + synthesize the post reports), thread the
flag through `CreateWebGpuAppOptions`→`create-webgpu-app`→`frame-boundaries`
(default OFF), and prove via the post-effects E2E (commandBuffers===1 +
postEffects parity + pixels). `dof.spec.ts` is the documented SwiftShader
timeout — use post-effects as the alternative + record it honestly.

Then T4 (forward/multi-target) → T5 (shadows); T6 (TAA history) after T3; T7
(public addRenderPass/addComputePass + custom-pass example) last (depends T4, T2).

See the Resume notes in docs/SOTA_ROADMAP.md for the full T3 step list +
watch-outs + the lowest-risk implementation shape.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only (no WebGL fallback). The graph model layer
stays GPU-free; only the executor touches the device. Each task: every "Done
when" box ticked, named proof passing with new coverage, `pnpm run check` green,
heading marked `✅ done (date · commit)`, completion-log row appended.
