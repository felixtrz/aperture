# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3122.

Status: `task-3121` completed GPU occlusion-query visibility feedback.

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
- ECS mesh draws can now opt into renderer-owned WebGPU occlusion queries via
  `withOcclusionQuery()`, extraction/snapshot transport preserves that opt-in,
  the WebGPU app allocates query sets, wraps queried draws, resolves/copies
  results, and reports visible versus occluded render IDs without exposing live
  GPU objects.
- `examples/occlusion-feedback.html` proves one hidden-but-frustum-visible
  queried cube with zero samples and one visible queried cube with non-zero
  samples, while keeping the worker/main snapshot boundary intact.
- The next SOTA efficiency gap is multi-material primitive/group queueing.
  Aperture can render many material entities, but a single source mesh still
  needs first-class primitive/group ranges that produce distinct queue records
  and material-route diagnostics without introducing a scene graph.

Next step: run `task-3122` from `agent/BACKLOG.md`, rendering multi-material
primitive groups through queue records with a browser-visible proof.

Reference anchors for the next task:

- `references/three.js/src/renderers/common/Renderer.js`.
- `references/engine/src/framework/parsers/glb-parser.js`.
- `references/engine/src/scene/mesh-instance.js`.
