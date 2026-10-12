# Round 003 retained source and contract review

This is a preliminary source review of the verified, read-only author audit copies. It identifies actual code and operational facts. It does not determine eligibility, visual quality, geometry scores or final runtime correctness. No authors were contacted; no code was edited or executed. Source/configuration paths below are relative to each public audit's `source/` directory, under `/workspace/aperture/benchmarks/agent-house-race-20261011/round-003/author-audits/{three-r003,aperture-r003}`. The companion receipt pins all reviewed source and retained public records.

## Renderer, authority and controlled execution

| Concern | Three frozen source | Aperture frozen source |
| --- | --- | --- |
| Actual renderer | `src/main.js:1,16–20` imports `three/webgpu` and constructs WebGPURenderer with forceWebGL:false; `1768–1772` additionally rejects any backend whose isWebGPUBackend is not true. | `src/main.js:1–4` awaits generated app/browser-entry; `.aperture/generated/aperture-worker-entry.js:1–7` starts the actual generated SimulationWorker. `src/systems/setup.system.ts:5–12` authors camera/lights/triangleList assets through ECS system init. |
| Static scene | Own construction code runs once before adapter registration; adapter `1787–1790` calls renderer.render once. No authored animation timers or native API patches were found in retained own src. | Setup init publishes meshes once; `src/main.js:15` delegates controlled frame delta/time to public app.renderFrame. `aperture.config.ts:4` selects manual cadence. No authored update loop, timers or native API patches found in retained own src. |
| Determinism | `src/main.js:5–9` uses seeded local LCG 329187 for authored procedural randomness. | `src/scene.js:3–4,113–125` resets seeded LCG 427; `src/surface.js:9–19` seeds procedural texture bytes 1321. |
| Viewport/tonemap | `src/main.js:13–24`: 1024/768 aspect, camera37deg near0.1/far200, canonical position[14,9,19], target[0,2.5,1], DPR1,1024x768,MSAA4,ACES/exposure1. `1777–1785` accepts all supplied camera fields. | `index.html:1` fixes actual canvas and CSS1024x768. Config `:4`: DPR1/maxDPR1,MSAA4,ACES/exposure1. Setup `:6` uses same canonical camera fields/aspect. Main `:7–13` sends translation/lookAt and fov radians/near/far to real worker tooling requests using correct camera component ID. |
| Light/ground | `src/main.js:25–46` enables sun shadows/map2048 plus hemisphere and directional fill. Actual lawn/road geometry begins `322–393`; procedural environment `152–183`. | Setup `:7–8` authors sun shadows/map2048 plus ambient fill; meshes `:11` receive shadows, cast unless b.cast false. Actual ground/road geometry `src/scene.js:127–149`. Config does not disable default environment. |
| Timing/counters | Own source has no performance/Date measurement substitution, renderer counter assignment, GPU queue patch or added frame delays. Source facts do not replace the independent native observer. | Same own-source finding. Frame timing is delegated to public controlled frame; source facts do not replace independent native observer/worker evidence. |

The line-range excerpts are source anchors, not executed assertions of engine configuration. Actual final native settings and frame proof remain required.

## Actual geometry adapters and coverage risks

Three `src/main.js:1791–1835` copies native position/normal attribute values to Float32Array and the index buffer to its actual typed-array constructor. It returns actual Object3D world matrices as owned Number arrays. For InstancedMesh it visits actual `o.count` and multiplies object matrixWorld by every getMatrixAt row (`1821–1830`). The source creates the pooled InstancedMeshes and all populated matrix rows at `1753–1765`. Number-array matrices are intentionally Float64LE in the common v2 transport.

Three exports each mesh's complete buffers and checks its own visible flag, without checking ancestor visibility or drawRange/material groups. The retained authored code has no visibility toggles or draw-range/group restrictions found; this makes those generic adapter caveats conditional rather than an observed omitted object. Primitive built-in material groups are not restricted by the authored single-material mesh helpers. Scene traversal can include off-frustum geometry. Final native evidence must still establish that all visible source geometry/instances are represented and that exported data matches real uploaded data. No skinning, morph animation, GPU deformation or custom shaders were found in the own source.

