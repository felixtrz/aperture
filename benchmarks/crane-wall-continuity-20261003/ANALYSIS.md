# Crane wall continuity: bounded follow-up

## Result

**All seven native captures passed.** The extension closes the earlier horizontal-join question and directly verifies the Aperture interior-face inference. A continuous brick-wall extrusion renders without the thin vertical or horizontal body-join lines in both engines, from front and rear. The frozen widened opening (`opening_width=2.1`) also remains open and free of body-join lines in both front views.

This is **authoring guidance using existing APIs**, not a new capability or an engine fix. Aperture's earlier cottage A-v2 already used a continuous native facade extrusion for the same class of issue. Consolidate the cottage and crane observations into one guidance item rather than opening a duplicate API/renderer feature request.

The original eight-case diagnostic, original comparison and engine files remain unchanged. Three.js retains its noisy wide-PCF shadow edges in these full-shadow captures; wall continuity does not replace the earlier filter-radius diagnosis.

## Seven captures and comparators

Every capture is 1024×1024 with the frozen camera, tone mapping, material parameters, lights and shadows for its named engine/view/edit. Only case 001 inherits the previous shadow-disabled state, which is unchanged relative to its comparator.

| Attempt | Controlled change | Comparator | Result |
| --- | --- | --- | --- |
| [001](renders/attempt-001/render.png) | Aperture/front/no-shadow: delete covered interior faces only | Previous diagnostic 003 | Vertical and horizontal join lines disappear |
| [002](renders/attempt-002/render.png) | Aperture continuous brick body, front | Frozen A v2 baseline/front | Clean body surface with original PCSS shadows |
| [003](renders/attempt-003/render.png) | Aperture continuous brick body, rear | Frozen A v2 baseline/rear | Both classes of body-join line absent |
| [004](renders/attempt-004/render.png) | three.js continuous brick body, front | Frozen B v2 baseline/front | Body joins absent; wide-PCF stippling remains |
| [005](renders/attempt-005/render.png) | three.js continuous brick body, rear | Frozen B v2 baseline/rear | Body joins absent; noisy penumbras remain |
| [006](renders/attempt-006/render.png) | Aperture continuous body, width 2.1/front | Frozen A v2 arch edit/front | Opening preserved; no body-join lines |
| [007](renders/attempt-007/render.png) | three.js continuous body, width 2.1/front | Frozen B v2 arch edit/front | Opening preserved; no body-join lines |

The prior run already reproduced both frozen front baselines byte-for-byte. This extension uses that bridge with unchanged source/dependency hashes instead of spending capture slots on another reproduction. The retained front/rear and widened-edit comparators are themselves pinned by `protected-pins.json`. All seven slots were consumed by successful captures; no failures, extra captures or retries occurred.

## Strict interior-face control

Case 001 deletes:

- The same 13 exactly coincident opposite interior quad pairs found in both authors: 52 triangles.
- Two pier-top and two upper-side-bottom quads at the spring line: eight additional triangles.

For **each of the 60 triangles**, exact binary-rational clipping proves that oppositely oriented adjoining wall surfaces cover its entire area. Pier tops are covered by the upper-side boxes and the unchanged terminal arch blocks. The slightly protruding ring is not altered. All original exterior triangles, source positions, materials and transforms remain untouched; only the specified index entries are removed. The remaining 64 meshes retain exact native stream records.

Only 750 screenshot pixels change relative to the previous no-shadow Aperture case, all within the wall's image bounds. An inspected vertical-join region contains 702 changed pixels and the right horizontal-join region 32. The visual result removes the thin lines in both regions. These counts describe this capture and are not quality scores.

This provides a direct causal result for **Aperture/front/no-shadow**: covered interior faces generated the visible join contributions. It confirms the prior three.js vertical-face result and closes the horizontal-join question in Aperture without cap retriangulation or exterior-geometry changes. The pure interior-deletion variant was not separately rendered at the rear or for three.js horizontal joins; those are covered here by the continuous-body remedy, not an identical pure-deletion experiment.

## Continuous body and equivalence guards

Aperture uses the existing `mesh.extrude` API, with `createExtrudeMeshAsset` for independent CPU expectations. Three.js uses its existing `Shape`/`ExtrudeGeometry` with bevels disabled and one extrusion step. Neither engine implementation changes.

The outline preserves the union of the original 16 plain brick solids:

