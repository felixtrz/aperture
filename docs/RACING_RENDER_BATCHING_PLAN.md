# Racing Render Batching Plan

**Created:** 2026-06-17
**Updated:** 2026-06-18
**Status:** implemented and browser-validated.

This plan captures the frame-time follow-up from the Racing experience audit.
The current symptom is that idle Racing reports far more draw calls than the
asset/material count suggests. The diagnosis is that Aperture already has a
draw-list coalescer, but the render pipeline does not yet arrange compatible
draws so the coalescer can fire reliably.

## Implementation Status

Implemented on 2026-06-18.

- Shadow caster draw records now preserve submesh vertex/index ranges, sort by a
  shared render-phase compatibility key, exclude alpha-blend and alpha-test
  casters from the first depth-only slice, and coalesce baked caster records into
  grouped `drawIndexed(..., instanceCount=N, firstInstance=K)` commands.
- Main-pass opaque rigid draws now use a separate renderer-owned draw-order
  world-transform buffer. Eligible records have their `transformPackedOffset`
  rewritten only after the draw-order buffer and matching group-1 bind groups are
  ready; extraction-order snapshot transforms remain untouched for picking,
  motion-vector history, and transform-slot side buffers.
- The compatibility key is shared by the main-pass draw-order packer and shadow
  caster grouping. It includes resolved pipeline key, material resource/parameter
  identity, mesh/layout/topology, submesh/ranges, layer/receive-shadow state,
  cull state where applicable, bind/buffer identity where applicable, and
  negative-scale winding for main-pass rigid draws.
- Racing managed validation after implementation reported:
  - main packages/descriptors/drawList/resolved:
    `36 / 36 / 14 / 14`;
  - main swapchain draw calls: `12`;
  - extracted shadow caster records: `364`;
  - submitted grouped shadow draw calls: `30`;
  - frame diagnostics: `0`;
  - screenshot proof:
    `/tmp/aperture-racing-batching-validation.png`.
- FPS no-regression validation passed after moving the smoke default off the
  occupied port `5173` and making `fps.state` reads wait for the generated worker
  resource before pausing ECS:
  `smoke:full-clear`, `smoke:mechanics`, and `smoke:skybox-readback`.

## Confirmed Findings

- `spawn.gltfBatch(...)` expands to independent ECS entities. It is an authoring
  convenience, not a render-instancing contract.
- Racing decorations are strong instancing candidates: the empty, forest, and
  tents GLBs each contain one mesh, one primitive, and one material.
- Default Racing decoration counts are `empty: 68`, `forest: 242`, and
  `tents: 14`, for `324` decoration casters.
- Current shadow-caster volume is roughly `364` raw mesh records:
  `324` decorations, `16` track chunks, and `24` vehicle mesh parts.
- The main-pass draw-list coalescer already increments `instanceCount` for
  adjacent compatible records. It misses Racing because sorted records still
  carry extraction-order `transformPackedOffset` values, and the coalescing gate
  requires contiguous transform slots.
- The standard vertex shaders already use `@builtin(instance_index)` to index
  the world-transform storage array, while WebGPU adds `firstInstance`. No WGSL
  change is needed for grouped rigid instances.
- The shadow pass has a separate baked-caster matrix buffer. Main-pass transform
  repacking will not reduce shadow draw calls.

## Reference Anchors

- Bevy binned render phases:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Bevy shadow queue batching:
  `references/bevy/crates/bevy_pbr/src/render/light.rs`.
- Bevy mesh/material opaque queueing:
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- PlayCanvas explicit instancing:
  `references/engine/src/scene/mesh-instance.js`.
- PlayCanvas batch splitting compatibility:
  `references/engine/src/scene/batching/batch-manager.js`.
- Aperture live coalescer:
  `packages/webgpu/src/render/passes/render-pass-draw-list.ts`.
- Aperture live frame-plan route:
  `packages/webgpu/src/render/frame/render-frame-plan.ts`.
- Aperture shadow command planning:
  `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts`.

## Correct Mental Model

The required feature is not "turn on the coalescer." The coalescer already
works for records whose transform offsets are contiguous. The missing feature is
draw-order instance packing:

```text
compatible records after sorting/binning
  -> draw-order matrix buffer or baked shadow matrix buffer
  -> rewritten transformPackedOffset / firstInstance base
  -> existing draw command emits instanceCount > 1
```

The repack is the feature. The coalescer is the consumer.

This must stay a derived render concern. ECS entities, authoring components,
and `RenderSnapshot` data remain the source data. The renderer may build
pass-local packed buffers from the snapshot, but it must not create a hidden
scene graph.

## Sequencing

### 0. Surface Existing Counters First

`RenderFramePlanCounts.draw` already reports packages, descriptors, draw-list
records, and resolved draws. Use those counts in Racing-facing status before
adding heavier diagnostics. The current gap is observable as:

```text
descriptors > drawList
```

when the existing coalescer succeeds, and as:

```text
descriptors == drawList
```

when compatible records fail to become contiguous.

### 1. Shadow Caster Instancing First

