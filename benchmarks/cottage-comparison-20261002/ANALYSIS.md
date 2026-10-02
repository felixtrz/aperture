# Cottage comparison: exploratory analysis

## Result and limits

Two independent, engine-blind image reviews narrowly preferred Cedar (Aperture) over Maple (three.js) for reference resemblance. Both cited muted colors and cleaner facade surfaces, while identifying Aperture eave/shadow banding and three.js wall seams. This is an authored-output preference, not an engine-quality or performance ranking. Exact model identities and complete authentic author transcripts were unavailable; no formal score is assigned.

Both engines completed all seven final cases: front/rear/side base views, roof/bench/tree edits, and rear roof edit. All 14 final captures passed native WebGPU verification without WebGL attempts or GPU errors. Independent checks of actual native mesh vertices passed 29/29 per engine (58 total). These validate the specified structural edits, not image quality. No new aggregate engine test pass is claimed for this evidence-only work.

## Audit of available attempts

- Aperture initial attempt 001 succeeded. Frozen v1 and its image survive. The single allowed revision changed framing, geometry, palette and shadows; v2 uses continuous native polygon extrusion for facade openings rather than overlapping panels. Final scene has 35 checked mesh parts, versus the earlier reported 42-part first version.
- three.js initial attempt 001 failed the readiness contract: the ready global was populated during initialization. Diagnostics and source survive, but there is no initial image. The single revision moved progress to a separate global and announces readiness only after native rendering and submitted GPU work complete. All seven final cases then passed. This is a scene/harness integration failure, not evidence of a renderer defect.
- Attempts 002–008 are final views and edits of frozen v2 sources, not seven additional author revisions. Both authors consumed one revision and eight render-attempt slots including the initial attempt.
- Authors were isolated from the other candidate. Judges inspected only reference/candidate images with Cedar/Maple labels and did not inspect source or engine identity. Their reports are preserved verbatim in review-one.md and review-two.md.
- The actual brief explicitly requested an **open doorway** and a bench with **separate slats/legs**. Both judges noted departures from the reference's apparent closed door and broad bench boards. Those observations describe reference mismatch, but are not author failures against the written brief and do not justify closing the doorway or removing separate editable slats.

## Confounds verified in source

Both use 800×800, DPR 1, orthographic views, ACES exposure 1 and 4-sample rendering, but camera poses, object proportions, fill lights and shadow settings differ. Aperture uses ambient fill, directional intensity 4.2, PCSS-style shadowType 2 with filterRadius 6 and strength 0.72. three.js uses hemisphere fill, directional intensity 3.15 and PCFShadowMap. Their base thicknesses are 1.05 and 0.80; house positions and depth also differ. A direct visual difference cannot establish an engine regression.

## Evidence-backed follow-up queue

| Category | Priority | Item | Acceptance and decision boundary |
| --- | --- | --- | --- |
| Maintenance / benchmark diagnosis | P1 | Isolate Aperture eave banding | Preserve frozen base, camera and geometry. Compare bounded shadow-off, hard/PCF/PCSS, filter/bias and bloom controls through the approved renderer only. Identify a repeatable cause across front and rear views. Keep all attempts. |
| Patch candidate, not yet confirmed | P1 conditional | Shadow filtering or bias defect | Implement only after controlled native renders and code evidence show an engine defect. Regression must distinguish the failing implementation from expected shadow penumbra or scene settings. |
| Maintenance / benchmark design | P2 | Align written brief and visual reference | Retain editable open doorway/slats for this run; next reference/brief should agree. Preserve authentic evidence and clarify author/model/transcript limits before scored work. |
| Maintenance / scene authoring | P2 | Investigate three.js facade seams | Separate wall boxes and gable joins are source-level hypotheses. A controlled geometry-only change must remove seams across views before attribution. Do not change the frozen control. |
| Minor capability | None established | No demonstrated missing API from this run | Aperture's existing extrusion, procedural geometry and editable-part APIs completed the scene. Do not invent an API solely from a visual preference. |
| Major planning | None established | No breaking change justified | No architecture or release action follows from these images. |

The next active step is the P1 Aperture shadow/eave diagnosis. Compatible implementation follows only if that diagnosis demonstrates a gap. Earlier lost-work claims remain separate; this run does not restore missing transcripts or artifacts.

## Preservation

The source/reference and preflight were already published before this analysis. Commit 8b905eb6a57ae391b19b8e6c021f402e0f3e9bb1 preserved 62 changed evidence files, verified by fetching and comparing actual bytes. Commit 9d9fe3f46762bf159c44284e7f5cafff7a114468 restored the complete prepared checkpoint tree after the supported approval-rule update. This analysis and reviews require their own final publication verification. The companion manifest inventories actual available files and explicitly identifies missing formal gates.
