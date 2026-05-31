# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done; **M3-T5 IN PROGRESS (NOT done)**. Source of truth is
`docs/SOTA_ROADMAP.md` (it correctly shows 4/7). Work tasks in dependsOn order, one
at a time, committing each separately.

## Done

- **M3-T1** (`107c61d`) — FrameGraph data model + `compileFrameGraph`.
- **M3-T2** (`924003c`) — single-encoder executor + `encodeFrameBoundaryInto` split.
- **M3-T3** (`1f6721f`) — post stack behind `useFrameGraph` (byte-identical + pixel).
- **M3-T4** (`6aa330a`) — forward + multi-target route through ONE encoder.

## In progress — M3-T5 (shadow casters into the encoder, deps T4). NOT done.

Detailed status + resume plan + the mistakes-to-avoid: **agent/HANDOFF.md**.

Done so far (verified): the engine mechanism + public export
(`app/shadow-caster-graph-pass.ts` → depth-only nodes the forward node READS;
`frame-graph-shadow.test.ts` = 7 passed) + **csm** fold pixel-proven (`eb01ae3`) +
**point** fold pixel-proven (`1039c1c`), both `?graph=1` 1-passed on SwiftShader.

Still owed (T5 not done):

- **spot** — a REAL over-occlusion bug (folded receiver renders fully black); I
  committed a false "passed" (dac7068) and reverted it (`6b6f3f9`). Spot-specific
  (csm/point pass identical machinery), prime suspect = depth-view/passKey pairing in
  createShadowCasterGraphPasses dropping the spot pass → depth never written. Diagnose
  before re-folding.
- **multi-light** — not folded.
- **Done-when #2** (one command buffer / no separate submit, fake-device execute
  test) and **#4** (ShadowPassPlanReport status:'ready') — drafted but never committed
  (cancelled batches); frame-graph-shadow.test.ts is still 7, must reach those proofs.

Done-when #1 needs ALL FOUR shadow specs green with visible-shadow assertions (2/4
so far). Then M3-T6 (TAA history; model `11b9518` landed), then M3-T7.

## Working discipline (mandatory — this session's lesson)

ONE command at a time when a step gates the next (a failed assertion in a batch
cancels everything after it). After every Edit/write-script, `grep -c` the inserted
text on disk (sandboxed writes can be silently dropped — use disable_sandbox). After
every test, READ `N passed` + exit BEFORE committing. NEVER write "X passed" or a SHA
not read from git. NEVER mark a task done on an unrun/unread proof.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, headless/worker-safe, WebGPU-only. Graph
model layer stays GPU-free; only the executor touches the device. Each task: every
"Done when" box ticked, named proof passing with NEW coverage, `pnpm run check`
green, heading `✅ done (date · commit)`, completion-log row.
