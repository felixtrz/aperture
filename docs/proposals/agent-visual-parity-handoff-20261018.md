# Agent visual parity handoff — DRAFT / active

Prepared 19 October 2026 for the work begun 18 October. This is a navigation and
reproduction handoff, not a completion declaration. The authoritative development
history and acceptance rules remain in the [active plan](agent-visual-parity-20261018.md).

**R19 engineering validation passes**, including the reviewed one-shot local
camera measurement command, actionable bevel diagnostics and installed-package
smoke. The full suite passes **5,158 tests in 701 files**; 65 Dawn tests, packed
Dawn rendering and 1,200 memory-check frames also pass. The [R19 validation and workflow section](#round-19-reviewed-measurement-workflow-and-validation)
links source, reviews and exact receipts. The CPU usability pilot is complete:
all three routes pass mechanical measurement checks, but **full operational
acceptance is not established for any route** because each explanation omits a
required partial-bounds limitation. The supplied script and CLI tie on retained
workflow evidence. This is one author per route; no author-time gain is
established. R19 visual qualification and H2 remain unstarted. No new commit/push
or parity closure is claimed by this update.

**Round 18 authoring is complete; both visual gates fail.** Canal Aperture
scores **6.9975** against vGPU **7.47**, with composition **0.85**, shape **0.40**
and lighting **0.50** deficits. Courtyard Aperture scores **7.1475** against
Three.js **7.1925**, with lighting deficit **0.30**. Neither judge reports a major
Aperture artifact, but the mean/category failures still prevent qualification.
First-useful timing passes; finish timing fails by **1.2089076 s**, with no
rounding waiver. Independent technical review passes with bounded findings,
including an authored vGPU cleanup violation. All six final apps
match their last successful captured source; **223 frozen files** and **1,259
JavaScript runtime files** matched before this update. Both required Aperture
final browser comparisons pass. The [R18 scene and evidence index](#round-18-completed-authoring-and-validation)
links every final and the exact judgments. R17 stays interrupted/ineligible; H2
remains untouched. The parity goal and full private evidence publication stay open.

**The preceding completed qualification was round 16, at committed/pushed checkpoint
`5e981e2a4bc56ec21e8c5828bcdac79aa12ba9ea`. Combined qualification failed only
on finish time.** Both subjects pass visual gates and first-useful-image time
passes. Finish is **1160.305351 s** versus vGPU **997.864978 s**, ratio
**1.1627879288093423**, above the unchanged **1.10** limit. The allowed finish is
**1097.6514758 s**; the miss is **62.6538752 s**.
All six finals are technically valid with limitations; all **199 frozen files**,
**1,253 built runtime files** and final source sets match. All 36 calls remain:
**35 successes and one failed Aperture CPU preflight**. Both Aperture final browser
proofs pass, courtyard vGPU is exact, and canal vGPU's permitted native-only route
has no optional browser proof. Cleanup passes. Rail-halt remains untouched and
undispatched.

The generic ECS assembly starter and resolved-light diagnostics are reviewed,
validated and committed in R14 checkpoint `488fe04`: **4,968 tests in 692 files**, **65
native Dawn tests**, packed-package Dawn rendering, memory checks and native/browser
controls passed. Both Aperture authors used local groups early; their adoption
does not establish an author-time gain. Round 15's atomic resolved local camera
probes, opt-in coplanar geometry review and timestamp compatibility repair are
committed and pushed in `88fc655`.
Independent camera, coplanar and timestamp reviews are accepted within their
bounded scopes. [R15 engineering validation](../../benchmarks/visual-parity-20261018/evidence/round15-validation/checkpoint-validation.json)
passes: **5,046 tests in 696 files**, **65 Dawn tests**, packed-package Dawn
rendering and **1,200-frame memory checks**. Focused CPU evidence, a rebuilt
coplanar control and the corrected browser timestamp smoke also pass.
The six-call native timestamp control fails exact pixel equality. A separate
three-call pre-repair untimed control reproduces the same two RGBA hashes,
showing that the variation predates the repair; both exact gates remain failed.
R16's guide/generated-starter follow-up uses existing finite CPU transport and
camera fitting. Main CPU controls, independent exact snippets, the full repository
check (**5,046 tests / 696 files**), preflight and exact starter browser/native
pixels passed before its committed/pushed checkpoint. Both Aperture authors later
reported choosing other workflows without using the finite inspection route.
R16 establishes neither benefit nor failure of that unexercised route, and no
speed improvement. R17 sphere diagnostics, offline selected-vertex bounds and
request-local shadow resource reuse are independently reviewed and validated.
The projected-bounds review found and corrected a tied-extremum witness defect;
74 focused tests, 21 independent cases and the actual installed CLI smoke pass.
The full check passes **5,127 tests in 700 files**. Build, **65 native Dawn tests**,
packed Dawn rendering and **1,200-frame memory checks** also pass. The first full
check failed on two new test-code typing issues; their correction and the passing
rerun remain separately retained. No product runtime changed between those checks.
These changes are committed and pushed in **`6b962dc2cff7c15dba42e3fa5a43739a78c87777`**;
the [commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-commit.json)
records the identical remote commit and all 34 staged files. **Round 17 was
interrupted by a shared native-service outage and is ineligible for qualification.**
Its retained images and forced finish records establish no completed-round visual,
timing or technical pass. The [interruption and scene index](#round-17-interruption-and-retained-scenes)
below retains all six lanes and every attempt. H2 rail-halt remains untouched.
The immutable asset-sharing control completed all **18 native renders** with
zero rendering failures, but **both primary exact-output and secondary pixel
bounds failed**. Timing did not improve consistently. No automatic asset
deduplication is proposed, and no output-equivalence, speedup or author-finish
claim follows. The original failed gates remain retained without retry.
The [R17 harness](../../benchmarks/visual-parity-round17-20261018/README.md)
passed preflight and released all six fresh authors at **12:49:39.081265 UTC**.
The native service disappeared during the shared authoring window; all authors
stopped by **13:06:49.948 UTC**, before the original 13:14:39.081265 deadline.
All **27 calls (22 successes, five failures)** remain retained. Two failures
are author errors; three are service-fetch failures. The underlying outage cause
is unresolved. Required final browser proofs and independent judging were not
completed. This interrupted attempt cannot release rail-halt.

Round 15's finish failure, round 14's canal/finish failure, round 13's courtyard/finish failure, round 12's
historical qualification followed by the failed fuel-stop transfer, and all
earlier failures remain retained.
The live gallery now covers round 14 and fuel-stop; downloadable source/evidence
archives cover only through round 3. Its hosted `HANDOFF.md` predates the local
completed-R14 update and all subsequent R15–R18 handoff revisions. This document indexes both concept batches while keeping
those coverage and completion gaps explicit.

Read [the evidence guide](../../benchmarks/visual-parity-20261018/EVIDENCE_GUIDE.md)
before replaying files. Fresh benchmark authors must not read this handoff or the
historical trials: their frozen assignment restricts them to public framework
material and their own newly assigned reference.

## Validated follow-up checkpoint

Checkpoint `2c500eb` adds staged guidance, pixel-to-plane camera placement and
the reusable profile shape sheet. It passed independent reviews, native/browser
controls, 36 actual installed camera-command cases, and the full repository check:
**4,943 tests in 691 files**. The exact receipts are indexed in
[checkpoint validation](../../benchmarks/visual-parity-20261018/evidence/round13-validation/checkpoint-validation.json),
[camera review](../../benchmarks/visual-parity-20261018/evidence/round13-unproject-review.md),
[shape review](../../benchmarks/visual-parity-20261018/evidence/round13-shape-review.md),
[placement control](../../benchmarks/visual-parity-20261018/evidence/round13-placement-control/README.md),
and [profile visual controls](../../benchmarks/visual-parity-20261018/evidence/round13-profile-controls/VISUAL_OBSERVATIONS.md).
The [round-13 freeze](../../benchmarks/visual-parity-round13-20261018/evidence/round13-freeze.json)
records this exact committed source. Its fresh author round is complete, with
[round report](../../benchmarks/visual-parity-round13-20261018/REPORT.md),
[qualification record](../../benchmarks/visual-parity-round13-20261018/QUALIFICATION.md),
[raw judgments](../../benchmarks/visual-parity-round13-20261018/judging),
[recomputed qualification](../../benchmarks/visual-parity-round13-20261018/recomputed-summary.json)
and a [technical audit](../../benchmarks/visual-parity-round13-20261018/judging/technical-audit.md).
Engineering validation passed; the combined authoring gates failed. Neither the
controls nor the faster first useful image establish causal author savings.

## Round 14 engineering validation

The [checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-validation.json)
links the full check and native/package/memory results with exact validated source
hashes. The [commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-commit.json)
records `488fe0497318208c360433528e9dd0c6bbd42d87` and the identical verified remote
commit. Product/tests/guides matched validation; only plan/handoff status and links
changed before that commit. This is engineering evidence for R14, not validation
of the subsequent R15 work.

[Native controls](../../benchmarks/visual-parity-20261018/evidence/round14-authoring-controls/README.md)
verify starter preservation and isolate a key-direction intervention. The retained
exact comparison to the older courtyard native image failed by at most one RGB
value. An [independent old/current runtime replay](../../benchmarks/visual-parity-20261018/evidence/round14-runtime-replay/findings.md)
then produced four byte-identical PNGs from the same frozen bundle, also matching
the historical browser image. This isolates the report-code change under matching
fresh-session conditions; the historical session difference remains unexplained
and the failed assertion remains unchanged. The direction control demonstrates a
lighting tradeoff, not a benchmark win or a universal lighting default.

The [service preflight](../../benchmarks/visual-parity-round14-20261018/evidence/service-preflight.json)
passed native routes, verified browser recovery and profile cleanup. The
[new starter browser/native control](../../benchmarks/visual-parity-round14-20261018/evidence/starter-browser-native-control.json)
is pixel-identical. The completed [round-14 report](../../benchmarks/visual-parity-round14-20261018/REPORT.md),
[qualification](../../benchmarks/visual-parity-round14-20261018/QUALIFICATION.md),
[final summary](../../benchmarks/visual-parity-round14-20261018/final-summary.json)
and [coordinator findings](../../benchmarks/visual-parity-round14-20261018/coordinator-findings.md)
retain the failed canal/finish qualification. The untouched transfer remains open.

## Workspace and implementation status

The working branch is `codex/dawn-shader-polygon-authoring`, with reviewed/pushed
R17 checkpoint **`6b962dc2cff7c15dba42e3fa5a43739a78c87777`**. The
[R17 commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-commit.json)
records identical local/remote commits, all 34 staged files matching the commit
and a clean product worktree at that checkpoint. Sphere diagnostics,
request-local shadow resource reuse and offline projected bounds, including the
corrected tied witness, have independent review and full engineering validation.
The ensuing R17 author round was interrupted by infrastructure and cannot qualify.
Its final freeze check matched all 219 frozen files, 1,259 runtime files and six
last-success app source sets before this status update.

R16 checkpoint `5e981e2a4bc56ec21e8c5828bcdac79aa12ba9ea` remains retained:
both visuals/first-useful passed, finish failed,
and that round's service cleanup passed. R15's camera/coplanar/timestamp checkpoint
and both native exact-repeatability failures remain separate history. The
immutable asset-sharing experiment completed its fixed 18 native calls on the
unchanged R16 runtime and failed both output gates; its independent evidence
audit and lossless archive verification pass. It establishes no shippable
asset-sharing optimization. R18 subsequently completed authoring on the same engine and failed both visual
gates and finish time. A passing complete qualification and the held-out transfer
remain open; the complete plan stays active.
Inspect `git status --short` before
continuing: benchmark evidence is largely untracked. Its presence on disk does
not mean it is in Git or in a published archive. Preserve that work; use a separate checkout for a
historical replay rather than resetting this branch.

| Checkpoint | What it contains                                                                                                        | Status at draft                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a4cef30`  | Direct Dawn rendering, shader workflows, portable capture work, AO repair and polygon authoring from the earlier batch  | Committed; see [earlier implementation record](shader-gpu-and-dawn-node-rendering.md#implementation-checklist-and-evidence) and garden/car follow-ups below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `cbcb6e7`  | Retained garden, street and car comparisons; original harbor baseline                                                   | Committed baseline; harbor evidence has its own separate publication/source status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `0e1f31f`  | Scene reflections, fatal-capture feedback, environment controls, diorama starter, loft/bevel/path/icosphere workflows   | Committed; accumulated changes qualified by the round-6 checkpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `6c26db7`  | Fitted roof and branch-foliage recipes                                                                                  | Committed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `4c3b280`  | Oval foliage and portable surface variation                                                                             | Committed; round-8 checkpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `5cda7bd`  | Tight MSAA reflection masks, single-sample SSAO compatibility and cheaper surface recipe                                | Committed; round-9 checkpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `d1622f2`  | Unsupported torus option diagnostics                                                                                    | Committed; round-10 checkpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `588296b`  | Fitted profile example and roof-verge grid control                                                                      | Committed; round-11 checkpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `0239f77`  | CPU camera projection and bounded fitting                                                                               | Committed/pushed checkpoint recorded by round 12 and first held-out freeze receipts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `2c500eb`  | Staged workflow/DIORAMA prose; `camera unproject`; profile shape-sheet helper/docs/tests                                | Reviewed, validated, committed and pushed. [CLI guide changeset](../../.changeset/staged-diorama-guidance.md), [camera changeset](../../.changeset/camera-pixel-plane-placement.md), [round-13 freeze](../../benchmarks/visual-parity-round13-20261018/evidence/round13-freeze.json). Round 13 failed the combined courtyard/finish gates.                                                                                                                                                                                                                                                                                                                                                                       |
| `488fe04`  | Generic ECS assembly starter and informational resolved light direction diagnostics                                     | Reviewed, fully validated, committed and pushed; [commit receipt](../../benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-commit.json). R14 completed and failed canal visual/finish gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `88fc655`  | Atomic resolved local camera probes, opt-in coplanar geometry review and modern pass-descriptor timestamp compatibility | Independent reviews, full repository checks (5,046 tests / 696 files), 65 Dawn tests, packed Dawn, memory checks and bounded controls pass. Native exact-pixel controls fail; pre-repair untimed variation is reproduced. Committed and pushed; service preflight passed. R15 completes with both visuals/first-useful passing and finish failing. [Camera guide](../CAMERA_LOCAL_INSPECTION.md), [coplanar guide](../COPLANAR_OVERLAP_INSPECTION.md); original [camera proposal](../../benchmarks/visual-parity-20261018/evidence/round15-camera-workflow-proposal.md) and [coplanar proposal](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-inspection-proposal.md) retain design history. |
| `5e981e2`  | Finite CPU camera route and explicit projection-comparison discoverability in four guides/generated DIORAMA prose       | Reviewed, fully checked (5,046 tests / 696 files), committed and pushed. No runtime/API/solver/renderer change. R16 completes with both visuals/first-useful passing and finish failing; both Aperture authors report not using the finite route. [Checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round16-validation/checkpoint-commit.json).                                                                                                                                                                                                                                                                                                                                              |
| `6b962dc`  | Sphere option diagnostics, offline selected projected-vertex bounds and request-local shadow resource reuse             | Independently reviewed, full check passes 5,127 tests / 700 files, 65 Dawn tests, packed Dawn and 1,200-frame memory checks; committed and pushed. [Checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-commit.json). R17 author round interrupted by infrastructure, all results provisional and ineligible for qualification. R18 completed on the same engine and fails both visual gates and finish time.                                                                                                                                                                                                                                                     |

The [earlier shader/Dawn proposal](shader-gpu-and-dawn-node-rendering.md) is a
completed engineering workstream with explicit supported/unsupported boundaries.
The [current parity plan](agent-visual-parity-20261018.md) is still active. Passing
engineering checks does not substitute for its independent authoring gates.

## Scene and reference index

These are distinct concepts and evidence types. Coordinator repairs and controlled
replays do not replace the original author result or provide new authoring times.

| Concept                                                                     | Reference, authored source and report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Follow-up / reusable result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chinese garden: pavilion, jade pond, curved bridge, moon gate and planting  | [Reference](../../benchmarks/chinese-garden-20261017/reference/garden.png), [all author sources](../../benchmarks/chinese-garden-20261017/authors), [report](../../benchmarks/chinese-garden-20261017/REPORT.md), [protocol](../../benchmarks/chinese-garden-20261017/PROTOCOL.md)                                                                                                                                                                                                                                                                                                                                                                                                                              | [AO/cadence diagnosis](../../benchmarks/chinese-garden-20261017/diagnostics/REPORT.md), [exact-frame capture and Dawn measurements](../../benchmarks/chinese-garden-20261017/followup/REPORT.md), [retained replay scene](../../benchmarks/chinese-garden-20261017/followup/garden).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Street corner: cafe/bookshop, awnings, two cars, furnishings and trees      | [Reference](../../benchmarks/street-corner-20261017/reference/street.png), [all author sources](../../benchmarks/street-corner-20261017/authors), [report](../../benchmarks/street-corner-20261017/REPORT.md), [follow-up plan](../../benchmarks/street-corner-20261017/FOLLOW_UP_PLAN.md)                                                                                                                                                                                                                                                                                                                                                                                                                      | [Strict Dawn parity](../../benchmarks/street-corner-20261017/evidence/dawn-verification/summary.json); exposed delayed fatal feedback, color/transform friction and fitted-car construction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Fitted procedural car and revised street                                    | [Controlled comparison report](../../benchmarks/car-construction-20261017/REPORT.md), [before/after/side/rear apps](../../benchmarks/car-construction-20261017/apps), [validation](../../benchmarks/car-construction-20261017/evidence/validation.json)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | [Reusable car source](../../examples/procedural-car/src/car.ts), [polygon authoring](../POLYGON_SURFACE_AUTHORING.md). Shared glass/body boundaries; separate wheel/mirror/lamp parts. Construction follow-up, not a new scored trial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Harbor: shaped boat, waterfront architecture, water and planting            | [Original reference](../../benchmarks/harbor-20261017/reference/harbor.png), [frozen authors](../../benchmarks/harbor-20261017/authors), [original report](../../benchmarks/harbor-20261017/REPORT.md), [reproduction README](../../benchmarks/harbor-20261017/README.md)                                                                                                                                                                                                                                                                                                                                                                                                                                       | [All coordinator repairs/controls](../../benchmarks/visual-parity-20261018/harbor), [repair 11](../../benchmarks/visual-parity-20261018/harbor/repair-round11), [four-judge paired confirmation](../../benchmarks/visual-parity-20261018/judging/harbor-round11/assessment.json). Original absolute-score failure remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Canal-side workshop, fitted vehicle/boat and reflective water               | [Reference](../../benchmarks/visual-parity-20261018/reference/canal.png), [round-12 Aperture app](../../benchmarks/visual-parity-round12-20261018/trials/canal-aperture/app), [all round-12 trials](../../benchmarks/visual-parity-round12-20261018/trials), [round-12 report](../../benchmarks/visual-parity-round12-20261018/REPORT.md), [round-13 Aperture app](../../benchmarks/visual-parity-round13-20261018/trials/canal-aperture/app), [all round-13 trials](../../benchmarks/visual-parity-round13-20261018/trials), [round-14 Aperture app](../../benchmarks/visual-parity-round14-20261018/trials/canal-aperture/app), [all round-14 trials](../../benchmarks/visual-parity-round14-20261018/trials) | Repeated qualification subject across rounds 1–18, with R17 interrupted; section geometry, roof courses, vehicle profiles and camera checks. R13's canal gate passes; R14 fails composition, lighting and finish. [R14 canal diagnosis](../../benchmarks/visual-parity-20261018/evidence/round14-canal-diagnosis/README.md) retains independent geometry/light/tint controls. R15 visual gate passes; [R15 Aperture app](../../benchmarks/visual-parity-round15-20261018/trials/canal-aperture/app) and [all R15 trials](../../benchmarks/visual-parity-round15-20261018/trials) are retained. R16 visual gate also passes; [R16 Aperture app](../../benchmarks/visual-parity-round16-20261018/trials/canal-aperture/app) and [all R16 trials](../../benchmarks/visual-parity-round16-20261018/trials) are retained. Every prior outcome remains indexed below. |
| Courtyard/fountain: curved architecture, roof, foliage and reflective basin | [Reference](../../benchmarks/visual-parity-20261018/reference/courtyard.png), [round-12 Aperture app](../../benchmarks/visual-parity-round12-20261018/trials/courtyard-aperture/app), [round-12 judgments](../../benchmarks/visual-parity-round12-20261018/judging), [round-13 Aperture app](../../benchmarks/visual-parity-round13-20261018/trials/courtyard-aperture/app), [round-13 judgments](../../benchmarks/visual-parity-round13-20261018/judging), [round-14 Aperture app](../../benchmarks/visual-parity-round14-20261018/trials/courtyard-aperture/app), [round-14 judgments](../../benchmarks/visual-parity-round14-20261018/judging)                                                               | Repeated qualification subject; branch/oval foliage, controlled lighting, MSAA reflection mask and single-sample SSAO controls. R13 fails lighting despite a higher overall mean; R14 passes all courtyard visual gates. Those outcomes cannot be combined with another round’s timing or canal result. [R15 Aperture app](../../benchmarks/visual-parity-round15-20261018/trials/courtyard-aperture/app); R15/R16 visual gates pass; [R16 Aperture app](../../benchmarks/visual-parity-round16-20261018/trials/courtyard-aperture/app).                                                                                                                                                                                                                                                                                                                        |
| Rural fuel stop: shop, pump canopy, pickup and puddle                       | [Reference](../../benchmarks/visual-parity-heldout-20261018/reference/fuel-stop.png), [all trials](../../benchmarks/visual-parity-heldout-20261018/trials), [report](../../benchmarks/visual-parity-heldout-20261018/REPORT.md), [protocol](../../benchmarks/visual-parity-heldout-20261018/shared/PROTOCOL.md)                                                                                                                                                                                                                                                                                                                                                                                                 | First transfer **failed**; [startup diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-startup-diagnosis.md), [shape diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-shape-diagnosis.md), [retrospective author accounts](../../benchmarks/visual-parity-heldout-20261018/evidence/startup-author-testimony.md). Now exposed, never call it unused again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| New rail-halt transfer, both reference generations                          | [Selected simplified reference](../../benchmarks/visual-parity-heldout2-20261018/reference/rail-halt.png), [rejected over-detailed generation](../../benchmarks/visual-parity-heldout2-20261018/evidence/reference-generation-overdetailed.png), [preparation/selection receipt](../../benchmarks/visual-parity-heldout2-20261018/evidence/preparation.json)                                                                                                                                                                                                                                                                                                                                                    | **Unused by authors/judges; undispatched.** The coordinator saw both for setup. One simplification edit was selected before qualification/authoring/judging because the original was too detailed/photoreal. Both generations are retained; the receipt records the selected hash and confirms that no benchmark outcome informed selection. No trial result exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Generic profile shape sheet: delivery vehicle and instrument housing        | [Study guide](../../examples/fitted-props/SHAPES.md), [caller-owned study data/system](../../examples/fitted-props/src/shape-sheet.ts), [shared profile helper](../../examples/fitted-props/src/profile-shell.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Committed and validated in `2c500eb`. Boxy/shaped forms share outer envelopes, panes, wheels and materials; evaluates sections and silhouette, not a fuel-stop finished asset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Reusable engineering concept index

Public application state remains ECS-owned; rendering consumes extracted snapshots.
The shader-first API is a separate explicit GPU-program entry point. Neither path
introduces a second mutable scene graph into an ECS app.

| Concept and boundary                                                                                                                                 | Source / documentation / example                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Tests and retained evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Direct Dawn Node route**, independent of vGPU                                                                                                      | [Device adapter](../../packages/adapter-node/src/device.ts), [offscreen output](../../packages/adapter-node/src/offscreen.ts), [CLI driver](../../packages/cli/src/render/dawn-driver.ts), [worker](../../packages/cli/src/render/dawn-worker.ts), [runbook](../DAWN_NODE_RENDERING.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [Native tests](../../scripts/native-webgpu.node-test.mjs), [memory check](../../scripts/check-dawn-memory.mjs), [earlier validation record](shader-gpu-and-dawn-node-rendering.md#final-verification-record), [local raw logs](../../.aperture-env/dawn-evidence). vGPU is a benchmark peer, not an Aperture engine dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **WGSL authoring and shader-first GPU programs**: artifacts, imports, source maps, layouts, compute/draw/history/MRT, replacement and data-only jobs | [Compiler](../../packages/shader/src/compiler.ts), [GPU context](../../packages/gpu/src/context.ts), [shader jobs](../../packages/shader/src/shader-job.ts), [tutorial](../SHADER_FIRST.md), [workbench](../../examples/shader-workbench/programs.mjs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [Compiler tests](../../test/shader/compiler.test.ts), [job tests](../../test/shader/shader-job.test.ts), [native standalone tests](../../scripts/standalone-gpu.node-test.mjs), [shader parity runner](../../scripts/shader-browser-parity.mjs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WGSL standard-material extensions** preserve lighting/shadows; custom material boundaries remain explicit                                          | [Material tutorial](../SHADER_MATERIALS.md), [extension shader integration](../../packages/webgpu/src/materials/standard/standard-shader-extension-sampling.ts), [worker-authored example](../../examples/material-shaders)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [Native material tests](../../scripts/material-extension.node-test.mjs), [earlier supported-material limits](shader-gpu-and-dawn-node-rendering.md#supported-material-boundary), [material parity evidence](../../.aperture-env/dawn-evidence/material-parity-final).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Portable bundles, strict preflight and exact-frame capture**: one scene for browser/Node, hold through readback, restored cadence                  | [Bundle facade](../../packages/app/src/render-bundle.ts), [strict extraction](../../packages/cli/src/headless/bundle.ts), [capture controller](../../packages/app/src/browser/capture.ts), [still-image guide](../PROCEDURAL_STILL_IMAGES.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [Bundle tests](../../test/cli/headless-bundle.test.ts), [capture tests](../../test/app/browser-capture.test.ts), [garden follow-up](../../benchmarks/chinese-garden-20261017/followup/REPORT.md). Includes SSAO serialization and platform base64 decoding with fallback; retained stage timing does not imply total author speedup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Fatal worker/capture feedback** and authored geometry call sites                                                                                   | [Simulation worker](../../packages/runtime/src/simulation-worker.ts), [browser capture](../../packages/app/src/browser/capture.ts), [workflow](../AGENT_VISUAL_WORKFLOW.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [Capture regression tests](../../test/app/browser-capture.test.ts), [live acceptance](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/live/acceptance.json), [preflight times](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/portable-preflight-timings.json), [authored callsite](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/authored-callsite.txt). Original malformed capture remains recorded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **AO silhouette repair and static capture cadence**                                                                                                  | [SSAO implementation](../../packages/webgpu/src/post/post-ssao.ts), [still-image guidance](../PROCEDURAL_STILL_IMAGES.md), [garden diagnosis](../../benchmarks/chinese-garden-20261017/diagnostics/REPORT.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [Native depth tests](../../scripts/ssao-depth.node-test.mjs), [garden timing control](../../benchmarks/chinese-garden-20261017/diagnostics/timing/summary.json). Nearest real depth, camera projection and discontinuity-aware sampling; AO stays enabled. Demand-cadence result is screenshot workflow wall time on this software GPU.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Environment intensity/color and controlled key/fill lighting**                                                                                     | [IBL sampling](../../packages/webgpu/src/materials/standard/standard-shader-ibl-sampling.ts), [visual defaults](../VISUAL_QUALITY.md), [lighting reference](../AGENT_VISUAL_REFINEMENT.md#3-get-depth-from-lighting-then-add-surface-effects), [PCSS](../SINGLE_MAP_PCSS.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | [Harbor ablations](../../benchmarks/visual-parity-20261018/harbor/controls), [lighting GPU evidence](../../benchmarks/visual-parity-20261018/evidence/lighting-gpu), [round-10 key/fill control](../../benchmarks/visual-parity-20261018/evidence/round10-lighting-control). Wrong key direction is not fixed by brighter fill; fixed-scene controls are separate from scored images.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Planar scene reflections**, tint and ripple frequency                                                                                              | [Options](../../packages/render/src/rendering/planar-reflection-options.ts), [mirrored view](../../packages/webgpu/src/app/planar-reflection-view.ts), [pass/lifetime](../../packages/webgpu/src/app/planar-reflection.ts), [example](../../examples/planar-reflections/README.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [Facade tests](../../test/app/planar-reflection.test.ts), [native reflections](../../scripts/planar-reflection.node-test.mjs), [tint control](../../benchmarks/visual-parity-20261018/evidence/reflection-tint-canal), [ripple control](../../benchmarks/visual-parity-20261018/evidence/reflection-ripple-control). One horizontal plane/full-output camera; receiver matching and offscreen-object retention matter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Tight MSAA reflection masks and single-sample SSAO compatibility**                                                                                 | [Reflection composite](../../packages/webgpu/src/app/planar-reflection-shader.ts), [SSAO](../../packages/webgpu/src/post/post-ssao.ts), [sky pipelines](../../packages/webgpu/src/render/skybox), [documented memory/edge limits](../../examples/planar-reflections/README.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [Mask control](../../benchmarks/visual-parity-20261018/evidence/round8-reflection-mask-control), [single-sample fix evidence](../../benchmarks/visual-parity-20261018/evidence/ssao-single-sample-fix), [native reflection tests](../../scripts/planar-reflection.node-test.mjs), [native SSAO tests](../../scripts/ssao-depth.node-test.mjs). 4x reflection composite adds about 33 MiB at 1200×900; mixed edges are coverage-weighted, not exact per-sample color preservation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Polygons, fitted openings and corresponding section lofts**                                                                                        | [Polygon factory](../../packages/render/src/mesh/primitives-polygons.ts), [loft](../../packages/render/src/mesh/loft.ts), [polygon guide](../POLYGON_SURFACE_AUTHORING.md), [profile guide](../FITTED_PROP_PROFILES.md), [panel helpers](../../examples/fitted-props/src/panels.ts), [two-prop example](../../examples/fitted-props/README.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [Polygons](../../test/mesh/polygons.test.ts), [lofts](../../test/mesh/loft.test.ts), [fitted car](../../test/mesh/fitted-car.test.ts), [fitted props](../../test/mesh/fitted-props.test.ts), [round-11 multi-view proof](../../benchmarks/visual-parity-20261018/evidence/round11-fitted-proof). Shared pane boundaries, outward normals and intended closedness do not establish arbitrary reference fidelity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Connected tubes, endpoint extrusions, bevels and icospheres**                                                                                      | [Tube](../../packages/render/src/mesh/tube.ts), [extrude-between](../../packages/render/src/mesh/extrude-between.ts), [beveled box](../../packages/render/src/mesh/beveled-box.ts), [icosphere](../../packages/render/src/mesh/icosphere.ts), [connected-parts recipes](../CONNECTED_PARTS.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [Path solids](../../test/mesh/path-solids.test.ts), [bevel tests](../../test/mesh/beveled-box.test.ts), [icosphere tests](../../test/mesh/icosphere.test.ts), [path controls](../../benchmarks/visual-parity-20261018/evidence/path-controls), [icosphere receipt](../../benchmarks/visual-parity-20261018/evidence/icosphere-tests.txt). General primitives; dimensions and assembly remain caller-owned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Roof courses/caps and exposed-verge grid fitting**                                                                                                 | [Recipe](../../examples/planar-reflections/src/roof.ts), [guide](../../examples/planar-reflections/ROOF.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [Geometry tests](../../test/mesh/roof-recipe.test.ts), [roof control](../../benchmarks/visual-parity-20261018/evidence/roof-authoring-control), [grid-only control](../../benchmarks/visual-parity-20261018/evidence/round10-roof-control), [review](../../benchmarks/visual-parity-20261018/evidence/round11-roof-review.md). Clipping alone does not guarantee a visually low verge; preserve roof planes and fit pitch/offset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Seeded foliage, branch pairs and oval profiles**                                                                                                   | [Recipe](../../examples/planar-reflections/src/foliage.ts), [guide](../../examples/planar-reflections/FOLIAGE.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [Branch tests](../../test/mesh/branch-foliage-recipe.test.ts), [oval tests](../../test/mesh/foliage-oval-recipe.test.ts), [winding control](../../benchmarks/visual-parity-20261018/evidence/round4-leaf-winding-control), [branch control](../../benchmarks/visual-parity-20261018/evidence/branch-foliage-control), [oval control](../../benchmarks/visual-parity-20261018/evidence/oval-foliage-control). Choose crown/leaf granularity from the subject; more leaves cannot fix the wrong profile or branching silhouette.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Selective portable surface variation**                                                                                                             | [WGSL](../../examples/planar-reflections/surface-variation.wgsl), [guide](../../examples/planar-reflections/SURFACES.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [Visual control](../../benchmarks/visual-parity-20261018/evidence/surface-variation-control), [all cost-control attempts](../../benchmarks/visual-parity-20261018/evidence/round8-surface-cost-control). Tetrahedral hash replaces the costlier 27-neighbor pattern; preserve PBR and use on broad selected surfaces. Reported fixed-scene saving is not author-time causality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Torus option feedback**                                                                                                                            | [Primitive contracts](../AGENT_VISUAL_REFINEMENT.md#2-use-fitted-surfaces-and-corresponding-sections), [independent feedback review](../../benchmarks/visual-parity-20261018/evidence/round9-torus-feedback-review.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [Frozen round-9 report](../../benchmarks/visual-parity-round9-20261018/REPORT.md), [round-10 validation](../../benchmarks/visual-parity-20261018/evidence/round10-validation). Unsupported own option names now fail instead of silently selecting defaults; accepted geometry bytes remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Diorama starter and staged reading**                                                                                                               | [Template](../../packages/cli/src/create/templates/diorama.ts), [short first-image guide](../AGENT_VISUAL_WORKFLOW.md), [full refinement reference](../AGENT_VISUAL_REFINEMENT.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [Template/create tests](../../test/cli/create.test.ts), [strict native extraction test](../../test/cli/diorama-authoring-native.test.ts), [starter parity](../../benchmarks/visual-parity-20261018/evidence/starter-parity), [startup diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-startup-diagnosis.md). At `2c500eb`, the front door is 76 lines/4,852 bytes; advanced sections are retained. That staged-guidance change altered DIORAMA prose only, preserving generated geometry/config/shader. This is structural reduction, not measured time saved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **CPU camera project/fit**                                                                                                                           | [Solver/projection](../../packages/cli/src/camera/landmarks.ts), [engine cross-check](../../packages/cli/src/camera/engine-projection.ts), [guide](../CAMERA_LANDMARKS.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [Tests](../../test/cli/camera-landmarks.test.ts), [independent review](../../benchmarks/visual-parity-20261018/evidence/round12-camera-review.md), [fixed-geometry controls](../../benchmarks/visual-parity-20261018/evidence/round12-camera-control/RESULT.md), [installed-package check](../../benchmarks/visual-parity-20261018/evidence/round12-packed-camera). Convergence, conditioning and pixel tolerance are separate; a camera fit does not repair geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **CPU pixel-to-plane unproject** — committed in `2c500eb`                                                                                            | [Implementation](../../packages/cli/src/camera/unproject.ts), [CLI integration](../../packages/cli/src/commands/camera.ts), [contract](../CAMERA_LANDMARKS.md#pixel-to-plane-placement)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [Tests](../../test/cli/camera-unproject.test.ts), [changeset](../../.changeset/camera-pixel-plane-placement.md). Explicit plane and camera, rays/intersections/reprojection, diagnostic invalid points; no image reading, depth inference or scene mutation. Independent review, fixed-camera controls and 36 installed CLI cases passed; see the validated checkpoint index above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Profile shape sheet** — committed in `2c500eb`                                                                                                     | [Shape guide](../../examples/fitted-props/SHAPES.md), [pure profile helper](../../examples/fitted-props/src/profile-shell.ts), [study system](../../examples/fitted-props/src/shape-sheet.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [Shape-sheet tests](../../test/mesh/profile-shape-sheet.test.ts), [shape diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-shape-diagnosis.md). Fitted surface roles and same-envelope silhouette variants; ten native controls, two browser controls and full validation passed; see the validated checkpoint index above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Named local assemblies in the diorama starter** — committed in `488fe04`                                                                           | [Template](../../packages/cli/src/create/templates/diorama.ts), [native authoring tests](../../test/cli/diorama-authoring-native.test.ts), [changeset](../../.changeset/diorama-local-assemblies.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [Independent review](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-review.md), [exact preservation evidence](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-review.json), [contact control](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-contact-control.mjs), [results](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-contact-control.json). Existing ECS groups and parent/local transforms; all six original Float32 mesh world matrices, assets, camera and lights match. Five contact poses pass with maximum separation 1.1921e-7 units. Focused and full/native validation passed; starter pixels are unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Resolved directional-light geometry and split health cache** — committed in `488fe04`                                                              | [Geometry helper](../../packages/render/src/rendering/lighting-direction-evidence.ts), [health analyzer](../../packages/render/src/rendering/lighting-health.ts), [renderer integration](../../packages/webgpu/src/app/create-webgpu-app.ts), [guide](../LIGHTING_DIRECTION_EVIDENCE.md), [tests](../../test/rendering/lighting-direction-evidence.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [Independent review](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.md), [review results](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.json), [retained controls](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.control.mjs). Informational resolved direction/elevation/camera-plane shadow evidence; ordinary warnings and rendering settings remain unchanged. Moving-camera material rescans and a paired-sign hash collision were reproduced and fixed before release. Full/native validation passed; isolated old/current pixels match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Atomic resolved local camera probes** — committed in `88fc655`                                                                                     | [Guide](../CAMERA_LOCAL_INSPECTION.md), [app operation](../../packages/app/src/camera-local/inspect.ts), [camera facade](../../packages/app/src/systems/cameras.ts), [tool schema](../../packages/cli/src/tools/camera-local-schema.ts), [app tests](../../test/app/camera-local-inspection.test.ts), [tool tests](../../test/cli/camera-local-inspection-tools.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `CameraHandle.inspectLocal` / `camera_inspect_local` resolve selected ECS camera/subjects together without stepping user systems, then project caller-owned local points, oriented triangles and static source-mesh bounds. Reports clipping/facing/residuals and provenance; optional fit-seed export has stricter compatibility/precision guards. No automatic composition score. [Independent review](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/findings.md) found no remaining blocker; [final implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round15-camera-local-validation.md) retains 81 passing CPU tests; the [final overflow-guard review](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/frozen-addendum.md) passes 40/40. Full engineering validation passes and the change is committed in `88fc655`; the subsequent R15 finish gate fails.                                                                                                                                                                                                                  |
| **Opt-in coplanar geometry review** — committed in `88fc655`                                                                                         | [Guide](../COPLANAR_OVERLAP_INSPECTION.md), [render inspector](../../packages/render/src/rendering/coplanar-overlap-inspection.ts), [geometry predicates](../../packages/render/src/rendering/coplanar-overlap-geometry.ts), [offline CLI](../../packages/cli/src/commands/inspect.ts), [geometry tests](../../test/rendering/coplanar-overlap-inspection.test.ts), [CLI tests](../../test/cli/coplanar-inspection.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                          | `inspectCoplanarMeshOverlaps` / `aperture inspect coplanar` inspect explicitly selected static bundle draws using actual positions, draw ranges and resolved matrices. Reports positive-area near-coplanar overlap, measurements, bounded witnesses and complete/partial/empty coverage. Visibility remains unknown; view selection filters layers only. No mandatory preflight, per-frame scan, automatic fix or scene rejection. [Independent review](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/review.md) accepts the bounded scope, including 120 analytic cases and four CLI groups; [implementation validation](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/implementer-validation.json) retains 35 focused tests. Full engineering validation passes and the change is committed in `88fc655`; the subsequent R15 finish gate fails. [Rebuilt frozen-R14 control](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-r14-control/report.md) finds 32 door/plinth triangle-pair overlaps in the baseline and zero after the split, with complete selected-draw coverage. |
| **Bounded native capture profiling** — initial control completed                                                                                     | [Completed report](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/README.md), [all results](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/results.json), [retained archive receipt](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/archive-receipt.json), [original proposal](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile-proposal.md)                                                                                                                                                                                                                                                                                                                                                                                   | All 42 renders and 12 idle probes completed in 9.942 s with zero failed samples, identical matched PNG/RGBA, all seven owned groups disposed/exited, no surviving owned process and unchanged 1,240-file dist digest. Tiny idle callbacks and work shifting into readback do not establish a stable optimization or savings on R14 scenes. No synchronization change is justified by this control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Modern pass-descriptor timestamps** — committed in `88fc655`                                                                                       | [Repair receipt](../../benchmarks/visual-parity-20261018/evidence/round15-timestamp-repair/README.md), [independent review](../../benchmarks/visual-parity-20261018/evidence/round15-gpu-timing-review/findings.md), [timestamp helper](../../packages/gpu/src/gpu/gpu-timing.ts), [frame boundary](../../packages/gpu/src/render/frame/frame-boundary.ts), [shadow encoder](../../packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts)                                                                                                                                                                                                                                                                                                                                                                               | Standard pass `timestampWrites` replace obsolete encoder calls. Valid measured zero stays zero; unavailable/invalid samples retain diagnostics, bounded leases release on failures, and main/shadow coverage stays partial. Focused 167/167 and independent 75/75 CPU tests pass. [Browser smoke](../../benchmarks/visual-parity-20261018/evidence/round15-browser-timestamp-smoke/result.md) passes three renders/33 checks; [native exact equality fails](../../benchmarks/visual-parity-20261018/evidence/round15-timestamp-native-validation/README.md), with the same two hashes reproduced by the [pre-repair untimed control](../../benchmarks/visual-parity-20261018/evidence/round15-r14-untimed-repeatability/README.md). No full-frame timing or speed claim.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Finite CPU local-camera workflow and explicit model comparison** — committed in `5e981e2`                                                          | [Proposal](../../benchmarks/visual-parity-20261018/evidence/round16-camera-ergonomics-proposal.md), [existing-route CPU control](../../benchmarks/visual-parity-20261018/evidence/round16-camera-workflow-control/README.md), [local-camera guide](../CAMERA_LOCAL_INSPECTION.md), [fitting guide](../CAMERA_LANDMARKS.md), [generated starter](../../packages/cli/src/create/templates/diorama.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                  | Construction variables supply local probes; an ordinary resource holds a labeled snapshot/request, finite headless transport checks response IDs and nested error envelopes, and separate model jobs use identical observations and explicit settings. Main control: 19 actual CLI subprocesses / 47 requests; own-family fits recover known models, while both near-orthographic candidates pass without an automatic winner. Guides and generated DIORAMA prose only; [exact-snippet review](../../benchmarks/visual-parity-20261018/evidence/round16-workflow-review/recipe-attempt-01/result.json) passes, full repository validation passes 5,046 tests / 696 files; committed/pushed. R16 finish fails, and both Aperture authors report no use of the finite route. No API/solver/renderer change or author-time claim.                                                                                                                                                                                                                                                                                                                            |
| **Sphere option diagnostics** — committed in `6b962dc`, independent review accepted                                                                  | [Implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-validation.json), [independent review](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-review/README.md), [render validator](../../packages/render/src/mesh/sphere-validation.ts), [app boundary](../../packages/app/src/systems/spawn/sphere.ts), [render tests](../../test/mesh/sphere-options.test.ts), [app tests](../../test/app/sphere-spawn.test.ts), [original proposal](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-proposal.md)                                                                                                                                                                                                                                                            | Facade/raw spawn accepts radius/segments; the direct factory accepts label/radius/widthSegments/heightSegments. Unsupported own enumerable string keys now produce boundary-specific actionable errors before geometry publication. All 12 pre-fix buffers and 102 independent accepted-input signatures match; 67 focused and eight independent tests pass. Supported normalization, defaults, smooth normals and geometry remain unchanged. Full repository and native/package validation pass; committed/pushed in `6b962dc`. R17 was interrupted and is ineligible for qualification. No measured author-time gain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Offline selected projected-vertex bounds** — committed in `6b962dc`, fully validated                                                               | [Proposal](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-proposal.md), [independent design contract](../../benchmarks/visual-parity-20261018/evidence/round17-control-design-review.md), [guide](../PROJECTED_BOUNDS_INSPECTION.md), [render helper](../../packages/render/src/rendering/projected-bounds-inspection.ts), [projection policy](../../packages/render/src/rendering/projected-bounds-projection.ts), [render tests](../../test/rendering/projected-bounds-inspection.test.ts), [CLI tests](../../test/cli/projected-bounds-inspection.test.ts), [source review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/REVIEW.md), [installed-smoke review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/INSTALLED_SMOKE_REVIEW.md) | Actual active referenced vertices, explicit view/draw selection and retained matrices yield static envelopes, including degenerate extrema. Partial coverage, a fixed 0.05 px numerical-sensitivity guard and alias protection are explicit; visibility remains unknown. Initial 73 focused tests, 20 independent cases and 35 coplanar regressions pass. Supplemental review found correct numeric bounds but incorrect global first-reference witnesses on ties; the axis-wise correction and regression pass 74 focused tests. Independent re-review accepts all 15 frozen files after a 21st control; full repository validation and actual installed-CLI execution pass. Initial acceptance, reopened finding, red regression and correction remain retained.                                                                                                                                                                                                                                                                                                                                                                                        |
| **Capture-cost attribution and immutable asset reuse** — completed experiment, output gates failed                                                   | [R16 timing/resource diagnosis](../../benchmarks/visual-parity-20261018/evidence/round16-timing-diagnosis.md), [complete-value inventories](../../benchmarks/visual-parity-20261018/evidence/round16-timing-diagnosis.json), [frozen control proposal](../../benchmarks/visual-parity-20261018/evidence/round16-capture-control-proposal.md), [control and retained archives](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control), [independent readiness review](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-review/README.md)                                                                                                                                                                                                                                               | Publicly reconstructed copied bundles preserve per-entity semantics while actual derived planner order changes are recorded. All 18 native calls complete with zero rendering failures on the retained R16 runtime. Exact RGBA fails for every fixture; the secondary one-LSB/0.01-mean-RGB/exact-alpha bound fails overall. Within-condition variation and a courtyard two-LSB cross-condition difference remain unresolved. Timing does not consistently improve; no retry, relaxed gate, equivalence or optimization claim. No automatic asset deduplication is proposed. Static aggregation and persistent app/environment reuse remain separate proposals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Request-local shadow pipeline resource reuse** — committed in `6b962dc`, independently reviewed                                                    | [Implementation](../../packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts), [resource tests](../../test/webgpu/shadow-caster-pipeline-resource.test.ts), [frame-planner tests](../../test/webgpu/shadows/render-shadow-frame.spec.ts), [baseline control](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-control/report.md), [implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-implementation.json), [independent review](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-review.md), [changeset](../../.changeset/tidy-shadow-requests.md)                                                                                                                                                                              | A map scoped to one resource-creation call reuses existing specialization keys before duplicate device requests. The 64 uniform-only-material control changes 65 cold creation calls to two, with 63 reuses and all 65 descriptor-array entries retained; warm creation stays zero. Per-material current/previous uniform buffers, bindings, keys, ordering and partial-failure behavior remain. Forty-eight tests including ten new cases pass. These count injected-device requests, not native compilations or seconds saved. Full repository/native/package validation passes after two test-only typing corrections; committed/pushed in `6b962dc`. R17 was interrupted and cannot qualify.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **One-shot source-owned local camera measurement** — implemented, independently reviewed and fully validated                                         | [Implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command/IMPLEMENTATION.md), [independent review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command-review/REVIEW.md), [command](../../packages/cli/src/commands/camera-inspect-local.ts), [guide](../CAMERA_LOCAL_INSPECTION.md), [command tests](../../test/cli/camera-inspect-local-command.test.ts), [installed-package smoke](../../scripts/check-pack-cli.mjs), [changeset](../../.changeset/fresh-local-camera-command.md)                                                                                                                                                                                                                                                                            | `camera inspect-local` boots the existing CPU runner and evaluates the current ECS through the existing inspection operation. Exactly one JSON-file or source-resource `values.request` input; explicit camera/viewport, strict assets and seed 0 by default. No step, extraction, camera edit or GPU. Full envelopes publish only after awaited cleanup, with atomic output/alias protection and explicit exit 0/2/1 semantics. Independent controls and full integration checks pass. The one-author-per-route pilot has correct measurements in all arms but a shared explanation gap; the supplied script and CLI tie. No author-time benefit or visual qualification is established.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Actionable bevel limits** — implemented, independently reviewed and fully validated                                                                | [Visual diagnosis and diagnostic review](../../benchmarks/visual-parity-20261018/evidence/round18-visual-gap-diagnosis/REVIEW.md), [independent evidence](../../benchmarks/visual-parity-20261018/evidence/round18-visual-gap-diagnosis/findings.json), [constructor](../../packages/render/src/mesh/beveled-box.ts), [tests](../../test/mesh/beveled-box.test.ts), [changeset](../../.changeset/clear-bevel-limits.md)                                                                                                                                                                                                                                                                                                                                                                                                              | The existing rejection reports supplied bevel, validated size and exclusive upper limit without coercing arbitrary objects. No auto-clamp, changed accepted range, new geometry API or unavailable entity-key attribution. Eight accepted descriptor comparisons match; twelve invalid cases remain rejected and adversarial coercion hooks are not called. Five focused tests and full R19 checks pass. The original failed R18 capture remains counted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

The generic ECS assembly starter and resolved-light diagnostics above are
fully validated and committed in `488fe04`. The earlier
[round-13 timing diagnosis](../../benchmarks/visual-parity-20261018/evidence/round13-timing-diagnosis.md)
links retained snapshots to late layout/assembly corrections. It attributes
41.016 s of Aperture's 185.292 s median finish gap to recorded capture intervals;
the remaining 144.276 s is an unmeasured mixture of reading, reasoning, editing,
CPU commands, inspection, reporting and scheduling. It does not measure active
labor or promise that a new example will recover that time.

The [round-13 lighting diagnosis](../../benchmarks/visual-parity-20261018/evidence/round13-lighting-diagnosis.md)
finds an authoring/observability issue; it reproduces no new renderer defect.
The key is **8.981°** from the camera's backward viewing axis, hiding many cast
shadows behind objects. The rotated pavilion still has distinct front/side
cosine responses of **0.724 / 0.354**; this is not an absence of directional
separation. Pale materials, authored shadow strength and geometry also matter.
The implemented informational diagnostics report resolved light/camera directions
and horizontal-plane shadow displacement in camera-plane units, with no aesthetic
pass/fail threshold or automatic lighting changes. Completed native direction
controls and isolated runtime replay are linked above; they do not replace R13's
failed scored final.

The [round-14 timing diagnosis](../../benchmarks/visual-parity-20261018/evidence/round14-timing-diagnosis.md)
finds that both authors adopted local groups and had resolved light evidence.
The **161.842 s** median finish gap to vGPU contains **45.245 s** of recorded
capture difference and **116.597 s** outside captures. The latter mixes editing,
reading, reasoning, CPU work, inspection and scheduling, not measured labor.
Large late camera/roof/layout revisions motivate the new atomic local
camera probes; the evidence does not assign recoverable seconds to that API.

The [round-14 canal diagnosis](../../benchmarks/visual-parity-20261018/evidence/round14-canal-diagnosis/README.md)
confirms the door-bottom slivers as the opaque beige plinth overlapping teal
front faces, using decoded geometry and resolved transforms. A geometry-only
split-plinth control removes the slivers. Separate key, fill and reflection-tint
controls explain different parts of the pale finish; no new renderer defect or
global default change is established. All original images/scores remain intact,
including the historical native-versus-replay maximum one-RGB-value difference.
The new selected coplanar review generalizes geometry inspection; it must
report visibility and precision limits rather than infer a rendering bug.

Other exploratory ideas in the timing diagnosis remain proposals: resize foliage
layout independently of leaflet dimensions, improve discoverability of existing
bridging/loft construction after a bent-quad error, and profile retained captures
with unchanged quality settings. None has a shipped or measured-savings claim.
The camera and coplanar R15 APIs are implemented with guides/tests and accepted
independent reviews after edge-case fixes. The timestamp repair is also implemented
and independently accepted. Full engineering validation, checkpoint commit/push
and service preflight passed; the completed R15 author round failed finish time.
Full, focused and bounded control receipts are linked below. Their original proposals retain
the design rationale; current guides describe the implemented scope. In
particular, coplanar visibility is always unknown and a view ID filters layers,
while camera inspection reports resolved ECS geometry rather than rendered or
deformed silhouettes. Neither feature changes benchmark gates or global defaults.

The separate [initial capture-profile control](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/README.md)
is complete: **42 renders / 12 idle completion probes**, **zero failures**,
identical matched PNG/RGBA and clean disposal, with the **1,240-file dist digest
unchanged**. Idle completion callbacks measured **0.032–0.148 ms**, refuting a
universal multi-second callback floor on this environment. Removing the explicit
cube drain moved required work into readback; the small variable sample does
not establish stable end-to-end savings or an optimization for R14. Keep
synchronization unchanged on this evidence.

The separate [generic feature/pass follow-up](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/feature-pass/README.md)
stopped after **two attempted calls: one untimed success, one timed failure,
four not run**. No retry or extra sample was added. The failure was
`writeTimestamp is no longer supported with the 'timestamp-query' feature`;
the failed call produced no PNG or valid per-pass report. Cleanup found no
remaining owned process and the dist digest stayed unchanged. This is a public
profiling compatibility issue, absent from uninstrumented R14 captures, and it
cannot explain R14's authoring gap. The [complete result record](../../benchmarks/visual-parity-20261018/evidence/round15-capture-profile/feature-pass/results.json)
retains failures and unrun calls separately from the initial 42 successes.
The implemented `timestampWrites` repair now has passing CPU and browser
correctness evidence. The separate native repair control produced valid timing
reports but failed its exact-pixel gate; the pre-repair untimed runtime reproduces
the same variance. Those results are retained below. No valid pass-cost comparison,
full-frame cost estimate or speed improvement is claimed.

## Qualification history and unchanged gates

Two independent anonymous judges score composition 25%, shape 25%, low-poly
style 15%, lighting/material 20%, finish 15%. Each subject must meet the best
peer's mean, have no category deficit above 0.25, and have no major artifact
reported by either judge. First-useful and finish time must each be at most
**1.10 × the fastest peer** (two-subject medians for qualification, one subject
for transfer). All queue time and failed attempts count. Authors receive 25
minutes and at most six captures, 1200×900, DPR 1, seeded/static time 0. Final
selection is the last successful capture with exact matching source.

The [round-12 protocol](../../benchmarks/visual-parity-round12-20261018/shared/PROTOCOL.md),
[round-13 protocol](../../benchmarks/visual-parity-round13-20261018/shared/PROTOCOL.md),
[round-14 protocol](../../benchmarks/visual-parity-round14-20261018/shared/PROTOCOL.md),
[round-15 protocol](../../benchmarks/visual-parity-round15-20261018/shared/PROTOCOL.md),
[round-16 protocol](../../benchmarks/visual-parity-round16-20261018/shared/PROTOCOL.md),
[interrupted round-17 protocol](../../benchmarks/visual-parity-round17-20261018/shared/PROTOCOL.md)
and [first-transfer protocol](../../benchmarks/visual-parity-heldout-20261018/shared/PROTOCOL.md)
retain the full requirements: actual 3D geometry, fitted/shared surfaces, a custom
procedural shader and actual scene reflections. Technical compliance and judged
visual quality are separate. The held-out Three.js glazing violates the shared
opening clause, but its stronger image/timing remains in the original comparison;
removing it would manufacture a pass.

| Retained round                                                                                  | Canal visual    | Courtyard visual | First useful | Finish     | Outcome / material disclosure                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | --------------- | ---------------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1](../../benchmarks/visual-parity-20261018/REPORT.md)                                          | Fail            | Fail             | Fail         | Fail       | Failed; repository checks overlapped early author/capture work.                                                                                                                                                                                                                        |
| [2](../../benchmarks/visual-parity-round2-20261018/README.md)                                   | Incomplete      | Incomplete       | Excluded     | Excluded   | Infrastructure-interrupted by unchanged 2 GiB browser disk guard; partial trials retained, not qualified.                                                                                                                                                                              |
| [3](../../benchmarks/visual-parity-round3-20261018/REPORT.md)                                   | Fail            | Fail             | Pass         | Pass       | Failed finish/detail categories; a peer's 122-second failure held the serial queue.                                                                                                                                                                                                    |
| [4](../../benchmarks/visual-parity-round4-20261018/REPORT.md)                                   | Fail            | Pass             | Pass         | Fail       | Failed canal and completion.                                                                                                                                                                                                                                                           |
| [5](../../benchmarks/visual-parity-round5-20261018/REPORT.md)                                   | Fail            | Fail             | Pass         | Fail       | Failed; missing assumed icosphere API exposed.                                                                                                                                                                                                                                         |
| [6](../../benchmarks/visual-parity-round6-20261018/REPORT.md)                                   | Pass            | Fail             | Pass         | Pass       | Failed courtyard construction/style categories.                                                                                                                                                                                                                                        |
| [7](../../benchmarks/visual-parity-round7-20261018/REPORT.md)                                   | Fail            | Fail             | Pass         | Pass       | Failed visual gates; reusable pinned browser executable service introduced, fresh profile/context each call.                                                                                                                                                                           |
| [8](../../benchmarks/visual-parity-round8-20261018/REPORT.md)                                   | Pass            | Fail             | Fail         | Fail       | Failed; tight MSAA mask defect and costly widespread surface hook investigated afterward.                                                                                                                                                                                              |
| [9](../../benchmarks/visual-parity-round9-20261018/REPORT.md)                                   | Pass            | Pass             | Pass         | Fail       | Completion misses by 7.2506302 s; sequential author spawning took 49.392971 s, individual activation unmeasured. No retrospective correction.                                                                                                                                          |
| [10](../../benchmarks/visual-parity-round10-20261018/REPORT.md)                                 | Fail            | Pass             | Pass         | Pass       | Failed canal finish/shape; common readiness barrier begins prospectively.                                                                                                                                                                                                              |
| [11](../../benchmarks/visual-parity-round11-20261018/REPORT.md)                                 | Pass            | Fail             | Pass         | Fail       | Mean leads do not override courtyard composition deficit 0.35 or completion failure. Judge-two subject-block order discrepancy disclosed.                                                                                                                                              |
| [12](../../benchmarks/visual-parity-round12-20261018/REPORT.md)                                 | Pass            | Pass             | Pass         | Pass       | **First complete two-subject pass**, at `0239f77`; transfer is a separate gate.                                                                                                                                                                                                        |
| [First transfer](../../benchmarks/visual-parity-heldout-20261018/REPORT.md)                     | Fuel-stop: fail | —                | Fail         | Pass       | **Failed transfer** at the same checkpoint; keep all three peers and all 18 calls.                                                                                                                                                                                                     |
| [13](../../benchmarks/visual-parity-round13-20261018/REPORT.md)                                 | Pass            | Fail             | Pass         | Fail       | Completed at `2c500eb`; courtyard lighting deficit **0.35** and finish ratio **1.172877** fail. All 36 attempts and technical deviations are retained.                                                                                                                                 |
| [14](../../benchmarks/visual-parity-round14-20261018/REPORT.md)                                 | Fail            | Pass             | Pass         | Fail       | Completed at `488fe04`; canal composition deficit **0.30**, lighting/finish deficits **0.75** each, finish ratio **1.144592**. All 36 attempts, limitations and exact evidence are retained.                                                                                           |
| [15](../../benchmarks/visual-parity-round15-20261018/REPORT.md)                                 | Pass            | Pass             | Pass         | Fail       | Completed at `88fc655`; only finish fails, ratio **1.216253384477**, missing the limit by **107.82769415 s**. All 36 calls (30 successes / six failures), final source sets, 193 frozen files and technical/browser scope limitations are retained.                                    |
| [16](../../benchmarks/visual-parity-round16-20261018/REPORT.md)                                 | Pass            | Pass             | Pass         | Fail       | Completed at `5e981e2`; only finish fails, ratio **1.1627879288093423**, miss **62.6538752 s**. All 36 calls (35 successes / one retained Aperture CPU-preflight failure), 199 frozen files and 1,253 built files are verified. Both authors report not using the finite camera route. |
| [17](../../benchmarks/visual-parity-round17-20261018/evidence/infrastructure-interruption.json) | Unjudged        | Unjudged         | Ineligible   | Ineligible | Shared native-service outage interrupted all six lanes. All 27 attempts and exact last-success sources retained; forced finishes are not author completion times.                                                                                                                      |
| [18](../../benchmarks/visual-parity-round18-20261018/recomputed-summary.json)                   | Fail            | Fail             | Pass         | Fail       | Same `6b962dc` engine after R17 infrastructure interruption; both visual gates fail and finish misses the unchanged limit by **1.2089076 s**. All 36 calls retained; independent technical review passes with bounded cleanup/geometry findings.                                       |
| [New rail-halt](../../benchmarks/visual-parity-heldout2-20261018/evidence/preparation.json)     | Undispatched    | —                | Unmeasured   | Unmeasured | Prepared after failed transfer; new combined qualification is required before release.                                                                                                                                                                                                 |

Round 12 means (Aperture / Three.js / vGPU) are canal
**7.7575 / 7.4900 / 7.4625**, courtyard **7.8150 / 6.9475 / 7.3250**.
Aperture's first-useful median is **76.557035 s**, versus **73.014035 s**;
finish is **1007.585535 s**, versus **951.7608105 s**. Ratios **1.048525** and
**1.058654** pass together. See the [exact recomputation](../../benchmarks/visual-parity-round12-20261018/recomputed-summary.json),
[freeze receipt](../../benchmarks/visual-parity-round12-20261018/evidence/round12-freeze.json)
and [unedited judgments](../../benchmarks/visual-parity-round12-20261018/judging).

Fuel-stop means are **7.0625 / 7.4825 / 6.5150**. Aperture first useful is
**104.737760 s**, versus Three.js **75.303760 s**, failing the **82.834136 s**
limit; finish **1075.126760 s** versus **1058.394627 s** passes. See
[exact records](../../benchmarks/visual-parity-heldout-20261018/recomputed-summary.json).
The startup gap decomposes into 25.798 s before capture start and 3.636 s in
capture endpoint intervals. The pre-capture interval includes reading, writing,
reasoning and scheduling; it is not measured documentation cost. No time saving
is assigned to staged docs, camera-tool adoption or the new helper.

Round 13 means (Aperture / Three.js / vGPU) are canal
**7.7000 / 7.2325 / 7.1600**, courtyard **7.3075 / 7.1600 / 6.9950**.
The courtyard lighting deficit
**0.35** exceeds the unchanged **0.25** limit. First-useful median is
**79.505359 s** versus Three.js **102.963859 s**, ratio **0.772168**, passing.
Finish median is **1257.103859 s** versus vGPU **1071.811859 s**, ratio
**1.172877**, failing the **1178.9930449 s** limit. The
[recomputation](../../benchmarks/visual-parity-round13-20261018/recomputed-summary.json)
retains raw elapsed clocks and phase coverage; no queue or failure is subtracted.

The [round-13 technical audit](../../benchmarks/visual-parity-round13-20261018/judging/technical-audit.md)
retains all **36 attempts, 34 successful images**, both failures, exact final
selection, **65 matching final source files**, and **139 unchanged frozen files**.
All finals satisfy the real-geometry/render-route requirements and final browser
proofs/cleanup pass. Two bounded vGPU resource-disposal deviations and separate
construction limitations remain disclosed; there is no automatic-disqualification
rule that permits removing those peers. Technical compliance does not erase the
visual or time failures. The [coordinator findings](../../benchmarks/visual-parity-round13-20261018/coordinator-findings.md)
record the same limits. Rail-halt cannot be released on this result.

Round 14 means (Aperture / Three.js / vGPU) are canal
**7.2925 / 7.6900 / 7.5800**, courtyard **7.8100 / 7.0700 / 7.5300**.
Canal fails its mean and composition (**0.30**), lighting (**0.75**) and finish
(**0.75**) category limits. Neither judge reports a major Aperture artifact;
courtyard passes. First-useful median **75.966051 s** versus Three.js
**107.475051 s**, ratio **0.706825**, passes. Finish median **1281.1409775 s**
versus vGPU **1119.299051 s**, ratio **1.144592**, exceeds the
**1231.2289561 s** limit by **49.9120214 s**. The
[final summary](../../benchmarks/visual-parity-round14-20261018/final-summary.json)
and [qualification](../../benchmarks/visual-parity-round14-20261018/QUALIFICATION.md)
preserve all clocks, failures and comparisons.

The [round-14 technical audit](../../benchmarks/visual-parity-round14-20261018/judging/technical-audit.md)
retains **36 attempts / 34 successes**, **146 matching frozen files** and
**66 matching final source files**. All six finals pass public real-3D route,
required geometry/reflection, browser and source checks; all use the last
successful capture. Retained construction/handling limitations include normals,
caps, support gaps and Three courtyard's missing failure-status handler; they do
not retrospectively remove any peer. Four coordinator browser proofs occur after
author clocks. [Pixel comparisons](../../benchmarks/visual-parity-round14-20261018/evidence/final-browser-native-pixels.json)
retain Aperture maximum RGB difference **1**, means **0.0484404321 / 0.0038496914**
for canal/courtyard, and exact vGPU equality. [Cleanup](../../benchmarks/visual-parity-round14-20261018/evidence/service-cleanup.json)
passes with service exit codes 0 and no retained processes/profiles. The failed
combined outcome leaves rail-halt undispatched.

Round 15 means (Aperture / Three.js / vGPU) are canal
**7.5650 / 7.3475 / 7.2800**, courtyard **7.6850 / 7.1225 / 7.0450**.
Both subjects pass mean/category/artifact gates. First-useful median
**72.689553 s** versus Three.js **98.807053 s**, ratio **0.7356717035**, passes.
Finish median **1128.103053 s** versus vGPU **927.5230535 s**, ratio
**1.216253384477**, fails the **1020.27535885 s** limit by **107.82769415 s**.
The [completed report](../../benchmarks/visual-parity-round15-20261018/REPORT.md),
[qualification](../../benchmarks/visual-parity-round15-20261018/QUALIFICATION.md),
[final summary](../../benchmarks/visual-parity-round15-20261018/final-summary.json),
[unedited judging records](../../benchmarks/visual-parity-round15-20261018/judging)
and [coordinator findings](../../benchmarks/visual-parity-round15-20261018/coordinator-findings.md)
retain this combined failure; no gate, budget or peer was changed.

The [R15 technical audit](../../benchmarks/visual-parity-round15-20261018/judging/technical-audit.md)
finds all six submissions valid with limitations and no disqualification.
All six authors finish before the shared deadline; **36 calls / 30 successes /
six failures** are retained. [All 193 frozen files](../../benchmarks/visual-parity-round15-20261018/evidence/frozen-at-completion.json)
and [all six final source sets](../../benchmarks/visual-parity-round15-20261018/evidence/final-source-verification.json)
match. Courtyard Three.js correctly restores its last successful `polished`
source after two later failures. Canal vGPU's first technically successful image
is blank; the useful-image review uses its later `blockout-depth` image.

The [coordinator browser proof](../../benchmarks/visual-parity-round15-20261018/evidence/coordinator-browser-verification.json)
and [pixel comparisons](../../benchmarks/visual-parity-round15-20261018/evidence/final-browser-native-pixels.json)
pass for Aperture: canal max/mean RGB difference **1 / 0.0223867284**, courtyard
**1 / 0.0356756173**, within unchanged **12 / 0.5** limits. Courtyard vGPU matches
exactly; both Three.js author finals retain verified browser proofs. The
[browser scope disclosure](../../benchmarks/visual-parity-round15-20261018/evidence/final-browser-scope.json)
records canal vGPU's absent optional browser entry: its permitted native route
is technically valid, while browser portability remains unproved. The frozen
helper and authored source remain unchanged. [Service cleanup](../../benchmarks/visual-parity-round15-20261018/evidence/service-cleanup.json)
and [browser lifecycle](../../benchmarks/visual-parity-round15-20261018/evidence/browser-lifecycle-manifest.json)
complete with both service exits 0 and no owned processes/profiles remaining.

The [R15 timing diagnosis](../../benchmarks/visual-parity-20261018/evidence/round15-timing-diagnosis.md)
and [supporting calculations](../../benchmarks/visual-parity-20261018/evidence/round15-timing-diagnosis.json)
partition the **200.5799995 s** median finish gap into **58.158 s** inside capture
windows and **142.4219995 s** outside them. Canal Aperture finishes **1.948 s**
earlier than canal vGPU, while courtyard finishes **403.107999 s** later.
Outside-capture time mixes reading, reasoning, editing, CPU work, inspection and
scheduling; it does not measure active labor or recoverable seconds. Both authors
use local groups and public recipes. Retained artifacts do not demonstrate use
of the new local camera/coplanar inspection APIs. Courtyard's manual world-anchor
fit jobs become stale after later geometry edits; this motivates a small generic
control of the existing local inspection workflow. An explicit-span polygon/hole
recipe for panes crossing profile cells is a separate diagnostic idea. These are
follow-up directions from that diagnosis. The camera route is now covered by a
bounded R16 control and guide/starter follow-up below; the spanning-window recipe
remains a separate diagnostic idea. No savings claim or fresh qualification is
established, and rail-halt remains undispatched.

The [R16 ergonomics proposal](../../benchmarks/visual-parity-20261018/evidence/round16-camera-ergonomics-proposal.md)
identifies an existing finite `headless serve` route. The
[main CPU workflow control](../../benchmarks/visual-parity-20261018/evidence/round16-camera-workflow-control/README.md)
passes **19 actual CLI subprocesses / 47 protocol requests**: two unrelated
generic assemblies, each at baseline plus three source edits, and separate live
parent-translation edits. An independent affine/projection/facing/bounds oracle
checks the reports. Source-derived local requests and a resource snapshot feed
fresh `camera_inspect_local`, export, actual `camera project` and `camera fit`
commands without stepping simulation. Five intentional missing-camera envelopes
fail correctly despite successful process exits; EOF/shutdown cleanup is retained.
Saved resource reports stay unchanged after live edits, while fresh probes update.
Dimension/rotation/scale changes are fresh source boots, not live geometry resizing.

Model comparisons use the same named world points, targets, weights, viewport,
tolerance and explicit fit constraints within each dataset. Known own-family fits
pass; both near-orthographic candidates also pass, so lower residuals do not select
a camera model automatically. Two unaccepted fits retain exit-2 reports and their
bounds/termination diagnostics. The control uses existing compiled workspace
packages; it is not a full build or installed-package validation and measures no
visual improvement or author-time saving.

R16 implementation scope is only [local-camera guidance](../CAMERA_LOCAL_INSPECTION.md),
[same-observation fitting guidance](../CAMERA_LANDMARKS.md), the
[short workflow](../AGENT_VISUAL_WORKFLOW.md), [refinement reference](../AGENT_VISUAL_REFINEMENT.md),
and generated `DIORAMA.md` prose in the [starter template](../../packages/cli/src/create/templates/diorama.ts),
with a [CLI patch changeset](../../.changeset/quiet-cameras-inspect.md).
The [six-file documentation validation receipt](../../benchmarks/visual-parity-20261018/evidence/round16-camera-docs-validation.json)
retains exact frozen hashes, scoped formatting/lint and unchanged generated
scene/config/shader and first-image bytes. It exposes construction-shared local features, checked finite CPU retrieval and
explicit projection-family jobs after the first image. No scene/config/render
behavior, public API, transport or solver changes are introduced. The [final independent review](../../benchmarks/visual-parity-20261018/evidence/round16-workflow-review/REVIEW.md),
[independent exact-recipe result](../../benchmarks/visual-parity-20261018/evidence/round16-workflow-review/recipe-attempt-01/result.json)
and [main-control audit](../../benchmarks/visual-parity-20261018/evidence/round16-workflow-review/control-audit.json)
pass. The reviewer executed the final snippets with strict TypeScript, actual
CPU probe/export/project and family jobs. Real failed envelopes, nested inspection
failure and null export, plus injected missing/duplicate/malformed responses and
invalid family input, stop before stale output can be reused. This establishes
the documented CPU contract, not an installed-package test, visual improvement
or measured authoring benefit.

The [R16 service preflight](../../benchmarks/visual-parity-round16-20261018/evidence/service-preflight.json)
passes recovery, path/time rejection and profile cleanup for its individual calls.
The [starter native/browser comparison](../../benchmarks/visual-parity-round16-20261018/evidence/starter-browser-native-control.json)
is exactly pixel-identical. The later author round and final service cleanup
are complete, with results below. The
[full repository check](../../benchmarks/visual-parity-20261018/evidence/round16-validation/checkpoint-validation.json)
passes **5,046 tests in 696 files**, shuffle seed `1792407751210`, including
build/type, package, example, documentation, diagnostics, lint and formatting
checks. Validated source remained unchanged throughout. The separate standalone
Dawn/memory suite was last run at R15; this prose-only follow-up does not claim
to have repeated it. The [checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round16-validation/checkpoint-commit.json)
records committed/pushed `5e981e2a4bc56ec21e8c5828bcdac79aa12ba9ea`. These engineering
passes remain separate from the completed R16 finish failure.

Round 16 means (Aperture / Three.js / vGPU) are canal
**7.6450 / 7.3700 / 7.5325**, courtyard **7.8750 / 7.2225 / 6.6625**.
Both visual gates pass. First-useful median **61.220851 s** versus Three.js
**85.677851 s**, ratio **0.7145469953488913**, passes. Finish median
**1160.305351 s** versus vGPU **997.864978 s**, ratio **1.1627879288093423**,
fails the **1097.6514758 s** limit by **62.6538752 s**. The
[completed report](../../benchmarks/visual-parity-round16-20261018/REPORT.md),
[qualification](../../benchmarks/visual-parity-round16-20261018/QUALIFICATION.md),
[final summary](../../benchmarks/visual-parity-round16-20261018/final-summary.json),
[raw judging](../../benchmarks/visual-parity-round16-20261018/judging) and
[coordinator findings](../../benchmarks/visual-parity-round16-20261018/coordinator-findings.md)
retain this combined failure with unchanged thresholds and all peers.

The [R16 technical audit](../../benchmarks/visual-parity-round16-20261018/judging/technical-audit.md)
finds all six submissions valid with limitations and no blocking violation.
All six authors finish within the common deadline and each uses six calls:
**35 successes / one failed Aperture CPU polygon preflight**. The failure, source
and repair remain in the timing/attempt evidence. [Frozen-source verification](../../benchmarks/visual-parity-round16-20261018/evidence/frozen-at-completion.json)
and [post-author integrity](../../benchmarks/visual-parity-round16-20261018/evidence/postauthor-integrity.json)
retain **199 matching frozen files / 1,253 unchanged runtime files**;
[all final source sets](../../benchmarks/visual-parity-round16-20261018/evidence/final-source-verification.json)
match the last successful captures. Construction limitations remain disclosed
without retrospective peer disqualification.

[Required browser proofs](../../benchmarks/visual-parity-round16-20261018/evidence/coordinator-browser-verification.json)
and [native/browser pixel comparisons](../../benchmarks/visual-parity-round16-20261018/evidence/final-browser-native-pixels.json)
pass for both Aperture finals: canal max/mean RGB **1 / 0.0020490740740740743**,
courtyard exact. Courtyard vGPU is also exact. Canal vGPU is explicitly
`not-supplied` for the optional browser entry; its permitted native route remains
valid while browser portability is unverified. The [cleanup receipt](../../benchmarks/visual-parity-round16-20261018/evidence/service-cleanup.json)
and [lifecycle manifest](../../benchmarks/visual-parity-round16-20261018/evidence/browser-lifecycle-manifest.json)
record both service exits 0 and no remaining owned processes/profiles. The
[initial cleanup false positive](../../benchmarks/visual-parity-round16-20261018/evidence/service-cleanup.initial-command-text-match.json)
matched its own shell command text; it remains retained separately from the
corrected exact executable/argv verification. Protected runtime retention remains
unchanged.

The [camera-adoption review](../../benchmarks/visual-parity-20261018/evidence/round16-camera-adoption-review.md)
and [source/artifact inventory](../../benchmarks/visual-parity-20261018/evidence/round16-camera-adoption-review.json)
separate delivered guidance, retained artifacts and author testimony. Both
retained starter files contain the new links. The verbatim post-run
[courtyard account](../../benchmarks/visual-parity-20261018/evidence/round16-author-retrospectives/courtyard-aperture.md)
and [canal account](../../benchmarks/visual-parity-20261018/evidence/round16-author-retrospectives/canal-aperture.md)
explicitly say the finite resource/`inspectLocal` route was not used. Courtyard
used public fit/project/unproject jobs; canal retained a separate SciPy experiment
without its numerical outputs. Some detail landmarks became historical after
later geometry edits, while courtyard's stable ground fit and explicit-plane
queries remain valid for their inputs. The round establishes neither benefit
nor failure of the unexercised route. Retrospectives are recalled experience,
not instrumented time attribution.

The [R16 timing/capture-cost diagnosis](../../benchmarks/visual-parity-20261018/evidence/round16-timing-diagnosis.md)
and [exact arithmetic](../../benchmarks/visual-parity-20261018/evidence/round16-timing-diagnosis.json)
partition the **162.440373 s** median finish gap to vGPU into **54.886 s** inside
capture windows and **107.554373 s** outside. Outside-capture intervals mix editing,
reading, reasoning, CPU commands, inspection and scheduling; they do not measure
active labor. The reported completion waits contain outstanding GPU work and
host scheduling, not demonstrated removable synchronization. Complete-value asset
inventories find repeated mesh/material values, while shadow descriptor requests
can repeat within a frame before their cache is filled. This supports CPU
semantic/duplicate-request controls and a feature-preserving investigation of
immutable asset reuse through existing facilities. It does not establish extra
pipeline compilations, fewer submitted draws or an end-to-end speedup. Any static
aggregation or app/environment reuse experiment is a separate question. The
subsequent native asset-sharing experiment is recorded below with failed output
gates; its execution does not turn this diagnosis into a speedup claim. Reported
unknown sphere option keys and manual post-capture geometry projection motivate
narrow investigation of diagnostics and existing bundle-inspection capabilities.
The [bounded R17 authoring proposal](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-proposal.md)
now retains CPU investigation results: [sphere option reproduction](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-baseline/sphere-results.json)
confirms silent schema mismatch at the facade/raw-spawn and direct-factory
boundaries, while [supported-buffer baselines](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-baseline/sphere-supported-buffers.json)
preserve existing accepted behavior. The schema-specific correction is now
implemented. The [sphere validation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-validation.json)
and [accepted independent review](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-review/README.md)
record **67 focused tests**, **eight independent tests**, all **12 retained
pre-fix buffers**, and **102 accepted-input differential cases**. Rejected options
produce actionable errors at the facade, raw-spawn and direct-factory boundaries;
corrected same-key retries and shared-ready-asset preservation are checked.
No numeric normalization, supported defaults or geometry algorithm changed.
The independent sphere review used the retained prior build as a comparison and
left compiled runtime files unchanged. Its CPU scope is distinct from the
coordinator's subsequent passing full repository/native/package validation below.
The reviewed correction is committed and pushed in `6b962dc`; interrupted R17
authoring provides no completed-round effectiveness result.

Separately, [offline selected-draw feasibility](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-baseline/bounds-results.json)
shows actual referenced-vertex envelopes can be tighter than projected source-AABB
corners. The [independently accepted design contract](../../benchmarks/visual-parity-20261018/evidence/round17-control-design-review.md)
requires explicit selection/view identity, every active referenced vertex,
recorded matrices, conservative numerical sensitivity and honest partial
coverage. The reusable helper and existing `inspect projected-bounds` command
are implemented; the [guide](../PROJECTED_BOUNDS_INSPECTION.md) states their
static-geometry and precision limits. The [initial focused checks](../../benchmarks/visual-parity-20261018/evidence/round16-offline-projection-control/checks.json)
pass 73 tests, type checks, lint and formatting. The
[independent review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/REVIEW.md)
retains 20 independent generic cases and 35 coplanar regressions, including an
incorrect reviewer assertion and its corrected rerun. Signed-ID rejection and
maximum-safe budget accounting were corrected before initial acceptance.

Supplemental [installed-smoke source review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/INSTALLED_SMOKE_REVIEW.md)
then found a global tied-extremum witness defect: numeric bounds are right, but
replaying per-draw witnesses in axis order can retain a later source reference.
The axis-wise correction and regression now pass
[74 focused tests and targeted type/lint/format checks](../../benchmarks/visual-parity-20261018/evidence/round16-offline-projection-control/tie-after-checks.json);
the [final independent re-review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/review-result.json)
accepts all 15 post-fix frozen files. Its 21st control covers interleaving, nonzero
index range and reversed draw order; earlier 20 controls and 35 coplanar
regressions remain retained. The smoke's independent analytic oracle is unchanged.
Both actual packed-CLI invocations and the full repository check now pass. These
reports establish neither visible silhouettes nor occlusion or aesthetic quality.

The separate [CPU shadow-request baseline](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-control/report.md)
reproduces duplicate creation requests for the same specialization during one
cold resource call. The [implemented correction](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-implementation.json)
uses a request-local resource map: 64 uniform-only material variants still
produce 65 metadata entries, but now only two resource creations and 63 reuses.
Every material retains its own parameter bytes/buffer and selection, while
shader/layout/deformation/opacity differences remain separate. Forty-eight
focused tests across two files, including ten additions, pass.
[Independent source review](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-review.md)
accepts the bounded change and attributes execution to that implementer receipt.
The counters measure injected-device calls, not native shader compilation or
saved capture time. The later full check found two test-code typing issues:
unsafe access through `unknown`, and use of `findLast` outside the configured
library target. The [test-only correction receipt](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-test-typecheck-correction/receipt.json)
retains the failed run, exact before/after files, unchanged product runtime and
changeset, and another passing 48-test run. Full repository validation then
passes; earlier native/package/memory checks remain applicable to the unchanged
runtime.

The [bounded immutable asset-reuse proposal](../../benchmarks/visual-parity-20261018/evidence/round16-capture-control-proposal.md)
passed CPU preparation and [independent native-readiness review](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-review/final-readiness-result.json).
The [retained control directory](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control)
contains preparation/runtime archives and the completed run retention.
The [retained run analysis](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/analysis.json)
records `run-2026-10-19T12-20-14-178Z`, which completed its fixed **18 calls**:
generic, canal and courtyard each used **A, B, A, B, B, A**, with the first pair
retained as warmups. There were **zero rendering failures**, all three workers
exited 0, and no owned process remained. The 1,253-file R16 runtime and frozen
source stayed unchanged; this control did not test the then-unbuilt R17 changes.

The **primary exact-RGBA gate fails for all three fixtures**, including
within-condition variation. The separate predeclared **one-LSB / 0.01 mean-RGB /
exact-alpha** observation passes generic but fails canal and courtyard; a
courtyard cross-condition difference reaches two LSB. At pixel (1114, 529),
the red channel is 178 in all three A samples and 176 in all three B samples;
all nine courtyard cross-condition comparisons fail the secondary bound. This
persistent condition difference cannot be dismissed as within-route variation.
Its mechanism remains unresolved. All 45 comparisons and raw outputs,
including warmups, remain part of the result. Timing does not improve
consistently across fixtures, and two measured pairs per fixture are limited
observations. No retry or relaxed threshold is allowed. No automatic asset
deduplication is proposed from this result, and it establishes no output
equivalence, optimization win or author-time saving. The analysis retains all phase values, native main/shadow counts and all
45 comparisons, with partial timing/reflection coverage explicitly distinguished.
The [independent post-run audit](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-review/POSTRUN.md)
passes evidence integrity while explicitly rejecting output/performance acceptance.
It recomputes all 45 pixel comparisons, decodes every PNG to its retained raw RGBA,
and checks 738 timing values, 252 native count values and 246 summaries plus
246 paired differences. Partial main/shadow/reflection coverage remains explicit;
CPU expanded-instance proofs are not relabeled as native command streams.

The [completed workspace archive](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/completed-workspace.tar.gz)
and [exhaustive inventory](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/completed-workspace.inventory.json)
retain **223 files / 227,520,398 uncompressed bytes**, including every native
sample and earlier failed preparation attempt. Independent reconstruction verifies
paths, modes, bytes and hashes; archive SHA-256 is
`e1c3663467c19ff7405be4088fdc3a6d0585b34cbdd254d516e66a1f02141908`.
The [bounded duplicate cleanup receipt](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/duplicate-cleanup-applied.json)
records coordinator verification before removing exactly the completed external
workspace. The archive, original evidence and old runtime archive remain retained;
cleanup creates no missing dependency for later analysis.

### Round 17 interruption and retained scenes

The [R17 harness](../../benchmarks/visual-parity-round17-20261018/README.md)
used unchanged gates, six fresh authors and the existing canal/courtyard
references. The [interrupted-round report](../../benchmarks/visual-parity-round17-20261018/REPORT.md)
and [qualification status](../../benchmarks/visual-parity-round17-20261018/QUALIFICATION.md)
record the ineligible outcome without an ordinary framework failure or pass. The [preflight](../../benchmarks/visual-parity-round17-20261018/evidence/service-preflight.json)
passed both native routes and browser controls, including intentional failure
and recovery. The [starter browser/native control](../../benchmarks/visual-parity-round17-20261018/evidence/starter-browser-native-control.json)
is exactly equal (maximum and mean channel difference zero). The
[source freeze](../../benchmarks/visual-parity-round17-20261018/evidence/round17-freeze.json)
and [author budget](../../benchmarks/visual-parity-round17-20261018/evidence/author-budget.json)
record committed checkpoint `6b962dc`, release at **12:49:39.081265 UTC** and the
original **13:14:39.081265 UTC** deadline on 19 October 2026.

The [interruption record](../../benchmarks/visual-parity-round17-20261018/evidence/infrastructure-interruption.json)
records exec transport loss observed at **13:03:59 UTC** and the native-service
PID absent at **13:05:52.243119 UTC**. Three native capture requests failed with
`TypeError: fetch failed`. All six authors were stopped and restored their exact
last successful captured source; the final acknowledgment was **13:06:49.948 UTC**.
Cumulative cgroup OOM counters lack a pre-round baseline and identified victim,
so they do not establish the cause. The original service sessions could not be
resumed. The [identity-checked stop request](../../benchmarks/visual-parity-round17-20261018/evidence/orphan-browser-stop-request.json)
sent SIGTERM only to the exact orphan browser-service PID at **13:09:27.604739 UTC**;
the [browser-service receipt](../../benchmarks/visual-parity-round17-20261018/evidence/browser-service-receipt.json)
records closure at **13:09:27.610 UTC**. The original wrapper was lost. Its
manifest remains active and its runtime protected; adopted zombies cannot be
reaped by an unrelated replacement process. The [independent infrastructure review directory](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review),
[review report](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review/REVIEW.md)
and [post-signal reconciliation](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review/orphan-reconciliation.json)
record no live matching browser/native/wrapper process, both service ports
refusing connections and no retained browser profiles at **13:13:31.527490 UTC**.
Thirty Chromium zombies and the browser-service zombie remain, with the original
manifest byte-identical and active. This establishes bounded inactivity; normal
exit status, complete descendant reaping and runtime retirement remain unproven.
The old runtime stays protected.

The infrastructure review identifies missing durable service ownership/exit
journaling, absent cgroup admission observations and persistent native-worker
resource lifetimes as next-run work. Its proposed supervisor, bounded worker
epochs, failure cleanup and neutral stress/admission controls require prospective
validation before author release. File memory and approximately 6 GB of tmpfs
were observed after the outage; these measurements do not identify the killed
process or prove a renderer leak. The recommendations do not alter engine quality
settings or justify a timing adjustment to R17.

The [post-stop source verification](../../benchmarks/visual-parity-round17-20261018/evidence/interrupted-final-source-verification.json)
at **13:07:49.960083 UTC**, before handoff/plan edits, passes all **219 frozen
files**, **1,259 runtime files** and all six app/source file sets. It retains
**27 calls: 22 successful captures and five failures**. Aperture canal's first
sphere-option failure and vGPU canal's unmatched `normal` attribute failure
remain author errors; the other three are the shared-service fetch failures.
No capture is erased, discounted, extended or selectively replaced. The later
[independent receipt review](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review/independent-receipt-verification.json)
and [retained freeze-copy check](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review/frozen-copy-verification.json)
verify all runtime files, all six final source sets and all 219 saved release
copies. At its later live-tree inspection, 218 of 219 files matched because this
handoff had been explicitly released for post-stop editing after the coordinator's
13:07:49 check. That later mismatch is retained; it is not relabeled as an
independent observation of the earlier live tree.

All six rows below are **provisional retained work from an interrupted round**.
The `final.json` files select the last successful image for preservation; their
forced timestamps are not natural author finish measurements. No independent
visual/effort/technical verdict or required Aperture final browser verification
was completed. None of these images or times qualifies the round or proves the
gap closed. At the interruption, the completed R16 failure was the latest qualification outcome; the later R18 result is recorded below.

| Subject/framework    | Retained image                                                                                                                       | Exact captured source and app                                                                                                                                                                                           | Attempts and forced-final metadata                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canal / Aperture     | [composition PNG](../../benchmarks/visual-parity-round17-20261018/trials/canal-aperture/captures/composition/render.png)             | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/canal-aperture/captures/composition/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/canal-aperture/app)         | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/canal-aperture/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/canal-aperture/final.json); 5 calls, 3 successes         |
| Canal / Three.js     | [fitted PNG](../../benchmarks/visual-parity-round17-20261018/trials/canal-three/captures/fitted/render.png)                          | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/canal-three/captures/fitted/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/canal-three/app)                    | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/canal-three/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/canal-three/final.json); 5 calls, 5 successes               |
| Canal / vGPU         | [refined-contacts PNG](../../benchmarks/visual-parity-round17-20261018/trials/canal-vgpu/captures/refined-contacts/render.png)       | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/canal-vgpu/captures/refined-contacts/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/canal-vgpu/app)            | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/canal-vgpu/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/canal-vgpu/final.json); 5 calls, 4 successes                 |
| Courtyard / Aperture | [proportions PNG](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-aperture/captures/proportions/render.png)         | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-aperture/captures/proportions/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-aperture/app) | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-aperture/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-aperture/final.json); 4 calls, 3 successes |
| Courtyard / Three.js | [proportion-light PNG](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-three/captures/proportion-light/render.png)  | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-three/captures/proportion-light/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-three/app)  | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-three/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-three/final.json); 4 calls, 4 successes       |
| Courtyard / vGPU     | [composition-light PNG](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-vgpu/captures/composition-light/render.png) | [Captured source](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-vgpu/captures/composition-light/source), [restored app](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-vgpu/app)   | [All captures](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-vgpu/captures), [final metadata](../../benchmarks/visual-parity-round17-20261018/trials/courtyard-vgpu/final.json); 4 calls, 3 successes         |

H2 rail-halt remains untouched and undispatched. R18 subsequently supplied a fresh
comparison under unchanged acceptance rules after infrastructure follow-up;
resumed clocks, forced finish times or selected R17 images did not substitute for it.

### Round 18 completed authoring and validation

R18 completed six fresh author lanes on the same pushed engine checkpoint
`6b962dc`. The [final report](../../benchmarks/visual-parity-round18-20261018/REPORT.md),
[qualification record](../../benchmarks/visual-parity-round18-20261018/QUALIFICATION.md),
[final summary](../../benchmarks/visual-parity-round18-20261018/final-summary.json)
and [coordinator findings](../../benchmarks/visual-parity-round18-20261018/coordinator-findings.md)
retain the failed combined qualification and every original review. The [engine continuity receipt](../../benchmarks/visual-parity-round18-20261018/evidence/engine-checkpoint-continuity.json)
records only post-R17 coordinator plan/handoff changes; engine implementation
and built runtime remain the validated checkpoint. The [frozen protocol](../../benchmarks/visual-parity-round18-20261018/shared/PROTOCOL.md)
discloses durable supervision and extra neutral warm preflight while preserving
the existing warm native rendering route, approved browser lifecycle, capture
budgets and quality/timing gates. No automatic restart or author-time correction
is allowed; cross-round timing cannot isolate the product change. The [R18 source freeze](../../benchmarks/visual-parity-round18-20261018/evidence/round18-freeze.json)
and [shared author budget](../../benchmarks/visual-parity-round18-20261018/evidence/author-budget.json)
record dispatch **13:34:03.244576 UTC** and deadline **13:59:03.244576 UTC**.
All six authors finished before that deadline. All **36 calls** remain retained:
**31 successes and five failures**, with no restored capture budgets.

The [service preflight](../../benchmarks/visual-parity-round18-20261018/evidence/service-preflight.json)
passed and the [starter browser/native comparison](../../benchmarks/visual-parity-round18-20261018/evidence/starter-browser-native-control.json)
was exact. The [bounded native-service stability control](../../benchmarks/visual-parity-round18-20261018/evidence/native-service-stability.json)
passed **36 neutral native calls** before release. The [retained pixel observation](../../benchmarks/visual-parity-round18-20261018/evidence/native-stability-pixel-observation.json)
found two Aperture PNG hashes: maximum difference **1**, mean RGB
**0.008948765432098766**, exact alpha. vGPU had one hash in that control.
These infrastructure controls establish neither general memory/speed gains nor
exact Aperture native repeatability; no variation cause is inferred.

The [coordinator completion freeze check](../../benchmarks/visual-parity-round18-20261018/evidence/frozen-at-completion.json)
at **13:56:19.431449 UTC** and [independent integrity verification](../../benchmarks/visual-parity-round18-20261018/judging/technical-integrity-verification.json)
at **13:57:40.592411 UTC** verify **223 frozen source files/copies** and **1,259
runtime JavaScript files** unchanged. The initial coordinator probe incorrectly
included declarations/sourcemaps (5,037 files); the receipt retains this scope
correction and reports no changed or missing recorded JavaScript file. The
[final source verification](../../benchmarks/visual-parity-round18-20261018/evidence/final-source-verification.json)
records every selected app file hash and natural finish timestamp. This handoff
update follows those checks; it does not alter the saved release copies.

| Subject/framework    | Last successful final image                                                                                                      | Exact captured source and final app                                                                                                                                                                            | Attempts and final metadata                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canal / Aperture     | [final PNG](../../benchmarks/visual-parity-round18-20261018/trials/canal-aperture/captures/final/render.png)                     | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/canal-aperture/captures/final/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/canal-aperture/app)         | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/canal-aperture/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/canal-aperture/final.json); 6 calls, 5 successes         |
| Canal / Three.js     | [final PNG](../../benchmarks/visual-parity-round18-20261018/trials/canal-three/captures/final/render.png)                        | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/canal-three/captures/final/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/canal-three/app)               | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/canal-three/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/canal-three/final.json); 6 calls, 6 successes               |
| Canal / vGPU         | [final-corrections PNG](../../benchmarks/visual-parity-round18-20261018/trials/canal-vgpu/captures/final-corrections/render.png) | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/canal-vgpu/captures/final-corrections/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/canal-vgpu/app)     | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/canal-vgpu/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/canal-vgpu/final.json); 6 calls, 3 successes                 |
| Courtyard / Aperture | [final PNG](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-aperture/captures/final/render.png)                 | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-aperture/captures/final/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-aperture/app) | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-aperture/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-aperture/final.json); 6 calls, 6 successes |
| Courtyard / Three.js | [final PNG](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-three/captures/final/render.png)                    | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-three/captures/final/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-three/app)       | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-three/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-three/final.json); 6 calls, 6 successes       |
| Courtyard / vGPU     | [final-finish PNG](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-vgpu/captures/final-finish/render.png)       | [Captured source](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-vgpu/captures/final-finish/source), [final app](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-vgpu/app)  | [All captures](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-vgpu/captures), [final metadata](../../benchmarks/visual-parity-round18-20261018/trials/courtyard-vgpu/final.json); 6 calls, 5 successes         |

The [coordinator browser verification](../../benchmarks/visual-parity-round18-20261018/evidence/coordinator-browser-verification.json)
and [pixel comparisons](../../benchmarks/visual-parity-round18-20261018/evidence/final-browser-native-pixels.json)
pass both required Aperture final routes at unchanged maximum **12** / mean
**0.5** tolerance. Canal is maximum **1**, mean **0.00017530864197530866**;
courtyard is maximum **1**, mean **0.0014873456790123456**. Their standalone
[browser canal PNG](../../benchmarks/visual-parity-round18-20261018/evidence/canal-aperture-browser/browser.png)
and [browser courtyard PNG](../../benchmarks/visual-parity-round18-20261018/evidence/courtyard-aperture-browser/browser.png)
remain retained. Both vGPU authors supplied the permitted native-only route;
neither supplied an optional browser entry, so neither has a browser-portability
claim. Successful rendering/portability does not decide visual quality.

The [supervisor result](../../benchmarks/visual-parity-round18-20261018/evidence/service-supervisor/result.json)
at **13:57:54.257782 UTC** records the requested stop, both owned service jobs
exiting **0**, no remaining descendants and no restarts. The [coordinator cleanup verification](../../benchmarks/visual-parity-round18-20261018/evidence/service-cleanup.json)
at **13:58:58.480932 UTC** passes: all service PIDs absent, no owned runtime
processes/profiles remaining and both ports closed. The retained
[browser lifecycle manifest](../../benchmarks/visual-parity-round18-20261018/evidence/browser-lifecycle-manifest.json)
and [lifecycle audit](../../benchmarks/visual-parity-round18-20261018/evidence/browser-lifecycle-audit.jsonl)
record normal completion with exit **0**. The young runtime remains protected.
The [independent runtime verification](../../benchmarks/visual-parity-round18-20261018/judging/technical-runtime-verification.json)
and completed technical audit independently confirm this normal shared-service
cleanup, all 70 healthy capture supervision checks, no increased OOM-kill counter
across 2,042 observations and zero restarts. These bounded observations do not
establish arbitrary-scene memory safety. R17's lost owner, active manifest and
residual zombies remain separate history; this result does not rewrite that
interrupted lifecycle.

The [independent R18 judgments](../../benchmarks/visual-parity-round18-20261018/judging)
retain [visual judge one](../../benchmarks/visual-parity-round18-20261018/judging/visual-judge-one.json)
and [visual judge two](../../benchmarks/visual-parity-round18-20261018/judging/visual-judge-two.json).
The [computed visual assessment](../../benchmarks/visual-parity-round18-20261018/judging/assessment.json)
fails both subjects under unchanged gates. Canal means (Aperture / Three.js /
vGPU) are **6.9975 / 7.0000 / 7.4700**; Aperture's deficits to vGPU are **0.85
composition**, **0.40 shape** and **0.50 lighting**. Courtyard means are
**7.1475 / 7.1925 / 7.1125**; Aperture's **0.30 lighting** deficit exceeds the
0.25 limit. Courtyard shape deficit is exactly **0.25**, which is permitted.
Neither judge reports a major Aperture artifact. That artifact result does not
override the mean/category failures.

Visual feedback identifies a compact canal scene with insufficient foreground
water and a dominant van, plus courtyard camera/proportion and lighting
differences. The [independent effort review](../../benchmarks/visual-parity-round18-20261018/judging/effort-review.json)
and [exact recomputation](../../benchmarks/visual-parity-round18-20261018/recomputed-summary.json)
retain every attempt and all 31 successful image inspections. First-useful median
is **73.963424 s** for Aperture versus Three.js **85.655924 s**; ratio
**0.863494555262751**, pass. Finish median is **1197.580924 s** versus Three.js
**1087.610924 s**; ratio **1.1011115257978046**, fail. The unchanged 1.10 gate
allows **1196.3720164 s**, leaving an exact **1.2089076 s** miss. Rounding,
queue subtraction or mixing another round's results cannot turn this into a pass.
The [independent technical audit](../../benchmarks/visual-parity-round18-20261018/judging/technical-audit.md)
and [full machine-readable findings](../../benchmarks/visual-parity-round18-20261018/judging/technical-audit.json)
report **pass with bounded findings**. All six finals meet the real geometry,
procedural shader/reflection, last-success source, deadline, six-call and
required browser-proof gates. The authored canal vGPU app omits per-job
`target.destroy()` and failure-path cleanup, leaving private MSAA attachments
without explicit job disposal: a **moderate cleanup-instruction violation**.
Shared device disposal at shutdown does not make that app's per-job lifecycle
clean; exact retained bytes/duration remain unknown. Courtyard vGPU's zero-area
triangles/NaN normals and stale tree normals are retained as low-severity
geometry findings. These limitations remain attached to valid native final-image
comparisons; no peer or failure is discarded to change the outcome.

R18 completed its author window, unlike interrupted R17, but both visual gates
and finish fail. H2 remains untouched and undispatched.

The [post-submission author retrospectives](../../benchmarks/visual-parity-20261018/evidence/round18-author-retrospectives/README.md)
identify manual camera/layout/proportion adjustment as the largest reported
source of effort. These activities were not timed independently. Neither
Aperture author used the public camera fitting, landmark, local-inspection or
projected-bounds tools; their availability does not establish effectiveness,
ineffectiveness or speed. Reported workflow costs motivate a compact measurement
workflow. They do not justify an unchanged rerun, omitted failed capture or
altered acceptance gate.

The [accepted next-workflow design review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-workflow-review/PLAN_REVIEW.md)
proposes one CLI adapter around the existing CPU runner and fresh local-camera
inspection, using either a JSON request or a construction-owned request resource.
It centralizes request/error handling and disposal without new projection math,
camera mutation or GPU work. The design requires a neutral usability comparison
against existing documentation and a generated protocol client, followed by
engineering validation and fresh visual qualification. The implementation and full engineering validation now pass as recorded below.
The CPU pilot is now complete with the bounded findings below. Neither design
acceptance, engineering checks nor the pilot establishes author-time savings,
improved lighting or closure of R18's visual deficits.

### Round 19 reviewed measurement workflow and validation

The [implementation record](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command/IMPLEMENTATION.md)
and [accepted independent source review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command-review/REVIEW.md)
cover `aperture camera inspect-local <headless-config>` with exactly one
`--request <args.json>` or `--request-resource <id>`, plus optional `--out`.
Resource mode reads construction-owned **`values.request`** after app boot and
computes a fresh report; saved inspection results are never substituted.
The existing runner, Node asset loader, camera operation and disposer preserve
ECS ownership. Inspection adds no simulation step, extraction, camera mutation,
fit or GPU work; normal app initialization still runs. Strict assets and seed 0
are defaults; background/manual assets may retain incomplete/null bounds.

The complete tool envelope is published only after awaited disposal succeeds.
Semantic tool/resource failures return **2** with diagnostics; usage, I/O,
bootstrap or cleanup failures return **1** and preserve prior output; successful
tool execution returns **0** without implying complete bounds or visual quality.
Atomic output and input-alias checks protect requests/configs. The generated
recipe shares construction coordinates with the resource. Independent review
retains **28 command tests and nine external CPU probes**, including actual
asset readiness, cleanup failure and output protection. The earlier catalog
misassignment and its correction remain retained.

The reviewed [installed-package smoke](../../scripts/check-pack-cli.mjs) runs both
request modes through the actual installed CLI. Its source request precedes a
parent transform edit; the independent post-boot world/pixel oracle rejects stale
center reuse. It also checks resource semantic failure, exit 2 and the full error
envelope. Both packed Dawn execution and the full check's standard packed route
pass; source-level mocks alone are not claimed as package proof.

The [visual-gap diagnosis and bevel review](../../benchmarks/visual-parity-20261018/evidence/round18-visual-gap-diagnosis/REVIEW.md)
support authored proportion, lighting and foliage differences without isolating
a new renderer defect. The narrow bevel message now exposes the supplied value,
size and exclusive maximum. Its accepted range and descriptor bytes are
unchanged; invalid arbitrary objects are not coerced. The review's scoped
188-draw contact check found no coplanar overlaps within stated tolerances; it
does not certify every contact or identify the cause of stippling. All original
R18 images, scores and failed attempts remain retained.

The [build receipt](../../benchmarks/visual-parity-20261018/evidence/round19-validation/attempt-2026-10-19T14-18-21.309Z/result.json)
passes separately. The [remaining validation receipt](../../benchmarks/visual-parity-20261018/evidence/round19-validation/attempt-2026-10-19T14-20-34.111Z/result.json)
passes **65 native Dawn tests**, packed CLI Dawn rendering/inspection,
**1,200-frame memory checks** and the full repository check. Vitest passes
**5,158 tests in 701 files**, shuffle seed **1792419896379**; boundaries,
release/build/types, examples, docs, diagnostics, lint and formatting also pass.
Both attempts retain **203 unchanged source files**. This status-only plan/handoff
update follows validation and is not part of those frozen source hashes.

The [CPU usability pilot protocol](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/PROTOCOL.md)
and historical [prepared record](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/PREPARED.json)
compare existing finite-protocol documentation, a supplied protocol client and
the thin CLI on the same generic sign assembly. All three authors completed;
the [collection receipt](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/COLLECTION.json)
retains every submitted file. The [independent review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/independent-review/REVIEW.md)
and [machine-readable audit](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/independent-review/review.json)
verify all **17 frozen inputs, 115 collected files and 1,260 built package
JavaScript files** against their hashes. Only the permitted parameter file
changed from the prepared apps; all four saved stage snapshots match.

| Pilot route                               | Retained author evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Mechanical assessment                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: existing finite-protocol documentation | [App and helper](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-a/app), [author report](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-a/app/RESULTS.md), [operation ledger](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-a/app/operations.jsonl), [four full envelopes](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-a/app/reports)          | [Pass: initial, revised, invalid and recovered stages](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-a-assessment.stdout.json) |
| B: supplied protocol script               | [App and supplied helper](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-b/app), [author report](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-b/app/RESULTS.md), [operation ledger](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-b/app/operations.jsonl), [four full envelopes](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-b/app/reports) | [Pass: initial, revised, invalid and recovered stages](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-b-assessment.stdout.json) |
| C: one-shot CLI                           | [App](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-c/app), [author report](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-c/app/RESULTS.md), [operation ledger](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-c/app/operations.jsonl), [four full envelopes](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/retained-arms/route-c/app/reports)                     | [Pass: initial, revised, invalid and recovered stages](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-c-assessment.stdout.json) |

All twelve reports have correct analytic measurements and deliberate-failure
handling. Plate width changes **300 to 400 pixels**, the bracket tip shifts
**25 pixels**, and recovered reports match the revised static source. Every
invalid selector produces `ok:false` with no result. A retains process exit 0;
B/C retain exit 2. All authors distinguish process exit from tool success.
Nevertheless, **full operational acceptance is not established in any arm**:
none explicitly explains that partial per-mesh data cannot be promoted to a
complete aggregate when aggregate bounds are null. No null aggregate occurred,
so this is missing explanation evidence, not an observed misuse. Original
reports and failures remain unchanged; no correction replaces the pilot result.

The **supplied script and CLI tie** on retained workflow evidence: each has four
measurement launches, zero authored route helpers/edits, zero manual envelope
extractions, three summary selections and one prescribed selector restoration.
A authored one route helper, then also used one launch per stage. B's supplied
helper is byte-identical to its frozen version. Raw self-reported action totals
**17/18/15** use inconsistent categories and cannot rank total effort. No
accidental measurement error is observed or reported in retained artifacts;
unlogged activity and errors remain unknown.

The prospective [evidence-limit addendum](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/PROSPECTIVE_EVIDENCE_LIMIT_ADDENDUM.md)
limits these findings to **one author per route** and editable retained artifacts.
Counts are author-reported with log corroboration, not authenticated complete
transcripts. Stage filenames may overwrite earlier attempts; intermediate state,
inline-command source and every read are not fully captured. The CLI ledger,
exit records and stdout/report equality are consistent with the assigned route,
without independently proving it; editable serve logs have the same provenance
limit. There is no observed missing log for a reported attempt, but completeness
and author isolation are not certified. No general timing, statistical, causal,
visual-quality or R18-remediation claim follows.

R19 visual qualification and untouched H2 remain unstarted. The reviewed product
checkpoint is still uncommitted at this update. Commit/push and complete private
evidence publication remain pending; R18's failed gates are unchanged.

The original harbor remains a distinct historical failure: Aperture **7.125**,
Three.js **8.2125**, vGPU **7.6625**. Coordinator repairs never met the original
absolute 8.2125 target. Every repair attempt and raw review remains in the
[repair history](../../benchmarks/visual-parity-20261018/harbor) and
[historical judging directory](../../benchmarks/visual-parity-20261018/judging).
After a [blinded methodology review](../../benchmarks/visual-parity-20261018/evidence/judge-scale-methodology-review.md)
found unstable cross-panel scores for the identical peer image, a
[prospective four-judge paired protocol](../../benchmarks/visual-parity-20261018/evidence/harbor-paired-confirmation-protocol.md)
was frozen before repair-11 judging. All four paired differences are positive:
**+0.565, +0.575, +0.530, +0.835**; category/contact gates pass. Raw paired means
are 8.0800 / 7.45375. The [amended assessment](../../benchmarks/visual-parity-20261018/judging/harbor-round11/assessment.json)
passes; the original absolute gate remains failed. Do not combine this coordinator
repair with fresh author timing or combine passing components from different rounds.

## Validation and evidence coverage

R17 engineering validation now passes; the [checkpoint validation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-validation.json)
binds the component checks, memory results and test-only difference proof.
The [first validation attempt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/attempt-2026-10-19T12-30-39.486Z/result.json)
records successful build, **65 native Dawn tests**, packed-package Dawn rendering
and **1,200-frame memory checks**, followed by a full-check failure in two new
shadow test files. The [test-only correction](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-test-typecheck-correction/receipt.json)
keeps runtime/configuration/changeset bytes unchanged and passes the focused
48 tests plus full test type checking. The [complete check rerun](../../benchmarks/visual-parity-20261018/evidence/round17-validation/attempt-2026-10-19T12-35-11.346Z/result.json)
then passes with source unchanged: **5,127 tests in 700 files**, shuffle seed
`1792413510153`, Vitest duration **199.32 s**, zero errors and two pre-existing
reference ESLint warnings. Package boundaries, release checks, build/types,
examples, docs, diagnostics, lint, formatting and packed CLI all pass.
The real installed projected-bounds smoke runs successfully in both the Dawn
packed check and the full check's standard packed command. These are engineering
results; fresh benchmark qualification and the untouched transfer remain open.
The [checkpoint commit receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-commit.json)
then records all 34 files committed and pushed as `6b962dc`. This interruption
status update follows validation and post-stop freeze verification; it does not
claim inclusion in the passing full-check source or the original R17 freeze.

The committed round-12 validation retains **4,906 tests in 689 files**, shuffle
seed `1792372143695`, **65 native GPU tests**, packed-CLI Dawn smoke, 1,200-frame
memory qualification and separate installed camera-command checks. Exact commands,
source inventories, logs and failed inventory-only attempt are under
[round-12 validation](../../benchmarks/visual-parity-20261018/evidence/round12-validation)
and [packed camera evidence](../../benchmarks/visual-parity-20261018/evidence/round12-packed-camera).
This is evidence for that checkpoint, not a full-suite result for today's dirty tree.

For earlier boundaries, the [Dawn/shader completion record](shader-gpu-and-dawn-node-rendering.md#final-verification-record)
retains 4,735 tests/671 files and Node 22/24 native validation;
[garden follow-up validation](../../benchmarks/chinese-garden-20261017/followup/validation.json)
and [car validation](../../benchmarks/car-construction-20261017/evidence/validation.json)
cover their later changes. These counts are chronological records, not quantities
to add together. Local `.aperture-env/dawn-evidence` logs exist here but are not
promised as Git-tracked or included in the final downloadable archive.

The staged-guidance/camera/profile checkpoint `2c500eb` has complete
[combined validation receipts](../../benchmarks/visual-parity-20261018/evidence/round13-validation/checkpoint-validation.json):
**4,943 tests in 691 files**, shuffle seed `1792392929674`, the native suite,
packed-CLI Dawn smoke, memory qualification, **36 installed camera-command cases**,
**ten native profile controls**, and **two browser profile controls**. Native and
full-check inventories differed only in the generated diagnostic catalog, plan
prose formatting and a narrow immutable capture-source ESLint exclusion; runtime,
authoring-example and test bytes matched. Earlier failed attempts are retained.
These checks predate the assembly/light diagnostics; that later checkpoint has
its own R14 validation receipts. Those earlier receipts do not validate R15;
its completed engineering validation is recorded separately below.

The implemented assembly follow-up passed **18 focused template/native tests**.
The [independent assembly review](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-review.md)
passed its **five focused tests**, confirmed byte-identical Float32 worlds for
all six mesh draws and equal assets/presentation settings, and ran a separate
five-pose contact control. The maximum shared-face discrepancy is
**1.1920928955078125e-7** units. Ordinary ECS roots shift some entity IDs but
introduce no mesh draws. This evidence proves the tested transform/contact
behavior, without claiming new author savings or a rendered visual improvement.

The [independent lighting review](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.md)
passed **36 tests in three files**: 28 focused product tests plus eight independent
controls. It reproduced and verified fixes for moving-camera material rescans and
a fingerprint collision between identity and 180° camera yaw. The final
`createLightingHealthAnalyzer()` separates compatibility and geometry caches;
four moving-camera frames after warmup perform zero repeated material/entity
comparisons in the retained 1,000-item controls. Existing compatibility-change
cost and finite hash collision limits remain; this is structural evidence, not
a frame-time speed claim. The reviewed evidence covers actual light packing,
parented/rolled/scaled views, invalid inputs, copy isolation and 67 cache-edit
comparisons. The report describes extracted matrices and ideal horizontal-plane
shadows, not occlusion, material brightness or image quality.

R14 full repository validation passed **4,968 tests / 692 files**, shuffle seed
`1792397216990`, plus **65 native tests**, packed Dawn and memory checks. Its
[exact checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-validation.json)
and [commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-commit.json)
separate engineering validation from the subsequently failed author round.
The [preparation receipt](../../benchmarks/visual-parity-round14-20261018/evidence/preparation.json)
is historical setup evidence; the [round-14 freeze](../../benchmarks/visual-parity-round14-20261018/evidence/round14-freeze.json)
and completed report supersede its earlier unstarted status. Source audits,
all final proofs and cleanup passed.

R15's [engineering checkpoint receipt](../../benchmarks/visual-parity-20261018/evidence/round15-validation/checkpoint-validation.json)
consolidates the accepted camera/coplanar/timestamp reviews and passing
[combined package build](../../benchmarks/visual-parity-20261018/evidence/round15-validation/attempt-2026-10-19T09-37-16.768Z/result.json),
[full repository check, packed Dawn and memory results](../../benchmarks/visual-parity-20261018/evidence/round15-validation/attempt-2026-10-19T09-56-07.769Z/result.json).
The full suite passes **5,046 tests / 696 files**, shuffle seed **1792403991336**;
lint reports **zero errors and two existing upstream warnings**. The first
[validation attempt](../../benchmarks/visual-parity-20261018/evidence/round15-validation/attempt-2026-10-19T09-55-17.617Z/result.json)
passed all **65 native Dawn tests** before the new packed inspection fixture
failed on an undeclared direct simulation-package import. Its original script
and failure log remain retained. The fixture now uses the existing public
`@aperture-engine/app/systems` `LocalTransform` export. Packed Dawn rendering
and **1,200-frame memory qualification** subsequently passed.

Independent review accepted the fixture correction and suggested an explicit
finite-overlap-area assertion. That test-only follow-up passed a separate
[final packed Dawn rerun](../../benchmarks/visual-parity-20261018/evidence/round15-validation/attempt-2026-10-19T10-03-14.895Z/result.json).
Product source remains unchanged from the full check; the stronger fixture
assertion and plan/handoff status updates are disclosed separately. This records
completed engineering validation without replacing either failed native exact-pixel
control below. The [commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round15-validation/checkpoint-commit.json)
records `88fc6551fb197038fe88ed671dae821e96745c60`; the [service preflight](../../benchmarks/visual-parity-round15-20261018/evidence/service-preflight.json)
and [starter browser/native control](../../benchmarks/visual-parity-round15-20261018/evidence/starter-browser-native-control.json)
pass. The [R15 preparation receipt](../../benchmarks/visual-parity-round15-20261018/evidence/preparation.json)
is historical setup evidence, superseded by the [source freeze](../../benchmarks/visual-parity-round15-20261018/evidence/round15-freeze.json)
and completed author round. Its finish failure remains separate from engineering
validation. The initial capture-profile control is an engineering experiment,
not author work. Rail-halt remains untouched and undispatched.

R15's [final camera validation receipt](../../benchmarks/visual-parity-20261018/evidence/round15-camera-local-validation.md)
records **81/81 tests in four CPU files**, seed `1792401544516`, plus focused
TypeScript, ESLint and formatting. Its separate [independent review](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/findings.md)
reports **39 tests**, including nine independent controls, with no remaining
blocker; [source/observation metadata](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/review.json)
identifies the reviewed scope. The final [finite/null guard addendum](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/frozen-addendum.md)
passes **40/40 CPU tests**, seed `1792401838290`, and retains
[final source hashes](../../benchmarks/visual-parity-20261018/evidence/round15-camera-review/frozen-addendum.json).
These are separate runs, not additive coverage.
The implementation receipt retains the earlier unintended broader test selection
and its three adapter-unavailable native failures; no successful native validation
is credited to that attempt. The isolated MCP catalog case subsequently passed.

The [accepted coplanar review](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/review.md)
retains **15 independent source groups**, including **120 analytic rectangle
cases**, plus **four CLI groups**. [Source results](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/independent-source-results.json)
and [CLI results](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/independent-cli-results.json)
cover known areas, transformations, thresholds, malformed data/budgets, immutability,
strict bundle decoding, atomic output and protected aliases. The
[implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-review/implementer-validation.json)
retains **35/35 focused tests** and scoped type/lint/format passes; six resolved
findings and pre-fix evidence remain linked from the review. Source/CLI checks
used existing dist dependencies; they remain separate from the later successful
combined build. The [rebuilt offline R14 control](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-r14-control/report.md)
then reports **32 door/plinth triangle-pair overlaps → 0** for the frozen baseline
and split-plinth bundles, with complete coverage of **9/9 → 10/10** selected draws.
The [exact settings and receipts](../../benchmarks/visual-parity-20261018/evidence/round15-coplanar-r14-control/summary.json)
retain unchanged bundle/inspector bytes. Pair areas are not a geometric union,
visibility remains unknown, and this CPU control changes no R14 image or score.
The subsequent full engineering validation and final packed Dawn check above
cover the installed package at committed/pushed `88fc655`; the subsequent author
qualification fails finish time.

The [timestamp repair receipt](../../benchmarks/visual-parity-20261018/evidence/round15-timestamp-repair/README.md)
retains **167/167 focused CPU tests** in seven files; the
[accepted independent review](../../benchmarks/visual-parity-20261018/evidence/round15-gpu-timing-review/findings.md)
passes **75/75**, including 11 independent controls. Standard pass descriptors,
main/shadow coverage, valid zero durations, unsupported/invalid samples and
readback/lease failure cleanup are covered. Preliminary failing controls and
preparation errors remain retained. These are report/command correctness checks,
not a measurement of native timestamp precision or author speed.

The [corrected browser timestamp smoke](../../benchmarks/visual-parity-20261018/evidence/round15-browser-timestamp-smoke/result.md)
passes **three fixed renders and 33 checks** in one approved browser launch:
untimed, timing enabled/supported, and timing requested without timestamp support.
All three **384×288** raw outputs are byte-identical. Requested reports disclose
partial coverage; unsupported timing is non-ready with an explicit reason.
Cleanup, frozen source and all **1,253 built files** pass verification. The first
harness attempt remains failed with **zero renderer calls** after an adapter
consumption error; only adapter acquisition changed for the retained second attempt.

The separate [native six-call repair control](../../benchmarks/visual-parity-20261018/evidence/round15-timestamp-native-validation/README.md)
renders and disposes all six outputs, and all three timed calls report valid main
and shadow samples. Its unchanged **exact-pixel gate fails**: five raw outputs
share SHA256 `6e01abe82a594fce1fccfc6c462c890a86069ece076e5b87ed6a66eee31cec82`,
while the third untimed output has
`e6e791b36501fee0439f5e1b18cdfd14f808dd178b15da34cce5e9399f93dffd`.
**19,604 / 1,080,000 pixels** differ; every changed channel is exactly **+1**.
This quantifies the failure without adding a tolerance. Full attempt/source/dist
archives and the original failed result remain retained.

A separate [pre-repair untimed repeatability control](../../benchmarks/visual-parity-20261018/evidence/round15-r14-untimed-repeatability/README.md)
then makes exactly **three calls**, with isolated old package resolution, one
fresh persistent device and the same frozen fixture/settings. It reproduces the
**same two RGBA hashes**. The variation therefore predates the repair and does not
require timestamp instrumentation; its arithmetic source remains unidentified.
Both original exact-repeatability gates remain failed. No retry, replacement
sample, tolerance, pass-cost comparison or performance claim follows from the
control. The subsequent R15 author qualification fails finish time; it does not
change either native control's exact-equality outcome.

Every completed round stores source snapshots under `trials/*/captures/*/source`,
phase records in `timing.json`, attempts in `attempts.jsonl`, selected final and
finish time in `final.json`, and anonymous raw reviews in `judging/`. Source-hash
verification, final browser comparisons and service cleanup are in `evidence/`.
The [evidence guide](../../benchmarks/visual-parity-20261018/EVIDENCE_GUIDE.md)
explains missing phase coverage, hard-linked immutable files and storage receipts.
Use the declared last successful source, never an earlier best-looking shot.

## Galleries, archives and publication gaps

All URLs below refer to the private hosted comparison site. Their availability
may require the owner's authenticated access. The latest retained verification
checks **216 files**, including gallery HTML, via authenticated HTTP, MIME types,
byte hashes and PNG decoding. A separate local check verified **367 image links**
to standalone PNG assets. This handoff did not rerun those checks; they do not
establish browser interaction QA.

| Published concept                                    | Gallery URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Retained publication / verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Garden and follow-ups                                | [Garden](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/)                                                                                                                                                                                                                                                                                                                                                                                                                                            | [Original deployment](../../benchmarks/chinese-garden-20261017/evidence/hosted-gallery.json), [follow-up update](../../benchmarks/chinese-garden-20261017/followup/hosted-update.json).                                                                                                                                                                                                                                                                                                                                                                                                 |
| Street corner                                        | [Street](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/street-corner/)                                                                                                                                                                                                                                                                                                                                                                                                                              | [Deployment](../../benchmarks/street-corner-20261017/evidence/hosted-update.json), [gallery QA](../../benchmarks/street-corner-20261017/evidence/gallery-qa.json).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Car construction                                     | [Car](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/car-construction/)                                                                                                                                                                                                                                                                                                                                                                                                                              | [Publication](../../benchmarks/car-construction-20261017/evidence/publication.json).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Original harbor                                      | [Harbor](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/harbor/)                                                                                                                                                                                                                                                                                                                                                                                                                                     | [Publication](../../benchmarks/harbor-20261017/evidence/publication.json).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Repeated parity, canal/courtyard and harbor repair   | [Parity index](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/)                                                                                                                                                                                                                                                                                                                                                                                                                        | Latest retained [deployment receipt](../../benchmarks/visual-parity-20261018/evidence/progress-round14-deployment.json), [216-file HTTP/HTML/MIME/image verification](../../benchmarks/visual-parity-20261018/evidence/progress-round14-site-verification.json), [gallery preparation](../../benchmarks/visual-parity-20261018/evidence/progress-round14-gallery-preparation.json) and [367 local image-link checks](../../benchmarks/visual-parity-20261018/evidence/progress-round14-local-image-links.json). Gallery/report coverage through round 14 and the failed first transfer. |
| Round 12 and first held-out fuel stop                | [Round-12 gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round12/), [fuel-stop gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/heldout/), [round-12 canal image](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round12/images/canal-aperture-final.png), [fuel-stop image](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/images/fuel-stop-aperture-final.png) | Included in current publication with all three peers. Earlier source `10e3655` [deployment](../../benchmarks/visual-parity-20261018/evidence/progress-heldout-deployment-20261019.json) and [177-file verification](../../benchmarks/visual-parity-20261018/evidence/progress-heldout-site-verification-20261019.json) remain retained.                                                                                                                                                                                                                                                 |
| Round 13 completed qualification                     | [Round-13 gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round13/)                                                                                                                                                                                                                                                                                                                                                                                                            | Retained in current publication; failed courtyard lighting and finish gates remain disclosed alongside all peers. Earlier source `8efeafa` [deployment](../../benchmarks/visual-parity-20261018/evidence/progress-round13-deployment.json) and [203-file verification](../../benchmarks/visual-parity-20261018/evidence/progress-round13-site-verification.json) remain retained.                                                                                                                                                                                                       |
| Round 14 completed qualification                     | [Round-14 gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round14/)                                                                                                                                                                                                                                                                                                                                                                                                            | Published in source `87b2985`; failed canal visual and finish gates and all prior history remain disclosed. Images use standalone PNG files and canonical shared references.                                                                                                                                                                                                                                                                                                                                                                                                            |
| R15–R18 follow-ups, rail-halt and this local handoff | Local evidence; completed failed R15/R16 qualifications, interrupted R17, completed R18 scenes with failed visual/finish gates, no authored rail-halt result                                                                                                                                                                                                                                                                                                                                                             | The deployed `HANDOFF.md` was copied before this local completed-R14 update. The live gallery's R14 coverage does not make that hosted document current or publish the later R15–R18 implementation/results or the interrupted R17 scenes. Rail-halt remains untouched.                                                                                                                                                                                                                                                                                                                 |

The latest deployment **succeeded** at `2026-10-19T08:59:57.705827Z`:
`appgdep_6ad5dbff71848191815fe1a6f0987f39`, site source
`87b29859eda6b30e11cd6925603235bc81d5e082`. It covers galleries/reports through
**round 14**, harbor repair 11 and the **failed fuel-stop transfer**.
Its downloadable archives are explicitly labeled **through round 3**. The site
source commit is separate from product checkpoint `6b962dc`; neither commit
means that all local benchmark artifacts were pushed.

The [verified deployment archive](../../benchmarks/visual-parity-20261018/evidence/progress-round14-archive.json)
contains **823 files**, **245,566,318 expanded bytes** and **235,822,410 compressed
bytes**, SHA-256 `1b5b186a10ad0a1b26456b8d6990b2d21145b28ed48501ebef23c9d6c894b801`.
This is the website deployment payload, not a new complete downloadable benchmark
archive. The deployment receipt explicitly records that its `HANDOFF.md` snapshot
predates the local completed-R14 update; publish that document separately when
ready rather than treating the gallery deployment as proof of document freshness.

| Coverage layer                        | Exact status at this update                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local workspace                       | Earlier concept batches, rounds 1–18 including interrupted R17, failed fuel-stop, untouched prepared rail-halt, committed R15 camera/coplanar/timestamp work, completed failed R15/R16 qualifications and bounded workflow controls/guide follow-up, completed initial capture-profile control and failed feature/pass follow-up, reviews, controls, raw judgments and diagnoses are retained. R17 sphere diagnostics, shadow request reuse and corrected projected bounds have accepted reviews and full repository/native/package validation. The 18-call native asset-sharing control failed both output gates; its independent audit and archive reconstruction pass. R17 has 27 retained calls and six provisional last-success scenes after a shared-service interruption; it is ineligible for qualification. R18 retains all 36 calls and six finals, exact source/runtime integrity and passing browser proofs; both visual gates and finish fail. Some relocated bundle bytes depend on the external storage receipt below. |
| Product Git                           | Reviewed and fully validated checkpoint `6b962dc2cff7c15dba42e3fa5a43739a78c87777` is committed and pushed. It includes the earlier work plus R17 sphere diagnostics, projected bounds and shadow resource reuse. The interrupted author round and this later status update have separate preservation/publication steps. Benchmark evidence is largely untracked and requires separate preservation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Live gallery                          | Verified progress publication through round 14, harbor repair 11 and failed fuel-stop. Hosted `HANDOFF.md` is an older copy; this current local handoff and later R15–R18 implementation/results are not established as published by that deployment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Downloadable source/evidence archives | Explicit coverage only through round 3. Complete later-round source/evidence packaging, extraction and hash verification remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Separate generated-build archive      | The earlier through-R12 build archive and five external storage archives preserve removed files; all need explicit materialization in complete source/evidence publication. The five-artifact allowlist is registered and checked; complete multipart outputs remain unpublished.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Completed generated builds through round 12 have a separate lossless segmented
[archive README](../../benchmarks/visual-parity-20261018/evidence/generated-builds-through-round12/README.md),
[inventory](../../benchmarks/visual-parity-20261018/evidence/generated-builds-through-round12/inventory.json)
and [verification result](../../benchmarks/visual-parity-20261018/evidence/generated-builds-through-round12/result.json).
These preserve removed redundant build products, not the full author/evidence
archive. Restore into a copy, verify the declared hash and inspect members first.
Dependency installations/runtime caches are excluded. Final source/evidence
packaging uses [package-evidence.py](../../benchmarks/visual-parity-20261018/shared/package-evidence.py)
and [archive verification](../../benchmarks/visual-parity-20261018/shared/verify-evidence-archives.py);
its final manifest and coverage remain pending, not implied by those tools existing.
The [engine-source scope preview](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/engine-source-scope.json)
corrects the prospective source selection to start at
`8b8275b82c23ddd61690fe975e45b3f10842408b`, the parent of original earlier-batch
commit `a4cef30`, rather than the later `cbcb6e7` baseline. This retains unchanged
earlier Dawn/shader/AO/polygon implementation files alongside later changes,
current untracked product files and required root configuration, docs-site,
`.github` and tools. The read-only preview records **470 source files**, with
required earlier-batch pointers present and no deleted source paths; the final
count can grow as work completes. The [independent source-selection review](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/canonical-bundles/package-selector-review.json)
confirms the exact preview, earlier commit parent, required earlier paths and
absence of generated dist/dependency files. This is a source delta plus explicit
root configuration, not a complete checkout. Real packaging, extraction
verification and publication remain separate steps; intended coverage of both
batches does not establish a downloadable archive.

Two further coverage blockers were identified during the interrupted R17 window:

- The earlier [Dawn evidence directory](../../.aperture-env/dawn-evidence) and
  [material parity finals](../../.aperture-env/dawn-evidence/material-parity-final)
  are already linked from this handoff, but the then-current benchmark/source
  selector omitted `.aperture-env/dawn-evidence`. Bounded evidence inclusion is
  required without bundling dependencies or runtime binaries.
- The native control's [CPU preparation archive](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/cpu-preparation.tar.gz),
  [original full-experiment archive](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/full-experiment.tar.gz)
  and [completed workspace archive](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/completed-workspace.tar.gz)
  each exceed the ordinary 24 MiB per-file publication limit. Splitting a tar's
  file list cannot make these indivisible compressed artifacts fit. Exact
  canonical-path-aware multipart reconstruction, full identity checks and
  portable links are required; omitting the archives would lose retained proof.

The [packaging implementation validation](../../benchmarks/visual-parity-20261018/evidence/round17-package-completion/validation.json)
and [focused test log](../../benchmarks/visual-parity-20261018/evidence/round17-package-completion/tests.log)
record **33 passing focused tests**, including the actual packager/verifier and
offline reconstruction in a temporary synthetic repository. The helper changes
address both gaps in code: three canonical archives total **138,826,304 bytes**
with **eight prospective 23 MiB parts**, and the bounded earlier Dawn directory
contains **349 files / 8,396,297 bytes** by metadata enumeration. These counts
and retained archive identities are not fresh hashes of the large real sources.
The [independent packaging review](../../benchmarks/visual-parity-20261018/evidence/round17-package-independent-review/REVIEW.md)
accepts the implementation after **32 independent controls and 61 focused
compatibility tests**; [corrected scope proofs](../../benchmarks/visual-parity-20261018/evidence/round17-package-completion/scope-correction)
retain the source-selection correction. The [fifth-archive addendum](../../benchmarks/visual-parity-20261018/evidence/round17-package-independent-review/FIFTH_ARCHIVE_ADDENDUM.md)
accepts that separate registration delta after **five additional independent
controls and 17 focused tests**. Real complete packaging, canonical/external
reconstruction, full source-coverage verification and owner-private publication
remain pending. Source evidence stays retained locally; synthetic tests and
source-archive identity receipts do not complete handoff publication.
Local path/anchor checks establish navigation in this workspace, not that the
same relative links resolve in the older hosted `HANDOFF.md` or its downloads.

For the combined future package, follow the current
[multipart consumer instructions](../../benchmarks/visual-parity-20261018/shared/EVIDENCE_MULTIPART.md):
**reconstruct canonical archive parts into a new evidence tree first**, then
extract ordinary evidence/image tars into that same tree. Reconstruct the five
external storage archives into separate new staging directories. Earlier storage
packets retain their historical ordinary-first wording; that ordering predates
canonical byte parts and must not be used for the new combined package. Inspect
inner archive inventories before extraction and do not overwrite current work.

## Reproduction and operating requirements

Start with [AGENTS.md](../../AGENTS.md), the [Dawn runbook](../DAWN_NODE_RENDERING.md)
and [cloud browser runbook](../CLOUD_LOCAL_RENDERING.md). Qualified native baseline:
Linux x64, Node 22.18.0 or qualified Node 24, direct `webgpu@0.6.2`, pinned
SwiftShader/Vulkan. Historical trials used Node 24.19.0, Three.js 0.186.1 and
vGPU 0.6.0; use each frozen protocol/package lock for exact versions. Browser proof
uses the separately provisioned Chromium 153.0.0 runtime package and Playwright
Core 1.60.0, exact flags, fresh profiles, loopback isolation and lifecycle cleanup.
Other operating systems, physical GPUs and later library versions need separate
qualification. vGPU belongs only to benchmark dependencies.

Fresh installation/build is needed in a new checkout; none was run to prepare
this handoff. Respect the root lockfile/package-manager pin. In this prepared
workspace use installed binaries directly: `pnpm exec` can trigger dependency
reconciliation. Do not print environment contents or inspect credentials. Native
rendering needs provisioned `VK_ICD_FILENAMES`/loader paths; browser work needs
`APERTURE_WEBGPU_RUNTIME` and wrapper-owned `APERTURE_TMP_RUN`, as documented.
Never reuse old service ports, PIDs, runtime scratch, budget files or capture labels.

The following are reproduction commands, not checks newly executed for this draft.
Run from the repository root, use fresh output locations, and keep benchmarks
immutable. Stop shared services and finish validation before new author clocks.

```sh
# A NEW checkout only: install from the frozen lockfile, then build packages.
pnpm install --frozen-lockfile
pnpm run build

# Full required repository validation in a correctly installed checkout.
pnpm run check

# Focused CPU/source tests; include the active paths only after their review.
node node_modules/vitest/vitest.mjs run test/cli/camera-landmarks.test.ts test/cli/camera-unproject.test.ts test/mesh/fitted-props.test.ts test/mesh/profile-shape-sheet.test.ts test/cli/create.test.ts test/cli/diorama-authoring-native.test.ts

# Required native suite / packed CLI / memory qualification; provision GPU first.
pnpm run test:dawn
node scripts/check-pack-cli.mjs --render-dawn
node scripts/check-dawn-memory.mjs

# Recompute a retained round to a NEW output directory without rendering.
python3 benchmarks/visual-parity-20261018/shared/summarize-round.py benchmarks/visual-parity-round12-20261018 /tmp/aperture-handoff-round12

# Portable example extraction and a NEW native output, after package build.
node packages/cli/dist/bin/aperture.js headless examples/planar-reflections/aperture.headless.config.ts --out /tmp/aperture-handoff-reflections.bundle.json --asset-mode strict --render-width 1200 --render-height 900
node packages/cli/dist/bin/aperture.js render /tmp/aperture-handoff-reflections.bundle.json --backend dawn --adapter software --out /tmp/aperture-handoff-reflections.png --json

# CPU camera jobs: save the complete JSON examples from CAMERA_LANDMARKS.md first.
node packages/cli/dist/bin/aperture.js camera project camera-job.json --out /tmp/aperture-handoff-projection.json
node packages/cli/dist/bin/aperture.js camera fit camera-job.json --out /tmp/aperture-handoff-fit.json
node packages/cli/dist/bin/aperture.js camera unproject plane-job.json --out /tmp/aperture-handoff-placement.json
```

`unproject` is committed in checkpoint `2c500eb`; build that source or use its
validated installed package. Earlier checkpoint `0239f77` contains only project/fit. Camera fit or placement can return exit 2 for a valid
job that fails its acceptance criteria; inspect the report rather than forcing
success. The [shape-sheet guide](../../examples/fitted-props/SHAPES.md#run-the-study)
gives copy-to-scratch commands and explicit hero/side/front/rear variants. The
[shader guide](../SHADER_FIRST.md) and [material guide](../SHADER_MATERIALS.md)
give complete WGSL build/inspect/job examples, rather than a scene-specific shader.

All cloud browser runs must use `pnpm run render:cloud` or `runVerifiedScene`
inside the established cleanup wrapper. Do not launch browser binaries/Playwright
as an alternative. [Parity scripts](../DAWN_NODE_RENDERING.md#evidence-and-performance)
remain subject to that wrapper. Historical replay scripts may have immutable
output guards; run in a separate evidence copy with pinned packages. Do not
regenerate anonymous mappings or overwrite author captures. Before a new round,
freeze source/instructions, preflight all routes and wait for all authors at the
common barrier before one atomic release. No root checks/GPU jobs/packaging may
overlap author clocks.

## What the measurements cannot establish

- One author per framework/subject, repeated canal/courtyard references and
  iterative selection of product versions limit generalization. A later pass
  does not erase earlier failures. Rail-halt remains within a related low-poly
  family, even when unused before dispatch.
- Authors/judges use independent contexts with inherited matching model/reasoning
  settings; exact named model/version/effort values are not supplied by the old
  run metadata. Related-model panels, framework familiarity and subjective visual
  scores remain confounds. Blinding is procedural, not a filesystem security wall.
- Rounds 1, 2, 7, 9 and 10 have the process changes/disclosures listed above;
  round 11 has a judge-order discrepancy. Cross-round time comparisons cannot
  silently assume identical startup/infrastructure. Read each raw receipt.
- Shared software-GPU load and later provider scheduling remain variable after
  the release barrier. The held-out vGPU author had [three capacity failures](../../benchmarks/visual-parity-heldout-20261018/evidence/author-capacity-interruption.json)
  after first captures, resumed on the same clock/model/budget. No downtime or
  hypothetical uncontended duration is subtracted.
- R17 was interrupted by shared infrastructure before its deadline. All six
  last-success scenes are provisional and unjudged; forced final timestamps
  cannot measure natural author completion. Neither a visual nor a timing pass
  follows, and cumulative OOM counters alone do not identify the outage cause.
- Wall time/attempts are cost proxies, not billing, token usage or active labor.
  Queue, build, preflight and service phases have coverage limits and need not
  partition elapsed time. GPU fences are wall-clock waits, not hardware timestamp
  queries. Three.js browser versus Aperture warm-Dawn authoring routes are product
  workflow differences, not equivalent renderer workloads.
- Byte-identical or one-byte-different browser/Dawn images qualify these retained
  software-driver outputs. They do not prove cross-device parity, visual fidelity,
  renderer superiority or a general productivity gain. Geometry/topology tests
  complement independent image inspection.
- [Performance notes](../../benchmarks/visual-parity-20261018/evidence/PERFORMANCE_NOTES.md)
  retain unshipped environment-cache and lower-shadow-sample investigations.
  Do not claim a speed win from removing quality or from a discarded prototype.

## Coordinator completion fields — still open

1. Preserve the committed/pushed R17 checkpoint `6b962dc` and the completed R16
   finish failure. R17 sphere diagnostics, corrected projected bounds and
   request-local shadow reuse have accepted reviews and full engineering validation.
   Retain the initial test-type failure, exact correction and successful rerun.
   Preserve all 18 asset-sharing renders, failed primary/secondary gates, accepted
   independent evidence audit and verified reconstruction archive; do not retry
   or infer savings. Neither finite-route benefit nor failure follows from
   authors who chose not to use it.
2. Preserve interrupted R17 with all 27 attempts, exact last-success sources and
   abnormal lifecycle reconciliation. Retain completed R18's 36 attempts, six
   finals, normal shared-service cleanup, bounded technical findings and failed
   visual/finish gates. The next measurement workflow and bevel diagnostics are independently reviewed
   and fully validated. Preserve the completed CPU pilot's three mechanical
   passes, shared operational-explanation gap and supplied-script/CLI tie. Its
   one-author-per-route evidence does not establish time savings. R19 visual
   authors remain undispatched; a fresh qualification still uses unchanged gates.
   Manual author effort is not independently measured and unexercised tools
   cannot be credited or rejected.
   Never resume R17, treat its forced finishes as natural author cost, erase native
   exact-pixel failures or combine passing components across rounds.
3. Release rail-halt only after a new complete pass; retain both reference
   generations, its frozen protocol, source, all attempts, blind scores,
   effort/technical reviews and cleanup.
4. Refresh the hosted handoff from this local document and extend verified gallery
   coverage beyond its current R14/fuel-stop state as new results complete;
   publish complete downloadable source/evidence archives with checked
   extraction/hash inventory beyond the current through-R3 archives. Resolve
   the earlier Dawn-evidence omission and oversized native-control archive
   packaging blockers with verified complete coverage before publication.
5. Update this handoff and the active plan with the final measured outcome and
   outstanding limits. Keep **DRAFT / active** until those facts support closure;
   R18 visual/finish failures, R17 interruption, R16, R15, R14, R13, the first
   fuel-stop and original harbor failures remain disclosed.

## Local evidence storage receipt

On 19 October, 241 immutable render bundles from completed rounds 1–12 and the
first transfer were relocated under the explicit
[registry](../../benchmarks/visual-parity-20261018/evidence/relocation-manifest.json)
to `/tmp/aperture-parity-evidence-a658c961f15d46618631191735fb8547`.
Their 2,051,546,362 logical bytes deduplicate to 221 objects/1,824,701,656 stored
bytes. Every canonical path remains readable and hash/size/mode verified; apply
recovered 1,658,728,448 workspace bytes. Preserve the external objects while these
local links are used. The [helper](../../benchmarks/visual-parity-20261018/shared/evidence_relocation.py)
can restore regular files with original bytes/mode/mtime. Preview, original inode
metadata, apply, fixture and all-path verification receipts remain beside the registry.
The completed R13/R14 extension adds **18 immutable bundles** under a separate
[new registry](../../benchmarks/visual-parity-20261018/evidence/relocation-round13-round14-manifest.json),
backed by `/tmp/aperture-parity-evidence-4cadb8bbb73547c3bcaa17d7ad63f5a9`.
The historical registry and its stored object bytes remain unchanged. The
[applied receipt](../../benchmarks/visual-parity-20261018/evidence/relocation-round13-round14-review/APPLIED.md)
and [apply result](../../benchmarks/visual-parity-20261018/evidence/relocation-round13-round14-review/apply-result.json)
retain byte-count, SHA-256 and mode verification for all 18; workspace free space
increased by **148,029,440 bytes**. The [combined final verification](../../benchmarks/visual-parity-20261018/evidence/relocation-round13-round14-review/verify-applied.json)
checks **259 registered paths** across both manifests.

The applied receipt also retains a failed read-only preservation check: apply
started before that check finished, and its original-regular-file assertion saw
an already relocated R13 `balance/scene.bundle.json` symlink, raising
`ValueError: Not a regular file`. It had verified all 241 historical objects;
it made no changes and its intended `preservation-verification.json` was not
written. The later registered-path verifier is a separate completed result;
it does not relabel the raced assertion as passed.

The completed [third canonical-bundle transaction](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/canonical-bundles/TRANSACTION.md)
adds **25 R15/R16 paths** under the [third registry](../../benchmarks/visual-parity-20261018/evidence/relocation-round15-round16-manifest.json),
backed by `/tmp/aperture-parity-evidence-7d575647b2e948c285738e490f140a03`.
It preserves 230,642,173 logical bytes in 24 unique objects containing
230,578,105 bytes. All 25 new targets were verified for SHA-256, size and mode;
[post-apply verification](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/canonical-bundles/verify-applied.json)
records **284 registered paths**, unchanged predecessor registry hashes and
**230,592,512 bytes** of apply-time workspace recovery. Older object payloads
were not rehashed by this third transaction. Twenty-seven relocation tests and
17 multipart tests pass; an earlier test-only nanosecond rounding assertion
failure and correction remain retained. Restore this scope with
`python3 -B benchmarks/visual-parity-20261018/shared/evidence_relocation.py restore-extension --scope completed-round15-round16`
after ensuring space for the full payload and filesystem overhead.

Archive consumers must resolve **all three registries** into canonical file bytes.
Complete download archives must materialize those bytes as regular files or
internal tar hardlinks, with no external `/tmp` dependency. Local symlinks need
all three external storage roots until restored or packaged. Only completed immutable
render bundles moved; source/app/frozen-source trees, live trials, runtime caches,
scores and the untouched second transfer did not. Archive enumeration can include
prepared and incomplete trials; archive presence does not assert that a trial
passed. Website deployment archives and older through-R3 downloads do not imply
that this new relocation or all later evidence has been packaged for download.

A separate [completed R15 storage transaction](../../benchmarks/visual-parity-20261018/evidence/round15-storage-preflight/README.md)
archived **3,880 generated/duplicate regular files** after full validation:
completed R13/R14 build outputs, generated `docs-site/dist`, and three external
control copies verified against canonical retained evidence. The
[inventory](../../benchmarks/visual-parity-20261018/evidence/round15-storage-preflight/inventory.json),
[archive verification](../../benchmarks/visual-parity-20261018/evidence/round15-storage-preflight/archive-verification.json)
and [apply receipt](../../benchmarks/visual-parity-20261018/evidence/round15-storage-preflight/apply-result.json)
retain exact members, bytes, modes and hashes; cleanup removed only inventoried
regular files and empty directories, reclaiming about **270 MB**. Canonical
benchmark source, images, bundles, frozen evidence, active R15 inputs and
protected browser runtime directories were excluded; both `node_modules`
symlinks were preserved. The completed apply transaction must not be rerun.

Its lossless **94,634,935-byte** archive remains external at
`/tmp/aperture-r13-r14-storage-prep/completed-generated-and-duplicate-controls.tar.gz`,
SHA-256 `4f77c09c54de4b1491ba3c0909bfc687cd3a604e8d0333ac1487fcb87175ac81`.
Preserve this archive and materialize/verify its contents in the final complete
source/evidence archives before final handoff; it is **not yet downloadable**.
The storage README documents restoration into an empty external directory,
`repository/` and `duplicate-controls/` member mappings, mode/hash verification
and restoration only to absent destinations. The gallery deployment does not
publish this archive or remove the external-storage dependency.

The later [R16 storage-preflight transaction](../../benchmarks/visual-parity-20261018/evidence/round16-storage-preflight/TRANSACTION.md)
is also complete. It preserves **1,681 selected regular files** from completed
R15 outputs in `/tmp/aperture-r15-storage-prep-YECiWZ/completed-r15-selected-outputs.tar.gz`,
with exact **30,336,885-byte** size and SHA-256
`f1e40d8a9717b5aa5bab644fcbea981aad07df10522dcf4df4b2842cc7620619`.
[Inventory](../../benchmarks/visual-parity-20261018/evidence/round16-storage-preflight/inventory.json),
[archive verification](../../benchmarks/visual-parity-20261018/evidence/round16-storage-preflight/archive-verification.json)
and [apply receipt](../../benchmarks/visual-parity-20261018/evidence/round16-storage-preflight/apply-result.json)
record verification before bounded cleanup; overlay free space rose from
**2,187,640,832** to **2,352,738,304 bytes**. Sources, directories, symlinks,
dependencies and protected runtimes remain unchanged. Its original preparation
README retains the pre-apply state; `TRANSACTION.md` records the completed action.
Do not reapply the transaction. This archive and the earlier
**94,634,935-byte** archive remain required inputs to final durable publication.

The third [applied storage transaction](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/TRANSACTION.md)
preserves **2,617 generated regular files** from completed R16 `dist`/`.aperture`,
older reviewed garden/car/fuel-stop/harbor/street/R1 outputs and a conservative
`docs-site/dist` subset. Its [inventory](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/inventory.json),
[archive verification](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/archive-verification.json),
[apply receipt](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/apply-result.json)
and [retention receipt](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/retention-receipt.json)
retain exact members, hashes and recovery instructions. Overlay free space gained
**198,594,560 bytes**; all **113 protected Chromium metadata records** match.
Sources, images, canonical bundles, dependencies, runtime copies, directories and
symlinks stayed outside removal scope. The completed transaction must not be
reapplied.

Its **54,224,800-byte** archive remains external at
`/tmp/aperture-r16-storage-prep-nGual4/completed-r16-selected-outputs.tar.gz`,
SHA-256 `0c1d5d4911fb71a0b076fddedf72740f44b7c95087bbf54ae2ab72c5f1ff7ac5`.
The [then-current source-archive verification](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/source-archives-verification.json)
checks the three archive identities present at that point. The [explicit allowlist](../../benchmarks/visual-parity-20261018/shared/external-storage-artifacts.json)
and [multipart instructions](../../benchmarks/visual-parity-20261018/shared/EVIDENCE_MULTIPART.md)
cover **179,196,620 compressed bytes**, with nine predicted parts, each at most
23 MiB. [Registration validation](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/registration-validation.json)
retains **17 multipart and 19 relocation tests** on small external fixtures,
including standalone reconstruction and tamper/missing-part rejection.
No complete multipart output or publication is established by that registration.
Those three archives, their manifests and recovery instructions must be
materialized and verified for final download; producer `/tmp` paths must not be
consumer dependencies. Reconstruct archives into fresh staging directories and
verify members before restoring only chosen absent paths. The separate
R15/R16 canonical-bundle relocation is complete as recorded above; canonical
bundles use ordinary registered-file materialization, while these three
external generated-output archives use the multipart allowlist.

The **fourth external archive** was applied after the successful full check at
**12:45:34 UTC**, before R17 service preflight and author release. Its
[transaction and recovery instructions](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/completed-controls/TRANSACTION.md),
[inventory](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/completed-controls/inventory.json),
[archive verification](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/completed-controls/archive-verification.json)
and [apply receipt](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/completed-controls/apply-result.json)
retain **4,228 regular files / 159,654,138 logical bytes**: 17 completed external
control/review workspaces and regenerated `docs-site/dist`. Every archived member
was checked for exact bytes, mode and hash before removing the inventoried
regular files. Workspace recovery was **169,902,080 bytes**. Duplicate control
PNGs and generated docs images were included; canonical benchmark images/source,
bundles, dependencies, current product dist, existing archives and all 113
Chromium copies present at apply were excluded. Subsequent R17 startup added
another protected runtime copy. No runtime policy exception was made.

The **79,433,701-byte** archive remains at
`/tmp/aperture-r17-completed-controls-storage-tnng1y/completed-r17-external-controls-and-docs.tar.gz`,
SHA-256 `5e0b360490d06072a08baaa8e1b2cc88497976815ea0952fd14f6091ea7c46d3`;
inventory SHA-256 is
`bcac4648449dfd7a41343304d69638aba475608fd65c66fdbfeff97fbf533c75`.
The [four-archive registration validation](../../benchmarks/visual-parity-20261018/evidence/round17-storage-preflight/completed-controls/registration-validation.json)
verifies every allowlisted archive and passes 17 multipart tests. All four total
**258,630,321 compressed bytes**, requiring **13 prospective parts** at the 23 MiB
limit. This registration does not establish complete package creation or upload.
Preserve all four archives and all three canonical-bundle stores until verified
portable publication or explicit restoration. Do not rerun completed cleanup;
restore verified archives only into fresh staging as their receipts prescribe.

The [fifth storage transaction](../../benchmarks/visual-parity-20261018/evidence/round18-storage-preflight/TRANSACTION.md)
and [completion receipt](../../benchmarks/visual-parity-20261018/evidence/round18-storage-preflight/completion-receipt.json)
retain the independently verified package-cache archive and bounded cleanup.
The original apply recovered **678,711,296 overlay bytes**. Later removal of
its exactly verified temporary reconstruction recovered **681,885,696 tmpfs
bytes**; the archive and all reconstruction proofs remain retained. All **115
protected Chromium runtimes** present at the latter cleanup kept identical
metadata. These are measured storage gains, not renderer memory or speed claims.
The fifth archive is **275,417,677 bytes**, SHA-256
`3de9d0c5547f305e83708fe49b6dcfeb6fdfba20c9c3f64ec93f49fdf7171c4f`.

The [five-source identity verification](../../benchmarks/visual-parity-20261018/evidence/round18-storage-preflight/five-source-identities.json)
records fresh archive hashes. Five external archives now total **534,047,998
bytes / 25 prospective parts**. The three canonical native-control archives add
**138,826,304 bytes / eight parts**: **672,874,302 bytes combined**, before ordinary
evidence extraction. Prior four-archive counts above remain historical receipts.
Preserve all five external archives and all three bundle stores; full packaging,
consumer reconstruction, source coverage and private publication remain open.
Use the current canonical-first consumer order above, not historical packet
ordering, and never reapply completed cleanup.

The [gallery-checkout relocation receipt](../../benchmarks/visual-parity-20261018/evidence/round16-storage-preflight/gallery-checkout/README.md)
records the whole clean checkout preserved at
`/tmp/aperture-gallery-storage-z8jbm8f7/checkout`. The canonical
`/workspace/sites/chinese-garden-comparison-20261016` path remains usable through
an explicit directory symlink. All **1,120 regular files / 457,470,448 logical
bytes**, modes and mtimes matched at relocation; Git HEAD stayed
`87b29859eda6b30e11cd6925603235bc81d5e082` and status was clean. The live site
remains unchanged. Preserve this active checkout; later gallery edits can make
the historical relocation manifest stale. Reversal must copy and verify the
**current whole checkout**, including `.git`, before replacing the canonical
symlink. This relocation is storage preservation, not a publication update.
