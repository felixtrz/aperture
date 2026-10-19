# Agent visual parity handoff — DRAFT / active

Prepared 19 October 2026 for the work begun 18 October. This is a navigation and
reproduction handoff, not a completion declaration. The authoritative development
history and acceptance rules remain in the [active plan](agent-visual-parity-20261018.md).

**The latest completed authoring benchmark used checkpoint
`2c500eb249c2a94d195b3937a71c888984ecc278`. Round 13 completed but failed combined
qualification.** Canal visual quality and first-useful time pass; courtyard's
lighting deficit of **0.35** and the finish-time ratio of **1.172877** fail.
Checkpoint `0239f77` retains round 12's complete qualification and the subsequent
failed fuel-stop transfer. Neither historical outcome is replaced by round 13.
Rail-halt remains prepared and undispatched, unused by authors/judges.

The generic ECS assembly starter and informational resolved light direction
diagnostics are implemented, with focused checks and independent reviews passed.
Full repository validation now passes **4,968 tests in 692 files**, all **65 native
Dawn tests**, packed-package Dawn rendering and memory checks. Native/browser
controls and service preflight pass; the new starter is pixel-identical between
Dawn and browser. Round 14 inputs and services are ready, but no authors or clocks
have started. The reviewed candidate is included in this follow-up revision; its
exact committed identity will be recorded in the round freeze. The live
gallery now covers round 13 and the failed fuel-stop transfer; downloadable
source/evidence archives still cover only through round 3. This handoff indexes
both concept batches while keeping those coverage and completion gaps explicit.

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
hashes. Only plan/handoff status and links were updated after that check; product,
tests and authoring guides remain the tested bytes.

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
is pixel-identical. Fresh qualification and the untouched transfer remain open.

## Workspace and implementation status

The working branch is `codex/dawn-shader-polygon-authoring`. The reviewed R14
follow-up in this revision builds on `2c500eb`. Inspect `git status --short` before
continuing: benchmark evidence is largely untracked. Its presence on disk does
not mean it is in Git or in a published archive. Preserve that work; use a separate checkout for a
historical replay rather than resetting this branch.

