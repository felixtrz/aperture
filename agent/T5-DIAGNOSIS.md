# M3-T5 — status (2026-05-31, session 2, V10 — supersedes all prior)

UNIQUE_MARKER_T5_DIAGNOSIS_V10

V10 is current. Earlier versions/commit messages this session made several claims I
had not verified before writing them (retracted in V7/V9). V10 states only what was
read cleanly, one command at a time. **T5 is NOT done** (3 of 4 shadow examples
remain). Origin `claude/sweet-cerf-gTacp` @ `9c4a2f9`, clean + synced.

## DONE for T5 + verified (read before claiming)

1. **Engine mechanism** — `app/shadow-caster-graph-pass.ts`
   (`createShadowCasterGraphPasses` + `buildShadowCasterDepthAttachmentPlan`) +
   depth-only shadow nodes in `frame-boundaries.ts` (each forward target node READS
   the shadow depth handles so the compiler orders shadows first). It is exported
   from the public bundle `packages/webgpu/src/index.ts` (verify `grep -c
shadow-caster-graph-pass packages/webgpu/src/index.ts` = 1). The MISSING bundle
   export was the real root cause of the long "150s hang" — the example imports built
   `dist`, so the call was `undefined` → TypeError → no status → Playwright timeout.

2. **Headless proofs** — `test/webgpu/frame-graph-shadow.test.ts` = **8 passed**:
   compile-ordering (read edge, not insertion order, puts shadows first; cascade/face
   nodes before opaque; depthStoreOp='store'), the helper pair/resolve/drop, the
   depth-only attachment plan, AND a fake-device EXECUTE test that folds depth-only
   shadow nodes + a forward node into ONE encoder/finish/submit
   (`commandBuffers===1`, shadows before forward). **= Done-when #2 + #5(headless).**

3. **csm example FOLD + PIXEL proof — DONE.** `examples/csm-directional-shadow.main.js`
   `?graph=1` builds the caster graph passes, gates its own caster submit off
   (`submit: casterEnabled && !useFrameGraph`) so the engine's depth-only nodes are
   the SOLE caster writer, and feeds the passes forward one frame.
   `test/e2e/csm-directional-shadow.spec.ts` "...FOLDED into the single encoder
   (M3-T5)" = **1 passed, exit 0, 37.6s** on SwiftShader: captures a
   receiver-disabled baseline + a shadowed screenshot under `?graph=1` and asserts
   (via `expectVisibleCsmScene` + `expectCsmShadowActivation`) the receiver regions
   measurably DARKEN — proving the folded casters actually render visible shadows,
   with no validation warnings. **= Done-when #1 (csm) + #5 (csm).** Done-when #4
   (status==='ready') is already satisfied for csm (plan built with `submission:"ready"`).
   IMPORTANT subtlety baked into that test: in graph mode `status.shadow.rendering.supported`
   is FALSE (it is tied to the example's now-gated-off separate submit), so the test
   drives frames by COUNT (`waitForCsmDirectionalShadowFrame(page, 3)`), NOT by that
   flag, and lets the pixel diff be the proof. Apply the same when wiring the others.

## NOT done → why T5 is open

Done-when #1 needs ALL FOUR shadow specs green WITH visible-shadow assertions. Only
csm is folded + pixel-proven. **point / spot / multi-light** are not folded and have
no `?graph=1` pixel test.

### point-shadow anchors already mapped (for the resume; verify counts on disk)

`examples/point-shadow.main.js`: `exampleParams` line 12; `createWebGpuApp({` line
85 (add `useFrameGraph` via `exampleParams.get("graph")==="1"` → `{ useFrameGraph:
true }`); `const loop = {` line 99 — NOTE its receiver field is `shadowReceiverResources`
(line 101), NOT csm's `standardMaterialShadowReceiverResources`, so READ the
renderSnapshot call + feed-forward in this file carefully (≈155–185) before editing;
`autoStandardMaterialShadowReceiverResources: false,` line 160; the three builder
inputs are `shadowPassAttachments` (JSON form, line 256),
`shadowDepthTextureResourceReport` (report), and `shadowPassCommandRecordPlanReport`
(report, line 370 → `.commandRecords`); `submit: scene.shadowControls.casterEnabled,`
line 437 → ` && !useFrameGraph`. point = a 6-face cube; the helper emits one
ShadowCasterGraphPass per face (resolved by viewKey) automatically — no special
handling. spot/multi-light share the same shape (re-map their var names the same way).

## BLOCKER (why I stopped here, not a rationalization)

Multi-line tool-output corruption is ACTIVE again: `sed -n` and `Read` are returning
DUPLICATED lines (e.g. point-shadow lines 256–258 and 370–372 each printed twice this
turn), and some greps return empty then succeed on retry. Single-value channels
(`grep -c`, exit codes, `node -e typeof`, vitest/E2E pass tails, push ranges) are
reliable and were used for every claim above. Editing three more ~600–800-line
example files (each with per-file loop-field naming differences I must read correctly)
under duplicated-line reads is the exact condition that produced this session's
earlier false-claim cascade. Per the goal's honesty rule ("if blocked, record it and
stop"), I stopped at a clean, green, csm-proven checkpoint.

## Resume (one command at a time; corruption cleared at prior container restarts)

For EACH of point → spot → multi-light:

1. Map its var names with single-value greps (the csm three: passAttachments-JSON,
   depthTextureResources-report, commandRecordPlan-report). READ its renderSnapshot +
   feed-forward to get the correct loop receiver-field name.
2. Apply the csm fold via an assert-protected write-once Python script (assert each
   anchor count, write once, fail loud) + `node --check`.
3. `npx tsc -b packages/webgpu --force` (dist must carry the export — already in src).
4. Add a `?graph=1` pixel test in that spec mirroring csm's (two screenshots:
   `&disable-shadow-receiver=1` baseline vs shadowed; that spec's own
   expect*Visible/expect*ShadowActivation helpers; drive by frame COUNT, not
   rendering.supported). RUN it; READ `N passed` + exit BEFORE committing.
5. Only when all four shadow specs are green WITH shadow-pixel assertions: mark the
   M3-T5 heading `✅ done (date · commit)`, append a completion-log row, tick the
   Done-when boxes, bump the milestone row to 5/7, update the Status block.

After T5: M3-T6 (TAA history wiring; history model already landed), then M3-T7
(public addRenderPass/addComputePass + custom-pass example).
