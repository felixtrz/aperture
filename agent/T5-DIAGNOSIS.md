# M3-T5 — status + evidence-based findings (2026-05-31, session 2)

UNIQUE_MARKER_T5_DIAGNOSIS_V2

## CORRECTION to the previous version of this file

The earlier root-cause claim in this file (reverted csm fold failed because of a
`submit:true` double-write) is **WRONG** and is retracted. Evidence: the reverted
commit `6885e15` is a **1-line diff** (`submit: ...casterEnabled && !useFrameGraphParam`)
— it NEVER threaded `shadowCasterGraphPasses` into `renderSnapshot`. Its commit
message overclaimed a much larger change that silently never landed (a batched-edit
failure under the tool-output corruption described below). So in graph mode the
reverted attempt ran NO shadow casters at all (engine got `useFrameGraph:true` but
`shadowCasterGraphPasses:undefined`, and the example's own submit was gated off).

## What is VERIFIED this session (reliable channels only)

- **Engine T5 mechanism — DONE, headless-proven.** `test/webgpu/frame-graph-shadow.test.ts`
  = 7/7 (re-run this session). `shadow-caster-graph-pass.ts` worktree hash ==
  HEAD == `3f349bf`.
- **csm example caster fold — APPLIED + renders ok in graph mode.** This session I
  threaded the fold correctly into `examples/csm-directional-shadow.main.js`:
  - module-level `const useFrameGraph = exampleParams.get("graph") === "1";` +
    `let pendingShadowCasterGraphPasses = null;`
  - `createCsmShadowFrame` builds `pendingShadowCasterGraphPasses` via
    `aperture.createShadowCasterGraphPasses({ passAttachments: shadowPassAttachments,
depthTextureResources: shadowDepthTextureResourceReport, commandRecords:
commandRecordPlan.commandRecords })` when `useFrameGraph`.
  - the example's own caster submit is gated: `submit: ...casterEnabled && !useFrameGraph`
    (the engine fold becomes the SOLE caster writer of the persistent depth texture).
  - `pendingShadowCasterGraphPasses` is fed forward one frame
    (`loop.shadowCasterGraphPasses = pendingShadowCasterGraphPasses;`) and passed
    into the next `renderSnapshot` (spread when `useFrameGraph && loop.shadowCasterGraphPasses`).
  - Verified: all edit counts (single-token Python), `node --check` exit 0, and the
    `?graph=1` E2E (`csm-directional-shadow.spec.ts -g "single-encoder FrameGraph"`)
    = **1 passed** on SwiftShader. Default (non-graph) path untouched.

## What is NOT yet proven (the remaining T5 work)

1. **Visual-shadow correctness in graph mode.** The passing `?graph=1` E2E asserts
   `ok:true` but has NO shadow-pixel/darkening assertion — so it does NOT prove the
   folded casters produce visible shadows (an unshadowed floor would also pass it).
   Owed: a graph-mode pixel proof (near/far receiver darkened), mirroring the
   legacy visual test (`csm-directional-shadow.spec.ts:144`, which reads canvas
   pixels — `readback`/`pixel` tokens live in the SPEC, not the example).
2. **commandBuffers===1 + no separate shadow submit** (Done-when #2).
3. **point / spot / multi-light** example folds + their `?graph=1` pixel proofs
   (Done-when #1). Each sets `autoStandardMaterialShadowReceiverResources:false` and
   hand-rolls casters like csm; the same fold pattern applies (point/spot = 6/1 face
   nodes; resolveShadowDepthTextureAttachmentView keys faces by viewKey).
4. **ShadowPassPlanReport.status==='ready' + sections.passSubmission===true** under graph.

## BLOCKER — active tool-output corruption (why this stops here)

This environment is injecting **fabricated prose / duplicated / reordered text** into
multi-line and even structured single-token tool outputs (`Read`, `sed`, `awk`,
`python` heredocs). Examples observed this session: `sed -n '563p'` returned the real
line PLUS "this is line 563 content but the tool output may include extra material…";
`awk` returned "at Object.<anonymous>"/"stack" injected between real lines; a function-
listing probe returned "FNS# first DABABABABBC stack overflow… [CORRUPT]". It is
intermittent but WORSENING (it now sometimes hits single-token probes too).

RELIABLE channels (cross-verified): pure numeric/hash output (`wc -l`, `grep -c`,
`git rev-parse`, `git hash-object`, push SHAs), `node --check` exit codes, and
vitest/E2E pass-count tokens (`N passed`, `✓`). The **files on disk are intact**
(node runs them; E2E passes; git hashes match) — only the relay to the agent is
corrupted. Self-verifying Python EDIT scripts (assert anchor counts on disk, write
once, fail loud) are safe and were used for the csm fold.

What the corruption BLOCKS: reliably READING existing multi-line test assertions to
extend them, and REVIEWING diffs. Authoring four graph-mode pixel-proof E2E tests
(each reusing/duplicating ~20 lines of existing canvas-readback assertions I cannot
read cleanly) is not safe under this — it is exactly the failure mode that produced
the overclaiming reverted commit. Per the run's honesty rule ("if blocked, record it
and stop"), T5 is paused here. **T5 is NOT done.**

## Resume plan (fresh session / container — corruption cleared at prior restarts)

1. Re-run `frame-graph-shadow.test.ts` (expect 7/7) and the csm `?graph=1` E2E
   (expect 1 passed) to confirm the baseline.
2. Add the csm graph-mode VISUAL proof: a sibling test in
   `csm-directional-shadow.spec.ts` navigating `?graph=1` and reusing the line-144
   canvas-pixel darkening assertions (near + far receivers darker than lit). This is
   the real Done-when #1 proof — it confirms the folded casters render shadows.
3. Add a commandBuffers===1 assertion for the shadows+opaque graph frame (Done-when #2).
4. Repeat the fold + pixel proof for point / spot / multi-light.
5. Tick Done-when boxes ONLY against E2E results read cleanly; mark the M3-T5 heading
   `✅ done (date · commit)` + completion-log row + Status block ONLY when all four
   specs are green with shadow-pixel assertions.
