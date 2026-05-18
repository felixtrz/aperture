# Next Route Or Standard Follow-Up After Frame-Resource Diagnostic Helper

Date: 2026-05-18

Task: `task-1630`

## Context

`task-1627` extracted app-facing frame-resource route diagnostic construction
into a focused helper while preserving the existing failure-only
`webGpuApp.frameResourceRoute` report shape. Existing app regressions already
assert successful built-in frames omit frame-resource route diagnostics.

The next slice should avoid broad app-level non-built-in material rendering and
pick a concrete proof-point gap.

## Candidates

### Production Route / Prepared-Resource Cleanup

Continue route/prepared-resource cleanup after the diagnostic helper extraction.

Pros:

- The material-route spine remains the current architecture priority.
- Small helper extractions have recently reduced built-in collector coupling.

Cons:

- The remaining obvious route work either duplicates existing success-path
  regression coverage or starts moving toward real app-level non-built-in
  material adapter rendering, which is broader than one safe follow-up.
- Successful built-in frames already assert no default
  `webGpuApp.frameResourceRoute` diagnostics across multiple app tests.

Decision: defer until the next plan can identify a genuinely small route
boundary cleanup.

### StandardMaterial / glTF Fidelity

Add a browser-verifiable glTF fixture proving
`pbrMetallicRoughness.baseColorFactor` tints `baseColorTexture`.

Pros:

- The shader path already multiplies sampled base color by the factor, but the
  glTF browser fixture mostly uses `[1, 1, 1, 1]` for textured base-color
  cases.
- This is a narrow, visual, proof-point-relevant fidelity check.
- It can reuse the existing StandardMaterial glTF texture fixture, status
  reporting, screenshot/readback helpers, and typed material mapping.

Cons:

- It does not reduce route/prepared-resource coupling.
- It adds another browser fixture to an already large E2E file.

Decision: select. The selected route cleanup alternatives are either redundant
or too broad; this StandardMaterial fidelity slice is concrete and
browser-verifiable.

### Diagnostics / Tooling

Write a route diagnostics overview or audit-only follow-up.

Pros:

- Could summarize the now-split route-report, prepare-route, and
  frame-resource diagnostic helpers.

Cons:

- Recent audits already document these boundaries.
- A targeted browser fidelity proof is more useful for the proof point now.

Decision: defer.

## Selected Follow-Up

### task-1632 — Add glTF base-color factor texture tint browser proof

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted status/helper updates in
those files only unless a focused defect is exposed.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-material-buffer.ts`,
`packages/render/src/materials/gltf-material.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario where `baseColorTexture` is multiplied by
  a non-white `baseColorFactor`.
- Publish JSON-safe status for the source factor, mapped factor, texture/sampler
  readiness, resource counts, and selected readback sample.
- Assert screenshot/readback output is closer to the tinted expected color than
  to an untinted texture sample and clear color.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.
- Do not change route traversal, app-level non-built-in rendering, binary GLB
  loading, IBL, shadows, or material-family registration policy.

## Next Step

Run `task-1631` to audit this selected follow-up before implementation.
