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
- [x] B: genuine planar reflections pass native GPU, camera, mask and lifecycle checks.
- [x] C: fitted-shape recipe works for multiple props and alternate views.
- [ ] D: controlled lighting evidence explains/removes the observed visual deficit.
- [ ] E: full repository checks, native rendering and package verification pass.
- [ ] F1: repaired harbor mean visual score is at least the strongest frozen peer
      (8.2125); no scored category is more than 0.25 below that peer.
- [ ] F2: on each fresh brief, Aperture mean visual score is at least the strongest
      contemporary peer; no scored category is more than 0.25 below that peer and no
      major geometry/reflection/contact artifact is identified by either judge.
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