- Original outer bounds: x=[-0.6,3], y=[0,2.6], authored planes z=-2.2/-1.9, with their exact stored Float32 values.
- The original twelve-segment **outer** arch radius, plus the two spring-line steps to the jambs. Using the inner opening radius instead would add overlapping body material behind the raised ring and would not be the same solid union.
- Original raised arch blocks, alternating ring materials, cap, lamp and all unrelated scene objects, byte-identical in their retained geometry/material/transform records.

The pre-render and actual-native guards verify, separately for baseline width 1.6 and widened width 2.1:

1. Exact Float32 world bounds and front/back planes. Depth is derived from the frozen plane difference, avoiding the one-ULP shift possible with naive `fround(-2.2) + fround(.3)` placement.
2. Exact directed cap boundary equality after splitting collinear segments at the union of boundary vertices, using binary-rational arithmetic rather than a geometric tolerance.
3. Exact cap area equality. The 32 triangles per old cap become 19 per continuous cap, with the same covered planar region. Normalized boundaries contain 36 segments in both representations.
4. A closed, consistently wound, two-manifold continuous body with 80 finite nondegenerate triangles. Cap normals are exactly ±Z; other generated normals are unit/outward within 1e-6.
5. Ten through-opening ray probes and four inside/outside jamb probes. All pass for both widths.
6. Every native oriented triangle, matrix and material label matches the prepared CPU expectation exactly. Native normals match prepared normals exactly when explicitly authored. Unaffected native Aperture streams and three.js normal arrays remain exact.

The body replacement reduces 16 brick meshes to one. Aperture retains 64 other meshes (65 total); three.js retains 62 (63 total). These counts are structural evidence, not performance rankings.

### What is and is not equivalent

The occupied brick-solid envelope and visible boundary planes are exact. The new body intentionally has different triangulation, vertex layout, draw grouping and hidden faces. Its generated side normals are validated, not claimed byte-identical to every old body normal. Consequently, the continuous cases prove an authoring remedy and multi-view behavior; they do not uniquely isolate the contribution of retriangulation versus interior-face removal or establish a low-level rasterization defect. Case 001 supplies the narrower causal control.

The widened rear view, moving-camera behavior, physical-GPU rendering and other opening widths were not captured. The unchanged raised ring still has intentional visible material/facet boundaries; “clean” refers to the unwanted plain-brick body joins.

## Deduplicated authoring guidance

The existing cottage A-v2 implementation, `benchmarks/cottage-comparison-20261002/sources/a-v2/part-data.mjs:112–117`, already authors one continuous native extrusion with its doorway notch and window hole. Its scene uses the app facade's `mesh.extrude` directly. The crane validates the same approach for a stepped arch profile and a widened opening.

Use one coherent boundary for a visually continuous wall body. Preserve genuinely separate raised trim and materials. If retaining assembled closed primitives, remove provably covered interior faces rather than offsetting visible planes to conceal lines. Keep shadow-radius/bias tuning as a separate decision: these continuous-body captures deliberately retain the original filters, so three.js's broad stippling and Aperture's soft final shadows are not silently “improved” during the geometry test.

No new API defect, engine patch, breaking change or release follows from this result. No additional captures are needed to complete this bounded extension.

## Integrity and lifecycle

- Seven attempts, seven native SwiftShader WebGPU passes, zero WebGL attempts, device losses or GPU errors.
- Seven completed lifecycle audits, all exit 0 after the adopted subreaper awaited descendants. All servers closed. No renders remain active.
- All **1,163 runtime/helper pins** and **171 protected evidence/source pins** remained unchanged before and after every capture and at final verification. The protected set includes every file of the prior eight-case archive and its manifest.
- Exact per-case source hashes, comparator diffs, full before/after pin records, static/native geometry guards, PNGs, result JSON, logs and lifecycle audits are retained here. `verification.json` contains capture hashes and final checks; `MANIFEST.json` pins the archive files, excluding itself.
- Storage stayed above the 2 GiB floor: approximately 14.23 GB before captures and 12.69 GB after. No deletion or pressure retirement occurred.
- The browser route was exclusively adopted `runtime_pressure.py` wrapping `runVerifiedScene`, with ephemeral loopback serving. No alternate browser launch, additional worker agents, new dependencies or engine edits were used.
- Per-source syntax checks, exact CPU guards and native geometry guards passed. The aggregate package suite was not rerun; this archive is a bounded authoring experiment, not a full product regression run.
- The driver refuses an eighth attempt. Keep this archive and the prior experiment immutable.
