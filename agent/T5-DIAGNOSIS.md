# M3-T5 — status (2026-05-31, session 2, V8 — supersedes all prior)

UNIQUE_MARKER_T5_DIAGNOSIS_V8

V8 is current. Earlier versions/commit messages this session asserted unverified
things (wrong root causes; "E2E passes" written before reading the run); all
retracted in V7 and below. Everything in V8 was read cleanly, one command at a time.

## M3-T5 progress: PARTIAL. csm fully folded + proven. 3 examples remain. NOT done.

Origin `claude/sweet-cerf-gTacp` @ `6816cba` — clean, synced, full gate green
(`pnpm run check` exit 0; 400 files / 2241 tests).

### DONE + verified (read cleanly this session)

- **Engine mechanism** (`app/shadow-caster-graph-pass.ts` + the depth-only shadow
  nodes in `frame-boundaries.ts`; forward node READS the shadow depth handles so the
  compiler orders shadows first) — and it is now **publicly exported** from
  `src/index.ts` (commit `3d289d8`; the missing export was THE root cause of the
  earlier 150s example hang — runtime `createShadowCasterGraphPasses` was undefined).
- **Headless proofs** — `test/webgpu/frame-graph-shadow.test.ts` = **8/8**:
  compile-ordering (read edge, not insertion order, puts shadows first; cascade/face
  nodes before opaque; depthStoreOp stays 'store'), helper pairs/resolves/drops, the
  depth-only attachment plan, AND (commit `6816cba`) a fake-device EXECUTE test:
  depth-only shadow nodes + a forward node reading them fold into ONE
  encoder/finish/submit, `metrics.commandBuffers===1`, shadows encoded before the
  forward color pass. **This is Done-when #2.**
- **csm example fold + PIXEL proof** (commits on the csm example + `60bb44e`):
  `examples/csm-directional-shadow.main.js` with `?graph=1` builds
  `aperture.createShadowCasterGraphPasses(...)`, gates its own caster submit off
  (`submit: casterEnabled && !useFrameGraph`) so the engine's depth-only nodes are
  the SOLE caster writer, and feeds the passes forward one frame. Proof:
  `test/e2e/csm-directional-shadow.spec.ts` -g "FOLDED into the single encoder" =
  **1 passed, exit 0, 16.5s** — reuses `expectVisibleCsmScene` +
  `expectCsmShadowActivation` to assert near + far receivers measurably darker than
  the lit receiver, with no validation warnings. **This is Done-when #1 for csm**
  (and #5 no-warnings for csm). Done-when #4 (status==='ready') is already true for
  csm (the example builds the plan with `submission:"ready"`).

### NOT done → why T5 is NOT done

Done-when #1 requires ALL FOUR specs green with graph ON + visible shadows:

- **point-shadow** — example has the SAME structure/var names as csm
  (`shadowPassAttachments` ×3, `shadowDepthTextureResourceReport` ×5, `commandRecordPlan`
  at line 539) but NO graph wiring yet and NO `?graph=1` spec test. Cube = 6 face
  nodes; the helper produces one ShadowCasterGraphPass per face (resolved by viewKey).
- **spot-shadow** — same shape; not folded; no graph spec test.
- **multi-light-shadow** — same shape; not folded; no graph spec test.

Each needs (a) the same 6-edit fold the csm example got, and (b) a NEW `?graph=1`
pixel test mirroring csm's (reuse that spec's existing activation/visual helpers).

### BLOCKER (active, demonstrated this turn)

Tool-output corruption on MULTI-LINE reads: `Read` of an 11-line temp file came back
duplicated/garbled; `grep -n … | head -1` returned the real line PLUS an injected
second line; `git status --porcelain` printed twice with a prose tail. It is
intermittent but recurred reliably enough this turn that I CANNOT safely read the
multi-line structure of the 3 remaining example files + their 3 spec files to author
the folds + pixel proofs. Single-value channels remain reliable and were used for all
verification: `grep -c`, exit codes, `node -e typeof`, vitest/E2E pass-count tails,
git rev-parse. Files on disk are intact (proven by the green gate + clean rebuild).

Per the run's honesty rule ("if blocked, record it and stop"), I stopped rather than
risk the false-claim failure mode that this corruption already caused earlier this
session (see retractions in V7). **T5 is NOT done.**

## Resume (fresh session / container — corruption cleared at prior restarts)

For EACH of point / spot / multi-light, one command at a time:

1. Apply the csm fold pattern via an assert-protected write-once script (anchors:
   `const stopAfterReady = …` → add `const useFrameGraph = exampleParams.get("graph")
=== "1";` + `let pendingShadowCasterGraphPasses = null;`; `const loop = {` → add
   `shadowCasterGraphPasses: null,`; `autoStandardMaterialShadowReceiverResources:
false,` → add the spread; the 2-line `loop.…ReceiverResources = nextFrameResources.…;`
   feed-forward; `submit: …casterEnabled,` → `&& !useFrameGraph`; build
   `pendingShadowCasterGraphPasses` before that example's `const route`/return via
   `aperture.createShadowCasterGraphPasses({ passAttachments: shadowPassAttachments,
depthTextureResources: shadowDepthTextureResourceReport, commandRecords:
commandRecordPlan.commandRecords })`). `node --check` the example.
2. `npx tsc -b packages/webgpu --force` (so dist carries the export — already in src).
3. Add a `?graph=1` sibling pixel test in that spec reusing its existing visual
   helper (csm used expectCsmShadowActivation/expectVisibleCsmScene; find the
   equivalent in each spec). Run `-g` it; READ `N passed` + exit from the log.
4. Only after all four specs are green WITH shadow-pixel assertions: mark the M3-T5
   heading `✅ done (date · commit)`, append a completion-log row, tick the Done-when
   boxes, bump the milestone row to 5/7, and update the Status block.