Do shadows first. It is the larger Racing win, and the shadow pass owns its
private baked-caster matrix buffer, so it avoids the main pass's picking,
motion-vector, previous-transform, and instance-attribute entanglement.

Implementation shape:

- Thread submesh/index-range information through the shadow caster draw-list,
  readiness, and command-record planning path. The `submesh` field is currently
  present on caster records, but the command path still draws the whole index
  buffer.
- Bin shadow caster records per pass by compatibility:
  - pass key, light, cascade/face
  - pipeline key
  - mesh resource key
  - mesh layout key
  - vertex buffer resource keys
  - index buffer resource key and index format
  - submesh vertex/index range and topology
  - caster cull mode / shadow side
  - layer and caster masks
  - material alpha state, with alpha-blend excluded
- Bake caster matrices in grouped draw order. The first matrix in a group
  becomes the grouped draw's base `transformPackedOffset`; the group size
  becomes `instanceCount`.
- Keep alpha-tested/cutout shadows out of the first slice unless the key also
  includes cutoff texture, sampler, and cutoff value.
- Auto-exclude skinning and morphing in this first slice.

Target Racing effect:

```text
324 decoration shadow caster records -> about 3 grouped shadow draws
16 track caster records -> about 3 grouped shadow draws if ranges match
24 vehicle caster records -> unchanged initially
```

### 2. Main-Pass Draw-Order Transform Packing

Add a separate draw-order world-transform buffer for eligible main-pass draws.
Do not mutate the snapshot's `worldTransforms` buffer in place. The pick pass,
previous-transform history, motion vectors, and transform-slot-indexed side
buffers assume the original extraction-order slots.

Implementation shape:

- Run after opaque package sorting/binning and before draw descriptors are
  consumed by the live draw-list path.
- Build a renderer-owned draw-order transform buffer for eligible packages.
- Rewrite the eligible records' `transformPackedOffset` to the new contiguous
  draw-order offsets.
- Bind the draw-order transform resource only for the pass/records that use the
  rewritten offsets. Keep the original transform resource available for
  unbatched draws and auxiliary passes.
- Let `writeRenderPassDrawList(...)` keep consuming descriptors and emitting
  grouped `instanceCount` records.

Initial eligibility should be conservative:

- opaque only
- rigid only
- no skinning
- no morph targets
- no occlusion query
- no transparent phase
- no alpha-test until cutoff state is in the compatibility key
- no per-instance tint or custom instance attributes
- no transform-slot-indexed side buffers
- same pipeline, material resource, mesh resource, vertex/index buffers,
  submesh ranges, topology, bind groups, and required bind-group layout

Opaque depth-order concerns are not a blocker for this slice. Aperture's opaque
sort is already state-first, with depth later in the key, so this does not
sacrifice a front-to-back policy that is currently providing the draw order.

### 3. Generalize Into Render-Phase Binning

After the shadow and main-pass slices prove the mechanics, fold both paths into
a Bevy-style binned render-phase model instead of keeping bespoke batching code
per pass.

The compatibility model should incorporate PlayCanvas-style split dimensions
where Aperture has equivalent state:

- per-draw material parameters or uniform overrides
- light masks and receive-shadow state, unless fully encoded in the pipeline key
- negative-scale winding/culling implications
- culling granularity and group bounds
- pipeline-determined state folded into stable pipeline keys
- material bind group identity
- mesh buffer identity and draw ranges

One large forest draw can harm per-instance frustum culling. Track this as a
miss/subgroup reason and prefer bounded grid-cell groups when needed.

## Non-Goals For The First Fix

- Do not batch different meshes with the same material into one instanced draw.
  Render-phase sorting can reduce state churn there, but one draw call requires
  static mesh merging, multi-draw indirect, or a later GPU-driven path.
- Do not add shader changes for rigid StandardMaterial or UnlitMaterial
  instancing. `firstInstance + instance_index` already selects distinct
  transform matrices.
- Do not couple this work to a shadow baked-matrix resource leak fix. The current
  shadow baked matrix buffer path caches, reuses, writes, destroys on size
  mismatch, and invalidates the bind group tied to the old buffer identity.
- Do not use `render-queue-batching.ts` for the live app frame path without first
  proving it is invoked by `render-frame-plan.ts`. The active route reaches
  `render-pass-draw-list.ts`.

## Validation

Add focused unit coverage before browser validation:

- Shadow records with the same pass, mesh, range, pipeline, and material alpha
  state become one command record with `instanceCount = N`.
- Shadow records with different pass keys, ranges, cull modes, pipelines, or
  alpha state do not merge.
- Main-pass shuffled compatible opaque packages produce a draw-order transform
  buffer and one draw-list record with `instanceCount = N`.
- Main-pass transparent, alpha-test, skinned, morphed, occlusion-query,
  instance-tint, and custom-instance-attribute records stay unbatched.
- Existing `firstInstance` tests continue to prove matrix selection without WGSL
  changes.

Then validate Racing through the managed app route and record:

- main packages/descriptors/drawList/resolved counts
- shadow caster raw records versus grouped command records
- total draw calls before/after
- frame diagnostics
- a screenshot or pixel smoke confirming visual output is unchanged
