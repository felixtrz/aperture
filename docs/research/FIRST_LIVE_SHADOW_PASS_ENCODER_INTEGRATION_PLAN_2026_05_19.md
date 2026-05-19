# First Live Shadow Pass Encoder Integration Plan — 2026-05-19

## Context

The GLTF scene path now has JSON-safe shadow-map prerequisites:

- shadow pass plans and live depth attachment descriptors,
- directional shadow matrices and live matrix buffer resources,
- caster draw lists and command-plan metadata,
- depth-only shadow caster pipeline descriptor metadata,
- per-caster frame-resource readiness over prepared mesh buffers.

Actual shadow pass encoder execution, command-buffer submission, and
StandardMaterial shadow sampling are still deferred. The next slice should turn
the existing descriptor/resource surfaces into a live WebGPU pass without making
ECS own GPU state or adding a hidden scene graph.

## Reference Patterns Inspected

- `packages/webgpu/src/webgpu/frame-boundary.ts`
  - Existing forward frame boundary separates current texture/attachment
    planning, command encoder creation, render pass begin/end, command
    execution, command-buffer finish, queue submission, and readback.
- `packages/webgpu/src/webgpu/render-pass-command-executor.ts`
  - Existing command executor consumes prepared `RenderPassCommand` records and
    a pass-like encoder, returning JSON-safe execution counts/diagnostics.
- `packages/webgpu/src/webgpu/render-pass-attachments.ts`
  - Existing attachment planning treats GPU attachment handles as renderer-owned
    inputs and reports stable descriptor status.
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
  - Shadow rendering is a dedicated render pass executed before dependent
    lighting work, with update filtering at the light/face level.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
  - Shadow rendering is a pre-forward pass that sets depth state, targets the
    shadow map, and renders caster geometry with depth-only material variants.

Commonality: mature engines execute shadows as an explicit pre-lighting render
pass over renderer-owned targets. Aperture should keep that shape, but express
it as a JSON-safe, typed WebGPU report over ECS-derived snapshots and prepared
renderer resources.

## Candidate Follow-Ups

### A. Add shadow pass encoder assembly report

Create a shadow-specific assembly helper that begins planned shadow depth
passes, executes already-prepared caster commands against a pass-like encoder,
ends the passes, and reports JSON-safe counts. It should not submit command
buffers yet.

Pros:

- Smallest live step from current descriptors to actual pass encoder work.
- Reuses the existing render-pass lifecycle and command executor boundary.
- Keeps queue submission and StandardMaterial shadow sampling separate and
  reviewable.

Risks:

- Needs a small live pipeline/bind-group bridge for the depth-only caster
  commands if existing command descriptors do not yet carry raw handles.

### B. Add shadow command-buffer finish and queue submission

Extend the shadow path through command-buffer finish and queue submission in the
same slice.

Pros:

- Produces an actual submitted shadow command buffer sooner.
- Mirrors the forward `assembleFrameBoundary` path more completely.

Risks:

- Too much blast radius for the first live shadow pass because attachment,
  pipeline, mesh, matrix bind group, command execution, finish, and submit
  failures would land together.
- Harder to diagnose whether failures are pass assembly or queue submission.

### C. Add StandardMaterial shadow shader sampling

Wire the existing shadow matrix/depth/sampler group into StandardMaterial WGSL
and sample the shadow map in the forward pass.

Pros:

- User-visible result is closer to the final scene milestone.

Risks:

- Premature without a submitted shadow depth pass.
- Couples shader fidelity to pass execution diagnostics and makes failures less
  localized.

## Decision

Select candidate A: add a shadow pass encoder assembly report.

The next implementation should build a narrow `ShadowPassEncoderAssemblyReport`
over the current shadow pass attachment descriptors, frame-resource readiness,
and command-plan/command-encoding records. It should prove that Aperture can
begin/end live shadow render passes and execute caster command records through
the existing pass command executor while keeping command-buffer finish, queue
submission, and shader sampling deferred.

## Proposed Backlog Task

### task-1865 — Add shadow pass encoder assembly report

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor: local `frame-boundary`, `render-pass-lifecycle`,
`render-pass-command-executor`, `shadow-pass-attachment-descriptor`,
`shadow-caster-frame-resource-readiness`, and reference shadow pass execution
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Add a JSON-safe report for beginning planned shadow depth passes, executing
  prepared caster command records against a pass-like encoder, and ending the
  passes.
- Reuse existing render-pass lifecycle and command executor helpers where
  practical.
- Report missing attachment descriptors, frame resources, pass encoder methods,
  or command records with stable diagnostics.
- Keep command-buffer finish, queue submission, and StandardMaterial shadow
  shader sampling deferred.
