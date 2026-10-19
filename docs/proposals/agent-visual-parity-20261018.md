# Agent visual authoring parity: implementation and qualification

Status: active. Owner: Codex. Started 18 October 2026.

Latest engineering status: R19 camera `inspect-local`, source-owned request
workflow, bevel diagnostics and installed-package smoke are reviewed and fully
validated: **5,158 tests / 701 files**, **65 Dawn tests**, packed Dawn and
**1,200-frame memory checks** pass. The CPU usability pilot is complete: all
three routes pass mechanical checks, but full operational acceptance is not
established because every explanation omits the required partial-bounds
limitation. The supplied script and CLI tie; one author per route establishes
no author-time gain. R19 visual qualification and H2 remain unstarted. R18's
canal/courtyard visual failures and exact **1,208.9076 ms** finish miss remain
unchanged; engineering validation does not close the goal. See
[R19 implementation and validation](#round-19-implementation-and-engineering-validation).

## Goal and scope

Make Aperture a competitive agent authoring tool for restrained low-poly scenes
containing fitted hard-surface geometry, lit materials, and shader-driven water.
Implement reusable product improvements, then measure quality and effort against
Three.js and vGPU. Do not call the goal achieved because APIs compile or because
one hand-tuned screenshot looks better. Completion requires the gates below.

“Completely filled” means all identified gaps pass these declared qualification
gates on the retained tasks, runtime and model. It cannot establish that every
future agent, scene or GPU will perform equally. Keep that boundary explicit in
the final report; do not silently relax gates after seeing results.

## Baseline and causal hypotheses

Preserve `benchmarks/harbor-20261017` without editing its source, images, timings,
or judgments. Aperture baseline commit: `cbcb6e772475378d93dc4e114309ee433e461360`.
Mean visual scores: Aperture 7.125, Three.js 8.2125, vGPU 7.6625. Aperture finished
first (18:04); Three.js reached the first useful image earlier (6:16 vs 7:57).
These are single-author observations, not population estimates.

1. Shape/composition account for about 63% of the weighted visual deficit to
   Three.js. Both hulls used authored vertex rings; a missing boat primitive is
   not established. Test reusable section modeling and proportion-check guidance.
2. Aperture water only modified color/normals. Competitors rendered actual scene
   reflections. Standard shader extensions work, but an accessible scene-reflection
   workflow is missing from the generated-app/bundle path.
3. A malformed mesh waited 122 seconds in browser capture; the same diagnostic
   took about 0.76 seconds through CPU extraction. A fatal worker error must settle
   capture promptly, including when it precedes capture registration. Cleanup must
   preserve the original diagnostic and must not wait for a dead worker.
4. A second attempt used the wrong plane orientation. Tuple layouts, transforms,
   primitive axes and portable shader imports need discoverable, runnable examples
   and a fast normal validation path.
5. Lighting looks flatter, but this benchmark did not isolate renderer behavior
   from scene settings. Compare matched geometry/light/material setups before
   changing rendering defaults. Do not fix aesthetics by disabling required effects.

## Architectural constraints

- ECS remains authoritative. Reflections derive additional views from snapshots;
  no second mutable scene graph and no renderer mutation of simulation state.
- WebGPU only. Node rendering uses Aperture's Dawn binding, never vGPU as a dependency.
- Material/config data crosses worker and bundle boundaries; GPU objects stay in
  renderer-owned lifetimes. Browser and Dawn use the same rendering implementation.
- Every public option is validated, serialized, documented, and tested through the
  app facade and portable bundle route. Preserve established cloud browser launch
  verification and lifecycle cleanup.
- Keep unrelated work and frozen benchmark files intact. Add package changesets.

## Workstream A: failure feedback and portable iteration

Trace generated worker startup, extraction, explicit capture, release and disposal.
Retain fatal failures from startup; reject pending and subsequent captures with
the authored diagnostic. Release renderer holds locally when the worker is dead;
unsubscribe listeners on disposal and avoid unhandled late rejections. Ordinary
request errors remain recoverable when the worker remains usable.

Regression cases: failure before controller installation; failure while selecting
a snapshot; failure while holding a frame; release error; renderer rejection
before worker response; timeout; corrected application after failure. Verify both
request and release listener cleanup, not just rejection text.

Provide a concise portable iteration entry point/recipe: source validation and
strict CPU extraction first, then Dawn render, then verified browser compatibility
capture. Prefer the existing CLI/MCP contracts where they already solve a step.
Use JSON import attributes (or portable generated modules) in every new example.
Surface input field paths and corrective guidance. Do not require separate scene
implementations for Node and browser.

Acceptance: original invalid input rejects with its mesh diagnostic in under 5 s
after capture invocation on this runtime, without advancing a 120 s deadline;
repeated CPU preflight completes under 3 s on the installed workspace; corrected
source renders and cleans up. Timings are qualification evidence, not fragile
relative-speed unit assertions.

## Workstream B: reusable scene reflections

Provide a supported planar reflection route for horizontal water/mirrors in
ordinary ECS apps, with explicit plane, strength, resolution and distortion
controls. Reflections must contain actual reflected scene geometry, follow object
and camera changes, and exclude the receiver itself. A procedural color pattern
or vertically flipped main image does not satisfy this requirement.

Audit the existing post-effect, render-target, snapshot-camera and material resource
contracts. Choose the smallest coherent implementation supporting generated apps
and bundles. A renderer-owned mirrored scene view plus depth-masked composition is
acceptable; document its scope instead of pretending it is a universal material
texture API. Prefer serializable configuration over application GPU callbacks.

Requirements: perspective and orthographic cameras; correct plane projection and
receiver mask; geometry clipping/exclusion; no texture read/write feedback; HDR
composition before tone mapping; MSAA compatibility; source-asset updates; resize;
resource ownership; disable/replacement/disposal; actionable unsupported diagnostics.
Retain standard WGSL surface hooks for water tint and normal/ripple detail.

Acceptance: actual GPU pixel tests show a reflected colored landmark moving with
its source and disappearing when removed, with receiver-only composition and no
self-reflection recursion. Browser/Dawn output is equal or within a declared
numeric tolerance with a retained difference image. Resize and repeated rendering
produce no validation errors, stale textures or growing owned resource counts.

## Workstream C: fitted shape authoring

Create a general cross-section/loft recipe and a runnable fitted-prop example.
Describe independent longitudinal taper, transverse fullness, top-edge rise,
material bands and openings; reuse shared boundaries instead of positioning trim
by eye. A reusable public helper is justified only for repeated geometry work,
with deterministic normals, winding, bounds and explicit vertex correspondence.
Do not ship a harbor-specific boat as the only solution.

Document local axes, tuple-vs-flat-array contracts, quaternion alignment, palette
color space and polygon planarity. Provide a short authoring sequence: major
layout/blockout; silhouette review; fitted surfaces; lighting; shader effects;
small props. Require front, side and three-quarter inspection for the hero prop.

Acceptance: semantic parts remain editable; meaningful bow/stern taper and volume;
no detached glazing, accidental seams or degenerate triangles. Unit tests cover
input rejection and geometric properties. Native/browser renders validate at
least two different shaped props, plus the retained harbor reconstruction.

## Workstream D: lighting diagnosis and recipes

Use fixed geometry, camera, linear palette and effect settings to compare key,
fill, shadow and tone-mapping behavior. Retain separate images for environment,
key light, shadows, AO and bloom ablations. Measure before adjusting defaults.
Fix demonstrated numerical/rendering defects; otherwise publish a compact typed
lighting recipe with controlled fill and warm/cool separation. Preserve default
environment portability and previously fixed AO depth-discontinuity behavior.

Acceptance: no false outlines, floating contacts, clipped bright surfaces or
missing shadow intent in the diagnostic scenes. Matched-camera judges find no
remaining material/lighting deficit exceeding 0.25/10 against the strongest peer
on the qualification scenes. Record all settings and any perceptual tradeoffs.

## Workstream E: controlled validation before fresh benchmarking

Create `benchmarks/visual-parity-20261018/` for all new evidence. Record base commit,
working-tree diff hash, dependency/runtime versions, dimensions, seeds, camera,
shader routes and exact reproduction commands. Preserve every failed attempt.

1. Run targeted unit/type checks for each changed boundary.
2. Render retained invalid and corrected harbor inputs on the repaired path.
3. Run reflection GPU correctness/lifecycle tests and browser/Dawn comparisons.
4. Reconstruct the harbor in a separate directory using new public APIs/recipes;
   retain matched views and separate geometry/reflection/light ablations.
5. Have fresh independent judges score anonymous final images against the original
   reference and inspect alternate views. Keep their unedited judgments.
6. Run repository `pnpm run check`, required native tests, package-install/Dawn
   verification and relevant memory/lifecycle checks before completion.

## Workstream F: fresh three-framework authoring benchmark

Use the previously requested independent author/judge format. Prepare references,
dependencies and capture tooling before dispatch. Fresh-context authors may read
their framework's public docs/examples but not peer source, prior benchmark scenes,
judgments or the coordinator's reconstructed harbor. Freeze implementations for
each round; no coaching, engine edits or extra attempts for one framework.

Run two new matched briefs: a low-poly canal-side workshop with a shaped small
vehicle/boat and water, and a distinct courtyard/fountain scene with fitted curved
architecture. Keep complexity comparable to harbor and require real 3D geometry,
a custom procedural shader and visible scene reflections. Reference creation is
excluded from author time. All frameworks may use their normal public APIs.

Each author gets 25 minutes and six captures; same model/reasoning, 1200x900 DPR1,
seeded/static time. Log dispatch, first request, first valid image, first useful
image, final image, finish, builds, failures, queue and render phases. Run captures
serially with retained source snapshots. Distinguish common-browser render
performance from the recommended framework iteration route; Aperture uses CPU
preflight plus Dawn for iteration and gets a separate final browser verification.
State that authoring-route differences are part of this product-workflow trial.

Two independent blind visual judges score composition25%, shape25%, low-poly15%,
lighting/material20%, finish15%, using the original rubric. A separate effort
review uses anonymous attempts/timings. Report individual scores and disagreements;
do not grade code. Time and attempts are cost proxies; no invented token billing.

## Completion gates and iteration rule

All gates must pass; keep this checklist updated with artifact paths.

- [x] A: fatal error and corrected-render lifecycle tests pass; live latency gates pass.
- [x] B: genuine planar reflections pass native GPU, camera, mask and lifecycle checks;
      the round 8 tight-tolerance MSAA defect is fixed and revalidated below.
- [x] C: fitted-shape recipe works for multiple props and alternate views.
- [x] D: controlled lighting evidence explains/removes the observed visual deficit;
      round 9 lighting deficits are 0.00/0.05, within the declared 0.25 gate.
- [x] E (current follow-up): CPU camera tooling passes independent numerical/ECS review,
      fixed-scene native control, the full repository suite, native GPU/memory checks,
      and an isolated installed-package command check. Round 12 qualification passes; transfer remains open.
- [x] F1 (amended): four contemporary independent paired judges each prefer the
      repaired harbor, with category/contact gates passed. The original raw-score
      target of 8.2125 remains failed; the prospective methodology amendment and
      every raw result are retained below. This check records the amended gate only.
- [x] F2 at checkpoint `0239f77`: round 12 passes both subjects' visual gates;
      both judges rank Aperture first on each. Every prior failure remains retained.
      The separate fuel-stop transfer fails; later changes require fresh qualification.
- [x] F3 at checkpoint `0239f77`: round 12 first-useful median is 4.8525% and finish
      median 5.8654% above the fastest peer, within the unchanged 10% allowance.
      All failures and queue time count. This does not close the failed transfer gate.
- [ ] G: final gallery loads actual PNGs, has standalone image links and a downloadable
      source/evidence archive; images and claims match retained outputs.

If a gate fails, retain the result, identify its cause, change reusable tooling or
guidance, rerun affected correctness checks and run a new independently authored
qualification round. Do not cherry-pick a best attempt, change rubric weights,
hide slower runs, or call a fixed scene a fresh benchmark. Disclose repeated rounds
and the resulting selection bias. Stop only when the declared suite passes, or
report an external blocker explicitly without claiming the gap is closed.

## Final deliverables

Implementation and changesets; concise agent-facing recipes; this plan with
evidence links and final status; raw timing/proof/test logs; frozen author source
and intermediate images; independent judgments; a readable comparison gallery;
reproduction instructions and a report distinguishing measured closure from
unmeasured generalization. Preserve user edits and existing benchmark history.

The user additionally requires a complete Markdown handoff after qualification.
Produce `docs/proposals/agent-visual-parity-handoff-20261018.md`, covering both the
earlier batch and current work: all scene/reference concepts, reusable rendering
and authoring concepts, implementation/commit status, exact source and gallery
links, tests and raw evidence, reproduction commands, historical failures and
limitations, and any remaining follow-up. Include a concept-to-artifact index
so a new owner can find the original proposal, implementation, example and
validation for each item. This is a required final deliverable, not a replacement
for finishing the current qualification and transfer gates.

## Retained round 1 and next qualification

The first fresh round did **not** close the gap. Mean visual scores were:

| Brief     | Aperture | Three.js |   vGPU |
| --------- | -------: | -------: | -----: |
| Canal     |   7.0000 |   7.8000 | 6.9500 |
| Courtyard |   7.2125 |   7.6000 | 6.8250 |

Aperture's median first useful image was 222.996 seconds versus 191.580 for
Three.js. Median completion was 995.219 seconds versus 903.876 for vGPU. Both
10% timing gates failed; completion missed by only 0.956 seconds. The independent
effort review also reports queue-subtracted diagnostics, without labeling them
active labor. Raw judgments and every attempt remain in
`benchmarks/visual-parity-20261018/`. Repository checks overlapped early round-1
captures, so absolute time has a shared-host-load confound.

Changes for the next independently authored round:

- `aperture create --template diorama`: runnable browser/Node setup, camera/light,
  portable compiled procedural water and blockout masses. No finished models.
- `mesh.beveledBox`: one closed chamfered solid for masonry/props, with manifold,
  winding and bounds tests. This complements fitted polygons and section lofts.
- Headless geometry failures retain the authored source call site, addressing the
  first canal author's nonplanar-floor debugging delay.
- Public guidance explains level floors versus raised rims, short overlapping
  roof courses, broad branching foliage, substantial coping and shadow length.
- Live GPU regressions now include camera changes and source-material replacement,
  plus nonfinite exposure fallback when reflections force HDR.

A candidate environment cache was investigated but is not a product change:
removing environment preparation did not isolate a meaningful speed benefit in
that workload. No quality was removed to claim a faster preview.

The next round uses the same references, rubric, six-capture/25-minute budgets,
new independent author contexts, and retained failures. It is a repeated-task
qualification, with the resulting selection bias disclosed. Existing gates remain
unchanged. Product checks will finish before the author clocks begin this time.

## Round 2 infrastructure interruption

The second fresh round was stopped after the approved browser route refused
launches below its 2 GiB free-space threshold. The native routes did not share
that blockage, so the six partial trials are retained but excluded from timing
and qualification. See `benchmarks/visual-parity-round2-20261018/evidence/interruption.json`.

Forty completed Chromium cache copies, all inactive over 24 hours, were retired
with exact pinned-hash and registry checks under the exclusive lifecycle lock.
Unknown/nested files and all benchmark evidence were preserved; 8,360,887,040 bytes
were reclaimed. The bounded preview, audit, tests and result are retained. The
2 GiB admission guard remains unchanged.

Round 3 uses new independent contexts and the same images, rubric and budgets.
A common instruction for all frameworks now explicitly requires a first blockout
with 5–10 principal masses before detailing. Browser and both native routes pass
preflight before its clocks start. No repository-wide checks run during authoring.

## Round 3 findings and connected-geometry follow-up

Independent judges scored Aperture 7.0875 on canal (best peer 7.2125), and 7.0000
on courtyard (best peer 6.9625). The finish deficit is 0.75 on canal and 0.50 on
courtyard, so both visual gates remain open. Moderate defects include broken rope
segments, protruding roof tiles and small fragments inside the arch. No rubric
or acceptance threshold changes. Raw judgments and all attempts remain in
`benchmarks/visual-parity-round3-20261018/`.

First-useful median 174.721 seconds beats the fastest peer's 184.920 seconds.
Completion median 1159.153 seconds is within 10% of the fastest peer's 1076.592.
Both primary timing gates pass; queue-subtracted completion passes by only 2.728
seconds. One Three.js construction failure occupied the serial capture queue for
122 seconds; it and all resulting waits remain in the record. These descriptive
results are not a robust performance separation or an estimate of active labor.

The next reusable changes are `mesh.tube` (shared bend rings and varying radii)
and `mesh.extrudeBetween` (closed profiles/holes between explicit endpoints).
They avoid fragile manual Euler alignment. Public recipes use the exact same
curve samples for arch openings and trim, and short parallel roof courses bounded
by hip edges. Tests cover manifold connectivity, outward winding, holes, arbitrary
axis orientation, finite bounds, rejection and browser/Dawn rendering. A fresh
six-author round follows verification; all previous failures remain visible.

## Round 4 findings and reflection-color follow-up

Round 4 passes the courtyard visual gate: Aperture 7.0300, strongest peer Three.js
6.7800, with no category deficit above 0.25 or major artifact. Canal still fails:
Aperture 7.1375 versus vGPU 7.5025, with 0.40 composition, 0.45 shape, 0.50 lighting
and 0.40 finish deficits. The wheel hub has a coincident cap-plane artifact and
water is too pale; foliage detail also becomes fragmented in the courtyard.
All six sources, deadlines and real shader/reflection routes pass technical audit.
Separate final browser checks pass for all frameworks. All 75 frozen files were
unchanged through author completion; later product edits belong to the next round.

First-useful median 121.337 seconds passes against Three.js at 117.747 seconds.
Completion median 962.190 seconds fails against Three.js at 799.270 seconds, by
82.993 seconds beyond the unchanged 10% allowance. Aperture had zero capture
failures. Its recorded CPU/render phases explain about 26 seconds of the 163-second
median completion difference; the other intervals are uninstrumented elapsed time,
not measured active labor. All judgments, phase totals and failures remain in
`benchmarks/visual-parity-round4-20261018/`.

A shader-only control on the unchanged canal bundle shows that tinting reflected
radiance reduces the pale wash while preserving actual reflected geometry. Add
validated, portable `planarReflection.tint` (linear RGB, white default); test its
GPU effect on reflected landmarks and absence of changes to foreground objects.
Update the diorama recipe with lower fill and stronger shadow contrast, plus
noncoincident tire/rim/hub planes, submerged lower hulls and a small number of
closed foliage masses. Reserve final previews for known corrections, avoiding
unreviewed cosmetic geometry changes. These are reusable controls/guidance, not
edits to frozen author results. A new independent round follows validation with
the same references, rubric and budgets; no completion gate is relaxed.

### Fifth harbor repair and next qualification round

The fifth coordinator repair scored 7.6000 and 7.8400 (mean 7.7200). Both
fresh blind judges preferred it to the old Three.js image, but the frozen
8.2125 historical target and category constraints still fail. Retain that
distinction: fresh pairwise preference does not replace the fixed gate.
The next fresh authoring round includes validated reflection tint, stronger
default key/fill separation, explicit tire/rim cap separation and restrained
foliage guidance. Its references, budgets and scoring thresholds stay fixed.

### Fifth fresh round and held-out transfer validation

Round 5 finished all six authors within budget, with every final source matching
its last successful capture and all 75 frozen files unchanged at completion.
Aperture's median completion was 903.4548875 seconds versus Three.js at
795.7557 seconds: a 13.53% gap, above the unchanged 10% allowance. The first-useful median
117.3612 seconds passes against Three.js at 111.0017 seconds. Both independent
visual reviews fail both scenes: canal 7.1175 against vGPU 7.6075, courtyard
6.7925 against Three.js 7.2025. Canal deficits reach 0.75 in finish; courtyard
reaches 0.80 in style. Neither has a major artifact, but the fixed gates remain
open. All six final scenes
also pass verified browser WebGPU checks; native-first Aperture/vGPU scenes
retain their separate Dawn captures.

One Aperture author lost an attempt and about 44 seconds recovering from an
assumed `mesh.icosphere` API. Add that standard faceted primitive, with bounded
subdivisions, outward closed topology, public facade/types, a portable example,
and tests for edge pairing, winding, radii, determinism and invalid inputs.
The round-5 snapshot remains unchanged; this is a subsequent product version.

- [ ] H — Held-out transfer: after the current repairs, run three new independent
      authors on the first generated rural fuel-stop reference retained at
      `benchmarks/visual-parity-heldout-20261018/reference/fuel-stop.png`.
      The image was selected before round-5 judgments, without regeneration.
      Freeze the same 25-minute/six-capture budget and visual rubric. Require
      Aperture's mean to meet the best peer, no category deficit greater than
      0.25, no major artifact, and both first-useful and completion time within
      10% of the fastest peer on that subject. This supplements, rather than
      replaces, the existing two-subject and historical harbor gates. Retain
      any failure. One new subject cannot establish universal superiority.

### Round 5 causal controls and next version

The camera/roof relationship explains a concrete canal mismatch: Aperture's
~31.7-degree view elevation exposes the reverse side of its ~21.7-degree roof,
while peers use lower views and steeper roofs. Its tile relief is about 1.8 times
the peers' for similar tile widths. These are authoring choices, not missing mesh
APIs. Add a measurable image-space proportion and camera/roof check to the public
workflow instead of prescribing benchmark-specific coordinates.

The prior instruction to use only a few faceted foliage masses was too broad.
It suits the chunky harbor tree but not the courtyard's leafy olive tree. Remove
that blanket direction from the next common protocol and public guide. A source
audit also found inward-wound closed leaflets in round 4; closedness alone never
proved correct shading. Validate a generic seeded leaflet example with outward
normals and use a control that changes foliage only, holding the round-5 camera,
palette, lighting and all nonfoliage descriptors fixed. Retain unsuccessful trials.

A reflection-only control holds the harbor bundle and distortion amplitude fixed:
raising spatial frequency from 1 to 6 replaces large glassy warps with short
recognizable ripples. Expose validated portable `distortionFrequency`, default 1
for compatibility. Native tests must demonstrate its effect on reflected pixels,
no foreground displacement, no effect at zero amplitude and full disposal.
Rerun the full repository suite and browser/Dawn parity before freezing the next
fresh author round. All prior rounds and unchanged acceptance gates remain visible.

The isolated round-four winding correction improves coherent leaf undersides,
but pale crown fragments remain; density and orientation are independent issues.
The new round-five foliage-only control retains all 581 nonfoliage descriptors
exactly and uses 4,866 closed leaflets in five batches. It improves leafy density
but still has visibly separate crown lobes. These are controlled observations,
not replacement scores for either retained author result.

The sixth harbor repair scores 7.8400 and 7.6050 (mean 7.7225), again preferred
to the old Three.js image by both fresh judges but still below the fixed historical
gate. Shorter ripples remove the broad glass-like warps yet introduce visible
periodic bands; water variation, integrated greenery, hull shading and warm light
remain targets. No failed result is dropped and no score threshold changes.

### Sixth fresh round: first complete canal pass, courtyard construction remains

Round 6 froze commit `0e1f31fab85147b4edade7c94fdc777b4877570c`; all 79
live and retained frozen files match. All six authors finished within budget,
all final app sources match their last successful capture, and all six pass the
independent technical audit and verified browser WebGPU route. Four failed
attempts remain included. The full repository suite passed before dispatch
(683 files, 4,823 tests), along with 54 native Dawn tests, packed-CLI smoke,
1,200-frame memory validation and byte-identical browser/Dawn example output.

Both blind judges rank Aperture first on canal: mean 8.3050 against Three.js
7.4775, with every category passing. Courtyard still fails: Aperture 7.5625
against Three.js 7.8800; category deficits are composition 0.30, shape 0.55,
style 0.35 and finish 0.35. Lighting is tied, and no major artifact is reported.
First-useful median 119.187204 seconds beats Three.js 129.967704 seconds;
completion 1,040.3543625 seconds is 7.16% above Three.js 970.881704 seconds,
within the unchanged 10% allowance. This round passes both timing gates and
canal visual gates, but does not close the overall plan.

The courtyard judges independently identify the same construction issues:
a tall/deep pavilion with a shallow-looking niche, continuous roof strips with
small seams, and dense rounded foliage rather than open spreading branches.
The source contains short tile courses, but their shared curve and plane make
them merge visually; prose advice to offset the overlap was insufficient.
Implement a generic fitted roof-face and cap recipe with deliberate course
steps/taper and closed hip clipping. Validate deterministic geometry, outward
winding, nondegenerate closed pieces, input constraints and a roof-only control.
Keep caller-defined roof geometry, materials and ECS state authoritative.

Extend the pure leaflet recipe with caller-authored branch paths and coherent
leaf orientations/gaps; retain its existing default output. Validate seeded
repeatability, outward closed Float32 geometry and a foliage-only control with
all other geometry, camera and lighting held fixed. Add concrete image-space
measurements for pavilion/arch proportions to the workflow without prescribing
benchmark-specific coordinates. These reusable recipes address the observed
construction costs; they do not replace independent authoring results.

Review and run the complete validation suite before another source freeze.
Then use new independent authors under the same two references, budget, failure
accounting and blind rubric. Retain round 6 and every earlier result. The seventh
coordinator harbor repair requires its own blind scoring and alternate-view
checks. The original harbor threshold and held-out fuel-stop requirements remain
unchanged; neither may be marked complete from the canal win alone.

### Roof/branch controls and seventh-round preparation

The new public roof recipe generates closed tapered tiles with actual raised
course lips, convex hip clipping and fitted cap runs. Its controlled replacement
preserves 601 non-roof descriptors and reduces roof draw descriptors from 134 to 38. CPU checks cover 1,132 shells and 63,190 Float32 triangles; five permanent
regression tests cover winding, closure, clipping, lap separation and limits.
The browser and Dawn control images are byte-identical.

The additive branch-foliage recipe attaches paired closed blades to authored
paths, with stable seeded thinning, gaps and transported local frames. Legacy
ellipsoid foliage remains byte-identical. Seven permanent regression tests cover
attachment, thinning, curved paths, Float32 winding, limits and compatibility.
The final 852-leaf control preserves all 719 non-tree descriptors and matches
browser/Dawn pixels exactly. Three earlier control attempts are retained. Its
crown remains twiggy; this establishes geometry and portability, not visual parity.

Harbor repair 9 improves the fixed-scene mean to 8.01, below the unchanged 8.2125
threshold. Shape is still 0.45 below its fixed category target; no major artifact
was found. Its contemporaneous frozen-peer rescore is 7.4475, disclosed separately
without replacing the historical threshold. Its final source and both alternate
views are retained, and browser/Dawn images match exactly. The next focused repair
addresses shoreline integration, planting density and material variation.

Round 7 retains the same subjects, 25-minute/six-capture budgets, weights and gates.
Before dispatch, its browser harness is preflighted inside one existing cleanup
lifecycle. It reuses one pinned executable extraction while every capture starts
a fresh verified browser/context/profile. The unchanged launch/network/GPU proof
checks and a per-request 2 GiB disk guard remain mandatory. A preserved profile
quarantines the service until lifecycle reconciliation. Successful captures,
a deliberate authored failure followed by recovery, distinct profiles, identical
executable hash, and outside-path rejection have been checked. This change saves
duplicate runtime storage; cross-round timing comparisons must disclose it.
No full check, packaging job or coordinator capture may overlap fresh author clocks.

## Prospective historical-score measurement amendment

Recorded 18 October 2026 after round 7 author clocks closed, before repair-round11
was rendered or judged. The historical raw F1 result remains reported under its
original rule. It is not relabeled as passed. An independent method review, blinded
to candidate images and scores, found that the identical frozen Three.js anchor
scored 7.5275, 7.4475 and 7.5425 under subsequent panels versus its original 8.2125.
The anchor itself therefore fails the old numerical rule. This does not support
treating cross-panel raw scores as a stable measure of historical visual parity.
See `benchmarks/visual-parity-20261018/evidence/judge-scale-methodology-review.md`.

For the historical-quality component of completion, prospectively replace the
uncalibrated cross-panel comparison with a fixed contemporary paired confirmation.
This is an explicit measurement-method amendment, not a claim that the original
raw F1 gate passed. Freeze the final repair-round11 hero, front and side images,
the original reference and the unchanged strongest historical peer before review.
Four new independent judges each assess both anonymous heroes against the same
reference and inspect the repair's alternate views for structural defects. Reverse
presentation order for two judges. Give no historical scores, desired winner or
candidate identities. Keep the same five categories and weights. Do not add judges
after seeing results, select a favorable panel or discard unfavorable scores.

The amended historical gate requires **each of the four judges' weighted paired
differences to be nonnegative**, the mean paired difference in every category to
be at least -0.25, and no major structural/contact/reflection artifact in hero or
alternate views. Report all raw scores, individual differences and original raw
F1 outcome alongside this amended result. No additive calibrated score is needed.
If confirmation fails, record the failure; the fixed round cannot be extended by
resampling judges. Further development would require a separately declared new
candidate and new confirmation, with repeated testing disclosed.

Fresh canal/courtyard and held-out gates are unchanged. They already compare
contemporary candidates within the same panel. These small, related model panels
provide operational evidence on these scenes, not population-level proof or a
claim of universal superiority.

## Round 7 result and final historical confirmation

Round 7 is retained as a failed qualification. Aperture scored 7.4250 on canal
against Three.js 7.6500, and 7.1925 on courtyard against vGPU 7.6150. Both timing
gates passed: first useful median 113.583s versus 125.344s, completion 1007.345s
versus 1000.830s. Every final source matches its last capture; all six routes and
four additional browser proofs passed. The independent review attributes the
remaining courtyard deficit to brittle foliage, flat lighting, uniform surfaces
and awkward roof joins. More helper geometry alone did not establish parity.

The prospective four-judge historical confirmation is complete. All four judges
prefer repair-round11 over the unchanged historical Three.js image; weighted
paired differences are +0.565, +0.575, +0.530 and +0.835. Every category mean is
higher, and no judge finds a major defect in the hero or alternate views. Mean
raw scores are 8.0800 and 7.45375. The original uncalibrated 8.2125 check remains
failed; the amended contemporary historical-comparison gate passes. Source, raw
judges, frozen protocol/hashes and calculations are in
`benchmarks/visual-parity-20261018/judging/harbor-round11/`. Native and browser
rendering of the repair are byte-identical. The boat was lowered 0.20 world units;
a closed 26-segment waterline is verified numerically. This remains coordinator
repair evidence, never fresh authoring-cost evidence.

Next reusable improvements are isolated before round 8:

- Optional closed oval leaf profiles preserve legacy diamond defaults, leaf
  layout, materials and transforms while reducing brittle triangular silhouettes.
- Controlled lighting establishes that wrong key direction cannot be repaired by
  brighter fill or warmer color. The workflow now documents actual Euler order,
  ray direction, world elevation and per-plane contrast checks.
- A small portable surface-variation shader recipe targets uniformly smooth
  plaster/stone without changing geometry or bypassing PBR and shadows.
- Roof edits must check actual per-slope facing before changing pitch; move the
  fitted assembly for late framing corrections where appropriate.

The fresh and held-out gates are unchanged. Freeze the validated improvements,
run another independent six-author round, and retain every failure and judgment.
Only then run the untouched fuel-stop transfer reference with three new authors.

## Round 8: canal parity, remaining reflection and effort failures

Round 8 used pushed checkpoint `4c3b2809aaf12de06fefde42f24ff54bab575414`,
with 4,848 passing tests in 686 files before dispatch. All six fresh authors
finished inside 25 minutes, used six calls each, and retained exact final source.
All 93 frozen files matched after author completion. Two anonymous visual judges
scored canal Aperture 7.815, Three.js 7.4125 and vGPU 6.9525: every canal visual
gate passes. Courtyard scores were 7.2575, 7.3725 and 6.9125 respectively; its mean
and lighting deficit of 0.35 still fail. No major Aperture artifact was reported.

Both timing gates fail under the original rule. First useful median is 101.178 s
against Three.js 90.015 s (limit 99.016 s); finish median is 1,144.247 s against
vGPU 1,023.690 s (limit 1,126.059 s). Failures remain counted: one Aperture polygon
property error, two vGPU native depth-texture compatibility failures, and one
Three.js readiness timeout. Aperture accumulated 155.088 s of GPU queue across
two trials. Queue subtraction is only diagnostic and does not change these gates.

Four separate final browser proofs pass. Both vGPU finals and Aperture canal are
byte-identical between browser and native; Aperture courtyard differs by at most
1/255, mean 0.014752/255. Services exit cleanly. The technical audit records three
metadata/filename exposure disclosures without demonstrated prior-scene content
access, two peers' solid canal facade overlays, and vGPU failure-path resource
cleanup limitations. These do not replace the visual judgments.

The courtyard reveals a concrete additional renderer defect. A native control
changing only reflection surfaceTolerance from 0.002 to 0.02 restores recognizable
reflections. The 4x depth resolve selects a sample but reconstructs at pixel center;
for this camera a point on Y=0.43 reconstructs at about 0.4338914, outside tolerance.
Workstream B is reopened. Fix the sample-coordinate mismatch without globally
widening the authored tolerance or assuming undocumented hardware sample offsets.
Cover tight coplanar masks, nearby nonreceivers, edges, browser/Dawn parity,
resize, disable/disposal and sample-count changes. Measure the added resource and
GPU cost. Retain the separately observed single-sample/SSAO failure for diagnosis.

The repeated `outer` versus `outline` mistake also warrants a compact inline
polygon example in the mandatory workflow. That documentation change begins only
after the round's completion hash receipt; original sources and judgments remain
unchanged. Complete and review these corrections, rerun repository/native/lifecycle
validation, then freeze another fresh qualification round. The unused fuel-stop
transfer trial remains pending. Round 8 is a retained failure, not full closure.

### Post-round-8 correctness and cost controls

The reflection mask now uses hardware sample interpolation with matching depth
loads, preserving the authored 0.002 tolerance. Twelve native regressions cover
tight masks in both projections at 1x/4x, nearby nonreceivers, 0/4 through 4/4
receiver coverage, resize, sample-count transitions and disposal. Twenty-two
focused unit tests pass. The corrected courtyard matches browser and Dawn pixels
exactly through the approved lifecycle. Independent review found and resolved an
allocation-recovery defect before accepting the patch. This closes the reproduced
mask defect; broader validation and fresh qualification remain required.

The correction adds a full-output 4x rgba16float attachment: 32.96 MiB at
1200×900, independent of reflection resolutionScale. It adds no pass or draw,
but runs the composite per sample. A controlled full-screen receiver test on
SwiftShader measures median composite fence time increasing from 93.88 to
437.00 ms. This is isolated wall time, not a hardware timestamp or whole-scene
claim. Color is already resolved; mixed foreground/receiver edges receive
coverage-weighted reflection, not exact preservation of original color samples.
The cost and limitation remain part of the acceptance evidence.

The single-sample control also exposed separate graph/sky compatibility defects:
SSAO's indirect-light attachment was rejected by the shadow graph path, and sky
pipelines declared only one color target. Extend the existing graph attachment
route and sky pipeline/cache descriptors while retaining separated indirect
occlusion and all shadows. Verify shadows on/off, sky pixels, actual SSAO contact
darkening, reflection submission, cache reuse and resource lifetime.

Round-8 cost accounting attributes 77.801 of 90.426 seconds of native report time
to GPU completion waits. The courtyard has 438 draws, of which 435 use a
27-neighbor Voronoi surface hook; foliage is already grouped into 25 draws.
Final captures introduce zero new native device-cache misses. These observations
justify a controlled surface-hook experiment, not an assumption that compilation
or unbatched foliage caused the gap. Preserve geometry, PBR, camera, lights,
shadows, reflections and effects; alternate warmed original/hook-off renders.
Only if that control demonstrates substantial cost should a cheaper deterministic
faceted recipe replace the public example, with image and browser/Dawn checks.
No performance measurement may overlap another GPU job or full repository check.

Round 9 remains undispatched until these fixes are reviewed, tested and committed,
services preflighted, and source frozen. Its visual and timing gates, author time
and capture budgets remain unchanged. The unused transfer subject remains held
out until the fresh qualification succeeds.

The surface control supports a modest optimization, not a dominant-bottleneck
claim. Removing only the hook reduces median native total time from 8.218 to
7.257 seconds. A cheaper same-route tetrahedral hash, at the author's 0.3/0.035
cell-size/contrast settings, reduces median native total from 8.019 to 7.389
seconds. At public defaults 0.5/0.06, five warmed pairs reduce median total from
8.112 to 7.631 seconds (5.93%); minimum changes from 7.852 to 7.460 seconds.
The candidate is faster in each pair, with one near tie. GPU-completion median
changes from 7.442 to 6.807 seconds; CPU preparation does not improve. All warmed
cache-miss deltas are zero. Geometry, PBR fields, camera, lighting, shadows,
reflections and effects remain fixed. Repeated image drift is bounded to one
channel byte. All attempts and phase samples are retained under
`benchmarks/visual-parity-20261018/evidence/round8-surface-cost-control/`.

Coordinator image review finds no loss of silhouettes, contacts, hue, lighting
or reflection at public defaults. The pattern intentionally changes from
irregular Voronoi cells to angular tetrahedral facets; this is not pixel identity
or a blind visual-parity result. The public example adopts the cheaper recipe
and repeats selective-use guidance in the mandatory workflow. Both its 4x
courtyard proof and the exact retained single-sample courtyard now match browser
and Dawn with zero differing pixels. The combined browser lifecycle cleans up.
The full native suite additionally checks both sky types, graph/legacy routes and
SSAO toggles. Renderer reviews are complete with no blocking issues. Author-time
improvement remains unproven until the next independently authored qualification.

Before round 9, the complete validation passes: 4,852 tests in 686 files,
65 native tests, packed-CLI installation/Dawn rendering, and the 1,200-frame
memory gate. Steady-window RSS growth is 4,616,192 bytes, heap growth 5,674,776
bytes and peak RSS 438,538,240 bytes, within the declared budgets. Source hashes
remain unchanged throughout validation. Retained commands, logs and GPU artifacts
are in `benchmarks/visual-parity-20261018/evidence/round9-validation/attempt-2026-10-18T22-55-57.546Z/`.
The final documentation-only status update is formatted separately after that
run. Fresh qualification, held-out transfer and final evidence publication remain
open; the repository checks alone do not demonstrate authoring parity.

## Round 9: visual gates pass, completion misses by 7.25 seconds

All six new authors finished within budget; final source snapshots and all 103
frozen files match. Two independent anonymous panels give Aperture 7.5500 on the
canal against Three.js 7.3425, and 7.3975 on the courtyard against vGPU 7.3925.
Both mean/category/artifact gates pass. The courtyard margin is only 0.005/10,
and canal composition reaches the permitted 0.25 deficit exactly; these are
bounded qualification results, not evidence of universal superiority.

Median first useful image is 101.696465 s for Aperture versus the fastest peer's
128.695465 s. Median completion is 966.567965 s versus Three.js 872.106668 s:
the unchanged 10% limit is 959.3173348 s, so completion fails by 7.2506302 s.
The combined round remains failed. Aperture uses 11 successful calls; Three.js
uses 12 calls with one failure and vGPU 12 with two failures. All attempts remain
in the clock. The independent effort reviewer inspected every successful image.

Sequential agent spawning completed 49.392971 s after common dispatch; exact
per-author activation times were unavailable. This limits fine timing claims,
especially the small completion miss. No retroactive subtraction, deadline
extension or tolerance change is applied. Before outcomes were known, a shared
release barrier was prepared for the untouched fuel-stop trial. The next fresh
qualification will use the same prospective method: agents perform common setup
and wait before seeing their assignments, then one atomic budget file starts
every author clock and releases all lanes. Release observations are recorded.

Technical validation passes for all six finals. Both Aperture browser/Dawn pairs
have maximum RGB difference 1/255; both vGPU pairs are byte-identical. Verified
browser and native services exit zero and remove their profiles. Raw reviews,
timings, source verification and cleanup are retained in
`benchmarks/visual-parity-round9-20261018/`. The original historical raw-score
failure and its separate paired amendment remain disclosed.

The canal author exposed a reusable feedback defect: unsupported torus fields
`minorRadius` and `tubularSegments` were silently ignored, so CPU preflight passed
while geometry used default tube dimensions. The correction now rejects unknown
torus option keys with `aperture.spawn.invalidTorusMesh`, supported names and
their meanings. Facade creation, raw CPU spawning and the direct render factory
share validation; supported geometry bytes stay unchanged. Inherited metadata
remains ignored, but unsupported own enumerable fields intentionally become
errors. Focused tests cover geometry hashes, malformed inputs, transactional
recovery, extraction and headless diagnostic propagation. Full validation of
this follow-up is required before redispatch.

A frozen-bundle camera control also checks the projection hypothesis. Replacing
orthographic projection with perspective while matching target-plane scale
changes near-object scale by depth; it clips the existing deformed foreground.
The public workflow now explains how to choose projection at blockout, recognize
convergence, and avoid assuming that target-plane framing protects every object.
This is causal authoring guidance, not a repaired benchmark image or another
scored attempt. The native control and CPU projection proof are retained under
`evidence/round9-camera-control/` in the main evidence directory.

Next: validate the feedback/guidance checkpoint, conduct a new independent
qualification with synchronized starts and unchanged gates, then run the still
untouched transfer subject. Final archive/gallery publication remains pending.

Pre-round-10 validation passes on unchanged source: 4,875 tests in 687 files
(shuffle seed 1792366627567), 65 native GPU tests, packed-CLI Dawn installation,
and 1,200 memory-test frames. Steady RSS growth is 5,058,560 bytes, heap change
-392,968 bytes and peak RSS 420,909,056 bytes. Independent torus review reports
no blockers. Logs and all 98 source hashes are retained in
`benchmarks/visual-parity-20261018/evidence/round10-validation/attempt-2026-10-18T23-33-39.200Z/`.
This status-only plan update is formatted after validation; implementation,
tests and the public workflow remain byte-identical to the validated source.

## Round 10: synchronized cost gates pass; canal finish remains below parity

The common release barrier removes the known sequential-spawn delay from the
prospective setup. All six authors are ready before dispatch; observed release
delays are at most 80 ms, spanning 54 ms. Subsequent model scheduling remains
variable. No root GPU work or validation runs during author clocks. All 113
frozen live/retained hashes and final source snapshots match.

Aperture's first-useful median is 72.183149 s versus Three.js 76.407149 s;
completion is 911.038884 s versus vGPU 870.0201465 s. Both unchanged cost gates
pass. The courtyard visual gate also passes, 7.7750 versus Three.js 7.3900.
The canal fails, 7.3800 versus Three.js 7.7475: deficits are 0.45 shape,
0.30 style, 0.30 lighting and 0.75 finish. Both judges identify a boxy vehicle
and projecting rear roof cuts. The complete round remains failed. Round 9's
visual pass and Round 10's timing pass cannot be combined into one passing run.

All six entries pass technical eligibility, final source/backend/cleanup checks.
Both Aperture browser/Dawn pairs differ by at most one channel byte; both vGPU
pairs match exactly. The independent effort reviewer views all 31 successful
images and retains all four failures. The two visual reviews and the technical
review remain unedited in `benchmarks/visual-parity-round10-20261018/judging/`.

The next scoped follow-up addresses demonstrated authoring friction:

1. **Fit the tile grid to exposed roof verges.** CPU inspection shows that the
   outer tile column is cut through its crown, extending 0.192563 normal units
   above the bed, while its authored trim reaches only 0.085. The clipping
   boundary itself is correct. A centered grid lowers that cut to 0.057385
   without changing the roof planes or tile dimensions. Add an explicit optional
   column offset to the public recipe, preserve existing defaults, and document
   fitting phase/pitch and measuring clearance. Validate multiple roof pitches,
   boundary phases, closed cuts and unchanged default bytes; retain a frozen
   baseline versus grid-only native image control.
2. **Provide a reusable fitted-profile construction recipe.** Existing low-level
   polygons/lofts support the required forms, but authors still rebuild a flat
   cabin over a box. Add a small public example for corresponding sections,
   independently tapered width/height, fitted planar window patches and genuine
   wheel-well clearance. Include a generic utility vehicle and a non-vehicle
   housing to demonstrate reuse. The caller owns proportions and sections; this
   is no reference-specific finished asset or renderer scene graph. Validate
   winding, shared pane boundaries, intended closedness and wheel clearance,
   then strict extraction and browser/Dawn rendering.
3. **Keep lighting diagnosis separate from geometry.** A three-image frozen
   bundle control changes only key-light X direction or environment fill. The
   direction change restores stronger bright-front/shaded-side separation;
   halving fill has a smaller effect. Geometry, materials and shaders stay fixed,
   all native proofs pass, and the session is disposed. This supports checking
   visible-plane relationships during authoring, not changing renderer defaults
   or claiming a newly discovered lighting engine defect. Evidence is in
   `evidence/round10-lighting-control/` in the main benchmark directory.
4. **Review, validate, then requalify.** Require independent code review and the
   full repository check, focused geometry/native/browser checks, packed CLI and
   memory gate where applicable. Freeze the new checkpoint before another fresh
   synchronized six-author run with unchanged budgets and acceptance thresholds.
   Retain every result; do not relabel a control image as an authored benchmark.

The fuel-stop reference remains untouched by benchmark authors. Dispatch it only
after the same fresh round passes both scene-quality and both cost gates. The
original harbor absolute-score failure, its separate prospective paired
amendment, repeated-round selection bias and small related-model panels remain
explicit limitations. Final publication and full-plan closure remain open.

Pre-round-11 validation passes: **4,883 tests in 688 files**, shuffle seed
1792369152264, with all required repository checks. The seven roof tests and six
fitted-prop tests pass independently, both code reviews have no unresolved
blocker, the roof baseline/grid-only native pair passes, and fitted props pass
strict extraction plus front/side/rear native inspection. The final worked
example browser/Dawn pair is byte-identical at 1200×900.

The production renderer/CLI source is unchanged from the independently reviewed
pre-round-10 checkpoint: the validation runner verifies the prior source hashes
and rejects new production changes before carrying forward its 65 native tests,
packed-CLI Dawn proof and 1,200-frame memory gate. These are explicitly inherited
checks, not falsely reported reruns. New example geometry has its own native and
browser evidence. Full-check logs/source inventories are retained under
`benchmarks/visual-parity-20261018/evidence/round11-validation/attempt-2026-10-19T00-16-02.610Z/`.
This completion-status update is formatted after validation; implementation,
tests and authoring guidance remain byte-identical to the checked source.

## Round 11: mean visual leads, remaining composition and completion deficits

All six fresh authors started behind the common readiness barrier and finished
within budget. Release observations span 69 ms, maximum 103 ms. All 124 frozen
live/retained files and all final source snapshots match. There are 36 calls and
35 successes: Aperture and vGPU have no failed calls; Three.js has one retained
GTAO multisampled-depth failure followed by a corrected final. All six entries
remain technically eligible. Four separate final browser proofs and lifecycle
cleanup pass; Aperture native/browser maximum difference is one channel byte,
and both vGPU pairs are byte-identical.

Aperture leads both mean scores: canal 7.3850 versus Three.js 7.2875, courtyard
7.3625 versus vGPU 7.1475. Canal passes all visual gates. Courtyard composition
is 0.35 behind its strongest peer, exceeding the unchanged 0.25 limit. Neither
judge finds a major Aperture artifact. The individual scores disagree on some
rankings and remain unedited in `benchmarks/visual-parity-round11-20261018/judging/`.

First-useful median is 64.286386 seconds against Three.js 62.205386 seconds,
within the declared allowance. Finish median is 923.016016 seconds against
vGPU 782.251567 seconds. Its 860.4767237-second limit is missed by 62.5392923
seconds. The complete round fails; higher mean image scores alone do not close
the composition or cost gates. The untouched fuel-stop reference remains unused.

The independent cost diagnosis finds that capture calls occupy only 1.65–6.35%
of total author time. Aperture's measured GPU waits matter, but removing them
would not establish the cause of the full authoring gap. Repeated camera/layout
corrections appear in all six authors' notes. The Aperture courtyard author
compensated for an orthographic camera by changing pool proportions and roof
rise, then wrote an inline NumPy/SciPy least-squares camera fit after capture four.
The author subsequently preserved the exact command/stdout from its context in
`benchmarks/visual-parity-20261018/evidence/round11-camera-author-reconstruction.md`.
That is a retrospective reconstruction of an inline command, not an originally
saved benchmark script. Its approximate geometry and hand-marked targets have
16.3585-pixel coordinate RMS (23.1345-pixel point RMS), not final-image accuracy.

### CPU camera tooling follow-up

Existing `camera_frame_entities` and `camera_fit_entity` fit scene bounds into a
viewport. Reference-landmark agreement is a different operation. Add a small,
renderer-free CLI route for projecting named world anchors and fitting a bounded
camera to caller-supplied image coordinates. This replaces repeated custom math;
it does not read reference pixels, infer a finished scene, move authored geometry
or establish visual acceptance by itself.

The contract must support explicit perspective/orthographic projection, viewport,
initial position/target, near/far, weights, fixed/free parameters and finite
bounds. Use a parameterization without redundant target/distance degrees of
freedom. Return directly usable camera data, per-anchor pixels and signed
residuals, depth/frustum validity, clearly defined coordinate and point RMS,
iteration/termination evidence, bound hits and conditioning. Distinguish numerical
convergence from acceptable residuals. Expose inconsistent, behind-camera,
insufficient and underconstrained inputs rather than reporting false success.

Validation before another fresh round:

1. Cross-check projection with independent analytic fixtures and the engine's
   matrices for both projections, off-center anchors, non-square viewports and
   depth clipping. Verify recoverable synthetic fits, noisy/bound-limited data,
   singular cases and actual CLI JSON/file/error behavior.
2. Replay the recovered camera problem as a separate CPU control, retaining exact
   inputs, outputs and computation time. Do not relabel it as a fresh authoring
   result or infer minutes saved from a faster numerical calculation.
3. Retain a frozen-scene camera-only render control with unchanged geometry,
   materials and lighting. Inspect clipping, remaining residuals and the limits
   of fitting an imperfect model to a generated reference. Apply any scene
   correction only to the separate control, never to the scored round.
4. Require independent numerical/CLI code review, the full repository check,
   packed-CLI command validation and relevant native/browser checks. Keep public
   usage concise and place it at the blockout measurement step. Make the existing
   oval leaflet option explicit in the mandatory workflow; no geometry default
   changes are needed for that discoverability correction.
5. Freeze and run another independent synchronized six-author round under the
   same visual, first-image, finish-time and capture gates. Record tool use and
   all CPU work inside author clocks. Only a complete passing fresh round can
   release the unused transfer subject. Final publication remains open.

This is a defensible authoring experiment, with time and visual benefits still
unproven. The original harbor absolute failure, its separate paired amendment,
repeated-round selection bias and limits of small related-model panels continue
to apply.

### Camera checkpoint validation and round 12 release

The public CPU `camera project` / `camera fit` route is implemented without a new
dependency. Independent review retains 23 separate numerical/ECS cases and 73
focused tests. It verifies the emitted quaternion through actual spawn, local and
world transforms, and projection, including rotation precedence. Tiny-distance,
uniform-weight, Float32 precision and strict engine-target-tolerance findings
were corrected before release. The signed review is retained at
`benchmarks/visual-parity-20261018/evidence/round12-camera-review.md`.

The separate recovered-problem control reaches 16.3585326344-pixel coordinate
RMS, consistent with the author's prior custom solve. Its parameterization and
bounds differ as prospectively disclosed. Fixed capture-four geometry improves
from 28.1943 to 22.4068-pixel point RMS, with 34.4940-pixel maximum error. Both fits
converge but correctly return exit 2 against the unchanged 1-pixel tolerance.
The two camera-only native captures preserve every geometry/material/light/effect
field and pass strict preflight and renderer diagnostics. Baseline replay differs
from the original by at most one channel byte (mean 0.01218), rather than being
byte-identical. All inputs, outputs, residuals, matrices and images remain in
`evidence/round12-camera-control/`. This does not establish author-time savings.

Fresh validation at `evidence/round12-validation/attempt-2026-10-19T01-05-40.877Z/`
passes all 65 native GPU tests, the packed CLI's Dawn render smoke, 1,200-frame
memory check, and full repository check: 4,906 tests in 689 files, shuffled seed 1792372143695. All 114 inventoried source/configuration files remained unchanged
during validation. An earlier inventory-only runner failure from a Git output
buffer limit is retained; it launched no checks. A separate fresh package install
passes projection, accepted fit, rejected fit, invalid-input and runnable-help
checks (`evidence/round12-packed-camera/`). This plan status text was updated after
validation; implementation bytes remain the validated bytes.

Round 12 will use the same two references, six new independent authors behind the
common release barrier, the same 25-minute/six-capture limits and unchanged visual
and cost gates. Judge two's complete reverse presentation order is now explicitly
frozen, avoiding the subject-block order discrepancy disclosed in round 11. The
new camera route is discoverable in the public workflow and generated diorama
guide. Its use, benefits or failure to help must be observed in the new round. The
untouched fuel-stop subject remains undispatched until that complete round passes.

## Round 12: complete two-subject qualification passes

At pushed checkpoint `0239f77281054c3bbc79a180712f45b8fbec69e4`, both fresh
visual gates and both timing gates pass in the same round. Canal means are
Aperture 7.7575, Three.js 7.4900 and vGPU 7.4625; courtyard means are 7.8150,
6.9475 and 7.3250 respectively. Both independent judges rank Aperture first on
both subjects, with no major Aperture artifact. The largest positive category
deficit against the strongest peer is 0.05 (canal composition).

First-useful median is 76.557035 seconds against Three.js 73.014035 seconds;
finish median is 1007.585535 seconds against vGPU 951.7608105 seconds. Ratios
1.048525 and 1.058654 pass the unchanged 1.10 ceiling. Every first attempt is
independently judged useful. All 35 calls remain retained: 34 successes and one
Three.js courtyard configuration failure followed by recovery. All six final
sources match their last successful capture and all 129 live/archived frozen
files match. Release observations span 17–70 ms; later scheduling is unmeasured.
No root builds, GPU checks, packaging or cleanup overlapped author clocks.

Independent technical review finds all six eligible with documented construction
limitations. All four separate final browser proofs pass; Aperture's browser/Dawn
images differ by at most one channel byte, and both vGPU pairs are byte-identical.
Services, native child, profiles and lifecycle all close cleanly. The canal
Aperture author used camera project, while courtyard used neither camera command;
neither used fit. No causal time savings are inferred from adoption or round
outcomes. Complete reports are in `benchmarks/visual-parity-round12-20261018/`.

## First held-out transfer: retained failure, not full closure

Only after round 12 fully passed, three fresh authors received the previously
unused rural fuel-stop reference. Common release was 2026-10-19T01:50:13.739240Z,
with the unchanged 25-minute/six-call budget, dimensions, scoring and timing gates.
The implementation stayed at `0239f77`; all 128 frozen live/archive hashes match.
All authors finish within budget and final sources match the last successful
capture. Each uses six calls with one retained failure. Three.js's last call fails
parsing and its author restores the exact previous successful source, as required.

Both blind visual judges rank Three.js first, Aperture second and vGPU third.
Means are 7.4825, 7.0625 and 6.5150 respectively. Aperture's deficits to Three.js
are composition 0.55, shape 0.70, style 0.40 and finish 0.45. Lighting is 0.10 ahead;
neither judge identifies a major Aperture artifact. The pickup's tall boxlike cab,
coarse proportions and simplified surfaces, elevated framing, thin terrain edge
and incomplete ground integration explain the visible shortfall. This exposes
limits to transfer despite the successful repeated-subject qualification.

The independent effort reviewer inspected all 15 successful images and the
reference. All first attempts qualify as useful. Aperture's first useful image
is 104.737760 seconds versus Three.js 75.303760 seconds: ratio 1.390870, failing
the unchanged 82.834136-second ceiling. Finish is 1075.126760 seconds versus
1058.394627 seconds: ratio 1.015809, passing. Three provider-capacity errors
interrupted the vGPU author, which resumed on the same model with no added time
or captures. That interruption occurred after all first captures; it does not
explain Aperture's startup deficit. Provider downtime is not measured active labor.

Final browser portability checks pass: Aperture maximum difference one channel
byte, mean 0.00335648; vGPU byte-identical. Both service wrappers exit zero, exact
service/native-child PIDs are gone, profiles removed and lifecycle completed.
Independent technical review is complete: Aperture and vGPU meet the explicit
requirements with documented geometry limitations; Three.js glazing covers a
solid cab shell rather than shared opening boundaries, violating that clause. Keep the original all-peer visual/timing comparison;
do not remove a stronger peer to manufacture a pass. Source compliance and visible
quality are separate evidence dimensions.

Retrospective author accounts identify a concrete workflow concern: Aperture
requested its 417-line guide together with roof/foliage guides and received
truncated output, then read the generated diorama guide/config/source before the
first capture. Three.js wrote its blockout directly from existing API knowledge
and looked up framework source only afterward. Command ordering is retained,
but individual read/think phases were not timestamped. This supports investigating
staged documentation and startup ergonomics; it does not establish the cause or
promise a particular time saving. Aperture again wrote inline projection math
later rather than using the public camera commands.

Continue with independent shape and startup diagnoses before selecting reusable
changes. Preserve every result in `benchmarks/visual-parity-heldout-20261018/`.
Validate any change, then require a new complete two-subject qualification and a
new prospectively frozen, unused transfer subject. The fuel-stop is now an exposed
failure and cannot be relabeled as untouched in a later attempt. No quality,
timing, call-budget or image-selection gate is relaxed. Final publication and
full-plan closure remain open.

## Transfer follow-up: staged guidance, pixel placement and profile shape

The two independent diagnoses are retained at
`benchmarks/visual-parity-20261018/evidence/heldout-startup-diagnosis.md` and
`heldout-shape-diagnosis.md`. Before changing product behavior, the follow-up is:

1. **Stage the reading at the first useful image.** Replace the 417-line mandatory
   front door with a concise entry point (at most 80 lines/6,000 bytes), preserving
   advanced construction, lighting and portability guidance in linked sections.
   Put scaffold, editable scene file, 5–10 subject-specific masses and first capture
   before roof/foliage/shader research. Stage generated DIORAMA.md similarly.
   Do not weaken the useful-blockout definition, fitted surfaces, custom shader,
   real reflections, final-quality gates or failed-attempt accounting. Keep all
   old guidance available and link exact public files rather than guessed paths.
   Validate generated documentation, links, template extraction and the full suite.
   Reduced reading surface is structural evidence, not a promised time saving.
2. **Add CPU pixel-to-plane placement.** Three.js used camera unprojection plus a
   ray/plane intersection to place canopy/pump landmarks. Extend the existing CPU
   camera route with a small `camera unproject` command for explicit viewport,
   perspective/orthographic camera, named pixels and a caller-specified plane.
   Return rays, intersections, validity/clip information and reprojection error.
   Reject nonfinite/degenerate inputs; report parallel, ill-conditioned and
   behind-camera intersections honestly. Define plane sign, pixel origin, ray
   origin and units. Do not infer depth, move geometry, read images, or create a
   second authoritative scene. Reuse engine-compatible camera matrices.
   Validate independent analytic cases in both projections, non-square viewports,
   offscreen points, oblique/scaled planes, near-parallel rays, clipping, actual
   CLI JSON/file/exit behavior and installed-package use. Independently review
   numerical boundaries and retain a fixed-camera placement control. This is a
   missing operation demonstrated in the peer source, not renderer acceleration.
3. **Make fitted shape choices easier to reuse.** Existing profile/panel helpers
   support the omitted geometry. Add a short runnable shape-sheet recipe showing
   belt/shoulder/crown sections, independently sloped hood or top, planar shared
   window boundaries, material partitions and wheel/opening ratios. Use generic
   vehicle and non-vehicle forms with caller-owned dimensions, not the fuel-stop's
   completed pickup. Keep code copyable and semantic parts editable. Validate
   winding, closedness where intended, shared pane ownership, nondegenerate
   Float32 triangles and multiple native/browser views. Explain silhouette ratios
   before decorative trim; do not hide a solid body behind floating glazing.
4. **Requalify the combined workflow.** Review changes, run required correctness,
   package and full-repository checks, then freeze a new checkpoint. Use fresh
   authors behind the common barrier with unchanged budgets, two-subject visual
   gates and first-image/finish timing gates. Preserve new failures. Only a full
   passing combined round releases a newly prepared untouched transfer reference;
   the failed fuel-stop stays exposed and scored. Independent judges and technical
   audit must keep topology compliance separate from visible quality and retain
   all original peer comparisons. Final gallery/archive verification and closure
   remain pending until the full plan's measured gates pass.

The startup gap is 25.798 seconds before capture start plus 3.636 seconds during
the capture interval. Even removing the entire Aperture capture interval would
not pass the first-image limit. The uninstrumented pre-capture interval includes
reading, reasoning, writing and scheduling; it is not a measured documentation
cost. The shape audit also finds only about 1.5 degrees of camera-elevation
difference: canopy depth/yaw and truck profiles are local authoring decisions.
No new renderer defect is established. These observations constrain the follow-up
without claiming causality or relaxing acceptance.

### Round 13 checkpoint: implementation and controls validated

The staged front door is 76 lines/4,852 bytes, with the advanced reference retained.
The profile helper and same-envelope shape sheet passed independent review after
three edge-case fixes: mutable control-data sharing, prototype window-band keys,
and missing required section coordinates. Review covers 52 closed-shell cases,
12 matched control pairs and 20 focused tests. All ten strict native controls pass
and were visually inspected. The two shaped hero views pass the approved browser
route: vehicle pixels match Dawn exactly; housing maximum channel difference is
one, mean 0.01628765. These are geometry/portability controls, not fresh author scores.

The CPU pixel-to-explicit-plane command passed 14 independent review groups,
including 1,600 numerical intersections checked against actual ECS extraction and
an independent linear solve. The maximum accepted reprojection residual is
0.00070741 pixels. Four fixed-camera placement controls put 16 points through the
public CLI and ECS transforms with maximum residual 0.000011667 pixels. A shared
camera I/O alias bug found in review was fixed across project, fit and unproject;
ordinary project/fit report comparisons remain byte-identical. Fresh installed
package checks pass all 36 camera cases, including rejected jobs and alias input
preservation. No author-time benefit is inferred from these CPU timings.

Validation is retained in `evidence/round13-validation/checkpoint-validation.json`:
65 native GPU tests, packaged Dawn rendering, the 1,200-frame memory check and
full `pnpm run check` pass. The full suite has 4,943 tests in 691 files, seed
1792392929674, with all 124 inventoried inputs unchanged during the final run.
Earlier failed runs remain retained: the generated diagnostics catalog needed
refreshing, and two intentionally invalid first-transfer capture snapshots were
being parsed by lint. The new narrow exclusion preserves those immutable failed
attempts; current JS/MJS apps, harnesses and product TS retain their prior lint
eligibility. Benchmark app TS was already outside ESLint's configured file sets.
The plan was formatted before the final run; these status paragraphs are added
after validation and do not change the tested implementation.

Round 13 retained the same references, rubric, budgets and synchronized
six-author barrier. Independent judges used the prospectively frozen opposite
presentation orders. The prepared rail-halt transfer remains unused. The full
handoff remains a draft until the final benchmark, publication and archive
inventory are complete.

## Round 13: first-image and mean-quality gains, remaining lighting and finish gaps

Checkpoint `2c500eb249c2a94d195b3937a71c888984ecc278` is committed and pushed.
All six independent authors finished before the common deadline, using all 36
permitted calls; 34 succeeded and both failures remain retained. All 139 live and
archived frozen files matched at completion, as did all 65 final source files.
Every final is the last successful capture. Raw independent judgments and exact
recomputation are in `benchmarks/visual-parity-round13-20261018/judging/` and
`recomputed-summary.json`.

Aperture leads the paired mean in both subjects: canal 7.7000 against Three.js
7.2325, courtyard 7.3075 against Three.js 7.1600. Canal passes all visual gates.
Courtyard fails the category gate: lighting trails by 0.35, above the unchanged
0.25 allowance. Neither judge reports a major Aperture artifact. Mean leadership
does not override that category failure.

Independent effort review inspected all 34 successful images; the first
successful image is useful in every trial. Aperture's first-useful median is
79.505359 seconds against Three.js 102.963859, ratio 0.772168: pass. Finish median
is 1,257.103859 seconds against vGPU 1,071.811859, ratio 1.172877: fail against
the unchanged 1.10 ceiling. Its 185.292-second gap includes 41.015727 seconds of
measured capture overhead difference and 144.276273 seconds outside captures.
The latter mixes unmeasured reading, editing, reasoning, inspection and scheduling;
it is not measured active labor. No token billing is available.

All final framework routes submit real WebGPU work; required procedural shaders,
actual scene reflections, fitted vehicle/boat surfaces and real arches are present.
Four coordinator browser proofs pass after author clocks. Aperture's native/browser
maximum channel differences are one, means 0.00012654/0.02155031; vGPU is exact.
Both services exit zero, PIDs and browser profiles are gone, and the approved
lifecycle records completion. The independent technical audit retains two vGPU
per-job disposal deviations and four construction limitations. No automatic
disqualification rule was stated; all peers remain in the comparisons. Global
cleanup does not erase interim resource-disposal omissions.

### Follow-up: local assemblies and resolved lighting evidence

The retained timing diagnosis is
`benchmarks/visual-parity-20261018/evidence/round13-timing-diagnosis.md`.
Copied profile, roof and foliage recipes did not fail. Existing camera fit and
unprojection worked; canal used them after detailed construction. The largest
courtyard interval moved/rebuilt enclosure geometry and introduced pavilion
parents late, followed by an arch occlusion repair. Canal moved connected hull,
bench and rope pieces manually. One torus option error also required a retry.
These are concrete usability hypotheses, not proven causal savings.

The courtyard sun points within about nine degrees of the viewing axis, placing
many shadows behind objects. Direct illumination still depends on each authored
normal: the rotated pavilion's front/side cosine responses are about 0.724/0.354,
so this is not an absence of plane separation. The current report exposes light
counts and IBL readiness but not resolved directions. The existing guide already
prescribes key-direction checks before changing fill. No new renderer defect is
established; the previous successful courtyard also used environment intensity 0.5.

Before another qualification, implement and validate only these general changes:

1. Demonstrate named ECS assembly roots and local child coordinates directly in
   the small diorama starter, with a typed explicit-parent helper. Keep its initial
   six visible meshes, geometry, camera, materials, lights and water unchanged.
   Show moving, rotating and scaling a root without manually relocating fittings.
   Keep exact cylinder/cone/torus signatures beside the helper. Add no hidden scene
   graph, finished subject asset or new framework dependency.
2. Add informational CPU evidence to existing lighting-health reports: each
   directional light's resolved world direction/color/intensity, world elevation,
   camera-relative components/alignment, and horizontal-plane shadow displacement
   per unit height. Distinguish camera-plane direction from pixel projection and
   occlusion. Invalid or undefined geometry must be explicit; no aesthetic score,
   new warning, changed global default or automatic light adjustment is allowed.
   Include all new inputs in cache invalidation and deeply copy nested report data.
3. Independently review the changes. Extract the starter before/after and verify
   unchanged geometry/render settings; exercise translated, rotated and nonuniformly
   scaled parents, shared contacts and unrelated entities. Verify light evidence
   against actual ECS matrices and independent vector math, including roll,
   perspective/orthographic views, multiple lights/cameras and degenerate inputs.
   Retain fixed-scene direction controls with camera/materials/exposure/fill fixed;
   do not replace any benchmark image or score with those controls.
4. Run affected CPU/native tests, installed-package checks where public output
   changes, and the required full repository check before review/commit/push.
   Then freeze another fresh six-author qualification under the same rubric,
   budget, common barrier and last-success rule. Preserve all results.
5. Release the still-unused rail-halt reference only after the latest checkpoint
   passes every visual, timing and technical requirement together. Round 13's
   failure blocks release; a later qualification may earn it under the same
   numerical gates. The failed fuel-stop transfer remains a separate retained
   outcome, never relabeled. Finalize the full concept handoff and complete
   publication only after the declared suite qualifies.

The existing private gallery is now deployed through round 13 and the failed
fuel-stop transfer, source `8efeafa337f060e7316e5b3c4c6cb989e043605b`.
Authenticated byte/MIME/image-decoding verification passed for 203 files. Its
download scope is still explicitly through round 3; complete archives and current
round publication remain open. Do not infer archive coverage from a gallery link.

## Round 14 engineering checkpoint

The local-assembly starter and resolved-light report are implemented and have
passed independent review. Full validation passes 4,968 tests in 692 files,
65 native Dawn tests, packed-package Dawn rendering and memory checks; validated
source stayed unchanged. The exact receipts are in
`benchmarks/visual-parity-20261018/evidence/round14-validation/checkpoint-validation.json`.

Native controls preserve all six starter meshes/settings and produce identical
before/after pixels. The new starter is also pixel-identical in the verified
browser. Service preflight passes browser failure recovery/profile cleanup and
both native framework routes. Independent old/current runtime copies render the
same frozen courtyard bundle to four byte-identical PNGs. A separate earlier exact
comparison against the historical shared-session native capture remains failed
(max 1 RGB value); its cause is unproven and the failure is retained. It also
predates the new diagnostics, as the isolated old runtime reproduces the current
image exactly. The fixed-geometry key-direction control demonstrates stronger
plane separation with darker shadows, not a universal default or a scored win.

Round 14 authors have not started at this checkpoint. Freeze the reviewed revision
and run the unchanged six-author qualification next. No engineering check substitutes
for its visual/timing gates, and rail-halt remains undispatched.

## Round 14 outcome and bounded round 15 follow-up

The completed qualification at `488fe0497318208c360433528e9dd0c6bbd42d87`
**failed**. The paragraph above records the earlier engineering checkpoint;
the complete result is retained in
`benchmarks/visual-parity-round14-20261018/REPORT.md`, `QUALIFICATION.md`,
`final-summary.json`, and the raw independent judgments. All 146 frozen files
and 66 final source files matched. All six authors finished before the deadline;
36 calls produced 34 successful images, with both failures retained. All final
browser, procedural-shader, reflection, lifecycle and source-integrity checks
pass. Documented geometry limitations remain in the comparison, with no
retrospective peer disqualification.

Courtyard passes: Aperture 7.8100, vGPU 7.5300, Three.js 7.0700. Canal fails:
Aperture 7.2925, Three.js 7.6900, vGPU 7.5800, with lighting and finish category
deficits of 0.75 each and composition deficit 0.30. Neither visual judge finds a
major Aperture artifact. First-useful-image median passes at 75.966051 seconds
against Three.js 107.475051, ratio 0.7068249821. Finish median fails at
1,281.1409775 seconds against vGPU 1,119.299051, ratio 1.1445922127. It exceeds
the unchanged 1.10 limit by 49.9120214 seconds.

The retained CPU timing diagnosis attributes 45.244906818 seconds of the
161.8419265-second Aperture/vGPU median gap to capture intervals and
116.597019682 seconds to intervals outside captures. Those outside intervals
are not measured active labor or token cost. Both Aperture authors adopted the
local groups early; recommending groups again would not address this result.
The longest correction intervals combine camera, assembly proportions and
detail. Local camera jobs were first retained at the fifth capture and became
detached from subsequent geometry changes.

The separate canal controls identify nominally coplanar plinth and door faces:
their extracted world separation is about 8.20e-8 units. Removing only the
overlap removes the bright slivers with lighting and materials held fixed.
Lower fill restores shaded-plane separation; the isolated reflection-tint
control reduces pale water contribution. These are causal controls for those
specific effects, not a rejudged final, an optimal lighting prescription, or
evidence of an AO/renderer fault. Fresh repeated baseline renders agree exactly
with one another; their maximum one-channel-unit difference from the historical
native image remains unexplained and retained.

Before another qualification:

1. Add one resolved-ECS camera inspection operation, shared by the camera facade
   and existing tool transports. Transform caller-owned local landmarks and
   oriented triangles using fresh authoritative matrices; report projections,
   facing and static descendant source bounds without running simulation or
   mutating authored poses. Reuse the existing offline fitter through an optional
   job seed with explicit orbit distance; unsupported camera/export cases must
   be explicit. Add no landmark graph, inferred geometry or new optimizer.
2. Add an optional CPU coplanar inspection helper and offline bundle command.
   Inspect explicitly selected static triangle draw ranges and resolved matrices,
   exclude shared-edge/zero-area contacts, and report measured separation and
   positive overlap area. Keep tolerances, work limits, incomplete coverage and
   visibility/material limitations explicit. Do not add a per-frame pass,
   automatically move geometry, or reject intentional layered scenes.
3. Update the staged authoring guide to use fresh local probes for the largest
   composition mismatch and selected overlap inspection for suspicious contacts.
   Explain that root scale also scales foliage detail and that fill should be
   judged on shaded planes. Preserve the short first-image path, current scene
   defaults and all benchmark rules.
4. Independently review both APIs and validate analytic geometry/projection
   fixtures, transformed assemblies, stale-edit freshness, invalid/unsupported
   inputs, deterministic limits, tool routing and installed public exports.
   Retain an external round-14 diagnosis using the shipped inspector without
   changing or rescoring the original files. Run affected tests, the required
   full repository check and appropriate Dawn/browser portability checks before
   committing and pushing the reviewed checkpoint.
5. Separately profile native capture overhead only where current phase evidence
   supports a controlled experiment. Do not promise that eliminating capture
   overhead alone would close the finish gap; arithmetic substitution still
   misses the current limit and is not a causal counterfactual.
6. Freeze a fresh six-author qualification with the unchanged references,
   visual/category gates, 1.10 timing ceiling, budgets, barrier and last-success
   rule. Preserve every outcome. Release rail-halt only after the latest complete
   qualification passes; then require the untouched transfer to pass as well.
   Finalize the comprehensive concept handoff and complete archive publication
   only after the declared validation suite succeeds.

Architecture proposals and measurements are in
`benchmarks/visual-parity-20261018/evidence/round15-camera-workflow-proposal.md`,
`round15-coplanar-inspection-proposal.md`, `round14-timing-diagnosis.md`, and
`round14-canal-diagnosis/`. These are bounded implementation hypotheses; none
establish a future benchmark result. Rail-halt remains undispatched.

The first native synchronization control is now complete, outside author clocks:
42 renders and 12 idle probes, all identical paired RGBA/PNG results, unchanged
built runtime, and complete owned-process cleanup. Idle completion promises take
0.032–0.148 ms in this setup. The three small-cube routes share the same cached
device factory and cache-counter progression; four measured warm samples per
route have overlapping timing ranges. This does not establish a useful
end-to-end saving from removing the explicit completion wait, so synchronization
is unchanged. The complete script, inputs, runtime and results are retained in
`evidence/round15-capture-profile/`. The separately bounded generic pass-cost
control stopped after one successful untimed render and one failed timed render;
four planned calls did not run. Dawn exposes the obsolete command-encoder
`writeTimestamp` method but rejects it under the standard `timestamp-query`
feature. The exact failure, inputs, built runtime and cleanup are retained under
`evidence/round15-capture-profile/feature-pass/`. There is no valid pass-cost
comparison. The narrow repair now uses current render-pass `timestampWrites`;
its independent review and native/browser controls are recorded below. This
failure did not affect R14’s uninstrumented captures.

Round 15's six empty trial directories, unchanged references and judging rubric
are prepared, without source freeze, services, author readiness or dispatch.
The complete R14 progress gallery is deployed at source
`87b29859eda6b30e11cd6925603235bc81d5e082`; authenticated verification passes all
216 HTML/image files. Downloadable full evidence still covers only through R3.
The full concept handoff remains an active draft.

## Round 15 engineering validation

The local camera inspector, selected coplanar inspector and optional timestamp
repair have accepted independent reviews. The combined package build and full
repository check pass: **5,046 tests in 696 files**, shuffle seed
`1792403991336`, plus **65 Dawn tests**, installed-package Dawn rendering and the
1,200-frame native memory check. The exact source hashes and attempt receipts are
in `benchmarks/visual-parity-20261018/evidence/round15-validation/checkpoint-validation.json`.

The initial installed inspection fixture failed because it imported an undeclared
direct package. It now uses the existing public `app/systems` export; the failure
and original script remain retained. A subsequent review added an explicit finite
overlap-area assertion, and the affected installed-package/Dawn check passed
again. Product implementation did not change after the full check. Plan and
handoff status updates are formatted and checked separately before committing.

The shipped coplanar command finds 32 triangle-pair overlaps at the frozen R14
door/plinth joins and zero after the isolated split-plinth correction, with
complete selected-draw coverage. The browser timestamp control passes all three
renders and 33 assertions, with identical pixels for disabled, enabled and
unsupported profiling. Its earlier harness adapter-reuse failure remains
retained. The repaired native control produces six valid images and three valid
timing reports but fails its exact pixel-repeatability assertion: the third
untimed frame differs by one RGB unit in 19,604 pixels. A separately isolated
pre-repair runtime reproduces the same majority, majority, outlier images byte
for byte. This demonstrates that the observed variation predates the repair;
both failed exact gates remain failed, and its numerical cause is still unknown.

Timing reports disclose that main/shadow samples cover only part of the frame.
Measured zero remains zero, unsupported/invalid samples remain explicit, and no
render or author-time improvement is claimed from this profiling repair.

The next step is the reviewed checkpoint commit/push, service preflight and a
fresh synchronized six-author qualification. Its thresholds, 25-minute/six-call
budgets, references and judging rubric are unchanged. The engineering results
above do not close the authoring gap. Rail-halt remains undispatched until the
latest complete qualification passes. The comprehensive handoff links both
concept batches and will be finalized with complete evidence publication after
the declared qualification and untouched-transfer gates pass.

## Round 15 outcome and bounded round 16 follow-up

The qualification at pushed checkpoint
`88fc6551fb197038fe88ed671dae821e96745c60` is complete and **fails only the
finish-time gate**. The earlier paragraph records the pre-author checkpoint.
The complete result, original judgments, source verification and limitations
are retained in `benchmarks/visual-parity-round15-20261018/REPORT.md`,
`QUALIFICATION.md`, `final-summary.json` and `judging/`.

Both visual comparisons pass: canal Aperture 7.5650, Three.js 7.3475, vGPU
7.2800; courtyard Aperture 7.6850, Three.js 7.1225, vGPU 7.0450. Every category
deficit is within the unchanged 0.25 ceiling, with no major Aperture artifact.
First-useful-image median passes at 72.689553 seconds versus Three.js
98.807053 seconds, ratio 0.7356717035. Finish median fails at 1,128.103053
seconds versus vGPU 927.5230535 seconds, ratio 1.2162533845. The 1.10 limit is
1,020.27535885 seconds, leaving a **107.82769415-second miss**.

All six submissions finished before their deadline. The 36 calls produced 30
successful images and six retained failures; the first successful canal-vGPU
image was blank and is not counted as useful. All 193 frozen files and final
source sets match. The independent technical audit accepts all six submissions
with their recorded geometry limitations. Five finals have browser evidence;
canal-vGPU uses the explicitly permitted native-only route, so no browser
portability is claimed for it. Both Aperture native/browser comparisons pass
the unchanged numerical limits. Owned services, processes and profiles are
closed and verified. These results do not remove previous failed rounds or
the failed fuel-stop transfer.

The exact timing ledger is in
`benchmarks/visual-parity-20261018/evidence/round15-timing-diagnosis.json` and its
accompanying Markdown diagnosis. Of the 200.5799995-second Aperture/vGPU median
finish gap, 58.158 seconds fall in capture windows and 142.4219995 seconds
outside them. Outside time is not measured active labor or token cost.
Eliminating the capture difference alone would still miss the limit; that
arithmetic is not a causal speed estimate. Canal Aperture finished 1.948
seconds before canal-vGPU, while courtyard Aperture finished about 403.108
seconds after courtyard-vGPU. Concentrate the next investigation on the
observed workflow friction rather than inferring a universal renderer delay.

Neither Aperture trial retains an invocation of the new local-camera inspector.
This does not exclude an unrecorded external call. The generated diorama guide
still directs authors to manually maintained world anchors. Courtyard's saved
jobs outlive assembly pose/dimension edits; its orthographic and perspective
fits use different anchors and tolerances, so their residuals do not isolate a
projection-family improvement. The source also leaves one named roof feature
ambiguous. These are specific adoption and freshness issues, not evidence of a
fault in the projection solver. The proposed route and source anchors are in
`benchmarks/visual-parity-20261018/evidence/round16-camera-ergonomics-proposal.md`.

Before another qualification:

1. Exercise the existing finite-input `headless serve` route on two unrelated
   generic assemblies with three pose/dimension edits each. Share caller-owned
   dimensions and named features between geometry and probe inputs. Check fresh
   resolved coordinates and projections with independent analytic arithmetic,
   retain stale reports as snapshots, and verify no implicit simulation step.
   Pass an actual exported seed through the existing project/fit CLI. Preserve
   response failures, export refusals, stderr and all attempted recipes. No
   browser, GPU, benchmark geometry or new endpoint is needed for this control.
2. Demonstrate model comparison using identical points, targets, weights,
   viewport and tolerance, with explicit family-specific seeds and bounds.
   Report degrees of freedom, conditioning, termination and bound hits. Include
   an ambiguous case; a lower training residual cannot automatically select a
   projection or establish visual quality.
3. If those controls support the route, update the local-inspection guide and
   generated starter to expose the smallest working recipe. Copying local
   coordinates into a second hand-maintained file is insufficient: dimension
   changes must regenerate the feature inputs too. Explain resource snapshots,
   preload timing and fresh inspection after edits. Preserve the initial
   first-image cadence, render defaults and capture rules. Add API surface only
   if the controls demonstrate a concrete missing contract.
4. Independently review and exercise the documented recipe, run appropriate
   checks and the required full repository check, then commit and push the
   reviewed checkpoint. Prepare sufficient verified storage headroom without
   deleting sources, benchmark history, dependency trees or protected browser
   runtimes. Retain exact archive manifests and restoration instructions.
5. Run a fresh six-author qualification with the same references, 25-minute
   budgets, six-call limits, common barrier, independent judges, category gates,
   timing ceiling and last-success rule. A documentation change is a hypothesis,
   not a promised time saving. Keep every outcome and disclose repeated sampling.
6. Only after the latest full qualification passes, release the still-unused
   rail-halt transfer and require it to pass. Finalize the complete handoff for
   both concept batches, current image gallery and lossless evidence publication
   after the declared suite succeeds. The current handoff remains a linked draft;
   gallery coverage is through R14, and downloadable full evidence through R3.

The proposal above preceded the controls and guide implementation below. No
round 16 benchmark result is established. Rail-halt remains undispatched.

## Round 16 workflow controls and review

The existing route passes the bounded CPU controls, retained in
`benchmarks/visual-parity-20261018/evidence/round16-camera-workflow-control/README.md`:
19 CLI subprocesses and 47 protocol requests, including two generic assemblies
with three source pose/dimension edits each, live parent-translation edits,
fresh projection/fit export, zero implicit simulation steps and verified disposal.
Independent transform/pixel/facing/bounds arithmetic agrees within the declared
numerical bounds. Both known camera families recover their own synthetic targets;
both families also pass the explicit near-orthographic ambiguity case. The
bounded wrong-family perspective candidate remains unaccepted at its lower FOV
bound and iteration limit. Intentional request failures and exit-2 fits remain
retained. These controls establish route behavior, not time savings.

The implemented change is limited to four authoring/camera guides and the
generated `DIORAMA.md` instructions, with a CLI patch changeset. Geometry,
configuration, shaders, first-image instructions and runtime APIs are unchanged.
The guide shares construction features with geometry, demonstrates finite CPU
inspection and explicit model comparison, and distinguishes saved snapshots
from fresh post-edit queries. It adds no solver, endpoint or renderer change.

Independent review in
`benchmarks/visual-parity-20261018/evidence/round16-workflow-review/` recomputes
the generic controls and executes the exact final documentation snippets in an
external temporary app. Strict TypeScript checking passes. Changing the source
height changes both the top landmark and mesh bounds. Missing/duplicate/error
responses, nested inspection failure, unavailable export and invalid family
input all stop before a stale prior camera job or output can be consumed. Both
shell recipes now fail on unexpected command errors while preserving documented
exit-2 fit reports. No review blocker remains.

The prospective round-16 harness retains unchanged references, rubric, budgets,
barrier and numerical gates. Optional native-vGPU browser absence is now reported
prospectively, preserving the existing requirement for Aperture browser proof.
Service preflight passes failure recovery, cleanup between browser calls and both
native routes; starter browser/native pixels are identical. Services were held
active for the later author round. The full repository check passes **5,046 tests
in 696 files**, shuffle seed `1792407751210`, including build/type, package,
example, documentation, diagnostics, lint and formatting checks. Source remained
unchanged throughout validation. Exact receipts are in
`benchmarks/visual-parity-20261018/evidence/round16-validation/checkpoint-validation.json`.
The standalone Dawn/memory suite was last run at unchanged-runtime R15; this
prose-only change does not claim a new run. The reviewed checkpoint was committed
and pushed as `5e981e2a4bc56ec21e8c5828bcdac79aa12ba9ea`; the exact remote match is
retained in the adjacent `checkpoint-commit.json`.

## Round 16 outcome and next bounded diagnosis

The completed qualification at `5e981e2` **fails only finish time**. Its
[report](../../benchmarks/visual-parity-round16-20261018/REPORT.md),
[qualification](../../benchmarks/visual-parity-round16-20261018/QUALIFICATION.md),
[final summary](../../benchmarks/visual-parity-round16-20261018/final-summary.json)
and [independent technical audit](../../benchmarks/visual-parity-round16-20261018/judging/technical-audit.md)
retain all outcomes. Canal means are Aperture **7.6450**, best peer vGPU
**7.5325**; courtyard means are Aperture **7.8750**, best peer Three.js **7.2225**.
Both subjects pass every category-deficit and major-artifact gate. First-useful
median is **61.220851 s** versus Three.js **85.677851 s**, ratio
**0.7145469953488913**, passing. All six first captures were independently judged
useful blockouts.

Finish median is **1160.305351 s** versus vGPU **997.864978 s**, ratio
**1.1627879288093423**. The unchanged 1.10 limit is **1097.6514758 s**; the miss is
**62.6538752 s**. All 36 capture calls remain counted: 35 passed, one Aperture
CPU preflight failed. All six finals meet the deadline and match their last
successful source snapshots. All 199 frozen files and 1253 built files were
unchanged through completion. The two visual judges used the predeclared order
and its reverse; their original records remain unchanged.

Required Aperture native/browser comparisons pass: canal max **1** and mean
**0.0020490740740740743**, courtyard exact. Courtyard vGPU's supplied browser route
also passes exactly. Canal vGPU is explicitly native-only, as permitted, and has
no browser portability claim. The technical audit accepts all six submissions
with limitations and no blocking violation. Both services exit 0, all owned
profiles/processes are gone, and the browser lifecycle is completed. The initial
overbroad cleanup probe matched its own shell; that failed probe is retained
alongside the corrected exact-executable check. Protected runtime retention
remains unchanged.

The observed **162.440373 s** finish gap partitions into **54.886 s** of capture
timestamp windows and **107.554373 s** outside captures. The latter includes
reading, reasoning, editing, CPU work, inspection, reporting and scheduling;
it is not measured labor or a saving attributable to any proposed feature.
Rendering alone cannot explain the whole gap. This is another retained failed
qualification, not evidence that repeated sampling has closed the gap.

Both Aperture authors report seeing the new optional inspection route, but
neither used its finite resource/`inspectLocal` workflow. Retained source supports
public fit/project/unproject use and an independent projection experiment, with
some historical coordinate snapshots remaining after later geometry changes.
The [verbatim author retrospectives](../../benchmarks/visual-parity-20261018/evidence/round16-author-retrospectives)
are recalled experience, not instrumented timing. They describe manual bundle
projection inspection, coupled roof/layout corrections, and one concrete silent
contract mismatch: unsupported sphere segment option names were ignored.
The finite-route implementation is not shown to fail, and another prose-only
rerun is not justified by its non-adoption.

Before choosing the next change:

1. Independently retain exact timing and workflow-adoption diagnoses. Preserve
   the distinction between measured capture phases and unmeasured outside time.
2. Reproduce the sphere option mismatch with a generic CPU control and evaluate
   a consistent, actionable diagnostic using existing primitive validation rules.
3. Evaluate the existing inspection routes for selected projected mesh bounds
   from a retained portable bundle. The concrete need is avoiding manual matrix
   and vertex decoding after a capture; any proposal must state static-geometry,
   clipping, visibility and precision limits and avoid benchmark-specific code.
4. Design a feature-preserving control on retained final scenes and an unrelated
   fixture for native setup/draw cost. Hundreds of distinct mesh/material assets
   and completion-wait time are observations, not proof of a batching or cache
   defect. Inspect existing sharing/merging mechanisms first; do not weaken
   quality settings or infer GPU compilation counts from higher-level cache names.
5. Implement only evidence-supported reusable improvements, independently review
   and validate them, then run a fresh qualification under all unchanged gates.
   Release the untouched rail-halt transfer only after a complete qualification
   passes. Preserve the failed fuel-stop transfer. Finalize the comprehensive
   handoff and complete evidence publication only after the declared suite passes.

These are bounded investigations, not implemented round-17 features or promised
time savings. The overall goal remains active; the untouched transfer and final
publication are still open.

## Round 17 bounded implementation and controls — active

The [retained proposal and CPU baseline](../../benchmarks/visual-parity-20261018/evidence/round17-authoring-proposal.md)
reproduce the sphere contract mismatch without a GPU. The facade accepts
`radius` and `segments`, whereas the direct render factory accepts `radius`,
`widthSegments`, `heightSegments` and `label`. Unsupported names previously
silently selected defaults. The implemented diagnostic now checks each boundary
before geometry publication, names the accepted options, and permits a corrected
same-key retry. Numeric normalization and supported geometry remain unchanged.

The [implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-validation.json)
records 67 focused tests; the [independent review](../../benchmarks/visual-parity-20261018/evidence/round17-sphere-review/README.md)
accepts the bounded change with eight additional adversarial tests, 102
accepted-input comparisons against the prior built APIs, and all twelve retained
mesh-buffer signatures unchanged. These are CPU correctness results, not
author-time savings. Full checkpoint validation and commit/push are complete as
recorded below; author qualification remains open after the interrupted R17 run.

The [independent control design review](../../benchmarks/visual-parity-20261018/evidence/round17-control-design-review.md)
accepts a pure offline selected-vertex projection helper and an existing `inspect`
CLI subcommand for implementation. It requires actual active vertex references,
retained matrices, explicit view/target/selection, conservative numerical and
coverage diagnostics, and no visible-silhouette claim. Unsupported selected
geometry prevents a complete aggregate. Generic tests and a separate review
are required before acceptance. The implementation is now accepted for integration
by the [independent source/CPU review](../../benchmarks/visual-parity-20261018/evidence/round17-projected-bounds-review/REVIEW.md).
Its [focused implementation checks](../../benchmarks/visual-parity-20261018/evidence/round16-offline-projection-control/checks.json)
pass 73 tests, type checks, lint and formatting. Twenty independent generic cases
and 35 existing coplanar regressions also have passing evidence; an incorrect
reviewer assertion and its corrected rerun remain retained. Review caught and
resolved valid signed-ID rejection and maximum-safe triangle-budget accounting.
The command is linked from the existing post-first-image composition guidance.
The integration checks below now include the actual installed CLI smoke.
Supplemental review of that smoke found a tied-extremum witness selection issue
in aggregate bounds. Pixel minima/maxima are correct, but the documented first
source-reference witness can differ. The narrow axis-wise merge correction now
passes a retained regression that failed before the fix, plus **74 focused tests
in four files**, both no-emit type checks, lint, formatting and smoke-script syntax.
The [post-fix receipt](../../benchmarks/visual-parity-20261018/evidence/round16-offline-projection-control/post-tie-validation.json)
retains the original failure and the new fifteen-file source freeze. Independent
re-review accepts the correction after its 21st generic case; the actual installed
smoke also passes. The correction happened
after the isolated R16-runtime experiment ended; that experiment's frozen source
and runtime were unchanged during its execution.

The [capture-cost control proposal](../../benchmarks/visual-parity-20261018/evidence/round16-capture-control-proposal.md)
is accepted for CPU preparation only. It compares duplicated and explicitly
shared immutable assets in copied bundles, preserving per-entity geometry,
transforms, state, features and authored order. Correct canonical resource keys
may change the existing planner's derived opaque draw order; that consequence
must be recorded and checked, not hidden by stale keys. CPU equivalence and
public planner receipts precede any GPU execution. Exact RGBA identity is the
primary output result; a separately declared one-LSB/0.01-mean-RGB bound with
exact alpha is only an observation, not identical output or a noise attribution.
No performance or authoring savings are established yet.

A separate [CPU shadow-request control](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-control/report.md)
reproduces 65 cold pipeline creation requests for two keys across 64 materials
whose specialization matches and whose uniform values differ. It verifies the
distinct parameter bytes, pipeline/layout choice, active ranges and transforms;
negative shader/layout/deformation cases remain separate. This counts requests
to an injected recording device, not native compilations or saved seconds.
The implemented repair is a request-local resource map inside the existing shadow
pipeline resource function. It preserves material metadata, request-array
multiplicity and per-material bindings, with accurate unique-creation and
same-call reuse counts. The [implementation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-implementation.json)
records 48 passing focused tests, including ten new cases. The
[independent source review](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-request-review.md)
accepts the change for integration; full checkpoint validation now passes.
The 64-material control now makes two cold creations and 63 same-call reuses,
retaining 65 request entries and distinct material bindings. These are CPU
device-method counts, not native compilation counts or measured saved seconds.

The asset-sharing native control has now completed all **18 planned renders**,
with zero render failures and normal disposal of all three fixture workers.
Both the exact primary output gate and the separately declared secondary
observation fail. Variation exists within each condition as well as between
conditions. Courtyard also has a two-LSB cross-condition difference; the result
cannot be attributed wholesale to previously observed native variation.
Measured complete-operation timings do not consistently improve across the
three fixtures. Retain this failed experiment without retries or threshold
changes. It does not justify automatic asset deduplication or a performance claim;
the existing explicit shared-asset APIs remain available. Final phase/count
analysis, independent postrun audit and lossless retention are complete in
the [control evidence](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/README.md)
and [review packet](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-review/README.md).

The [round-17 harness](../../benchmarks/visual-parity-round17-20261018/README.md)
released six fresh authors together at 12:49:39.081265 UTC on 19 October,
using committed/pushed checkpoint `6b962dc2cff7c15dba42e3fa5a43739a78c87777`.
References, judging rubrics, the 25-minute/six-call limits, last-success rule,
visual/category requirements, 1.10 timing ceiling and portability scope were unchanged.
The shared native service subsequently became unavailable following an execution
transport disconnection. The coordinator stopped all six lanes and retained the
[interrupted round](../../benchmarks/visual-parity-round17-20261018/REPORT.md).
It is ineligible for qualification; forced finish timestamps cannot establish
author finish cost. No individual attempt waivers or deadline extensions apply.
All 27 attempts remain, including 22 successful images, two authoring errors and
three service-fetch failures. All six final apps match their last successful source
snapshots, and all 219 frozen source files and 1,259 built runtime files matched
before any coordinator documentation updates.
The next step is infrastructure reconciliation and a fresh full comparison with
unchanged gates. The untouched rail-halt transfer remains gated on a complete
qualification pass.

## Round 17 engineering validation

The [checkpoint validation receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-validation.json)
records a successful build, **65 native Dawn tests**, installed-package Dawn
rendering and projection inspection, **1,200 memory-check frames**, and the full
repository check: **5,127 tests in 700 files**, shuffle seed `1792413510153`.
Types, package boundaries/readiness, examples, documentation, all 1,458 diagnostics,
lint and formatting pass. Two pre-existing reference-source lint warnings remain;
there are no lint errors. Source hashes stayed unchanged throughout each run.

The first full-check attempt stopped at TypeScript errors in two new shadow tests.
The [retained correction](../../benchmarks/visual-parity-20261018/evidence/round17-shadow-test-typecheck-correction/receipt.json)
preserves the failed log and exact before/after tests. The assertions retain their
meaning while avoiding unknown-property access and an unsupported array method.
All 48 focused tests and full test type checking then passed, followed by the
complete repository rerun. The runtime files were identical between the native
validation and final full check; no native rerun is claimed for the test-only fix.

The [independent postrun audit](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-review/POSTRUN.md)
reproduces all 45 pixel comparisons and verifies the complete archived experiment
and old runtime. It accepts evidence integrity while preserving both failed output
gates. The [completed-workspace cleanup receipt](../../benchmarks/visual-parity-20261018/evidence/round17-asset-sharing-control/duplicate-cleanup-applied.json)
records verification of every one of the 223 archived files before removing only
their completed external duplicate workspace. Canonical benchmark inputs and
outputs, old archives and dependency targets remain retained.

These results establish the bounded engineering changes. They do not establish
author-time improvement or a passing round-17 qualification. The
[commit/push receipt](../../benchmarks/visual-parity-20261018/evidence/round17-validation/checkpoint-commit.json)
records checkpoint `6b962dc2cff7c15dba42e3fa5a43739a78c87777`. Service preflight and
exact starter browser/native comparison passed before synchronized author release.
The later shared-service outage invalidates this round's qualification rather
than establishing a framework result. Its original evidence and failed calls
remain retained; the goal remains active.

## Round 18 infrastructure repeat — completed, qualification failed

Round 18 repeats checkpoint `6b962dc2cff7c15dba42e3fa5a43739a78c87777` with fresh
authors and the existing acceptance gates. The
[independent interruption review](../../benchmarks/visual-parity-20261018/evidence/round17-infrastructure-review/REVIEW.md)
confirms R17's unequal service availability and preserved source evidence, while
leaving the process-exit cause unresolved. The orphan service is inactive; its
original lifecycle remains protected and active, with residual zombies recorded
separately. No normal completion was manufactured.

The [new harness](../../benchmarks/visual-parity-round18-20261018/README.md)
uses persistent service supervision with exact process identities, retained logs,
memory observations, failure propagation and no automatic restarts. Five synthetic
scenarios pass. Actual [service preflight](../../benchmarks/visual-parity-round18-20261018/evidence/service-preflight.json)
passes, the [starter comparison](../../benchmarks/visual-parity-round18-20261018/evidence/starter-browser-native-control.json)
is exact, and all [36 neutral native requests](../../benchmarks/visual-parity-round18-20261018/evidence/native-service-stability.json)
succeed in the same warm service epoch with separate retained outputs. This is
bounded infrastructure validation, not a performance or quality result. The
[pixel observation](../../benchmarks/visual-parity-round18-20261018/evidence/native-stability-pixel-observation.json)
retains Aperture's two distinct hashes and maximum one-value RGB variation;
no exact-repeatability claim follows.

The [storage transaction](../../benchmarks/visual-parity-20261018/evidence/round18-storage-preflight/TRANSACTION.md)
recovers 678,711,296 overlay bytes from singly linked package-cache files after
exact archive and full restoration verification. Installed dependencies,
canonical source/evidence and all young runtimes are preserved. Separate
[read-only cache advice](../../benchmarks/visual-parity-20261018/evidence/round18-memory-preflight/idle-runtime-cache-advice.json)
releases clean file-cache pages without moving or deleting runtime files. The
fresh round requires explicit memory/disk headroom before release. The untouched
rail-halt transfer still waits for complete qualification.

All six authors finished within the original deadline. All **36 calls** remain:
31 successful images and five author/API failures. The independent
[visual assessment](../../benchmarks/visual-parity-round18-20261018/judging/assessment.json)
fails both subjects. Canal Aperture averages **6.9975**, versus vGPU **7.4700**;
composition, shape and lighting deficits are 0.85, 0.40 and 0.50. Courtyard
Aperture averages **7.1475**, versus Three.js **7.1925**; its lighting deficit
is 0.30. The 0.25 courtyard shape deficit is within the unchanged category limit.
Neither Aperture final has a major artifact. Those artifact passes do not override
the failed mean/category gates.

The independent effort review and
[exact recomputation](../../benchmarks/visual-parity-round18-20261018/recomputed-summary.json)
give Aperture a **73,963.424 ms** first-useful median versus Three.js
**85,655.924 ms**, passing at ratio **0.863494555262751**. Finish medians are
**1,197,580.924 ms** and **1,087,610.924 ms** respectively. Aperture's ratio
**1.1011115257978046** fails the unchanged 1.10 ceiling by **1,208.9076 ms**.
Keep this small miss as a failure; do not round it away, subtract queues or
supervisor checks, exclude failed attempts, or change finish timestamps.

Both required Aperture browser proofs pass. Native/browser maximum channel
difference is one for each scene; means are 0.00017530864197530866 and
0.0014873456790123456, within the original max-12/mean-0.5 limits. Both vGPU
authors used the permitted native-only route and supplied no browser entry.
All 223 frozen source files and 1,259 runtime JavaScript files match before
post-round documentation edits, independently confirmed. The
[service cleanup receipt](../../benchmarks/visual-parity-round18-20261018/evidence/service-cleanup.json)
records normal zero exits, no remaining owned descendants/profiles, closed ports
and an unmodified normal lifecycle completion. Technical review retains source
limitations separately; no complete qualification pass is claimed.

## Next work: make existing measurements practical to use

The [post-clock author retrospectives](../../benchmarks/visual-parity-20261018/evidence/round18-author-retrospectives/README.md)
identify repeated manual camera/layout reasoning as the main unmeasured effort.
Neither Aperture author ran the available camera, landmark, local inspection or
projected-bounds tools. This is evidence of non-adoption in these runs, not proof
of tool speed, correctness or a causal explanation for the final scores.

Before another qualification, review and validate a compact path from actual
source-owned assembly features to a fresh CPU measurement report. Prefer existing
inspection/math and headless lifecycle APIs; compare a one-shot CLI wrapper with
a generated starter measurement script. Avoid requiring agents to assemble and
parse an NDJSON protocol manually for this common task. Keep coordinates shared
with construction, explicitly select the camera and viewport, refresh transforms
after source edits, and expose target residuals and incomplete/unsupported
coverage. Never silently fit/apply a camera, choose geometry from an image,
advance simulation or substitute stale init-time reports for current ECS state.

Acceptance must include a small prospective generic control, independent of
canal/courtyard/held-out scene dimensions: named grouped features; a deliberate
layout mismatch; an edited parent transform; a missing selector; incomplete
asset coverage; handled operation failure; and normal cleanup. Record commands,
errors, expected coordinates and source provenance. Fewer operational steps
alone establish usability simplification, not saved author seconds or visual
parity. Meaningful implementation tests, independent review, installed-package
proof and required repository/native checks precede a new frozen qualification.

Separately diagnose the retained lighting, foliage, shape and contact findings
against actual authored settings and existing controls. Change renderer behavior
only for a demonstrated defect; do not introduce benchmark-specific finished
props or presets. Keep successful historical samples and failed R18 outputs.
The next comparison keeps the same quality, timing, capture and portability
gates, with new independent authors and judges. Release untouched rail-halt
only after a complete qualification pass. Final handoff, working image gallery
and lossless portable evidence publication remain required after validation.

## Round 19 implementation and engineering validation

The [accepted workflow design](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-workflow-review/PLAN_REVIEW.md)
now has an [implemented CLI adapter](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command/IMPLEMENTATION.md)
and [accepted independent review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-command-review/REVIEW.md).
`aperture camera inspect-local <headless-config>` accepts exactly one JSON request
file or source-owned resource whose `values.request` contains the existing
camera/viewport/subject arguments. It boots the existing CPU runner, reads the
request after initialization and performs fresh local-camera inspection without
stepping, extraction, camera mutation or GPU work. Strict assets and seed 0 are
defaults; background/manual readiness and null/partial bounds stay explicit.

The adapter centralizes full-envelope handling, semantic exit 2 versus execution
exit 1, awaited cleanup and atomic publication with input-alias guards. It never
returns cached init-time inspection. Independent review passes 28 command tests
and nine external CPU probes, retaining the corrected diagnostic catalog finding.
The [installed-package smoke](../../scripts/check-pack-cli.mjs) checks both request
routes against a transformed source-owned landmark, explicit analytic pixels and
a semantic-failure envelope. Both actual packed execution routes pass.

The [independent visual diagnosis](../../benchmarks/visual-parity-20261018/evidence/round18-visual-gap-diagnosis/REVIEW.md)
supports no speculative renderer change. The reviewed bevel diagnostic now
reports supplied value, validated size and the exclusive maximum, preserving
accepted range/geometry and avoiding arbitrary-object coercion. Eight accepted
case descriptors match, twelve invalid cases stay rejected, five focused tests
pass, and the original R18 failed capture remains counted. Scoped contact
inspection found no coplanar overlap among 188 selected draws; no general
contact/renderer guarantee follows.

The [build attempt](../../benchmarks/visual-parity-20261018/evidence/round19-validation/attempt-2026-10-19T14-18-21.309Z/result.json)
and [remaining validation attempt](../../benchmarks/visual-parity-20261018/evidence/round19-validation/attempt-2026-10-19T14-20-34.111Z/result.json)
both pass with **203 source files unchanged**. The latter includes **65 Dawn
tests**, packed CLI Dawn rendering/inspection, **1,200 memory-check frames**, and
full `pnpm run check`: **5,158 tests in 701 files**, seed **1792419896379**.
Package boundaries, release/publish readiness, build/types, examples, docs,
diagnostics, lint and formatting pass. These plan/handoff status edits occur
after validation and do not claim inclusion in its frozen source.

The [prospective CPU pilot](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/PROTOCOL.md)
was [prepared before release](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/PREPARED.json)
and is now complete. The [collection](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/COLLECTION.json)
and [independent review](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/independent-review/REVIEW.md)
with [exact audit data](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/independent-review/review.json)
retain all three authors' evidence. All **17 frozen inputs, 115 collected files
and 1,260 built package JavaScript files** match their hashes. Mechanical checks
pass for [existing docs](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-a-assessment.stdout.json),
[the supplied script](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-b-assessment.stdout.json)
and [the CLI](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/route-c-assessment.stdout.json):
each initial, revised, deliberately invalid and recovered measurement is correct.

Full operational acceptance is **not established for any route**. Every author
omits the frozen requirement to explain that partial per-mesh data cannot become
a complete aggregate when aggregate bounds are null. No null aggregate occurred;
this is an explanation gap, not observed misuse. Retain the original reports and
failures rather than replacing them with post-task corrections.

The supplied script and CLI tie: four launches, zero authored route helpers or
edits, zero manual envelope extractions, three summary selections and one
prescribed selector restoration each. Existing-docs author A wrote one helper,
then also used one launch per stage. Raw action totals **17/18/15** use
inconsistent categories and cannot rank total effort. No accidental measurement
error is observed/reported in retained attempts; unlogged errors remain unknown.
The [prospective evidence limit](../../benchmarks/visual-parity-20261018/evidence/round19-measurement-pilot/results/PROSPECTIVE_EVIDENCE_LIMIT_ADDENDUM.md)
applies: **n=1 per route**, self-reported counts with log corroboration, editable
artifacts and no authenticated complete transcript. Log completeness,
intermediate states and author isolation are not certified. No general time
saving, statistical or causal result, visual improvement or R18 remediation is
established.

R19 visual work and H2 remain unstarted. This product checkpoint is uncommitted
at the documentation update. Commit/push, a complete fresh qualification,
held-out validation, current gallery and complete owner-private evidence
publication are still required. Preserve both concept batches, every pilot arm
and all failures in the [full handoff](agent-visual-parity-handoff-20261018.md).
