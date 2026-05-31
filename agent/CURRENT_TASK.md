# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md`; ignore
agent/BACKLOG.md per the active directive. Work tasks in dependsOn order, one at a
time, committing each separately.

## Done

- **M3-T1** (`107c61d`) — FrameGraph data model + `compileFrameGraph`.
- **M3-T2** (`924003c`) — single-encoder executor + `encodeFrameBoundaryInto` split.
- **M3-T3** (`1f6721f`) — post stack behind `useFrameGraph` (byte-identical + pixel).
- **M3-T4** (`6aa330a`) — forward + multi-target route through ONE encoder.

## In progress — M3-T5 (shadow casters into the encoder, deps T4). NOT done.

Authoritative detail: **agent/T5-DIAGNOSIS.md (V8)**. Origin @ `6816cba`, clean,
gate green (400 files / 2241 tests).

**Done + verified:** engine mechanism (`app/shadow-caster-graph-pass.ts` + depth-only
shadow nodes in `frame-boundaries.ts`, forward node reads them) + public export
(`3d289d8`, the missing export was the real root cause of the earlier hang) +
headless `frame-graph-shadow.test.ts` 8/8 incl. a fake-device one-encoder/submit
execute test (**Done-when #2**) + the **csm** example fold pixel-proven (`60bb44e`:
`?graph=1` E2E asserts near/far receivers darken, no warnings — **Done-when #1 for
csm**, #4/#5 for csm).

**Still owed (T5 not done):** point / spot / multi-light example folds + their
`?graph=1` pixel proofs (Done-when #1 needs all four specs). They share csm's exact
structure, so the same 6-edit fold + a mirrored pixel test applies to each.

**Blocker:** intermittent tool-output corruption on multi-line reads prevents safely
authoring the 3 remaining folds + spec proofs (single-value channels reliable; files
on disk intact). Stopped per the honesty rule. Resume per T5-DIAGNOSIS.md V8 in a
fresh session.

Then M3-T6 (TAA history wiring; model done `11b9518`); M3-T7 (public
addRenderPass/addComputePass + custom-pass example) last.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, headless/worker-safe, WebGPU-only. Graph
model layer stays GPU-free; only the executor touches the device. Each task: every
"Done when" box ticked, named proof passing with new coverage, `pnpm run check`
green, heading `✅ done (date · commit)`, completion-log row. NEVER mark a task done
on a red gate or an unrun/unread proof.
