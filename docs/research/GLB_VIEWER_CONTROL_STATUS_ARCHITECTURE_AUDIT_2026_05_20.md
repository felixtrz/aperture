# GLB Viewer Control/Status Architecture Audit - 2026-05-20

## Scope

Audited `glb-viewer` after the live shadow, IBL, animation, metadata, query
bootstrap, material-fidelity, and rotation/scale animation slices.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_animation/src/lib.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `examples/glb-viewer.js`
- `test/e2e/glb-viewer.spec.ts`

## Findings

- Viewer asset loading still flows through `loadGlbFromUri(...)`,
  source-asset registration, GLB ECS authoring command planning, and
  `applyGltfEcsCommandPlanToApp(...)`.
- Animation playback now samples translation, rotation, and scale channels and
  writes those values into replayed ECS `LocalTransform` components. The
  renderer continues to consume extracted transforms rather than an example-owned
  object graph.
- Live light, shadow caster/receiver, IBL, camera, pause/scrub, speed, loop,
  direction, and clip controls mutate ECS-authored state or example playback
  state that writes ECS transforms.
- Viewer status remains JSON-safe: parsed GLB metadata, material resolutions,
  texture slots, pipeline keys, control state, animation values, and shadow/IBL
  readiness are reported without raw GLB bytes or raw GPU handles.
- The example creates WebGPU shadow and IBL resources for browser proof scenes,
  but those resources are renderer-owned inputs to `app.render(...)`; they are
  not stored in ECS and do not become authoritative scene state.
- Package dependency direction remains aligned with the documented boundaries:
  `simulation` stays headless, `render` imports `simulation`, `runtime` composes
  headless app/replay APIs, and `webgpu` remains the backend package.

## Reference Alignment

Bevy's glTF loader creates transform curves for translation, rotation, and scale
targets, then applies them to entities with transform components and animation
target identifiers. Aperture's viewer keeps the same conceptual split in a
smaller browser example: parsed glTF channels are sampled into replayed ECS
`LocalTransform` fields, and render extraction derives packets from that ECS
state.

Bevy also treats cameras, lights, meshes, and materials as ECS-authored
constructs during glTF scene loading. Aperture has mesh/material replay and
example-authored lights today; imported camera and glTF punctual-light replay
remain useful visible-feature follow-ups.

## Risks / Gaps

- `glb-viewer.js` is now a large example-local orchestration file. That is still
  acceptable for proof work, but the next repeated animation or imported-scene
  behavior should consider a small runtime/render helper only when it removes
  real duplication without hiding ECS replay.
- The viewer still uses example-local synthetic image URI resolution for
  committed texture samples; embedded GLB image decode remains a product gap.
- Imported glTF cameras and `KHR_lights_punctual` nodes are still metadata-only
  or unsupported in the viewer path.
- Morph targets, skins, and cubic-spline animation remain deferred and should
  continue to diagnose honestly before any rendering support is claimed.

## Recommendation

Keep the next recommended task visible and GLB-viewer oriented. The strongest
next slice is `task-2045`: add a stepped animation interpolation sample so the
viewer proves non-linear keyframe timing behavior through ECS-authored transform
updates and browser pixels.
