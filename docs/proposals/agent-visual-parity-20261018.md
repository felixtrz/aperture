# Agent visual authoring parity: implementation and qualification

Status: active. Owner: Codex. Started 18 October 2026.

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
- [x] E: full repository checks, native rendering and package verification pass
      for the pre-round-11 checkpoint; later implementation changes require revalidation.
- [x] F1 (amended): four contemporary independent paired judges each prefer the
      repaired harbor, with category/contact gates passed. The original raw-score
      target of 8.2125 remains failed; the prospective methodology amendment and
      every raw result are retained below. This check records the amended gate only.
- [ ] F2 (current checkpoint): on each fresh brief, Aperture mean visual score is at least the strongest
      contemporary peer; no scored category is more than 0.25 below that peer and no
      major geometry/reflection/contact artifact is identified by either judge. Round 9 passed;
      Round 10 canal failed. Require a combined visual/cost pass in the same fresh round.
- [ ] F3: median first-useful-image and completion time across fresh briefs is no
      slower than the fastest peer beyond a declared 10% elapsed-time noise allowance;
      compare queue-inclusive and queue-reported results, without calling subtraction
      measured active labor. No capture stalls or hidden failures.
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
