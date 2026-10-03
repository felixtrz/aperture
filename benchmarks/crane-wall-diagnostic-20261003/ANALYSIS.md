# Crane wall and shadow diagnostic

## Outcome

The eight-attempt experiment separated three issues without changing either engine:

1. **The upper wall's vertical seams are caused by redundant interior faces in the tested three.js assembly.** They persist when all meshes stop receiving shadows. Removing only 13 exactly coincident, oppositely oriented interior quad pairs (52 triangles) makes the upper wall smooth. All exterior triangles, vertex positions, normals, material names, matrices, lights and camera remain unchanged. Only 693 pixels change, confined to the wall at x=645–795, y=357–534. The lower horizontal pier/upper-wall join remains; its partial-contact interior faces were deliberately not removed.
2. **three.js v2's conspicuous stippling is sensitive to its authored wide PCF footprint.** Changing only radius 12 → 3 removes the broad noisy penumbras and patterned wall marks at the cost of narrower, harder shadow edges. The v2 tone map, illumination, map resolution and biases stay fixed. Raising normalBias .012 → .048 alone reduces wall self-shadow marks but leaves noisy penumbras and shifts shadow contacts. This is not evidence that arbitrary bias increases are a safe fix.
3. **Aperture v2's excessive softness is an authored setting in this case.** Changing only filterRadius 16 → 4 on the same 1024 map visibly tightens the PCSS shadows. This does not establish an optimal universal radius, nor a quality-equivalent cross-engine setting.

No engine defect or additional engine patch is demonstrated. The renderer comparison's original images and sources remain frozen.

## Reproduction and attempt accounting

All **8/8 native attempts passed**, including fresh A/B baselines that reproduce the retained v2 PNGs **byte-for-byte**. There were no failed attempts, WebGL calls, GPU errors or lost devices. Every attempt used the adopted `runtime_pressure.py` lifecycle and `runVerifiedScene`, sequentially, with an ephemeral loopback server. All eight lifecycle logs end in `run-completed`, exit 0, after the wrapper awaited descendants. There are no outstanding renders or servers from this experiment.

| Attempt | Case and single changed variable | Exact comparator | Native result / observed finding |
| --- | --- | --- | --- |
| [001](renders/attempt-001/render.png) | Aperture frozen v2, no change | Retained A attempt-002 | Exact PNG reproduction |
| [002](renders/attempt-002/render.png) | three.js frozen v2, no change | Retained B attempt-002 | Exact PNG reproduction |
| [003](renders/attempt-003/render.png) | A: receiveShadow true → false on all meshes | 001 | Vertical and horizontal wall seams persist |
| [004](renders/attempt-004/render.png) | B: receiveShadow true → false on all meshes | 002 | Seams persist; shadow stippling disappears |
| [005](renders/attempt-005/render.png) | B: key.shadow.radius 12 → 3 | 002 | Broad stippling and wall acne greatly reduced; shadows harder |
| [006](renders/attempt-006/render.png) | B: key.shadow.normalBias .012 → .048 | 002 | Wall patterns reduced, noisy penumbras remain; contacts shift |
| [007](renders/attempt-007/render.png) | A: key filterRadius 16 → 4 | 001 | Penumbras visibly tighter |
| [008](renders/attempt-008/render.png) | B no-shadow: remove exact internal quad pairs only | 004 | Vertical wall seams disappear; untouched horizontal join remains |

All captures are 1024×1024, baseline edit, frozen front-quarter orthographic camera. “No-shadow” here means only mesh `receiveShadow=false`; lights and their authored shadow settings are untouched. The renderer may omit unused shadow work. Controls 003–007 retain their baseline's complete actual native geometry evidence exactly.

## Source and geometry inspection

The 16 plain brick panels in each scene are two piers, two upper-side boxes and twelve spandrel prisms. Their actual native unique vertex-position sets agree exactly across the two independent authors. Their front/back surfaces share z = -1.899999976158142 / -2.200000047683716 and all have correct flat ±Z normals. All use the same `brick` material within each scene. The intentional protruding arch blocks use alternating materials and are not the thin vertical marks at issue.

Both walls contain the **same 13 exact opposite interior face pairs**: eleven between neighboring spandrels and two at the upper-side/spandrel joins. These are full coincident quads, not a tolerance-based weld. Each pair contains four triangles. Adjacent exteriors therefore meet exactly; no vertex-position gap or material mismatch was found at those joins. Aperture generates flat per-triangle normals through `mesh.triangleList`; three.js supplies flat face normals and enables `flatShading`.

