# Crane courtyard: exploratory comparison

## Evidence and outcome

All 22 native WebGPU attempts passed: one initial front-quarter view plus ten final captures per engine (three baseline cameras and seven independently reset edits). Both versions used SwiftShader WebGPU with zero WebGL attempts, GPU errors or device loss. Each author used one initial submission and one own-render revision; final capture sweeps were not further author revisions.

Two independent blind image reviews mildly preferred Rowan (Aperture) for clean surfaces and smooth shadows. Juniper (three.js) had richer colour and a warmer lamp but visible stippled shadows and patterned wall marks. Both retained wall seams, subdued rear fill and some reference mismatch. Aperture's final shadows were judged overly diffuse in places. Neither review found a conspicuous visible failure in the seven edits. These are preferences for these authored outputs, not renderer, model or performance rankings.

Independent actual-vertex/triangle checks passed 558/558 for Aperture and 546/546 for three.js. These counts differ because the scenes contain 80 and 78 separate mesh parts; many checks concern each unaffected part, so the totals are not comparative scores. They cover finite triangles, open arch/pipe ray probes, boom lengths and joints, world-vertical cable and length, unchanged scope, tier translation and assembly rigid motion. Native stream comparisons additionally passed 800/800 Aperture mesh-capture pairs and 780/780 three.js pairs, matching final frozen CPU geometry and actual matrices. This does not claim exhaustive topology, physics or mechanical safety validation.

## Attempt audit and confounds

- Aperture v1 succeeded immediately. v2 preserved geometry and edit logic, changed lighting/background/shadow settings, and retained exact native stream evidence in readiness. It explicitly uses the published single-map PCSS implementation, shadowType 2, map 1024, radius 16 and strength 0.82.
- three.js v1 also succeeded immediately. v2 preserved geometry/palette/cameras/edits, switched to ACES and adjusted key/environment/background; PCF radius increased from 3 to 12 on a 2048 map. The final exhibits stronger stippling than its initial image. Native geometry export was added to readiness.
- Both used the same five frozen inputs, 1024-square images and fixed orthographic cameras. Geometry and inputs remained immutable during captures. The shared brief specifies numerical kinematics but allows engine-native artistic lighting. Different tone maps, shadow algorithms, resolutions, biases and fill systems prevent attribution of every image difference to an engine defect.
- Aperture source is the tested patch published at 4b70faeff01a75348193ae542be33b82dd69f164; the pinned three.js control identifies REVISION 185dev. Compiled dependency/module hashes are retained in runtime-pins.json. This crane run does not include a prior-Aperture crane control.
- Both authors and both judges were separate workers with equal inherited model/effort and revision/render budgets. Exact model identity and full authentic author tool transcripts are unavailable. No protected session data was accessed, no missing transcript was reconstructed and no formal score is assigned. Saved requests, source, visible reports and authentic render/tool logs are the available evidence.

## Deduplicated follow-up queues

| Category | Priority | Finding and evidence | Acceptance / owner |
| --- | --- | --- | --- |
| Maintenance / benchmark diagnosis | P1 | Both blind reviews identify thin wall seams; three.js final additionally has patterned wall/shadow artifacts. Related to the earlier cottage facade-seam observation, not a second invented feature. | Isolated diagnostic owner: preserve both frozen scenes and compare native shadow-off/bias/filter controls and actual coplanar mesh joins. Confirm repeatable cause across front/rear before any engine change. |
| Patch | Completed | Single-map PCSS advertised behavior was corrected and published; earlier focused/native tests and current real authored crane use survive. | 4b70fae source, 7d4c8dc archive. Current visual preference is supplementary, not a substitute for the controlled PCSS regression. No additional patch justified yet. |
| Maintenance / authoring guidance | P2 | Aperture final radius/map choice yields overly diffuse shadows; both rear walls lack reference cool fill. | Retain current outputs. Only after diagnosis, document bounded map/radius/fill guidance verified across views; do not modify immutable control to improve its result. |
| Minor capability | None established | Existing editable mesh, lighting and ECS APIs completed the articulated scene and seven edits. | No new capability is authorized solely to manufacture implementation activity. |
| Major planning | None established | No breaking architecture need demonstrated. | No release or breaking work follows from this comparison. |

Workspace version is 0.3.0. This evidence analysis does not assign a release number or authorize a release. New engine work requires a demonstrated technical finding; the next bounded step is wall/shadow diagnosis, while evidence publication continues independently.

## Recovery and publication

Five frozen author inputs were byte-verified on GitHub at 6dff635e0c7bda8cff992bec66d9b8f6ef133706. Full reference builder publication was denied during authoring because of the independence boundary. After both authors froze their sole final revisions, the supported reviewed retry of the exact same blob succeeded. Remaining full reference and comparison archive publication is pending; no complete-run durability claim is made until exact tree bytes are verified.

The existing environment remains healthy on the same boot. setup.py status reports pnpm because its broad input hash changed after the tested PCSS patch; historical five-stage setup receipts survive and current native captures work. No blind dependency reinstall, lock reset or recovery initialization was performed.