| Checkpoint             | What it contains                                                                                                       | Status at draft                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a4cef30`              | Direct Dawn rendering, shader workflows, portable capture work, AO repair and polygon authoring from the earlier batch | Committed; see [earlier implementation record](shader-gpu-and-dawn-node-rendering.md#implementation-checklist-and-evidence) and garden/car follow-ups below.                                                                                                                                                                               |
| `cbcb6e7`              | Retained garden, street and car comparisons; original harbor baseline                                                  | Committed baseline; harbor evidence has its own separate publication/source status.                                                                                                                                                                                                                                                        |
| `0e1f31f`              | Scene reflections, fatal-capture feedback, environment controls, diorama starter, loft/bevel/path/icosphere workflows  | Committed; accumulated changes qualified by the round-6 checkpoint.                                                                                                                                                                                                                                                                        |
| `6c26db7`              | Fitted roof and branch-foliage recipes                                                                                 | Committed.                                                                                                                                                                                                                                                                                                                                 |
| `4c3b280`              | Oval foliage and portable surface variation                                                                            | Committed; round-8 checkpoint.                                                                                                                                                                                                                                                                                                             |
| `5cda7bd`              | Tight MSAA reflection masks, single-sample SSAO compatibility and cheaper surface recipe                               | Committed; round-9 checkpoint.                                                                                                                                                                                                                                                                                                             |
| `d1622f2`              | Unsupported torus option diagnostics                                                                                   | Committed; round-10 checkpoint.                                                                                                                                                                                                                                                                                                            |
| `588296b`              | Fitted profile example and roof-verge grid control                                                                     | Committed; round-11 checkpoint.                                                                                                                                                                                                                                                                                                            |
| `0239f77`              | CPU camera projection and bounded fitting                                                                              | Committed/pushed checkpoint recorded by round 12 and first held-out freeze receipts.                                                                                                                                                                                                                                                       |
| `2c500eb`              | Staged workflow/DIORAMA prose; `camera unproject`; profile shape-sheet helper/docs/tests                               | Reviewed, validated, committed and pushed. [CLI guide changeset](../../.changeset/staged-diorama-guidance.md), [camera changeset](../../.changeset/camera-pixel-plane-placement.md), [round-13 freeze](../../benchmarks/visual-parity-round13-20261018/evidence/round13-freeze.json). Round 13 failed the combined courtyard/finish gates. |
| R14 follow-up revision | Generic ECS assembly starter and informational resolved light direction diagnostics                                    | Implemented and independently reviewed; full/native/package/memory validation and browser controls passed. Fresh qualification remains pending.                                                                                                                                                                                            |

The [earlier shader/Dawn proposal](shader-gpu-and-dawn-node-rendering.md) is a
completed engineering workstream with explicit supported/unsupported boundaries.
The [current parity plan](agent-visual-parity-20261018.md) is still active. Passing
engineering checks does not substitute for its independent authoring gates.

## Scene and reference index

These are distinct concepts and evidence types. Coordinator repairs and controlled
replays do not replace the original author result or provide new authoring times.

| Concept                                                                     | Reference, authored source and report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Follow-up / reusable result                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chinese garden: pavilion, jade pond, curved bridge, moon gate and planting  | [Reference](../../benchmarks/chinese-garden-20261017/reference/garden.png), [all author sources](../../benchmarks/chinese-garden-20261017/authors), [report](../../benchmarks/chinese-garden-20261017/REPORT.md), [protocol](../../benchmarks/chinese-garden-20261017/PROTOCOL.md)                                                                                                                                                                                                                                           | [AO/cadence diagnosis](../../benchmarks/chinese-garden-20261017/diagnostics/REPORT.md), [exact-frame capture and Dawn measurements](../../benchmarks/chinese-garden-20261017/followup/REPORT.md), [retained replay scene](../../benchmarks/chinese-garden-20261017/followup/garden).                                                                                                           |
| Street corner: cafe/bookshop, awnings, two cars, furnishings and trees      | [Reference](../../benchmarks/street-corner-20261017/reference/street.png), [all author sources](../../benchmarks/street-corner-20261017/authors), [report](../../benchmarks/street-corner-20261017/REPORT.md), [follow-up plan](../../benchmarks/street-corner-20261017/FOLLOW_UP_PLAN.md)                                                                                                                                                                                                                                   | [Strict Dawn parity](../../benchmarks/street-corner-20261017/evidence/dawn-verification/summary.json); exposed delayed fatal feedback, color/transform friction and fitted-car construction.                                                                                                                                                                                                   |
| Fitted procedural car and revised street                                    | [Controlled comparison report](../../benchmarks/car-construction-20261017/REPORT.md), [before/after/side/rear apps](../../benchmarks/car-construction-20261017/apps), [validation](../../benchmarks/car-construction-20261017/evidence/validation.json)                                                                                                                                                                                                                                                                      | [Reusable car source](../../examples/procedural-car/src/car.ts), [polygon authoring](../POLYGON_SURFACE_AUTHORING.md). Shared glass/body boundaries; separate wheel/mirror/lamp parts. Construction follow-up, not a new scored trial.                                                                                                                                                         |
| Harbor: shaped boat, waterfront architecture, water and planting            | [Original reference](../../benchmarks/harbor-20261017/reference/harbor.png), [frozen authors](../../benchmarks/harbor-20261017/authors), [original report](../../benchmarks/harbor-20261017/REPORT.md), [reproduction README](../../benchmarks/harbor-20261017/README.md)                                                                                                                                                                                                                                                    | [All coordinator repairs/controls](../../benchmarks/visual-parity-20261018/harbor), [repair 11](../../benchmarks/visual-parity-20261018/harbor/repair-round11), [four-judge paired confirmation](../../benchmarks/visual-parity-20261018/judging/harbor-round11/assessment.json). Original absolute-score failure remains.                                                                     |
| Canal-side workshop, fitted vehicle/boat and reflective water               | [Reference](../../benchmarks/visual-parity-20261018/reference/canal.png), [round-12 Aperture app](../../benchmarks/visual-parity-round12-20261018/trials/canal-aperture/app), [all round-12 trials](../../benchmarks/visual-parity-round12-20261018/trials), [round-12 report](../../benchmarks/visual-parity-round12-20261018/REPORT.md), [round-13 Aperture app](../../benchmarks/visual-parity-round13-20261018/trials/canal-aperture/app), [all round-13 trials](../../benchmarks/visual-parity-round13-20261018/trials) | Repeated qualification subject across rounds 1–13; section geometry, roof courses, vehicle profiles and camera checks. Round 13's canal visual gate passes. Every prior outcome remains indexed below.                                                                                                                                                                                         |
| Courtyard/fountain: curved architecture, roof, foliage and reflective basin | [Reference](../../benchmarks/visual-parity-20261018/reference/courtyard.png), [round-12 Aperture app](../../benchmarks/visual-parity-round12-20261018/trials/courtyard-aperture/app), [round-12 judgments](../../benchmarks/visual-parity-round12-20261018/judging), [round-13 Aperture app](../../benchmarks/visual-parity-round13-20261018/trials/courtyard-aperture/app), [round-13 judgments](../../benchmarks/visual-parity-round13-20261018/judging)                                                                   | Repeated qualification subject; branch/oval foliage, controlled lighting, MSAA reflection mask and single-sample SSAO controls. Round 13 fails the lighting category despite a higher overall mean.                                                                                                                                                                                            |
| Rural fuel stop: shop, pump canopy, pickup and puddle                       | [Reference](../../benchmarks/visual-parity-heldout-20261018/reference/fuel-stop.png), [all trials](../../benchmarks/visual-parity-heldout-20261018/trials), [report](../../benchmarks/visual-parity-heldout-20261018/REPORT.md), [protocol](../../benchmarks/visual-parity-heldout-20261018/shared/PROTOCOL.md)                                                                                                                                                                                                              | First transfer **failed**; [startup diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-startup-diagnosis.md), [shape diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-shape-diagnosis.md), [retrospective author accounts](../../benchmarks/visual-parity-heldout-20261018/evidence/startup-author-testimony.md). Now exposed, never call it unused again. |
| New rail-halt transfer, both reference generations                          | [Selected simplified reference](../../benchmarks/visual-parity-heldout2-20261018/reference/rail-halt.png), [rejected over-detailed generation](../../benchmarks/visual-parity-heldout2-20261018/evidence/reference-generation-overdetailed.png), [preparation/selection receipt](../../benchmarks/visual-parity-heldout2-20261018/evidence/preparation.json)                                                                                                                                                                 | **Unused by authors/judges; undispatched.** The coordinator saw both for setup. One simplification edit was selected before qualification/authoring/judging because the original was too detailed/photoreal. Both generations are retained; the receipt records the selected hash and confirms that no benchmark outcome informed selection. No trial result exists.                           |
| Generic profile shape sheet: delivery vehicle and instrument housing        | [Study guide](../../examples/fitted-props/SHAPES.md), [caller-owned study data/system](../../examples/fitted-props/src/shape-sheet.ts), [shared profile helper](../../examples/fitted-props/src/profile-shell.ts)                                                                                                                                                                                                                                                                                                            | Committed and validated in `2c500eb`. Boxy/shaped forms share outer envelopes, panes, wheels and materials; evaluates sections and silhouette, not a fuel-stop finished asset.                                                                                                                                                                                                                 |

## Reusable engineering concept index

Public application state remains ECS-owned; rendering consumes extracted snapshots.
The shader-first API is a separate explicit GPU-program entry point. Neither path
introduces a second mutable scene graph into an ECS app.

| Concept and boundary                                                                                                                                 | Source / documentation / example                                                                                                                                                                                                                                                                                                                            | Tests and retained evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Direct Dawn Node route**, independent of vGPU                                                                                                      | [Device adapter](../../packages/adapter-node/src/device.ts), [offscreen output](../../packages/adapter-node/src/offscreen.ts), [CLI driver](../../packages/cli/src/render/dawn-driver.ts), [worker](../../packages/cli/src/render/dawn-worker.ts), [runbook](../DAWN_NODE_RENDERING.md)                                                                     | [Native tests](../../scripts/native-webgpu.node-test.mjs), [memory check](../../scripts/check-dawn-memory.mjs), [earlier validation record](shader-gpu-and-dawn-node-rendering.md#final-verification-record), [local raw logs](../../.aperture-env/dawn-evidence). vGPU is a benchmark peer, not an Aperture engine dependency.                                                                                                                                                                                                                                                                                                                                                                         |
| **WGSL authoring and shader-first GPU programs**: artifacts, imports, source maps, layouts, compute/draw/history/MRT, replacement and data-only jobs | [Compiler](../../packages/shader/src/compiler.ts), [GPU context](../../packages/gpu/src/context.ts), [shader jobs](../../packages/shader/src/shader-job.ts), [tutorial](../SHADER_FIRST.md), [workbench](../../examples/shader-workbench/programs.mjs)                                                                                                      | [Compiler tests](../../test/shader/compiler.test.ts), [job tests](../../test/shader/shader-job.test.ts), [native standalone tests](../../scripts/standalone-gpu.node-test.mjs), [shader parity runner](../../scripts/shader-browser-parity.mjs).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **WGSL standard-material extensions** preserve lighting/shadows; custom material boundaries remain explicit                                          | [Material tutorial](../SHADER_MATERIALS.md), [extension shader integration](../../packages/webgpu/src/materials/standard/standard-shader-extension-sampling.ts), [worker-authored example](../../examples/material-shaders)                                                                                                                                 | [Native material tests](../../scripts/material-extension.node-test.mjs), [earlier supported-material limits](shader-gpu-and-dawn-node-rendering.md#supported-material-boundary), [material parity evidence](../../.aperture-env/dawn-evidence/material-parity-final).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Portable bundles, strict preflight and exact-frame capture**: one scene for browser/Node, hold through readback, restored cadence                  | [Bundle facade](../../packages/app/src/render-bundle.ts), [strict extraction](../../packages/cli/src/headless/bundle.ts), [capture controller](../../packages/app/src/browser/capture.ts), [still-image guide](../PROCEDURAL_STILL_IMAGES.md)                                                                                                               | [Bundle tests](../../test/cli/headless-bundle.test.ts), [capture tests](../../test/app/browser-capture.test.ts), [garden follow-up](../../benchmarks/chinese-garden-20261017/followup/REPORT.md). Includes SSAO serialization and platform base64 decoding with fallback; retained stage timing does not imply total author speedup.                                                                                                                                                                                                                                                                                                                                                                    |
| **Fatal worker/capture feedback** and authored geometry call sites                                                                                   | [Simulation worker](../../packages/runtime/src/simulation-worker.ts), [browser capture](../../packages/app/src/browser/capture.ts), [workflow](../AGENT_VISUAL_WORKFLOW.md)                                                                                                                                                                                 | [Capture regression tests](../../test/app/browser-capture.test.ts), [live acceptance](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/live/acceptance.json), [preflight times](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/portable-preflight-timings.json), [authored callsite](../../benchmarks/visual-parity-20261018/evidence/failure-feedback/authored-callsite.txt). Original malformed capture remains recorded.                                                                                                                                                                                                                                         |
| **AO silhouette repair and static capture cadence**                                                                                                  | [SSAO implementation](../../packages/webgpu/src/post/post-ssao.ts), [still-image guidance](../PROCEDURAL_STILL_IMAGES.md), [garden diagnosis](../../benchmarks/chinese-garden-20261017/diagnostics/REPORT.md)                                                                                                                                               | [Native depth tests](../../scripts/ssao-depth.node-test.mjs), [garden timing control](../../benchmarks/chinese-garden-20261017/diagnostics/timing/summary.json). Nearest real depth, camera projection and discontinuity-aware sampling; AO stays enabled. Demand-cadence result is screenshot workflow wall time on this software GPU.                                                                                                                                                                                                                                                                                                                                                                 |
| **Environment intensity/color and controlled key/fill lighting**                                                                                     | [IBL sampling](../../packages/webgpu/src/materials/standard/standard-shader-ibl-sampling.ts), [visual defaults](../VISUAL_QUALITY.md), [lighting reference](../AGENT_VISUAL_REFINEMENT.md#3-get-depth-from-lighting-then-add-surface-effects), [PCSS](../SINGLE_MAP_PCSS.md)                                                                                | [Harbor ablations](../../benchmarks/visual-parity-20261018/harbor/controls), [lighting GPU evidence](../../benchmarks/visual-parity-20261018/evidence/lighting-gpu), [round-10 key/fill control](../../benchmarks/visual-parity-20261018/evidence/round10-lighting-control). Wrong key direction is not fixed by brighter fill; fixed-scene controls are separate from scored images.                                                                                                                                                                                                                                                                                                                   |
| **Planar scene reflections**, tint and ripple frequency                                                                                              | [Options](../../packages/render/src/rendering/planar-reflection-options.ts), [mirrored view](../../packages/webgpu/src/app/planar-reflection-view.ts), [pass/lifetime](../../packages/webgpu/src/app/planar-reflection.ts), [example](../../examples/planar-reflections/README.md)                                                                          | [Facade tests](../../test/app/planar-reflection.test.ts), [native reflections](../../scripts/planar-reflection.node-test.mjs), [tint control](../../benchmarks/visual-parity-20261018/evidence/reflection-tint-canal), [ripple control](../../benchmarks/visual-parity-20261018/evidence/reflection-ripple-control). One horizontal plane/full-output camera; receiver matching and offscreen-object retention matter.                                                                                                                                                                                                                                                                                  |
| **Tight MSAA reflection masks and single-sample SSAO compatibility**                                                                                 | [Reflection composite](../../packages/webgpu/src/app/planar-reflection-shader.ts), [SSAO](../../packages/webgpu/src/post/post-ssao.ts), [sky pipelines](../../packages/webgpu/src/render/skybox), [documented memory/edge limits](../../examples/planar-reflections/README.md)                                                                              | [Mask control](../../benchmarks/visual-parity-20261018/evidence/round8-reflection-mask-control), [single-sample fix evidence](../../benchmarks/visual-parity-20261018/evidence/ssao-single-sample-fix), [native reflection tests](../../scripts/planar-reflection.node-test.mjs), [native SSAO tests](../../scripts/ssao-depth.node-test.mjs). 4x reflection composite adds about 33 MiB at 1200×900; mixed edges are coverage-weighted, not exact per-sample color preservation.                                                                                                                                                                                                                       |
| **Polygons, fitted openings and corresponding section lofts**                                                                                        | [Polygon factory](../../packages/render/src/mesh/primitives-polygons.ts), [loft](../../packages/render/src/mesh/loft.ts), [polygon guide](../POLYGON_SURFACE_AUTHORING.md), [profile guide](../FITTED_PROP_PROFILES.md), [panel helpers](../../examples/fitted-props/src/panels.ts), [two-prop example](../../examples/fitted-props/README.md)              | [Polygons](../../test/mesh/polygons.test.ts), [lofts](../../test/mesh/loft.test.ts), [fitted car](../../test/mesh/fitted-car.test.ts), [fitted props](../../test/mesh/fitted-props.test.ts), [round-11 multi-view proof](../../benchmarks/visual-parity-20261018/evidence/round11-fitted-proof). Shared pane boundaries, outward normals and intended closedness do not establish arbitrary reference fidelity.                                                                                                                                                                                                                                                                                         |
| **Connected tubes, endpoint extrusions, bevels and icospheres**                                                                                      | [Tube](../../packages/render/src/mesh/tube.ts), [extrude-between](../../packages/render/src/mesh/extrude-between.ts), [beveled box](../../packages/render/src/mesh/beveled-box.ts), [icosphere](../../packages/render/src/mesh/icosphere.ts), [connected-parts recipes](../CONNECTED_PARTS.md)                                                              | [Path solids](../../test/mesh/path-solids.test.ts), [bevel tests](../../test/mesh/beveled-box.test.ts), [icosphere tests](../../test/mesh/icosphere.test.ts), [path controls](../../benchmarks/visual-parity-20261018/evidence/path-controls), [icosphere receipt](../../benchmarks/visual-parity-20261018/evidence/icosphere-tests.txt). General primitives; dimensions and assembly remain caller-owned.                                                                                                                                                                                                                                                                                              |
| **Roof courses/caps and exposed-verge grid fitting**                                                                                                 | [Recipe](../../examples/planar-reflections/src/roof.ts), [guide](../../examples/planar-reflections/ROOF.md)                                                                                                                                                                                                                                                 | [Geometry tests](../../test/mesh/roof-recipe.test.ts), [roof control](../../benchmarks/visual-parity-20261018/evidence/roof-authoring-control), [grid-only control](../../benchmarks/visual-parity-20261018/evidence/round10-roof-control), [review](../../benchmarks/visual-parity-20261018/evidence/round11-roof-review.md). Clipping alone does not guarantee a visually low verge; preserve roof planes and fit pitch/offset.                                                                                                                                                                                                                                                                       |
| **Seeded foliage, branch pairs and oval profiles**                                                                                                   | [Recipe](../../examples/planar-reflections/src/foliage.ts), [guide](../../examples/planar-reflections/FOLIAGE.md)                                                                                                                                                                                                                                           | [Branch tests](../../test/mesh/branch-foliage-recipe.test.ts), [oval tests](../../test/mesh/foliage-oval-recipe.test.ts), [winding control](../../benchmarks/visual-parity-20261018/evidence/round4-leaf-winding-control), [branch control](../../benchmarks/visual-parity-20261018/evidence/branch-foliage-control), [oval control](../../benchmarks/visual-parity-20261018/evidence/oval-foliage-control). Choose crown/leaf granularity from the subject; more leaves cannot fix the wrong profile or branching silhouette.                                                                                                                                                                          |
| **Selective portable surface variation**                                                                                                             | [WGSL](../../examples/planar-reflections/surface-variation.wgsl), [guide](../../examples/planar-reflections/SURFACES.md)                                                                                                                                                                                                                                    | [Visual control](../../benchmarks/visual-parity-20261018/evidence/surface-variation-control), [all cost-control attempts](../../benchmarks/visual-parity-20261018/evidence/round8-surface-cost-control). Tetrahedral hash replaces the costlier 27-neighbor pattern; preserve PBR and use on broad selected surfaces. Reported fixed-scene saving is not author-time causality.                                                                                                                                                                                                                                                                                                                         |
| **Torus option feedback**                                                                                                                            | [Primitive contracts](../AGENT_VISUAL_REFINEMENT.md#2-use-fitted-surfaces-and-corresponding-sections), [independent feedback review](../../benchmarks/visual-parity-20261018/evidence/round9-torus-feedback-review.md)                                                                                                                                      | [Frozen round-9 report](../../benchmarks/visual-parity-round9-20261018/REPORT.md), [round-10 validation](../../benchmarks/visual-parity-20261018/evidence/round10-validation). Unsupported own option names now fail instead of silently selecting defaults; accepted geometry bytes remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Diorama starter and staged reading**                                                                                                               | [Template](../../packages/cli/src/create/templates/diorama.ts), [short first-image guide](../AGENT_VISUAL_WORKFLOW.md), [full refinement reference](../AGENT_VISUAL_REFINEMENT.md)                                                                                                                                                                          | [Template/create tests](../../test/cli/create.test.ts), [strict native extraction test](../../test/cli/diorama-authoring-native.test.ts), [starter parity](../../benchmarks/visual-parity-20261018/evidence/starter-parity), [startup diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-startup-diagnosis.md). At `2c500eb`, the front door is 76 lines/4,852 bytes; advanced sections are retained. That staged-guidance change altered DIORAMA prose only, preserving generated geometry/config/shader. This is structural reduction, not measured time saved.                                                                                                                      |
| **CPU camera project/fit**                                                                                                                           | [Solver/projection](../../packages/cli/src/camera/landmarks.ts), [engine cross-check](../../packages/cli/src/camera/engine-projection.ts), [guide](../CAMERA_LANDMARKS.md)                                                                                                                                                                                  | [Tests](../../test/cli/camera-landmarks.test.ts), [independent review](../../benchmarks/visual-parity-20261018/evidence/round12-camera-review.md), [fixed-geometry controls](../../benchmarks/visual-parity-20261018/evidence/round12-camera-control/RESULT.md), [installed-package check](../../benchmarks/visual-parity-20261018/evidence/round12-packed-camera). Convergence, conditioning and pixel tolerance are separate; a camera fit does not repair geometry.                                                                                                                                                                                                                                  |
| **CPU pixel-to-plane unproject** — committed in `2c500eb`                                                                                            | [Implementation](../../packages/cli/src/camera/unproject.ts), [CLI integration](../../packages/cli/src/commands/camera.ts), [contract](../CAMERA_LANDMARKS.md#pixel-to-plane-placement)                                                                                                                                                                     | [Tests](../../test/cli/camera-unproject.test.ts), [changeset](../../.changeset/camera-pixel-plane-placement.md). Explicit plane and camera, rays/intersections/reprojection, diagnostic invalid points; no image reading, depth inference or scene mutation. Independent review, fixed-camera controls and 36 installed CLI cases passed; see the validated checkpoint index above.                                                                                                                                                                                                                                                                                                                     |
| **Profile shape sheet** — committed in `2c500eb`                                                                                                     | [Shape guide](../../examples/fitted-props/SHAPES.md), [pure profile helper](../../examples/fitted-props/src/profile-shell.ts), [study system](../../examples/fitted-props/src/shape-sheet.ts)                                                                                                                                                               | [Shape-sheet tests](../../test/mesh/profile-shape-sheet.test.ts), [shape diagnosis](../../benchmarks/visual-parity-20261018/evidence/heldout-shape-diagnosis.md). Fitted surface roles and same-envelope silhouette variants; ten native controls, two browser controls and full validation passed; see the validated checkpoint index above.                                                                                                                                                                                                                                                                                                                                                           |
| **Named local assemblies in the diorama starter** — R14 follow-up                                                                                    | [Template](../../packages/cli/src/create/templates/diorama.ts), [native authoring tests](../../test/cli/diorama-authoring-native.test.ts), [changeset](../../.changeset/diorama-local-assemblies.md)                                                                                                                                                        | [Independent review](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-review.md), [exact preservation evidence](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-review.json), [contact control](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-contact-control.mjs), [results](../../benchmarks/visual-parity-20261018/evidence/round14-assembly-contact-control.json). Existing ECS groups and parent/local transforms; all six original Float32 mesh world matrices, assets, camera and lights match. Five contact poses pass with maximum separation 1.1921e-7 units. Focused and full/native validation passed; starter pixels are unchanged. |
| **Resolved directional-light geometry and split health cache** — R14 follow-up                                                                       | [Geometry helper](../../packages/render/src/rendering/lighting-direction-evidence.ts), [health analyzer](../../packages/render/src/rendering/lighting-health.ts), [renderer integration](../../packages/webgpu/src/app/create-webgpu-app.ts), [guide](../LIGHTING_DIRECTION_EVIDENCE.md), [tests](../../test/rendering/lighting-direction-evidence.test.ts) | [Independent review](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.md), [review results](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.json), [retained controls](../../benchmarks/visual-parity-20261018/evidence/round14-lighting-review.control.mjs). Informational resolved direction/elevation/camera-plane shadow evidence; ordinary warnings and rendering settings remain unchanged. Moving-camera material rescans and a paired-sign hash collision were reproduced and fixed before release. Full/native validation passed; isolated old/current pixels match.                                                                          |

The generic ECS assembly starter and resolved-light diagnostics above are
implemented follow-up work with focused validation. They are not yet a fully
validated or committed checkpoint. The
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
pass/fail threshold or automatic lighting changes. Native fixed-scene controls are
in progress; no completed result is claimed here. They cannot replace the failed
scored final.

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
[round-13 protocol](../../benchmarks/visual-parity-round13-20261018/shared/PROTOCOL.md)
and [first-transfer protocol](../../benchmarks/visual-parity-heldout-20261018/shared/PROTOCOL.md)
retain the full requirements: actual 3D geometry, fitted/shared surfaces, a custom
procedural shader and actual scene reflections. Technical compliance and judged
visual quality are separate. The held-out Three.js glazing violates the shared
opening clause, but its stronger image/timing remains in the original comparison;
removing it would manufacture a pass.

| Retained round                                                                              | Canal visual    | Courtyard visual | First useful | Finish     | Outcome / material disclosure                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | --------------- | ---------------- | ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1](../../benchmarks/visual-parity-20261018/REPORT.md)                                      | Fail            | Fail             | Fail         | Fail       | Failed; repository checks overlapped early author/capture work.                                                                                                        |
| [2](../../benchmarks/visual-parity-round2-20261018/README.md)                               | Incomplete      | Incomplete       | Excluded     | Excluded   | Infrastructure-interrupted by unchanged 2 GiB browser disk guard; partial trials retained, not qualified.                                                              |
| [3](../../benchmarks/visual-parity-round3-20261018/REPORT.md)                               | Fail            | Fail             | Pass         | Pass       | Failed finish/detail categories; a peer's 122-second failure held the serial queue.                                                                                    |
| [4](../../benchmarks/visual-parity-round4-20261018/REPORT.md)                               | Fail            | Pass             | Pass         | Fail       | Failed canal and completion.                                                                                                                                           |
| [5](../../benchmarks/visual-parity-round5-20261018/REPORT.md)                               | Fail            | Fail             | Pass         | Fail       | Failed; missing assumed icosphere API exposed.                                                                                                                         |
| [6](../../benchmarks/visual-parity-round6-20261018/REPORT.md)                               | Pass            | Fail             | Pass         | Pass       | Failed courtyard construction/style categories.                                                                                                                        |
| [7](../../benchmarks/visual-parity-round7-20261018/REPORT.md)                               | Fail            | Fail             | Pass         | Pass       | Failed visual gates; reusable pinned browser executable service introduced, fresh profile/context each call.                                                           |
| [8](../../benchmarks/visual-parity-round8-20261018/REPORT.md)                               | Pass            | Fail             | Fail         | Fail       | Failed; tight MSAA mask defect and costly widespread surface hook investigated afterward.                                                                              |
| [9](../../benchmarks/visual-parity-round9-20261018/REPORT.md)                               | Pass            | Pass             | Pass         | Fail       | Completion misses by 7.2506302 s; sequential author spawning took 49.392971 s, individual activation unmeasured. No retrospective correction.                          |
| [10](../../benchmarks/visual-parity-round10-20261018/REPORT.md)                             | Fail            | Pass             | Pass         | Pass       | Failed canal finish/shape; common readiness barrier begins prospectively.                                                                                              |
| [11](../../benchmarks/visual-parity-round11-20261018/REPORT.md)                             | Pass            | Fail             | Pass         | Fail       | Mean leads do not override courtyard composition deficit 0.35 or completion failure. Judge-two subject-block order discrepancy disclosed.                              |
| [12](../../benchmarks/visual-parity-round12-20261018/REPORT.md)                             | Pass            | Pass             | Pass         | Pass       | **First complete two-subject pass**, at `0239f77`; transfer is a separate gate.                                                                                        |
| [First transfer](../../benchmarks/visual-parity-heldout-20261018/REPORT.md)                 | Fuel-stop: fail | —                | Fail         | Pass       | **Failed transfer** at the same checkpoint; keep all three peers and all 18 calls.                                                                                     |
| [13](../../benchmarks/visual-parity-round13-20261018/REPORT.md)                             | Pass            | Fail             | Pass         | Fail       | Completed at `2c500eb`; courtyard lighting deficit **0.35** and finish ratio **1.172877** fail. All 36 attempts and technical deviations are retained.                 |
| [14 preparation](../../benchmarks/visual-parity-round14-20261018/evidence/preparation.json) | Unmeasured      | Unmeasured       | Unmeasured   | Unmeasured | Inputs prepared and CPU preparation checks passed. Source freeze, authors, authoring services and clocks have not started; full/native product validation comes first. |
| [New rail-halt](../../benchmarks/visual-parity-heldout2-20261018/evidence/preparation.json) | Undispatched    | —                | Unmeasured   | Unmeasured | Prepared after failed transfer; new combined qualification is required before release.                                                                                 |

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
These checks predate the new assembly/light diagnostics work and do not validate
that active follow-up.

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

Full repository validation and native controls now pass, with the exact scope
and retained historical pixel mismatch described above. Fresh author qualification
is still pending. The
[round-14 preparation](../../benchmarks/visual-parity-round14-20261018/evidence/preparation.json)
retains unchanged references/budgets/gates and passed CPU preparation checks,
at preparation time. Services subsequently passed preflight; no source freeze,
author work or clock release has occurred at this update. Rail-halt remains
undispatched.

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
checks **203 files**, including gallery HTML, via authenticated HTTP, MIME types, byte hashes and PNG
decoding. This handoff did not rerun that verification or browser interaction QA.

| Published concept                                  | Gallery URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Retained publication / verification                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Garden and follow-ups                              | [Garden](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/)                                                                                                                                                                                                                                                                                                                                                                                                                                            | [Original deployment](../../benchmarks/chinese-garden-20261017/evidence/hosted-gallery.json), [follow-up update](../../benchmarks/chinese-garden-20261017/followup/hosted-update.json).                                                                                                                                                     |
| Street corner                                      | [Street](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/street-corner/)                                                                                                                                                                                                                                                                                                                                                                                                                              | [Deployment](../../benchmarks/street-corner-20261017/evidence/hosted-update.json), [gallery QA](../../benchmarks/street-corner-20261017/evidence/gallery-qa.json).                                                                                                                                                                          |
| Car construction                                   | [Car](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/car-construction/)                                                                                                                                                                                                                                                                                                                                                                                                                              | [Publication](../../benchmarks/car-construction-20261017/evidence/publication.json).                                                                                                                                                                                                                                                        |
| Original harbor                                    | [Harbor](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/harbor/)                                                                                                                                                                                                                                                                                                                                                                                                                                     | [Publication](../../benchmarks/harbor-20261017/evidence/publication.json).                                                                                                                                                                                                                                                                  |
| Repeated parity, canal/courtyard and harbor repair | [Parity index](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/)                                                                                                                                                                                                                                                                                                                                                                                                                        | Latest retained [deployment receipt](../../benchmarks/visual-parity-20261018/evidence/progress-round13-deployment.json) and [203-file HTTP/HTML/MIME/image verification](../../benchmarks/visual-parity-20261018/evidence/progress-round13-site-verification.json). Gallery/report coverage through round 13 and the failed first transfer. |
| Round 12 and first held-out fuel stop              | [Round-12 gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round12/), [fuel-stop gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/heldout/), [round-12 canal image](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round12/images/canal-aperture-final.png), [fuel-stop image](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/images/fuel-stop-aperture-final.png) | Included in current publication with all three peers. Earlier source `10e3655` [deployment](../../benchmarks/visual-parity-20261018/evidence/progress-heldout-deployment-20261019.json) and [177-file verification](../../benchmarks/visual-parity-20261018/evidence/progress-heldout-site-verification-20261019.json) remain retained.     |
| Round 13 completed qualification                   | [Round-13 gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/visual-parity/round13/)                                                                                                                                                                                                                                                                                                                                                                                                            | Published in source `8efeafa`; failed courtyard lighting and finish gates remain disclosed alongside all peers.                                                                                                                                                                                                                             |
| Prepared round 14, rail-halt and active follow-up  | Local artifacts; no authored R14/rail-halt result                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | New implementation/review evidence is local. The hosted handoff is an active draft; it does not imply publication of later local revisions or complete source/evidence archives.                                                                                                                                                            |

The latest deployment **succeeded**: `appgdep_6ad5cbc5c9e48191b15f290a779a1aa7`,
site source `8efeafa337f060e7316e5b3c4c6cb989e043605b`. It covers galleries/reports
through **round 13**, harbor repair 11 and the **failed fuel-stop transfer**.
Its downloadable archives are explicitly labeled **through round 3**. The site
source commit is separate from product checkpoint `2c500eb`; neither commit
means that all local benchmark artifacts were pushed.

| Coverage layer                        | Exact status at this update                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local workspace                       | Earlier concept batches, rounds 1–13, failed fuel-stop, prepared round 14/rail-halt, new implementation/reviews, controls, raw judgments and diagnoses are retained. Some relocated bundle bytes depend on the external storage receipt below.     |
| Product Git                           | Reviewed checkpoint `2c500eb` is committed and pushed. The validated assembly/light follow-up is included in this revision; the fresh freeze records its exact commit. Benchmark evidence is largely untracked and requires separate preservation. |
| Live gallery                          | Verified progress publication through round 13, harbor repair 11 and failed fuel-stop. Later local assembly/light evidence and unstarted round 14 are outside its completed-gallery coverage.                                                      |
| Downloadable source/evidence archives | Explicit coverage only through round 3. Complete later-round source/evidence packaging, extraction and hash verification remain open.                                                                                                              |
| Separate generated-build archive      | Through round 12; restores removed build products only and does not replace full source/evidence archives.                                                                                                                                         |

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

1. Preserve the completed R14 engineering validation and independent native
   controls above; record the committed candidate identity in the fresh freeze.
2. Freeze and run round 14's full two-subject qualification under unchanged gates
   after validation. Its inputs and preflighted services are ready; authors and
   clocks have not started. R13 is completed and failed; a round-12 historical pass does not
   qualify this changed code or authorize transfer.
3. Release rail-halt only after that complete pass; retain both reference
   generations, its frozen protocol, source, all attempts, blind scores,
   effort/technical reviews and cleanup.
4. Extend and verify the gallery beyond its current R13/fuel-stop coverage;
   publish complete downloadable source/evidence archives with checked
   extraction/hash inventory beyond the current through-R3 archives.
5. Update this handoff and the active plan with the final measured outcome and
   outstanding limits. Keep **DRAFT / active** until those facts support closure;
   R13, the first fuel-stop and original harbor failures remain disclosed.

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
Complete download archives must materialize canonical bytes as regular files or
internal tar hardlinks, with no external `/tmp` dependency. Round 13, the second
transfer, app/source/frozen-source trees, browser runtimes and caches were outside
this relocation. Archive enumeration includes prepared and incomplete trials;
archive presence does not assert that a trial passed.
