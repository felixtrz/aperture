# Cottage eave banding: controlled diagnosis

## Result

The broad bands are the sampled roof shadow, produced by a widely spaced, fixed nine-tap filter. They are not caused by bloom, and the scene does not need geometry changes to remove the broad stepped transition. The authored single-map `shadowType: 2` request silently executes fixed-radius PCF rather than the publicly described PCSS contact hardening. That is a demonstrated implementation/contract mismatch, independent of aesthetic preference.

This batch diagnoses the issue; it makes no engine fix and assigns no formal quality, performance, or engine-comparison score. Narrowing the radius or selecting type 1 is a scene workaround, not proof that PCSS has been repaired.

## Controlled evidence

All 12 retained captures passed the approved native SwiftShader WebGPU verifier, with no WebGL attempts, GPU errors, lost devices, or frame diagnostics. All 12 lifecycle audits record successful completion. The new front and rear baselines are pixel-identical to the prior frozen captures `cottage-comparison-20261002/renders/a/attempt-002` and `attempt-003`, respectively. Historical front roof-edit attempt 005 was also visually inspected: its steeper eave has the same layered transition. It was not re-rendered in this batch.

All cases retain the same geometry, camera for the corresponding view, material, light direction/intensity, exposure, MSAA, and target dimensions. The entire `part-data.mjs` is byte-identical across all cases. The roof-casting control changes only whether the two roof meshes cast shadows; their visible meshes remain. Each source copy and its exact `control.diff` are retained.

| Case | Sole control from same-view baseline | Observed result |
| --- | --- | --- |
| 01 front baseline | None | Broad, layered transition beneath the left front roof slope |
| 02 shadow off | Remove directional shadow request | Eave wall becomes uniformly lit; broad bands disappear |
| 03 bloom off | Remove bloom configuration | Same broad bands; sampled eave transect is exactly identical to baseline |
| 04 hard | Type 2 → type 0 | Single hard shadow edge; broad transition disappears |
| 05 weighted PCF | Type 2 → type 1 | Narrow, smooth transition; broad layers disappear |
| 06 radius one | Type 2 radius 6 → 1 | Narrow shadow transition; broad layers disappear |
| 07 bias zero | Depth bias 0.00015 → 0 | Entire 800×800 image pixel-identical to baseline |
| 08 bias high | Depth bias 0.00015 → 0.002 | Other shadow pixels change, but broad eave bands and sampled transect remain |
| 09 normal zero | Normal bias 0.012 → 0 | Transition shifts slightly; broad stepped bands remain |
| 10 roof casting off | Exclude roof group from shadow casters | Eave wall becomes uniformly lit while visible roof remains; caster draws fall from 34 to 32 |
| 11 rear baseline | None | Reproduces historical rear exactly; stepped ground/side-wall transitions remain |
| 12 rear radius one | Type 2 radius 6 → 1 | Same narrow-filter effect on side-wall/ground shadow transitions; geometry remains coherent |

The rear gable is largely in the unlit direction of the sun. It is not an equally sensitive view of the front eave artifact. The rear control confirms the filter's cross-view effect, not a second independent front-eave measurement.

### Descriptive pixel measurement

`measurements.json` retains full pixel differences, original native proof, shadow descriptors, caster counts, exact SHA-256s, 107 verified input-pin checks, lifecycle summaries, and RGB runs. `analyze.py` analyzes retained captures only and launches no renderer.

At front x=335, y=240 through 264, fully shaded wall RGB is `[184,178,164]` and fully lit wall is `[223,220,212]`. The baseline has intermediate shades from y=242 through 256: 15 rows with several multi-row plateaus. Type 2/radius 1 has only two intermediate rows (249–250); type 1 has three (248–250); hard mode has none. Bloom-off has exactly the baseline RGB sequence. Both shadow-off and roof-casting-off are uniformly lit across all 25 sampled pixels. This descriptive transect was selected after image inspection; it is not a generalized quality score or a prespecified statistical test.

