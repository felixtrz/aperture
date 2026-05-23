# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3121.

Status: `task-3120` completed clustered local-light preparation for
StandardMaterial.

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
- `examples/clustered-lights.html` proves 64 ECS-authored point lights through
  the clustered StandardMaterial pipeline and reports JSON-safe cluster pressure
  plus buffer reuse.
- The next SOTA efficiency gap is hidden-but-frustum-visible geometry.
  Aperture has frustum culling, but does not yet allocate, resolve, and publish
  renderer-owned GPU occlusion-query visibility feedback like the referenced
  WebGPU pipelines.

Next step: run `task-3121` from `agent/BACKLOG.md`, adding GPU occlusion-query
visibility feedback with a browser-visible occluder proof.

Reference anchors for the next task:

- `references/three.js/src/renderers/common/RenderList.js`.
- `references/three.js/src/renderers/webgpu/WebGPUBackend.js`.
