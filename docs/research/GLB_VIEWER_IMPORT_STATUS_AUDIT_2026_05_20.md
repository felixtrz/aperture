# GLB Viewer Import/Status Architecture Audit — 2026-05-20

## Scope

Audited the recent GLB viewer slices for imported cameras, embedded bufferView
images, imported punctual lights, and unsupported morph-target metadata.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `examples/glb-viewer.js`
- `test/e2e/glb-viewer.spec.ts`

## Findings

- ECS remains authoritative. The viewer still replays glTF nodes through
  `applyGltfEcsCommandPlanToApp(...)`; imported cameras update the existing ECS
  camera transform/projection, and imported punctual lights update ECS-authored
  `Light` components on replayed node entities.
- Rendering remains derived. The render loop consumes extracted snapshots and
  WebGPU reports; imported camera, light, texture, and morph metadata status is
  published from source/import metadata or extraction output, not from
  renderer-owned scene state.
- GPU ownership stays in the WebGPU path. Embedded image handling converts known
  sample image payloads into renderer-independent texture source data, while
  live WebGPU resources remain behind the app/backend resource path.
- Status remains JSON-safe. Published camera/light/morph diagnostics expose
  indices, labels, counts, and stable entity keys; raw GLB bytes, image bytes,
  GPU handles, and callback-like objects are not included in the public example
  status.
- Unsupported morph targets are honest report-only metadata. The base mesh still
  renders, and the warning now reports target and primitive counts so agents can
  identify the unsupported surface without treating it as fatal.

## Corrective Work

No corrective refactor was required beyond the `task-2049` status count
tightening and Playwright coverage.

## Recommended Next Visible Slice

Add a narrow skinning unsupported-feature sample for `glb-viewer`: commit a GLB
with skin metadata that still renders an unskinned base mesh, report JSON-safe
skin/joint counts, and verify the warning plus visible pixels in Playwright.
