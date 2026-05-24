# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3127.

Status: `task-3126` completed production-fidelity RectAreaLight LTC tables.

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
- Renderer-owned occlusion-query feedback now keeps view-local history, skips
  eligible previously hidden opt-in draws on later frames without mutating ECS
  visibility, reports query/culling pressure, and
  `examples/occlusion-feedback.html` proves the worker still authors all ECS
  mesh draws while the renderer submits fewer draw calls.
- Clustered StandardMaterial routes now build local-light cluster descriptors
  per active view/light set, bind the route-matching cluster resource for each
  draw, preserve required render-pass state commands when filtering commands
  per view, and use fixed-capacity cluster index buffers so camera movement
  updates can reuse GPU buffers.
- `examples/clustered-lights.html` now proves two active view/light-set
  cluster routes with distinct view ids, distinct occupancy hashes, per-route
  max/average cell pressure below 64 local lights, six reused cluster buffers,
  and zero WebGPU validation warnings.
- Renderer-owned RectAreaLight LTC matrix/fresnel textures now use production
  RGBA16F table payloads derived from the three.js/selfshadow reference instead
  of placeholder `rgba8unorm` bytes.
- StandardMaterial area-light shading now applies the reference LUT scale/bias,
  builds the LTC inverse matrix/fresnel terms from the sampled tables, evaluates
  rect area lights through the matrix path, and clamps non-finite area-light
  contribution terms so high-roughness table samples cannot poison output.
- `examples/area-light-shapes.html` now proves rect, disk, and sphere area
  lights across glossy, rough, and oblique-view scenarios with bound LTC table
  resource status and zero WebGPU validation warnings.

Next step: run `task-3127` from `agent/BACKLOG.md`, re-auditing Aperture's
covered render pipeline against three.js and PlayCanvas after the occlusion,
multi-view clustered-light, and LTC table slices.

Reference anchors for the next task:

- `references/three.js/src/renderers/WebGLRenderer.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
