# Post-Showcase Material Route Audit — 2026-05-16

## Scope

Audited `createWebGpuApp.render()` after the material showcase moved onto the
app facade and the app route could render unlit, StandardMaterial, and
MatcapMaterial in one frame.

The question for this audit was whether the current specialized app branches
are still a safe bridge for the next StandardMaterial PBR slices, or whether
they are starting to replace the renderer architecture that should become a
generic material queue and phase sorter.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`
- `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

The Bevy commonality is conceptual: source material assets are extracted and
prepared into renderer-owned resources; material pipelines specialize around
material and mesh state; render phase items route draws by prepared pipeline,
mesh, and material data before command encoding.

## Findings

- The current app route is still snapshot-driven. `renderWebGpuAppFrame()` starts
  from `RenderSnapshot.meshDraws`, resolves mesh/material handles through the
  typed source asset registry, and writes a render-frame plan from snapshot data.
  It does not introduce renderer-owned gameplay state or a public mutable scene
  graph.
- GPU resources remain in `@aperture-engine/webgpu`. The app facade prepares
  textures, samplers, material buffers, bind groups, pipelines, and frame
  boundaries after extraction; ECS and renderer-independent packages still own
  only source handles/assets and serializable packets.
- Package-boundary search found no forbidden `@aperture-engine/webgpu` imports
  or browser WebGPU globals in `packages/simulation`, `packages/render`,
  `packages/runtime`, or `retired umbrella package directory`. The only `Scene` search hits in those
  packages are renderer-independent `SceneHandle` asset types.
- Pipeline-scoped bind group routing remains the key safety correction for
  mixed-family app frames. `pipelineScopedBindGroups()` namespaces shared group
  0 and group 1 bind group resource keys with the producing pipeline key and
  also appends that key to `entryResourceKeys`, so the frame planner cannot reuse
  an unlit shared bind group for a StandardMaterial or Matcap pipeline layout.
- Mixed-family material resource-key resolution remains JSON-safe. The app route
  maps source material handle keys to renderer-owned material resource keys and
  reports reuse through numeric counters and stable strings. Existing app report
  JSON helpers omit snapshots, command buffers, descriptors, and raw WebGPU
  handles.
- The current route is intentionally narrow. It has separate collectors and
  render helpers for multi-unlit, unlit+Matcap, Standard+other, and all three
  built-in families. These helpers prove same-pass mixed-family rendering, but
  they are not a generic material-family queue.

## Drift Risk

The specialized branches are acceptable as a bridge through the next
StandardMaterial PBR texture slices because they keep the app facade usable and
visible in browsers. They should not be expanded into a fourth material family,
transparent phase, multi-mesh batching scheme, or GLB material viewer path.

Continuing to add material combinations in `app.ts` would duplicate the role of
a render-world material queue. The next architecture step after the immediate
StandardMaterial texture work should be a generic queue contract that can route
draws by material family, pipeline key, mesh key, material resource key, phase,
and depth without pairwise app branches.

## Result

No package-boundary, hidden-scene-graph, or JSON-safety drift was found. The
current branches remain a safe narrow app-facade bridge, with one explicit
constraint: do not add more mixed-family branch shapes after the planned
StandardMaterial base-color, metallic-roughness, and normal-map texture slices.

## Follow-Ups

- Keep the next PBR tasks focused on StandardMaterial texture support.
- Add a generic material-family render queue contract before activating broader
  GLB material mapping, transparency, or another material family.
- Follow the queue contract with opaque sorting by pipeline/material/mesh/depth,
  then transparent phase sorting and render-state validation.
