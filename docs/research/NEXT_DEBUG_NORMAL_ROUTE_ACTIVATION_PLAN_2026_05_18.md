# Next DebugNormal Route Activation Plan

Date: 2026-05-18

## Scope

Plan the next DebugNormalMaterial route activation prerequisite after the
renderer-owned material buffer helper.

## References Inspected

- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_BUFFER_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `test/webgpu/unlit-bind-group.test.ts`
- `test/webgpu/matcap-bind-group.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Candidate Comparison

### DebugNormal Bind Group Resources

Add group-2 bind group layout metadata, descriptor planning, resource creation,
and JSON-safe inspection for DebugNormalMaterial.

Why now:

- The shader already declares group 2 binding 0 as a debug-normal material
  uniform buffer.
- The material buffer helper now creates the renderer-owned resource that the
  bind group will reference.
- Bind group resources are the next dependency before any frame-resource helper
  or app route adapter can be safe.

Expected scope:

- `packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/debug-normal-bind-group.ts`
- `test/webgpu/debug-normal-bind-group.test.ts`
- exports only if needed.

### DebugNormal Frame Resources

Add a full frame-resource helper.

Why defer:

- Frame resources need the material bind group contract first.
- Starting with frame resources would either duplicate bind group planning
  inline or hide an incomplete dependency.

### DebugNormal Route Adapter Activation

Add `debug-normal` to the built-in app route table.

Why defer:

- Active routing should wait until material buffer, bind group, and frame
  resources exist and are tested.
- Current unsupported-family diagnostics are still correct.

## Selected Follow-Up

Select the DebugNormal bind group resources candidate.

### task-1386 Selection

Category: `webgpu-render`

Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`test/webgpu/debug-normal-bind-group.test.ts`, and exports only if needed.

Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group.ts`, and
`references/three.js/src/renderers/common/Bindings.js`.

Acceptance criteria:

- Add DebugNormalMaterial group-2 bind group layout metadata/plan for binding 0
  material uniform buffer.
- Add descriptor/resource helpers that consume a material buffer resource key
  and renderer-owned buffer resource.
- Add JSON-safe inspection for successful bind group resources that omits raw
  bind group handles.
- Add targeted tests for descriptor planning, resource creation, JSON safety,
  and missing material/layout/device diagnostics.
- Do not activate app-level DebugNormalMaterial routing, frame resources,
  browser rendering, binary GLB loading, IBL, shadows, or GLB viewer behavior.

## Recommendation

Audit this plan next. If it passes, implement the debug-normal group-2 bind
group resources as the next focused prerequisite.
