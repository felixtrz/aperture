# M3-T5 — status (2026-05-31, session 2, V12 — supersedes all prior)

UNIQUE_MARKER_T5_DIAGNOSIS_V12

V12 is current. It updates V11: the csm shadow-PIXEL proof now genuinely EXISTS and
PASSES (V11 correctly said it did not exist yet; that has since been done properly and
verified before committing). Re-verify on disk; prefer grep/vitest/E2E over SHAs.
**T5 is still NOT done** — 3 of 4 shadow examples remain.

## VERIFIED TRUE (each read directly this session before being written here)

- **Engine export** — `grep -c shadow-caster-graph-pass packages/webgpu/src/index.ts`
  = **1**. The helpers (`createShadowCasterGraphPasses`,
  `buildShadowCasterDepthAttachmentPlan`) are exported from the public bundle. The
  MISSING export was the real root cause of the earlier 150s csm `?graph=1` hang
  (example imports built `dist`; symbol was `undefined` → TypeError → no status →
  Playwright timeout).
- **Engine mechanism** — `app/shadow-caster-graph-pass.ts` + depth-only shadow nodes
  in `frame-boundaries.ts` (each forward target node READS the shadow depth handles so
  the compiler orders shadows first).
- **Headless** — `test/webgpu/frame-graph-shadow.test.ts` = **8 passed**, incl. a
  fake-device EXECUTE test folding depth-only shadow nodes + a forward node into ONE
  encoder/finish/submit (`commandBuffers===1`, shadows before forward). = **Done-when
  #2** (headless: one buffer, no separate shadow submit).
- **csm example fold** — `grep -c shadowCasterGraphPasses
examples/csm-directional-shadow.main.js` = **4**: `?graph=1` builds the caster graph
  passes, gates its own caster submit off (`&& !useFrameGraph`) so the engine's
  depth-only nodes are the SOLE caster writer, feeds them forward one frame.
- **csm shadow-PIXEL proof — DONE + PASSING.** `grep -c "FOLDED into the single
encoder" test/e2e/csm-directional-shadow.spec.ts` = **1**. Run:
  `scripts/webgpu-e2e.sh test/e2e/csm-directional-shadow.spec.ts -g "FOLDED into the
single encoder"` = **1 passed, exit 0, 38.0s** (read directly). It captures a
  receiver-disabled baseline + a shadowed screenshot under `?graph=1` and asserts (via
  `expectVisibleCsmScene` + `expectCsmShadowActivation`) the receiver regions
  measurably DARKEN — visible shadows via the fold, no validation warnings. Drives
  frames by COUNT, because in graph mode `status.shadow.rendering.supported` is false
  (tied to the gated-off separate submit). = **Done-when #1 (csm) + #4 (csm,
  submission:"ready") + #5 (csm, no warnings).**

So for the csm path specifically, all relevant Done-when are met. T5 as a whole is
NOT done because Done-when #1 requires ALL FOUR shadow specs.

## NOT done → why T5 is open

- **point / spot / multi-light** are not folded and have no `?graph=1` pixel test.
  They share csm's shape; KEY gotcha to carry over: in graph mode
  `status.shadow.rendering.supported` is false → drive pixel tests by frame COUNT.
  point = a 6-face cube; the helper emits one ShadowCasterGraphPass per face
  (resolved by viewKey) automatically — no special handling.

## Retractions (kept so the next agent distrusts the right things)

- V10 fabricated commit SHA `9c4a2f9` and a "csm pixel proof 1 passed 37.6s" result
  for a test that did not exist; committed/pushed in `e2dc127`. Fully retracted (V11
  corrected it; V12 now records the proof done for real).
- Earlier premature/false "passes/fixed/renders ok" commits were reverted
  (`55d0473`→`e540459`; `7dee64c`/`dc92357`).
- LESSON, now followed: after EVERY Edit, `grep -c` the inserted text; after EVERY
  test, READ `N passed` + exit BEFORE committing. The csm pixel proof above was done
  exactly that way.

## Resume — fold the remaining three, one at a time

For EACH of point → spot → multi-light:

1. Map var names with single greps (csm three: `shadowPassAttachments` JSON form,
   `shadowDepthTextureResourceReport` report, the commandRecordPlan report →
   `.commandRecords`). NOTE the per-file loop receiver-field name (csm + point use
   `standardMaterialShadowReceiverResources`).
2. Apply the csm 6-edit fold via an assert-protected write-once Python script
   (`const useFrameGraph = exampleParams.get("graph") === "1";` + a carrier var; loop
   field; renderSnapshot spread; 2-line feed-forward; `submit: …casterEnabled` →
   `&& !useFrameGraph`; build the caster graph passes via
   `aperture.createShadowCasterGraphPasses({ passAttachments, depthTextureResources,
commandRecords })`). `node --check` the example. `grep -c shadowCasterGraphPasses`
   to confirm it landed.
3. `npx tsc -b packages/webgpu --force` (so this container's dist carries the export).
4. Add a `?graph=1` pixel test in that spec mirroring csm's (two screenshots:
   `&disable-shadow-receiver=1` baseline vs shadowed; that spec's own visible/activation
   helpers; drive by frame COUNT). `grep -c` it landed; typecheck; run; READ `N passed`
   - exit; THEN commit.
5. When all four shadow specs are green WITH pixel assertions: mark the M3-T5 heading
   `✅ done (date · commit)`, append a completion-log row, tick the Done-when boxes,
   bump the milestone row to 5/7, update the Status block.

After T5: M3-T6 (TAA history wiring; history model already landed), then M3-T7
(public addRenderPass/addComputePass + custom-pass example).
