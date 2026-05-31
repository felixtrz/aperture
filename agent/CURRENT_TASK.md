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

**Still owed (T5 not done):** a shadow-PIXEL proof under `?graph=1` for csm (the one
I added was malformed, failed, and was reverted — `ok:true` alone does not prove
visible shadows) AND point / spot / multi-light example folds + their `?graph=1`
pixel proofs. Done-when #1 needs all four specs green with visible-shadow assertions.

**Blocker:** intermittent multi-line tool-output corruption (Read/git log/grep -n
return real value + fabricated prose) prevents safely authoring the remaining
multi-line folds + pixel tests. Edit/Write are reliable; files on disk intact.
Resume in a fresh session.

Then M3-T6 (TAA history wiring; model already landed); M3-T7 (public
addRenderPass/addComputePass + custom-pass example) last.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, headless/worker-safe, WebGPU-only. Graph
model layer stays GPU-free; only the executor touches the device. Each task: every
"Done when" box ticked, named proof passing with NEW coverage, `pnpm run check`
green, heading `✅ done (date · commit)`, completion-log row. NEVER mark a task done
on a red gate or an unrun/unread proof; NEVER write "X passed" before reading the run.
