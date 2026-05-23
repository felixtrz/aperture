# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3124.

Status: `task-3123` completed view/depth clustered-light binning.

Key finding:

- The post-Tier-20 submit-efficiency blockers are closed for the covered main
  forward path: redundant state commands are elided, static command plans can
  reuse WebGPU render bundles, compatible grouped draws can use indirect
  argument buffers, opaque/alpha-test queue ordering groups prepared resource
  state, queued built-in bind groups are reused, TAA has previous per-object
  transform history, bloom has a downsample/upsample graph, and multiple
  environment-map handles can prepare versioned diffuse/specular IBL resources.
- StandardMaterial many-light scenes now prepare renderer-owned local-light
  cluster buffers for extracted point/spot lights, bind them through group 3,
  and shade point/spot lights from per-cluster index lists instead of scanning
  every packed light per fragment.
- ECS mesh draws can opt into renderer-owned WebGPU occlusion queries via
  `withOcclusionQuery()`, and the app reports visible versus occluded render IDs
  without exposing live GPU objects.
- Single ECS mesh entities can now author material-slot overrides with
  `withMaterialSlots()`. Extraction emits one mesh draw per submesh with
  submesh/material-slot and vertex/index range metadata, queue records preserve
  those ranges, WebGPU command descriptors carry the range offsets, and
  render-pass commands emit the correct first index/vertex values.
- `examples/multi-material-groups.html` proves one source mesh rendering as two
  visibly distinct material groups, with JSON-safe material/range status and two
  indexed draw calls where the second draw starts at index 6.
- Clustered local-light descriptors now derive view/depth-space bounds from an
  active camera, pack the selected view matrix for shader-side cluster lookup,
  report coordinate space/view id/bounds/occupancy hash, and
  `examples/clustered-lights.html` proves camera movement changes reported
  cluster occupancy while keeping max/average lights per populated cell below
  total lights.
- The next SOTA efficiency gap is using renderer-owned occlusion-query feedback
  to skip eligible previously hidden opt-in draws instead of only reporting
  visibility results.

Next step: run `task-3124` from `agent/BACKLOG.md`, using occlusion-query
feedback to skip previously hidden opt-in draws with a browser-visible proof.

Reference anchors for the next task:

- `references/three.js/src/renderers/webgl-fallback/WebGLBackend.js`.
- `references/engine/src/scene/layer.js`.