Attempt 008 removes precisely the 156 selected index entries from 14 brick meshes and updates their group counts. The remaining 64 meshes are identical. All positions, normals, matrices, materials, markers and other scene fields remain exact. Exterior triangle indices are retained in order. `interior-pair-selection.json`, `native-inspection.json` and `verification.json` contain the full selection and checks. The result establishes an internal-face rendering contribution to the vertical seams in **three.js/front/no-shadow**. The identical Aperture wall topology makes the same authoring cause a strong inference there, but an Aperture removal render was not in this budget.

The retained rear images also show joins, but this experiment did **not** render new rear controls. Horizontal joins involve partial-contact surfaces rather than the exact full-quad pairs selected here. Their precise mechanism remains unresolved; neither should be presented as proven fixed.

## Shadow/filter evidence

The pinned three.js `PCFShadowFilter` at `shadow-lab/src/compare/three.webgpu.js:44022–44072` documents and implements five Vogel-disk samples rotated per screen pixel by Interleaved Gradient Noise, each with hardware PCF. Its radius is scaled by shadow-map texel size. The author changed radius 3 → 12 between v1/v2 without increasing that five-sample budget. The v2 authored scene submits one rendered frame; no temporal accumulation was added. A wider sparsely sampled footprint is therefore a concrete mechanism consistent with the observed stippling. Attempt 005 isolates radius from the v1/v2 tone-map, key-light and environment changes.

A fixed wall patch above the arch, x=[655,696), y=[383,417), has mean absolute four-neighbor luminance Laplacian 6.03 for B baseline, 1.06 for radius 3, 1.24 for higher normal bias, and 1.04 with shadow receiving disabled. After the interior-face control it is flat to numerical precision. This descriptive metric includes the remaining geometric seams and is **not an engine score**. The full images are the primary evidence.

Aperture's published single-map directional PCSS stays unchanged. Attempt 007 isolates radius from all other final-author choices, including its 1024 map, strength .82, normalBias .02, illumination and tone map. The result supports bounded authoring guidance about radius/map choice rather than another PCSS implementation change.

## Integrity, reproducibility and limits

- `frozen-source-pins.json` matches both original v2 source sets and their retained native render pins.
- `runtime-pins.json` verifies all 1,161 original runtime/dependency pins plus the adopted cleanup helper and the request handler, 1,163 files total. No drift occurred before, during or after any capture.
- Adopted helper hashes: cleanup `1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`; runtime_pressure `89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a`; verified-webgpu `c22115155673dea151d50eaf6e7a1cd4efb11ba514d4794184be58db0f8ebe8a`. The first two match the retained recovery-operation receipt.
- A fresh baseline PNG: `3beeb18578adfead53a1628d4bb2d15815750f2d053a1c232bf6bc9d0668797d`. B: `4b7f2990a7cbcf599704920690b3e6c6f052c66d5839642f618e9613dff707c1`.
- Exact source clones, stated comparator diffs, pre/post full pins, native geometry, proof, screenshot, console output and lifecycle audit are retained for every attempt. `cases.json` names each comparator. The conditional eighth changes only topology relative to the already shadow-disabled fourth, not relative to the fully shadowed baseline.
- Storage stayed above the 2 GiB floor: about 15.99 GB before the experiment and 14.24 GB after all attempts. No deletion or pressure retirement was performed.
- `verify-results.py` confirms native proof, equality and removal invariants. `inspect-native.py` inspects actual retained streams. Syntax checks passed for every rendered source and runner. No aggregate package suite or physical-GPU tests were run; this task made no engine changes.
- The eight native attempts are exhausted. The driver intentionally rejects additional attempts. This is a diagnostic archive, not an invitation to overwrite or extend its immutable cases.

## Recommended next step

Treat redundant internal wall faces as an **authoring/maintenance** finding. A later separately bounded copy can remove the remaining partial-contact horizontal interiors and verify clean exterior surfaces in both engines, front and rear. Keep the frozen comparison intact. For new authored scenes, choose shadow radius with the map resolution and available filter samples in mind, and inspect contact shadows before increasing bias. These controls do not authorize an engine patch or a release.
