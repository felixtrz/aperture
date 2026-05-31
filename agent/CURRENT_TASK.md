# Current Task

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done. Source of truth is `docs/SOTA_ROADMAP.md` (its 📋
Status block + completion log + Resume notes are authoritative; ignore
agent/BACKLOG.md per the active directive).

Work the M3 tasks in dependsOn order, one at a time, committing each separately.
Do not start any other milestone.

## Done

- **M3-T1** (`107c61d`) — pure FrameGraph data model + `compileFrameGraph`.
- **M3-T2** (`924003c`) — single-encoder executor + `encodeFrameBoundaryInto` split.
- **M3-T3** (`1f6721f`) — post stack behind `useFrameGraph` (byte-identical reports
  - real-GPU pixel parity).
- **M3-T4** (`6aa330a`) — forward + multi-target route through ONE encoder (incl.
  transmission-grab fold); all 5 Done-when proven on real GPU / vitest.

## In progress — M3-T5 (shadow casters into the single frame encoder, deps T4)

**NOT done.** Detailed, current record: **agent/T5-DIAGNOSIS.md (V6)**.

- Engine mechanism DONE + headless-proven: `app/shadow-caster-graph-pass.ts` +
  depth-only shadow nodes in `frame-boundaries.ts` (forward node READS the shadow
  handles → compiler orders shadows first). Proof: `frame-graph-shadow.test.ts` 7/7.
- csm example fold (`?graph=1`) applied; renders `ok:true` with a correct build.
  (The earlier "hang" was a STALE incremental `dist/` not re-exporting the helper →
  runtime `undefined` → TypeError → no status → Playwright timeout. Source export
  was always present; `dist/` is gitignored so fresh/CI builds are fine. Fix locally
  with `npx tsc -b packages/webgpu --force`.)
- `pnpm run check` = green (399 files / 2239 tests) at the committed source state.

**Still owed (why T5 is NOT done):**

1. A `?graph=1` shadow-PIXEL proof for csm (the passing test 317 asserts `ok:true`
   only — it does NOT prove visible shadows under the fold). Reuse the existing
   `expectCsmShadowActivation` / `expectVisibleCsmScene` helpers.
2. commandBuffers===1 + no separate shadow submit under graph (Done-when #2).
3. point / spot / multi-light example folds + their `?graph=1` pixel proofs (#1).
4. ShadowPassPlanReport.status==='ready' under graph (Done-when #4).

Then M3-T6 (TAA history wiring; model done `11b9518`); M3-T7 (public
addRenderPass/addComputePass + custom-pass example) last.

## Invariants (every M3 task)

ECS-authoritative, no central scene graph, renderer never owns game state,
headless/worker-safe, WebGPU-only. The graph model layer stays GPU-free; only the
executor touches the device. Each task: every "Done when" box ticked, named proof
passing with new coverage, `pnpm run check` green, heading marked `✅ done (date ·
commit)`, completion-log row appended. NEVER mark a task done on a red gate or an
unrun/unread proof.
