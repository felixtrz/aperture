# Next Route Or Standard Follow-Up After Route Shell Coverage

Date: 2026-05-18

Task: `task-1666`

## Context

The generic route spine now has registry validation and test-only
prepared-resource route shell coverage for non-built-in families. App-level
non-built-in material rendering remains deferred because public custom material
source authoring still needs a separate decision.

## Candidates

### Route / Prepared-Resource Candidate

Start app-owned non-built-in adapter registration policy.

Pros:

- It is the next ordered decomposition slice after generic route metadata.
- It would move closer to real non-built-in material-family routing.

Cons:

- It risks turning internal route-family flexibility into a public custom
  material API without a decision record.
- It would likely touch `createWebGpuApp()` policy, app diagnostics, cache
  ownership, and registration lifecycle in one slice.

Decision: defer until a separate decision/planning task narrows the public API.

### StandardMaterial / glTF Fidelity Candidate

Add a focused shader contract regression proving metallic-roughness texture
channels multiply the scalar `metallicFactor` and `roughnessFactor`.

Pros:

- This is a narrow StandardMaterial fidelity guard for glTF metallic-roughness
  behavior.
- The WGSL already has a texture variant and direct scalar factors; a focused
  shader test can lock the contract without adding browser fixture weight.
- It complements existing browser coverage for mapped metallic-roughness
  textures and existing buffer coverage for scalar factors.

Cons:

- It is not a visual/browser proof.
- It does not advance non-built-in app adapter registration.

Decision: select.

### Diagnostics / Tooling Candidate

Add a public docs page for route diagnostics layers.

Pros:

- Helpful for agent-facing diagnosis.

Cons:

- The diagnostics map remains research-level and may change with the next app
  registration decision.

Decision: defer.

## Selected Follow-Up

### task-1668 — Add metallic-roughness factor texture shader contract regression

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/standard-shader.test.ts`; implementation files only if the
regression exposes a focused defect.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`test/webgpu/standard-shader.test.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Assert the metallic-roughness texture WGSL multiplies texture blue by
  `material.metallicFactor`.
- Assert the metallic-roughness texture WGSL multiplies texture green by
  `material.roughnessFactor`.
- Keep this as shader contract coverage only: no examples, browser fixtures,
  app routing, custom material APIs, IBL, or shadows.

## Next Step

Run `task-1667` to audit this selected follow-up plan before implementation.