Whole-image changed-pixel counts from the front baseline are: shadow off 47,055; bloom off 114,903; hard 15,094; weighted PCF 15,482; radius one 14,611; bias zero 0; bias high 5,359; normal zero 11,304; roof casting off 5,381. Rear radius one changes 14,228 pixels from its rear baseline. These counts locate change, not improvement. Bloom affects many other pixels but leaves the measured eave sequence unchanged.

## Requested mode versus executed algorithm

Paths below are relative to the repository root. Line references describe the pinned pre-fix source in `input-pins.json`.

1. Public contract: `packages/render/src/rendering/authoring-types.ts:248–252` calls type 2 “PCSS contact-hardening” and documents the PCF/PCSS radius. `authoring-components-camera-light.ts:101–109` and `snapshot-packet-types.ts:395–400` repeat the mode semantics. No single-cascade exception is stated.
2. Frozen cottage authoring: `benchmarks/cottage-comparison-20261002/sources/a-v2/cottage-scene.mjs:18–20` requests one 2048 map, `cascadeCount: 1`, `shadowType: 2`, radius 6, depth bias 0.00015, normal bias 0.012, strength 0.72.
3. Automatic route: `packages/webgpu/src/app/auto-shadow-frame.ts:52–57` selects `directional`, because there is one directional request and no request with cascade count greater than one.
4. Pipeline features: `standard-app-pipeline-keys.ts:108–117` adds `cascadedShadowMap` only for `directional-cascaded`; this scene receives ordinary `shadowMap`.
5. Shader generation: `standard-shader.ts:526–533` calls `applyStandardShadowMapSampling` with `cascaded: false` for that ordinary path.
6. Actual single-map behavior: `standard-shader-shadow-sampling.ts:450–475` takes the authored radius (at least 1 for non-hard modes). At lines 508–519, type 1 selects weighted gather PCF; **every other type**, including 2, selects `sampleDirectionalShadowPcf3x3`. Lines 387–426 define its fixed 3×3 equally weighted tap grid. There is no blocker search or receiver–blocker-dependent radius in this branch.
7. Sampler behavior: `standard-material-shadow-bind-group.ts:685–689` deliberately uses nearest comparison filtering. Radius 6 therefore spaces the nine comparisons by six shadow texels instead of filling a dense smooth kernel. Fractional visibility changes in discrete tap increments; tone mapping/MSAA translate these into the observed stepped colors.
8. The actual PCSS function does exist, but only in the separate cascaded shader branch (`standard-shader-shadow-sampling.ts:140–181`, dispatched at 224–230). It is not selected by this scene. Changing the cottage to multiple cascades would also change its map/cascade configuration and is not an equivalent control or acceptable repair for an advertised single-map mode.

The relevant built JS files match this source behavior and are pinned. The output report records authored radius/depth bias and ordinary 2D map configuration; it does not directly expose the executed WGSL filter mode. Effective algorithm attribution is the deterministic source-routing evidence above, supported by native changes under radius/type controls, not a claim that the diagnostic report independently names PCSS.

### Separate bias finding

The non-cascaded receiver computes `max(authoredBias, 0.0004)` at `standard-shader-shadow-sampling.ts:343–348`, even though the descriptor reports the authored 0.00015. Thus both 0 and 0.00015 execute with 0.0004; their pixel-identical renders confirm that prediction. The high-bias control changes other shadows while preserving this eave transect. Normal bias moves the transition without eliminating its layers.

This is a real observability/semantics concern, but the evidence does not identify bias as the primary cause of the bands. Do not bundle a bias behavior change into a narrow filter fix without separate tests and compatibility review.

## Geometry and causality

The front facade is one native extrusion containing the gable, doorway notch, and window opening (`part-data.mjs:111–118`). The two roof slopes are closed extruded slabs with front overhang (`119–122`), not multiple visible eave trims. The roof shadow is expected scene geometry; the layered sampling transition is not authored layering. Removing roof casting eliminates the wall shadow while preserving visible geometry, and narrowing only the filter removes the broad layers without changing either roof or facade. That is enough to reject a required geometry edit for this artifact. It does not prove that every mesh is perfect or every other visual issue is a renderer defect.

