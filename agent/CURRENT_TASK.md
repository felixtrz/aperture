# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md`; ignore
agent/BACKLOG.md. Work tasks in dependsOn order, one at a time, committing each
separately.

## Done

- **M3-T1** — FrameGraph data model + `compileFrameGraph`.
- **M3-T2** — single-encoder executor + `encodeFrameBoundaryInto` split.
- **M3-T3** — post stack behind `useFrameGraph` (byte-identical + pixel parity).
- **M3-T4** — forward + multi-target route through ONE encoder.

## In progress — M3-T5 (shadow casters into the encoder, deps T4). NOT done.

Authoritative detail + the resume plan: **agent/T5-DIAGNOSIS.md (V9)**.

**Real + verified (re-derivable from files):** engine mechanism
(`app/shadow-caster-graph-pass.ts` + depth-only shadow nodes in
`frame-boundaries.ts`, forward node reads them) + public export from
`packages/webgpu/src/index.ts` (the missing export was the root cause of the earlier
hang) + headless `frame-graph-shadow.test.ts` = 8 passed, incl. a one-encoder/submit
execute test (**Done-when #2**) + the csm example fold renders `ok:true` under
`?graph=1`.

**Real + verified (single clean greps / vitest):** engine mechanism
(`app/shadow-caster-graph-pass.ts` + depth-only shadow nodes in
`frame-boundaries.ts`) + public export from `packages/webgpu/src/index.ts`
(`grep -c` = 1; the missing export was the real root cause of the earlier hang) +
headless `frame-graph-shadow.test.ts` = 8 passed incl. a one-encoder/submit execute
test (Done-when #2, headless) + the csm example fold present (`grep -c` = 4) renders
`ok:true` under `?graph=1`.

**csm shadow-PIXEL proof — DONE + PASSING:** `csm-directional-shadow.spec.ts -g
"FOLDED into the single encoder"` = 1 passed, exit 0, 38.0s (read directly), asserting
the receiver regions darken vs a receiver-disabled baseline under `?graph=1` =
Done-when #1/#4/#5 for csm. (A prior version of this file falsely claimed this with a
fabricated SHA `9c4a2f9`; that was retracted and the proof has since been done for
real — see T5-DIAGNOSIS.md V12.)

**Still owed (T5 not done):** point / spot / multi-light example folds + their
`?graph=1` pixel proofs. Done-when #1 needs all four shadow specs green. KEY: in
graph mode `status.shadow.rendering.supported` is false (tied to the gated-off
separate submit), so drive pixel tests by frame COUNT, not that flag.

**Discipline:** after every Edit, `grep -c` the inserted text before proceeding;
after every test, READ `N passed` + exit before committing; never write a SHA.
Resume per agent/T5-DIAGNOSIS.md (V11).

Then M3-T6 (TAA history wiring; model already landed); M3-T7 (public
addRenderPass/addComputePass + custom-pass example) last.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, headless/worker-safe, WebGPU-only. Graph
model layer stays GPU-free; only the executor touches the device. Each task: every
"Done when" box ticked, named proof passing with NEW coverage, `pnpm run check`
green, heading `✅ done (date · commit)`, completion-log row. NEVER mark a task done
on a red gate or an unrun/unread proof; NEVER write "X passed" before reading the run.
