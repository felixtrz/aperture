# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3120.

Status: `task-3119` completed the post-environment parity audit.

Key finding:

- The post-Tier-20 submit-efficiency blockers are closed for the covered main
  forward path: redundant state commands are elided, static command plans can
  reuse WebGPU render bundles, compatible grouped draws can use indirect
  argument buffers, opaque/alpha-test queue ordering groups prepared resource
  state, queued built-in bind groups are reused, TAA has previous per-object
  transform history, bloom has a downsample/upsample graph, and multiple
  environment-map handles can prepare versioned diffuse/specular IBL resources.
- The next SOTA efficiency gap is many-light local-light shading. Aperture's
  StandardMaterial shader still loops over every packed light for every
  fragment, while PlayCanvas prepares clustered local-light data per
  view/light-set and shades only the lights assigned to the fragment's cluster.

Next step: run `task-3120` from `agent/BACKLOG.md`, adding renderer-owned
clustered local-light preparation for StandardMaterial with a many-light browser
proof.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/renderer/world-clusters-allocator.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLight.js`.
- `references/three.js/examples/jsm/lighting/ClusteredLighting.js`.
