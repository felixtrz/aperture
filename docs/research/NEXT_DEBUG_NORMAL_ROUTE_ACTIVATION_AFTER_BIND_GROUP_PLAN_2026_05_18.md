# Next DebugNormal Route Activation Plan After Bind Groups

Date: 2026-05-18

## Scope

Plan the next DebugNormalMaterial route activation prerequisite after the
renderer-owned material buffer and group-2 bind group helpers.

## References Inspected

- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_BIND_GROUP_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`
- `packages/webgpu/src/webgpu/debug-normal-bind-group.ts`
- `packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `test/webgpu/matcap-frame-resources.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Candidate Comparison

### DebugNormal Frame Resources

Add a frame-resource helper that uploads or reuses mesh, view, world-transform,
material-buffer, shared bind groups, and debug-normal material bind group
resources.

Why now:

- The source asset, preparation plan, material buffer, and bind group contracts
  now exist.
- App-level routing should not activate until a lower-level frame-resource
  assembly helper is testable in isolation.
- The analogous Unlit and Matcap helpers provide a proven local pattern.

### DebugNormal App Frame Resources

Add app cache/reuse integration for the debug-normal frame helper.

Why defer:

- App reuse should wrap a validated family frame-resource helper rather than
  introduce the family path and app cache behavior in the same step.

### DebugNormal App Route Activation

Add DebugNormalMaterial to active app route resources.

Why defer:

- Route activation still needs app cache/reuse integration and route-summary
  diagnostics before browser rendering is honest.

## Selected Follow-Up

Select the DebugNormal frame resources candidate.

### task-1391 Selection

Category: `webgpu-render`

Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`test/webgpu/debug-normal-frame-resources.test.ts`, and exports only if needed.

Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/matcap-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-frame-resources.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial frame-resource assembly helper that can upload mesh,
  view uniforms, world transforms, material buffer, shared bind groups, and the
  debug-normal group-2 bind group.
- Support prepared mesh and prepared material resources as inputs so app/cache
  integration can reuse renderer-owned resources later.
- Return JSON-safe diagnostics and no resources when required inputs are
  missing.
- Add targeted tests for successful resource assembly and missing required
  input diagnostics.
- Do not activate app-level routing, browser rendering, binary GLB loading, IBL,
  shadows, or GLB viewer behavior.

## Recommendation

Audit this plan next. If it passes, implement the debug-normal frame-resource
helper before adding app cache/reuse integration.