## Narrow compatible repair recommendation

Implement genuine type-2 blocker-search/contact-hardening selection for the single-map directional receiver, with a bounded, documented penumbra calculation and sufficiently sampled filter. Preserve type 0 hard and type 1 weighted-PCF paths. Prefer shared, explicitly parameterized helpers where this prevents single-map/cascaded drift, but do not expand the patch into unrelated spot/point/cascade behavior or the bias floor. A small-radius PCF substitution may improve this screenshot but still fails the PCSS contract.

If implementing supported PCSS is deliberately deferred, explicitly report the unsupported request and document the fallback instead of silently claiming the public mode is honored. That makes the omission honest but is not equivalent to completing the advertised feature. For a compatibility repair, implementing the requested mode is preferable.

Do not assume copying the current cascaded expression automatically makes physically correct directional-light PCSS: check how normalized orthographic depth and near/far/light-distance parameters affect the penumbra estimate. This diagnosis proves missing contact dependence in the single-map path, not physical correctness of the separate cascaded implementation.

Required regression evidence:

- Generated-shader/routing tests: non-cascaded type 2 explicitly invokes a blocker search and variable-radius filter; type 0/1 remain distinct. Cover the single directional owner in any shared directional+point route if touched; avoid inadvertent spot/point changes from the shared helper.
- Algorithm boundary tests: no blocker means fully lit; near-contact blocker means narrow penumbra; increased receiver–blocker separation widens it; map-edge samples, zero/small radius, finite depth and bounded output are handled. Do not rely solely on presence of a function name or a screenshot that became sharper.
- Native controlled render: fixed camera, map, light footprint, receiver and caster size, with independent blocker-distance controls. Prove the patch fails against the old fixed-radius implementation and establishes contact dependence rather than merely reducing blur.
- Cottage regression: re-render the pinned baseline at radius 6 and compare front/rear and roof-edit geometry. Keep original evidence and post-fix captures separately. Validate narrow contacts without broad eave bands or lost roof occlusion. A one-cottage beauty check is insufficient to prove PCSS.
- Compatibility controls: hard/type 1 captures retain intended behavior; no-shadow and bloom controls remain valid; shadow descriptors, coverage, caster submission and native proof stay correct. Measure any filter-work growth structurally, not as a timing claim from these startup captures.

## Preservation and reconciliation

The batch contains exactly 12 sequential native captures. `run-batch.py` disallows repeat IDs, refuses beyond 12, verifies pinned helper/frozen/engine inputs, checks the 2 GiB free-space floor, and runs only `runtime_pressure.py run` wrapping `run-case.mjs` → `runVerifiedScene`. The helper hashes match `tools/coordination/evidence/recovery-verified-20261002.json`. Scratch is lifecycle-owned; retained sources, images, proofs, logs and audits are here. No dependencies or descendant agents were added, no frozen/engine source was changed, and no deletion was performed.

The retained progress record goes from 26,188,693,504 free bytes before the batch to 23,583,412,224 after it. Each audit contains matching run-start/run-completed with exit code 0. At 22:21 UTC, process reconciliation found no matching run-case/run-batch/runtime-pressure/browser process. On resumption, all existing captures and records were inspected; no capture was repeated. Final analysis rechecked 107 source/image/helper pins with no mismatch. A read-only exploratory analysis initially raised `KeyError: 'shadow'` on the intentionally shadow-free case; the corrected analysis handles that absent report. This was not a render failure, and it is retained in `measurements.json`.

`input-pins.json`, `cases.json`, individual `control.diff` files, `progress.json`, the 12 logs and audits, and `measurements.json` are the primary machine-readable evidence. `manifest.json` inventories the retained deliverables. No full repository test-suite pass, engine patch, commit, publication, or performance ranking is claimed by this report.