Aperture `src/main.js:18–29` uses actual public inspectRenderedGeometry with explicit96MiB request budget,2M vertices/6M indices/4096meshes/10kdraws/100kinstances. Config retains96MiB (`aperture.config.ts:4`). It rejects any status other than complete, copies positions/normals, builds indices from the actual submitted firstIndex/indexCount/baseVertex or firstVertex/vertexCount and copies every submitted instance world row to owned Float32Arrays. The common protocol treats `instances` as complete world matrices and uses them instead of multiplying by `worldMatrix`; providing both does not double-transform the rows.

Aperture inspection is explicitly the last accepted submitted static geometry. A complete result proves completeness within that API's submission scope, not automatically every scene mesh, every view or pixel visibility. The authored scene bakes world coordinates into per-material triangle-list batches (`src/scene.js:10–19`; setup`:10–12`) and has no authored GPU deformation/custom pass. Large material batches and shared-mesh draw splitting make final multi-view/native coverage important. A draw can repeat a full source buffer in this adapter; multiplicity and draw ranges are explicit, but duplicated unused source vertices must not be mistaken for separately drawn triangles. No invented statistics or source registry traversal appear in the adapter.

Some authored Aperture surfaces deliberately have open slab bottoms (`src/scene.js:49–54`) and reverse-facing duplicate triangles for selected car materials (`21–22`). Glazing uses opaque standard materials (`scene.js:117,123`; `surface.js:26`), not transparency/transmission. These are neutral source/topology/material facts, not judgments that the scene fails the contract. Final geometry should report actual topology rather than assume every decorative surface is a closed solid.

## Fourteen required feature groups: code presence only

The grouping follows the common brief; all entries need final geometry/views to judge appearance and adequacy.

| Feature group | Three src/main.js | Aperture src/scene.js |
| --- | --- | --- |
| Ivory stucco house exterior |79–84,394–464 |115,150–166 |
| Terracotta tiled gable roof |575–638 |81–112,159–167 |
| Chimney |663–676 |198–203 |
| Dark framed inset windows |465–574 |58–79,152–158 |
| Covered porch and two posts |677–714,681–685 |172–187,176–180 |
| Door |715–723 |188–191 |
| Stone path |744–792 |239–243 |
| Low stone garden boundary |793–858 |245–270 |
| Shrubs/trees |902–1125 |278–288 |
| Mailbox |859–899 |271–277 |
| Curved asphalt road |324–363 |130–136 |
| Curbs |364–384 |137–140 |
| Broken white markings |385–392 |142–145 |
| Blue hatchback with body/glass/lights/trim and four wheels |108–125,1126–1631; four wheels1571–1631 |123,294–398; four wheels372–393 |

The distant landscape is optional and has actual procedural source in both apps. No reference-image texture, scene billboard or imported ready-made house/car was found in retained own source. Three's procedural environment image is generated by its own canvas code, not the reference image.

## Preserved preview failure, author repair and final build differences

Aperture's first public preview artifact `public-records/previews/01-artifacts/public-error.txt` reports canonical-camera failure `aperture.entityLookup.componentMutationUnsupported`: authored component `'Camera'` is not mutable. The artifact records zero native submissions/draws; it is not a render-pass or renderer initialization failure. Command `public-records/commands/e892d8af57ba44828a168d3b43ebc4dd/request.json` (09:14:45.541080UTC, exit0) explicitly replaces `component:'Camera'` with `component:'aperture.render.camera'`, also adjusts reflected triangle winding and rebuilds. Current main`:11` uses that correct ID. Preview2 and3 both returned ok. This preserved evidence supports an author adapter error and recovery, not an assumed engine bug.

Aperture third preview froze at09:24:33; final command `0dec75cb799445e1b0b4641fbd91577e` starts09:27:52 and changes final texture clamping/slab orientation/ground/car details before rebuilding. Three third preview froze at09:28:52; final command `b6393869df8247e6b8be13d12e1d4809` starts09:31:40 and edits/rebuilds final source. Both final dist hashes differ from the third-preview frozen builds. Successful preview preflight therefore cannot certify these final builds.

Audit facts: Three12commands/1failed command (rg missing), active1594.253301495s, wall1716.965074168s, previewwait122.711772673s. Aperture24commands/1failed command (a nonexistent SDK textures path), active1406.691597643s, wall1509.94904043s, previewwait103.257442787s. These are audited operational facts, with no author-time or quality score computed here. All six audit verification checks are true; the receipt independently rechecks retained hashes.

Final native trials, source/upload parity, complete visible coverage, fixed-camera screenshots, geometry facts and blind judgment are pending. This review sets no arbitrary eligibility threshold and makes no visual self-grade or performance claim.
