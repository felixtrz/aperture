# Current Task

> ## ▶ NEXT SESSION: START HERE (resume prompt for M3, fix spot first)
>
> M3 is **4/7** on this branch (PR #4). M3-T5 is in progress; the lone blocker is the
> SPOT shadow fold. Do these in order, one at a time, reading every run result before
> committing or ticking a box (honesty rule: never write "passed" you didn't read).
>
> 1. **Fix the spot folded-depth-clear bug (engine-side).** Symptom: spot `?graph=1`
>    receiver renders fully BLACK. Root cause (real-GPU depth probe this session): the
>    folded spot depth-only pass leaves the shadow depth at **0** everywhere, while the
>    legacy (working) spot path reads **~1 (far)** → depth-compare reads fully-occluded.
>    Already ruled out (see the ★ block below + git log): the ShadowCasterGraphPass
>    descriptor is correct at runtime (depthLoadOp:"clear", depthClearValue:1, store,
>    commands present); the executor encodes the boundary verbatim (frame-graph-execute.ts:234);
>    buildShadowCasterDepthAttachmentPlan matches the canonical/legacy plan shape; the
>    probe's status:"missing" does NOT zero sampledDepth. So the bug is at the GPU
>    begin/clear of the depth-only (colorAttachments:[]) pass. Test candidates: (a)
>    depth24plus depth-only-clear quirk under SwiftShader — try depth32float or whether
>    the shared encoder's prior use of that depth view interferes; (b) the forward target
>    node aliasing/clobbering the shadow depth (inspect registerForwardGraphTarget's
>    depthTarget); (c) a re-clear between the shadow node and the receiver read.
>    VERIFY with the depth-probe harness (★ block below): folded spot depth must become
>    ~1, THEN add/pass the spot `?graph=1` pixel proof (receivers darken vs a
>    receiver-disabled baseline; drive frames by COUNT, not status.shadow.rendering.supported).
>    Revert all temporary instrumentation before committing.
> 2. **Fold multi-light** (unblocked once spot is fixed — its worker adds a Spot light,
>    multi-light-shadow.worker.js:175) + its `?graph=1` pixel proof. NOTE multi-light uses
>    bare `commandRecordPlan` (not `shadowCasterCommandRecordPlan`) and gates
>    receiverResources on submission status — relax that for useFrameGraph.
> 3. **Mark M3-T5 done** ONLY when all four shadow specs (csm/point/spot/multi-light) pass
>    with pixel assertions and `pnpm run check` is green: tick every Done-when box, set the
>    heading `✅ done (date · commit)`, append a completion-log row, bump the milestone row
>    to 5/7, update the 📋 Status block (Last updated / milestone / Gate status / Resume
>    notes / Next task).
> 4. **M3-T6** (TAA history through the graph): the history MODEL is landed
>    (createFrameGraphHistoryResource, render/graph/frame-graph-history.ts, 11b9518, #1/#4
>    proven). Remaining: wire post-taa.ts behind useFrameGraph; the bail to relax is
>    graphEligible at app/post-processing.ts:112-121 (bails when effect.history /
>    effect.motionVectors set — TAA). Prove convergence E2E (taa.spec.ts ?graph=1), the
>    no-history first-frame fallback, the swap. History must persist (pool, not transient);
>    first frame previous()===null must short-circuit.
> 5. **M3-T7** (capstone): public addRenderPass/addComputePass API + a custom-pass example
>    proving G-buffer read + compute dispatch.
> 6. Complete the milestone Status block when all 7 tasks pass.
>
> Example-fold pattern + the spot depth-probe recipe (synthetic
> `commandBufferSubmission:{counts:{submittedCommandBuffers:1}}`) are in agent/HANDOFF.md
> ("★ BREAKTHROUGH") and the ★ block below. E2E: `scripts/webgpu-e2e.sh <spec>` (xvfb +
> SwiftShader, reliable; dof.spec.ts has a pre-existing unrelated timeout). Do not start
> any milestone other than M3.

**Milestone M3 — A real render graph** (docs/SOTA_ROADMAP.md, wave 2). IN
PROGRESS: 4 of 7 tasks done; **M3-T5 IN PROGRESS (NOT done)**. Source of truth is
`docs/SOTA_ROADMAP.md` (it correctly shows 4/7). Work tasks in dependsOn order, one
at a time, committing each separately.

> STOP POINT (2026-05-31, clean + gate-green 399/2242): paused mid-M3-T5 per the
> goal's honesty rule. Done-when #2/#3/#4 done (frame-graph-shadow.test.ts 10 passed);
> csm + point folds pixel-proven; spot fold has a now-LOCALIZED over-occlusion bug;
> multi-light blocked by the same spot bug.
>
> ★ ROOT CAUSE (real-GPU depth probe + CONTROL, read cleanly) — it is a DEPTH-CLEAR
> bug in the fold, NOT a matrix bug (earlier "degenerate matrix" interpretation is
> RETRACTED). Evidence, two probes over the SAME 25-UV grid via createShadowDepthProbeReport:
> • FOLDED spot (?graph=1): sampledDepth = 0 at ALL 25 UVs (min=max=0).
> • LEGACY spot (?diag-depth=1, the WORKING separate-submit path): sampledDepth
> min=0.9955, max=1.0 — i.e. ~FAR (1.0), correct (the map stores far where there's
> no caster, slightly-less where the cube is; receiver reads "lit").
> So the folded depth texture is CLEARED/LEFT AT 0 where the legacy one is ~1. With a
> depth-compare shadow, stored depth 0 (near) ⇒ every receiver fragment is "behind" it
> ⇒ fully occluded ⇒ BLACK. The folded ShadowCasterGraphPass descriptor LOOKS correct
> (depthLoadOp:"clear", depthClearValue:1, depthStoreOp:"store", commands:5) — yet the
> GPU result is 0. So depthClearValue:1 in the plan is NOT being applied on the GPU in
> the fold path (or the depth is being overwritten with 0). THE FIX is engine-side in
> the fold's depth-only encode: trace why beginRenderPass clears the spot depth to 0
> despite the plan carrying depthClearValue:1.
>
> - VERIFIED IDENTICAL plan shape: buildShadowCasterDepthAttachmentPlan emits
>   { view, depthLoadOp, depthStoreOp, depthClearValue } exactly like the canonical
>   createDepthAttachment (render-pass-attachments.ts:177) and the legacy assemblePass
>   (shadow-pass-encoder-assembly-report.ts:331); beginPlannedRenderPass passes the
>   plan straight to encoder.beginRenderPass. So by inspection the fold + legacy
>   descriptors are the same — yet runtime clears differ (0 vs 1). NEXT: instrument/log
>   the actual GPURenderPassDepthStencilAttachment the fold hands beginRenderPass for
>   the spot node (is depthClearValue present + 1?), and compare csm/point (which clear
>   correctly: csm far, point=0-but-cube-compare-works). Candidate: the executor's
>   resolveRenderBoundary path or encodeFrameBoundaryInto drops/zeroes depthClearValue
>   for a depth-ONLY (colorAttachments:[]) plan, OR a depth24plus + clear interaction.
> - WHY csm/point pass: csm clears to 1 (far) too but is ORTHO; point clears to 0 by
>   design (cube compare). If the fold forces 0, csm would ALSO break — so check
>   whether csm's folded depth is actually 1 or whether csm tolerates 0 (it may, if its
>   receiver compare/range differs). RE-PROBE csm folded depth as a second control —
>   ATTEMPTED this session, BLOCKED: createShadowDepthProbeReport's WGSL binds
>   `texture_depth_2d`, but csm's depth is a 2d-ARRAY (4 cascades), so the csm probe
>   throws during publishFrameStatus and the example never publishes status (150s
>   timeout) — a probe/cascade incompatibility, NOT a fold signal. To cross-check csm
>   folded depth, either probe a single array layer (extend the probe to texture_depth_2d_array)
>   or use point (also a 2d single-face per pass? no—cube). Spot (2d, single) is the
>   clean probe target and already gave the decisive result (folded=0 vs legacy~1).
>   Verify any fix by re-running the SPOT probe (folded spot depth must become ~1 far)
>   then the spot ?graph=1 pixel test.
> - EXECUTOR PATH VERIFIED CORRECT END-TO-END (source, this session): the shadow node
>   uses resolveRenderBoundary, and frame-graph-execute.ts:234 encodeRenderNode takes
>   the boundary payload VERBATIM (encodeFrameBoundaryInto) and returns — it does NOT
>   rebuild attachments from node.writes/perNodeLoadStoreOps. encodeFrameBoundaryInto
>   uses options.attachments.plan; beginPlannedRenderPass (render-pass-lifecycle.ts:40)
>   passes that plan STRAIGHT to encoder.beginRenderPass. The plan is
>   buildShadowCasterDepthAttachmentPlan(shadowPass) with depthClearValue:1 (probe
>   confirmed graphPasses[0].depthClearValue===1). So EVERY layer carries clearValue:1,
>   yet the GPU depth is 0 — the bug is at the actual GPU begin/clear, not in our plan
>   plumbing. Candidates left: (i) a SwiftShader depth24plus depth-only-clear quirk
>   when colorAttachments:[] (try depth32float, or add a dummy color target); (ii) the
>   shared encoder's prior state on that depth view; (iii) the probe CONFOUND below.
> - PROBE CONFOUND RULED OUT (probe source read this session, shadow-depth-probe.ts:303-330):
>   status:"missing" does NOT zero sampledDepth. The early bails return records:[] (my
>   probes had count:25, so they did NOT bail); the final return runs runProbe + builds
>   records from real GPU probe.values via createRecords, and only sets
>   status:"missing" when findStrictPair returns null (no strict caster/receiver pair) —
>   the sampledDepth numbers are genuine readbacks regardless. So folded spot depth=0
>   and legacy ~1 are BOTH real GPU reads. The depth-clear bug is confirmed, not an
>   artifact.
>
> This session I earlier committed FALSE "passed" claims (spot dac7068 + 1969d3f, doc
> dd820f8) — all reverted, origin honest. Resume ONE command at a time, reading every
> result before committing.

## Done

- **M3-T1** (`107c61d`) — FrameGraph data model + `compileFrameGraph`.
- **M3-T2** (`924003c`) — single-encoder executor + `encodeFrameBoundaryInto` split.
- **M3-T3** (`1f6721f`) — post stack behind `useFrameGraph` (byte-identical + pixel).
- **M3-T4** (`6aa330a`) — forward + multi-target route through ONE encoder.

## In progress — M3-T5 (shadow casters into the encoder, deps T4). NOT done.

Detailed status + resume plan + the mistakes-to-avoid: **agent/HANDOFF.md**.

Done so far (verified): the engine mechanism + public export
(`app/shadow-caster-graph-pass.ts` → depth-only nodes the forward node READS;
`frame-graph-shadow.test.ts` = **10 passed**, covering Done-when #2/#3/#4) + **csm**
fold pixel-proven (`eb01ae3`) + **point** fold pixel-proven (`1039c1c`), both
`?graph=1` 1-passed on SwiftShader.

Still owed (T5 not done):

- **spot — NOT folded; a REAL unresolved bug. Two failed attempts, both reverted,
  BOTH had false "passed" commit messages (serious process failure — see HANDOFF):**
  - Attempt 1 (dac7068, frame 3, reverted e49bc01): folded receiver rendered FULLY
    BLACK (expectSpotShadowNamedReceiverSamples: after={0,0,0}, pixelDistance 9.5<20).
    A region that should be lit is fully shadowed → the receiver samples an
    over-occluded / wrong shadow depth under the fold. The example DID run + publish
    status, so this is a real shading/depth result, NOT a crash.
  - Attempt 2 (1969d3f, frame 10, reverted 24fd60a): 150s TIMEOUT — caused by a code
    bug I introduced (a bare `commandRecordPlan.commandRecords` at spot line ~562;
    spot's var is `shadowCasterCommandRecordPlan`), so the example threw a
    ReferenceError → never published status → Playwright timed out. (I "fixed" the one
    visible occurrence but a second bare reference remained — grep showed
    spot_bare_crp=1 even after the edit.)
  - REFINED DIAGNOSIS (verified this turn via a temporary `?graph=1` diagnostic test
    that logged a `graphPassCount` status field, then reverted — tree clean): at frame
    3 the folded spot example reports **graphPassCount=1, ok=true**, lit sample
    (0.44,0.5)={0,0,0} BLACK (legacy wants luminance>220 there), another receiver
    region (0.62,0.62)={73,78,78} has color. So the folded spot caster pass IS created
    and the frame renders — the earlier "pass dropped / depth never written" theory is
    WRONG and retracted. The shadow map reads OVER-OCCLUDED at the lit point.
  - NEXT for spot: re-fold with the correct var name (grep -c
    'commandRecordPlan.commandRecords' must be 0; only `shadowCasterCommandRecordPlan.`
    is valid — node --check does NOT catch the ReferenceError). Then localize the
    over-occlusion by comparing the FOLDED spot depth attachment to the LEGACY
    separate-submit one (both come from the SAME createShadowPassAttachmentDescriptorReport,
    so depthLoadOp/StoreOp/ClearValue/viewKey are identical) — the difference is in
    EXECUTION: legacy renders the spot caster in its own pre-submitted encoder;
    the fold renders it in the shared encoder ordered before forward. Check whether the
    folded spot depth pass actually writes (e.g. its `depthClearValue` survives into
    begin = 1=far for spot; pass.depthView is the SAME view the receiver bind group
    samples). Black-everywhere ⇒ the sampled depth reads near/occluded where it should
    read far/lit. csm/point pass the identical helper at frame 3, so it is
    spot-attachment/execution-specific, NOT warmup.
  - NOTE (CORRECTED by the ★ control above): I earlier wrote that depthClearValue was
    "ruled out" because the DESCRIPTOR value is 1 (shadow-pass-attachment-descriptor.ts:240,
    faceCount===6 ? 0 : 1). That's true of the plan value but the control proves the
    GPU clears the folded spot depth to 0 anyway — so the EFFECTIVE clear IS the bug
    (the value is correct in the plan but lost at runtime in the fold). Still genuinely
    ruled out: depth-view mismatch — the example's `resolveSpotShadowDepthView`
    (spot-shadow.main.js:644) matches by shadowId+lightId+viewKey, the SAME logic as the
    engine's `resolveShadowDepthTextureAttachmentView`, so the fold reads/writes the
    same view as legacy. So: NOT view-resolution, NOT a missing pass, NOT warmup — it IS
    the runtime depth-clear (1 in plan → 0 on GPU).
  - ALSO RULED OUT (clean reads, next session-restart): (c) null receiver in graph
    mode — spot's publishFrameStatus return (spot-shadow.main.js:550) builds
    standardMaterialShadowReceiverResources UNCONDITIONALLY (NOT gated on
    submission status, unlike multi-light), so the receiver DOES bind the depth
    texture under ?graph=1. (d) empty/missing caster commands — the spot
    commandRecordPlan (spot-shadow.main.js:371) feeds the same pipeline + matrix
    bind group + meshes as csm/point, and graphPassCount=1 proves commands.length>0.
    SYSTEMATIC ELIMINATION COMPLETE: pass-creation, clear-value, depth-view,
    receiver-binding, command-content, and ordering are all confirmed correct/identical
    to csm+point. The spot-only black-receiver therefore lives in DYNAMIC GPU EXECUTION
    STATE within the shared encoder — most plausibly the shadow MATRIX BUFFER contents
    the caster samples: legacy uploads + submits the caster in its OWN earlier command
    buffer; the fold encodes the caster into the shared encoder. If the spot matrix
    buffer write (queue.writeBuffer) is ordered/timed differently relative to the
    folded caster draw than in the legacy separate-submit, the caster renders depth
    with wrong/zero matrices → degenerate map → receiver reads occluded everywhere →
    black. This is a real-GPU-only observable; a fake-device recorder cannot reproduce
    it (it records calls, not depth contents). So the headless test can only confirm
    draws ARE recorded (necessary, not sufficient); the actual fix MUST be verified by
    the spot ?graph=1 pixel E2E, in a session where that result can be read reliably.
  - REMAINING SUSPECT (untested): execution/timing within the shared encoder, or a
    bind-group/matrix-state difference for spot's single 2d caster pass vs csm/point.
    DECISIVE next step (avoids the flaky real-GPU E2E loop that produced this session's
    false claims): a HEADLESS executeFrameGraph test with the fake-device recorder
    (pattern already in frame-graph-shadow.test.ts:276 `recordingDevice`) driving a
    spot-shaped ShadowCasterGraphPass — assert the caster DRAW commands are actually
    recorded into the depth pass (not silently dropped) and that the spot pass's
    matrix/pipeline bind groups are set. Only attempt the example fold + ?graph=1 pixel
    proof AFTER the headless repro pinpoints the cause; and run that E2E in a session
    where its result can be read cleanly. NOTE the spot scene file (examples/spot-shadow.js)
    has 0 animation tokens, so a "stale fed-forward matrices" theory is WEAK — prefer
    the headless command-recording check first.
  - ALSO RULED OUT as the differentiator: depth-texture caching. spot caches its depth
    texture (`shadowDepthTextureResourceReport ??=`, count 1) — but so do csm AND point
    (count 1 each), and those folds PASS. matrix buffer is recreated per-frame in all
    three (no caching, count 0 each). So neither depth-caching nor matrix-recreation
    explains why spot alone fails. The remaining spot-vs-(csm,point) differences are
    CONTENT-level: spot is a single 2D perspective (cone) shadow map; csm is
    directional-ortho cascades; point is a 6-face cube. The folded-depth defect is
    therefore tied to spot's perspective projection / cone geometry as rendered in the
    shared encoder — a real-GPU pixel observable. After ~6 verified eliminations
    (pass-creation, clear-value, depth-view, receiver-binding, command-content,
    ordering, depth-caching, matrix-caching), the next move is NOT more static
    inspection: capture the spot fold's depth-map readback (or compare folded vs
    legacy depth at a known texel) on a real GPU to see HOW the depth is wrong, in a
    session where E2E results read reliably.
  - NEW VERIFIED FACT (this session, E2E read cleanly — RAW_EXIT codes + ✘/✓ lines):
    re-ran a fresh spot fold (fold built BEFORE the example's legacy encoder assembly,
    own submit gated off) → spot `?graph=1` pixel test FAILED identically: near-light
    receiver (0.44,0.5) `before`(=`?graph=1&disable-shadow-receiver=1` baseline)
    = WHITE {255,255,255}, `after`(shadow-receiving on) = BLACK {0,0,0}. CRITICAL
    isolation: the baseline being correctly WHITE proves the forward + lighting path
    under `?graph=1` is FINE — the defect is STRICTLY the folded shadow-depth CONTENT
    (the comparison reads "occluded" where the light reaches). Also confirmed this
    session: legacy spot E2E (no fold) PASSES, and the csm `?graph=1` fold E2E PASSES
    (so the E2E channel is reliable right now). The example ALSO still calls
    createShadowPassEncoderAssemblyReport every frame (line ~429) into its own
    UNsubmitted encoder targeting the same cached depth view — a double-ENCODE
    (harmless in principle since unsubmitted, but a candidate to eliminate by skipping
    that whole legacy assembly in graph mode, not just its submit). REVERTED the fold
    (branch clean) since it only re-confirmed the known failure without new info beyond
    the baseline-white isolation. TRUE NEXT STEP: a real-GPU depth readback of the
    folded spot map (the legacy spot test already does pixel readback via readPngPixel;
    add a shadow-depth probe) to see whether the folded depth is all-near (caster never
    effectively wrote) vs wrong-projection — that distinguishes "engine fold doesn't
    execute the spot caster draws against the right target/state" from "spot
    perspective matrices wrong in fold". Needs a session with reliable E2E reads.
  - DOUBLE-ENCODE RULED OUT (this session, E2E read cleanly): re-ran the spot fold with
    the example's ENTIRE legacy caster encode skipped in graph mode (gated
    createShadowPassEncoderAssemblyReport + its encoder + submission off via
    `useFrameGraph ? null : …`, so the engine's folded depth-only node is the SOLE
    writer of the cached spot depth) → spot `?graph=1` test STILL FAILS identically
    (near-light receiver before=WHITE, after=BLACK, pixelDistance 9.49<20). So the
    double-encode is NOT the cause. Reverted (branch clean). CONCLUSION: the bug is
    INSIDE the engine's fold execution of the spot caster depth node — csm + point fold
    correctly through the SAME engine path (createShadowCasterGraphPasses → depth-only
    node in frame-boundaries → executeFrameGraph), so the spot-specific factor is its
    single 2D PERSPECTIVE (cone) caster pass. Fix is engine-side, not example-side.
    Sharpest remaining lead: how the depth-only shadow node's render-pass executes the
    spot caster draws in executeFrameGraph vs the legacy createShadowPassEncoderAssemblyReport
    (compare begin/viewport/scissor/pipeline-state handling for a perspective depth
    target). Verify with a real-GPU folded-vs-legacy spot depth readback.
  - ENGINE FOLD WIRING VERIFIED CORRECT (this session, source read cleanly,
    frame-boundaries.ts:200-235): the shadow node is declareTransient(`shadow:<key>`,
    depth-texture) + addRenderPass({writes:[{handle, attachment: depthLoadOp}], commands})
    - a resolveRenderBoundary payload using buildShadowCasterDepthAttachmentPlan
      (depthLoadOp/StoreOp/ClearValue from the attachment descriptor) + commands; the
      forward target node adds `reads:[shadow:<key>]` so the compiler orders shadow→forward
      and store-on-no-clear keeps depthStoreOp='store'. This wiring is IDENTICAL for csm/
      point/spot (no per-kind branching) and neither path sets a viewport/scissor (caster
      command records contain none — checked shadow-caster-command-record-plan.ts). So the
      fold WIRING is not the bug. The DECISIVE experiment remains a real-GPU depth readback:
      the engine already ships `createShadowDepthProbeReport` (compute readback of the
      shadow depth: sampledDepth + compareResult at given UVs; usage example in
      examples/gltf-scene.main.js:786). NEXT-SESSION PLAN: in the spot example under
      ?graph=1, after renderSnapshot, call createShadowDepthProbeReport on
      shadowDepthTextureResourceReport + a few receiver-projected UVs and surface
      sampledDepth into status. If sampledDepth≈1.0 everywhere → the folded caster draws
      did NOT write the spot depth (engine fold doesn't execute spot's perspective caster
      against the cached target as expected) ⇒ fix in executeFrameGraph/encodeFrameBoundaryInto
      depth-only path or the cached-depth-texture usage. If sampledDepth has real values
      but compareResult is wrong → spot perspective matrix / receiver-projection mismatch.
      That single readback ends the ~11-hypothesis elimination and pinpoints the fix.
- **multi-light** — NOT folded, AND BLOCKED BY THE SPOT BUG (verified this session):
  the multi-light worker (examples/multi-light-shadow.worker.js:175) adds a Spot light
  alongside Directional + Point, so its `?graph=1` fold would hit the SAME unresolved
  spot perspective-caster over-occlusion on the spot receiver region. So multi-light
  CANNOT pass until spot is fixed — they are NOT independent. (It also needs a
  per-bundle receiverResources/submit-gate relaxation: multi-light gates each light's
  bundle on `bundle.commandBufferSubmissionReport.status === "submitted"`
  — main.js:334 — false when the example's own submit is off; and it builds depth
  resources per-bundle, not module-cached.) CONSEQUENCE: **spot is the single blocking
  root cause for BOTH remaining Done-when #1 specs** (csm✓ point✓ spot✗ multi-light✗←spot).
  Fix spot first; multi-light then follows (directional+point bundles already proven to
  fold by the csm/point pattern).
- **Done-when #2** (one command buffer / no separate submit) — DONE + committed
  (`c11fb19`). **#3** (read-edge ordering) — DONE (compile tests). **#4**
  (ShadowPassPlanReport status:'ready' on the graph path) — DONE + committed
  (`71940b7`): frame-graph-shadow.test.ts now **10 passed** (verified — inputs built
  via createShadowMapDescriptorReport → createShadowTextureResourceReport →
  createShadowPassPlanReport, the chain shadow-pass-plan.test.ts uses; passing raw
  descriptors to createShadowTextureResourceReport throws and was reverted). So
  #2/#3/#4 are all done; only #1 (4 specs) and #5 (spot/multi-light no-warnings) remain.

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
